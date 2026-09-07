import { DocumentError, type DocumentImageModel } from "./medicalDocuments";

const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

async function readProviderResult(response: Response) {
  if (!response.body) throw new DocumentError(502, "document_extraction_failed", "The image provider returned no response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new DocumentError(502, "document_extraction_incomplete", "The image provider response exceeded its limit");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } finally { reader.releaseLock(); }
}

/** Reuse the app's configured provider; absence of a key leaves Workers AI as the OCR provider. */
export function createDocumentImageModel(apiKey: string, model: string): DocumentImageModel | undefined {
  if (!apiKey.trim()) return undefined;
  return async (prompt, imageDataUrl, timeoutMs) => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          { role: "developer", content: prompt },
          { role: "user", content: [{ type: "input_image", image_url: imageDataUrl, detail: "high" }] },
        ],
        max_output_tokens: 24_000,
        reasoning: { effort: "low" },
        store: false,
        text: { verbosity: "low" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new DocumentError(502, "document_extraction_failed", "The image provider is unavailable");
    }
    const output = await readProviderResult(response);
    if (!output || typeof output !== "object" || !("status" in output) || output.status !== "completed" || !("output" in output) || !Array.isArray(output.output)) {
      throw new DocumentError(502, "document_extraction_incomplete", "The image provider did not complete recognition");
    }
    const text: string[] = [];
    for (const item of output.output) {
      if (!item || typeof item !== "object" || item.type !== "message" || item.role !== "assistant" || item.status !== "completed" || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content && typeof content === "object" && content.type === "output_text" && typeof content.text === "string") text.push(content.text);
      }
    }
    if (!text.length) throw new DocumentError(502, "document_extraction_incomplete", "The image provider returned no transcription");
    return text.join("\n");
  };
}

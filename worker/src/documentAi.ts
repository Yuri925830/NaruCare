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

/** Images and scanned PDFs use the provider named in the user's processing consent. */
export function createDocumentImageModel(apiKey: string, model: string): DocumentImageModel {
  return async (prompt, imageDataUrl, timeoutMs) => {
    if (!apiKey.trim()) throw new DocumentError(503, "document_ai_unavailable", "OpenAI document reading is not configured");
    const content = imageDataUrl.startsWith("data:application/pdf;")
      ? { type: "input_file", filename: "document.pdf", file_data: imageDataUrl, detail: "high" }
      : { type: "input_image", image_url: imageDataUrl, detail: "high" };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          { role: "developer", content: prompt },
          { role: "user", content: [content] },
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

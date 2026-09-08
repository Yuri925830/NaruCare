import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocumentImageModel } from "./documentAi";

afterEach(() => vi.unstubAllGlobals());

const responseBody = (text = "Dose 12.5 mg\n[END_OCR_test]", status = "completed") => ({
  status,
  output: [{ type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text }] }],
});

describe("configured document image provider", () => {
  it("reports a missing key without sending to another provider", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(createDocumentImageModel("  ", "configured-model")("OCR", "data:image/png;base64,AAAA", 35_000)).rejects.toMatchObject({ code: "document_ai_unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends scanned PDFs as high-detail file inputs without response storage", async () => {
    const fetch = vi.fn(async () => Response.json(responseBody()));
    vi.stubGlobal("fetch", fetch);
    await createDocumentImageModel("test-key", "configured-model")("OCR", "data:application/pdf;base64,AAAA", 60_000);
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toMatchObject({ store: false, input: [{ role: "developer" }, { content: [{ type: "input_file", file_data: "data:application/pdf;base64,AAAA", detail: "high" }] }] });
  });

  it("uses the configured model, high-detail image input and low reasoning without storing the image", async () => {
    const fetch = vi.fn(async () => Response.json(responseBody()));
    vi.stubGlobal("fetch", fetch);
    const result = await createDocumentImageModel("test-key", "configured-model")!("Verbatim OCR prompt", "data:image/png;base64,AAAA", 35_000);
    expect(result).toBe("Dose 12.5 mg\n[END_OCR_test]");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "configured-model", store: false, reasoning: { effort: "low" },
      input: [{ role: "developer", content: "Verbatim OCR prompt" }, { role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "high" }] }],
    });
  });

  it.each(["incomplete", "failed", "in_progress", "cancelled"])("rejects %s output even if its text has a completion marker", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(responseBody(undefined, status))));
    await expect(createDocumentImageModel("test-key", "configured-model")!("prompt", "data:image/png;base64,AAAA", 35_000)).rejects.toMatchObject({ code: "document_extraction_incomplete" });
  });

  it("rejects empty output and refusal instead of accepting a fake transcription", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "completed", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "Unavailable" }] }] })));
    await expect(createDocumentImageModel("test-key", "configured-model")!("prompt", "data:image/png;base64,AAAA", 35_000)).rejects.toMatchObject({ code: "document_extraction_incomplete" });
  });

  it("bounds the response body and cancels a provider response that is too large", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel }))));
    await expect(createDocumentImageModel("test-key", "configured-model")!("prompt", "data:image/png;base64,AAAA", 35_000)).rejects.toMatchObject({ code: "document_extraction_incomplete" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("reports a provider error without exposing provider response details or credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("private provider details", { status: 401 })));
    await expect(createDocumentImageModel("test-key", "configured-model")!("prompt", "data:image/png;base64,AAAA", 35_000)).rejects.toThrow("The image provider is unavailable");
  });
});

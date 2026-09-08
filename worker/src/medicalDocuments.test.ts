import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDocumentOcrPrompt,
  extractMedicalDocumentText,
  handleMedicalDocumentRequest,
  readBoundedDocumentBody,
  splitMedicalDocumentText,
  translateMedicalDocumentText,
  validateMedicalDocumentFile,
  type DocumentTextModel,
  type DocumentImageModel,
} from "./medicalDocuments";
import worker from "./index";
import { MAX_MEDICAL_DOCUMENT_BYTES, MAX_MEDICAL_DOCUMENT_TEXT } from "../../src/medicalDocuments";

const databases: DatabaseSync[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

function harness() {
  const sqlite = new DatabaseSync(":memory:");
  databases.push(sqlite);
  sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('alice'),('bob'); CREATE TABLE sessions (token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT)");
  sqlite.exec(readFileSync(new NodeURL("../migrations/0008_medical_documents.sql", import.meta.url), "utf8"));
  const objects = new Map<string, Uint8Array>();
  const prepare = vi.fn((sql: string) => {
    let bindings: SQLInputValue[] = [];
    const statement = {
      bind(...values: SQLInputValue[]) { bindings = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...bindings) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...bindings), success: true, meta: {} }; },
      async run() { const result = sqlite.prepare(sql).run(...bindings); return { success: true, meta: { changes: Number(result.changes) } }; },
    };
    return statement;
  });
  const put = vi.fn(async (key: string, bytes: Uint8Array) => { objects.set(key, bytes); });
  const get = vi.fn(async (key: string) => objects.has(key) ? { body: new Blob([Uint8Array.from(objects.get(key)!)]).stream() } : null);
  const remove = vi.fn(async (key: string) => { objects.delete(key); });
  const aiRun = vi.fn();
  const toMarkdown = vi.fn();
  const env = {
    ALLOWED_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
    ALLOW_GITHUB_PAGES: "true",
    AI_MODEL: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  } as Env;
  Object.assign(env, { DB: { prepare }, RECORDINGS: { put, get, delete: remove }, AI: { run: aiRun, toMarkdown } });
  const generate = vi.fn<DocumentTextModel>(async (messages) => {
    const marker = messages[0].content.match(/\[END_TRANSLATION_[\w-]+\]/)![0];
    return `${messages[1].content}\n${marker}`;
  });
  const request = (path: string, userId = "alice", init?: RequestInit) => handleMedicalDocumentRequest(new Request(`https://example.test/api/documents${path}`, init), env, userId, generate);
  async function upload(text = "복용량 10 mg, 하루 2회. No known allergies.", userId = "alice", saveToHistory = true) {
    const form = new FormData();
    form.set("file", new File([text], "검사 결과.txt", { type: "text/plain" }));
    form.set("sourceLanguage", "auto");
    form.set("targetLanguage", "en");
    form.set("processingConsent", "true");
    if (saveToHistory) form.set("saveToHistory", "true");
    const response = await request("", userId, { method: "POST", body: form });
    return response.json() as Promise<{ id: string; sourceText: string; status: string; stored: boolean }>;
  }
  return { env, sqlite, objects, prepare, put, get, remove, aiRun, toMarkdown, generate, request, upload };
}

describe("medical document validation", () => {
  it.each([
    ["scan.pdf", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ["photo.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["camera.jpeg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
  ])("checks the signature for %s", (name, type, signature) => {
    const bytes = Uint8Array.from(signature);
    expect(validateMedicalDocumentFile({ name, type, size: bytes.length }, bytes)).toBe(type);
    expect(() => validateMedicalDocumentFile({ name, type, size: 4 }, new TextEncoder().encode("fake"))).toThrow("contents do not match");
  });

  it("rejects oversized files, binary text and invalid UTF-8", () => {
    expect(() => validateMedicalDocumentFile({ name: "large.pdf", type: "application/pdf", size: MAX_MEDICAL_DOCUMENT_BYTES + 1 }, new Uint8Array())).toThrow();
    expect(() => validateMedicalDocumentFile({ name: "a.txt", type: "text/plain", size: 1 }, Uint8Array.of(0xff))).toThrow("UTF-8");
    expect(() => validateMedicalDocumentFile({ name: "a.txt", type: "text/plain", size: 1 }, Uint8Array.of(0))).toThrow("binary");
  });

  it("bounds streamed bodies even without Content-Length and cancels the reader", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(9)); }, cancel });
    const request = new Request("https://example.test", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(readBoundedDocumentBody(request, 8)).rejects.toMatchObject({ status: 413, code: "document_too_large" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("document extraction and translation", () => {
  it("prefers the configured image provider without a second OCR call", async () => {
    const h = harness();
    const imageModel = vi.fn<DocumentImageModel>(async (prompt) => `검사 12.5 mg\n${prompt.match(/\[END_OCR_[\w-]+\]/)![0]}`);
    await expect(extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff), imageModel)).resolves.toBe("검사 12.5 mg");
    expect(imageModel).toHaveBeenCalledWith(expect.stringContaining("never guess"), "data:image/jpeg;base64,/w==", 35_000);
    expect(h.aiRun).not.toHaveBeenCalled();
  });

  it.each(["provider_failure", "incomplete_result"])("does not resend documents to another provider on %s", async (failure) => {
    const h = harness();
    const imageModel = vi.fn<DocumentImageModel>(async () => {
      if (failure === "provider_failure") throw new Error("provider failure");
      return "partial transcription";
    });
    await expect(extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff), imageModel)).rejects.toMatchObject({ code: failure === "provider_failure" ? "document_extraction_failed" : "document_extraction_incomplete" });
    expect(imageModel).toHaveBeenCalledOnce();
    expect(h.aiRun).not.toHaveBeenCalled();
    expect(h.toMarkdown).not.toHaveBeenCalled();
  });

  it("sends scanned PDFs to the consented provider without a second extraction", async () => {
    const h = harness();
    const imageModel = vi.fn<DocumentImageModel>(async (prompt) => `Dose 10 mg\n${prompt.match(/\[END_OCR_[\w-]+\]/)![0]}`);
    await expect(extractMedicalDocumentText(h.env, "scan.pdf", "application/pdf", Uint8Array.of(0x25), imageModel)).resolves.toBe("Dose 10 mg");
    expect(imageModel).toHaveBeenCalledWith(expect.any(String), "data:application/pdf;base64,JQ==", 60_000);
    expect(h.toMarkdown).not.toHaveBeenCalled();
    expect(h.aiRun).not.toHaveBeenCalled();
  });

  it("does not rerun OCR for complete empty or overlong transcriptions", async () => {
    const h = harness();
    const imageModel: DocumentImageModel = async (prompt) => prompt.match(/\[END_OCR_[\w-]+\]/)![0];
    await expect(extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff), imageModel)).rejects.toMatchObject({ code: "document_text_empty" });
    await expect(extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff), async (prompt) => `${"x".repeat(MAX_MEDICAL_DOCUMENT_TEXT + 1)}\n${prompt.match(/\[END_OCR_[\w-]+\]/)![0]}`)).rejects.toMatchObject({ code: "document_text_too_long" });
    expect(h.aiRun).not.toHaveBeenCalled();
  });

  it("times out OCR without sending the document to a fallback provider", async () => {
    const h = harness();
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const imageModel = vi.fn<DocumentImageModel>(() => new Promise(() => {}));
    h.aiRun.mockImplementation(() => new Promise(() => {}));
    try {
      const result = extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff), imageModel);
      const rejection = expect(result).rejects.toMatchObject({ status: 504, code: "document_extraction_failed" });
      await vi.advanceTimersByTimeAsync(35_000);
      expect(imageModel).toHaveBeenCalledOnce();
      await rejection;
      expect(h.aiRun).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); vi.restoreAllMocks(); }
  });

  it("uses verbatim OCR for photos and rejects interrupted OCR", async () => {
    const h = harness();
    h.aiRun.mockImplementation(async (_model, input) => {
      const marker = input.messages[0].content.match(/\[END_OCR_[\w-]+\]/)[0];
      return { choices: [{ finish_reason: "stop", message: { content: `검사 결과: 12.5 mg\n${marker}` } }] };
    });
    await expect(extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff, 0xd8, 0xff))).resolves.toBe("검사 결과: 12.5 mg");
    expect(h.toMarkdown).not.toHaveBeenCalled();
    expect(h.aiRun.mock.calls[0][1].messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    const prompt = buildDocumentOcrPrompt("END");
    expect(prompt).toContain("not a summary");
    expect(prompt).toContain("never guess");
    h.aiRun.mockResolvedValue({ choices: [{ finish_reason: "length", message: { content: "partial result" } }] });
    await expect(extractMedicalDocumentText(h.env, "camera.jpg", "image/jpeg", Uint8Array.of(0xff))).rejects.toMatchObject({ code: "document_extraction_incomplete" });
  });

  it("rejects empty scanned PDF extraction and provider errors explicitly", async () => {
    const h = harness();
    h.toMarkdown.mockResolvedValue({ format: "markdown", data: " \n " });
    await expect(extractMedicalDocumentText(h.env, "scan.pdf", "application/pdf", new Uint8Array())).rejects.toMatchObject({ code: "document_text_empty" });
    expect(h.toMarkdown.mock.calls[0][1].conversionOptions.pdf).toEqual({ metadata: false, images: { convert: false } });
    h.toMarkdown.mockRejectedValue(new Error("provider failed"));
    await expect(extractMedicalDocumentText(h.env, "scan.pdf", "application/pdf", new Uint8Array())).rejects.toMatchObject({ code: "document_extraction_failed" });
  });

  it("preserves every source character and numeric detail through all chunks", async () => {
    const h = harness();
    const text = ` ${"처방 10.5 mg, 하루 2회. 검사 2026-09-07. 😀\n".repeat(220)} final 12345.67`;
    const chunks = splitMedicalDocumentText(text);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
    expect(chunks.join("")).toBe(text);
    const translated = await translateMedicalDocumentText(text, "ko", "en", h.generate);
    expect(h.generate.mock.calls.map(([messages]) => messages[1].content).join("")).toBe(text);
    expect(translated).toContain("final 12345.67");
    expect(translated.match(/10.5 mg/g)?.length).toBe(220);
  });

  it("rejects missing completion markers, changed doses and overlong sources", async () => {
    await expect(translateMedicalDocumentText("Take 10 mg", "en", "ko", async () => "10 mg")).rejects.toMatchObject({ code: "document_translation_incomplete" });
    await expect(translateMedicalDocumentText("Take 10 mg", "en", "ko", async (messages) => `20 mg\n${messages[0].content.match(/\[END_TRANSLATION_[\w-]+\]/)![0]}`)).rejects.toMatchObject({ code: "document_translation_incomplete" });
    const generate = vi.fn();
    await expect(translateMedicalDocumentText("x".repeat(MAX_MEDICAL_DOCUMENT_TEXT + 1), "en", "ko", generate)).rejects.toMatchObject({ code: "document_text_too_long" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("limits translation concurrency and stops at the shared deadline", async () => {
    vi.useFakeTimers();
    try {
      const text = `${"x".repeat(1000)} `.repeat(19);
      let active = 0;
      let maximumActive = 0;
      const generate = vi.fn<DocumentTextModel>(async (messages) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 59_000));
        active -= 1;
        return `${messages[1].content}\n${messages[0].content.match(/\[END_TRANSLATION_[\w-]+\]/)![0]}`;
      });
      const result = translateMedicalDocumentText(text, "ko", "en", generate);
      const rejection = expect(result).rejects.toMatchObject({ status: 504, code: "document_translation_failed" });
      await vi.advanceTimersByTimeAsync(240_001);
      await rejection;
      expect(maximumActive).toBe(3);
      const callsAtDeadline = generate.mock.calls.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(generate).toHaveBeenCalledTimes(callsAtDeadline);
    } finally { vi.useRealTimers(); }
  });
});

describe("private document lifecycle", () => {
  it.each([undefined, "false", "yes", "1"])("requires explicit upload consent before extraction or storage: %s", async (consent) => {
    const h = harness();
    const form = new FormData();
    form.set("file", new File([Uint8Array.of(0xff, 0xd8, 0xff)], "photo.jpg", { type: "image/jpeg" }));
    form.set("targetLanguage", "en");
    form.set("saveToHistory", "true");
    if (consent !== undefined) form.set("processingConsent", consent);
    await expect(h.request("", "alice", { method: "POST", body: form })).rejects.toMatchObject({ status: 400, code: "document_consent_required" });
    expect(h.aiRun).not.toHaveBeenCalled();
    expect(h.put).not.toHaveBeenCalled();
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it("keeps upload and translation stateless unless saving is explicitly selected", async () => {
    const h = harness();
    const uploaded = await h.upload("Dose 10 mg", "alice", false);
    expect(uploaded).toMatchObject({ stored: false, id: expect.stringMatching(/^temporary-/) });
    const input = { sourceText: uploaded.sourceText, sourceLanguage: "en", targetLanguage: "ko", processingConsent: true };
    const translated = await h.request(`/${uploaded.id}/translate`, "alice", { method: "POST", body: JSON.stringify(input) });
    expect(await translated.json()).toMatchObject({ stored: false, translatedText: "Dose 10 mg", status: "translated" });
    expect(h.generate).toHaveBeenCalledOnce();
    expect(h.put).not.toHaveBeenCalled();
    expect(h.prepare).not.toHaveBeenCalled();
    await expect(h.request(`/${uploaded.id}`)).rejects.toMatchObject({ status: 404 });
    expect(h.objects.size).toBe(0);
  });

  it("rejects translation after consent is withdrawn", async () => {
    const h = harness();
    const uploaded = await h.upload("Dose 10 mg", "alice", false);
    await expect(h.request(`/${uploaded.id}/translate`, "alice", { method: "POST", body: JSON.stringify({ sourceText: uploaded.sourceText, sourceLanguage: "en", targetLanguage: "ko", processingConsent: false }) })).rejects.toMatchObject({ code: "document_consent_required" });
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it("reuses only the owner's unchanged completed translation and regenerates edits", async () => {
    const h = harness();
    const uploaded = await h.upload();
    const input = { sourceText: "Dose 15 mg", sourceLanguage: "en", targetLanguage: "ko", processingConsent: true };
    const translate = (body: typeof input, userId = "alice") => h.request(`/${uploaded.id}/translate`, userId, { method: "POST", body: JSON.stringify(body) });
    const first = await (await translate(input)).json();
    h.generate.mockClear();
    expect(await (await translate(input)).json()).toEqual(first);
    expect(h.generate).not.toHaveBeenCalled();
    await expect(translate(input, "bob")).rejects.toMatchObject({ status: 404 });
    expect(h.generate).not.toHaveBeenCalled();
    await translate({ ...input, sourceText: "Dose 20 mg" });
    expect(h.generate).toHaveBeenCalledOnce();
    h.generate.mockClear();
    await translate({ ...input, sourceText: "Dose 20 mg", targetLanguage: "ja" });
    expect(h.generate).toHaveBeenCalledOnce();
    h.generate.mockClear();
    await translate({ ...input, sourceText: "Dose 20 mg", sourceLanguage: "auto", targetLanguage: "ja" });
    expect(h.generate).toHaveBeenCalledOnce();
  });

  it("requires sign-in at the API boundary", async () => {
    const h = harness();
    const tasks: Promise<unknown>[] = [];
    const ctx = { waitUntil(task: Promise<unknown>) { tasks.push(task); } } as ExecutionContext;
    const response = await worker.fetch(new Request<unknown, IncomingRequestCfProperties>("https://example.test/api/documents"), h.env, ctx);
    expect(response.status).toBe(401);
    await Promise.all(tasks);
  });

  it("uploads, edits for translation, lists without full medical text, downloads and deletes", async () => {
    const h = harness();
    const uploaded = await h.upload();
    expect(uploaded.status).toBe("uploaded");
    expect(h.objects.size).toBe(1);
    expect([...h.objects.keys()][0]).toBe(`medical-documents/alice/${uploaded.id}/original`);
    const translated = await h.request(`/${uploaded.id}/translate`, "alice", { method: "POST", body: JSON.stringify({ sourceText: "Corrected dose: 15 mg", sourceLanguage: "en", targetLanguage: "ko", processingConsent: true }) });
    expect(await translated.json()).toMatchObject({ status: "translated", sourceText: "Corrected dose: 15 mg", translatedText: "Corrected dose: 15 mg" });
    const list = await (await h.request("")).json<{ documents: Record<string, unknown>[] }>();
    expect(list.documents).toHaveLength(1);
    expect(list.documents[0]).not.toHaveProperty("sourceText");
    const original = await h.request(`/${uploaded.id}/file`);
    expect(original.headers.get("content-disposition")).toContain("attachment;");
    expect(original.headers.get("cache-control")).toContain("no-store");
    expect(await original.text()).toBe(uploaded.sourceText);
    await h.request(`/${uploaded.id}`, "alice", { method: "DELETE" });
    expect(h.objects.size).toBe(0);
    await expect(h.request(`/${uploaded.id}`)).rejects.toMatchObject({ status: 404 });
  });

  it("prevents another user reading, translating, downloading or deleting a document", async () => {
    const h = harness();
    const uploaded = await h.upload();
    for (const [suffix, method] of [["", "GET"], ["/translate", "POST"], ["/file", "GET"], ["", "DELETE"]]) {
      await expect(h.request(`/${uploaded.id}${suffix}`, "bob", { method })).rejects.toMatchObject({ status: 404, code: "document_not_found" });
    }
    expect(await (await h.request("", "bob")).json()).toEqual({ documents: [] });
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("does not save a partial translation if a later provider call fails", async () => {
    const h = harness();
    const uploaded = await h.upload("Dose 10 mg.\n".repeat(400));
    h.generate.mockImplementationOnce(h.generate.getMockImplementation()!).mockRejectedValueOnce(new Error("outage"));
    await expect(h.request(`/${uploaded.id}/translate`, "alice", { method: "POST", body: JSON.stringify({ sourceText: uploaded.sourceText, sourceLanguage: "ko", targetLanguage: "en", processingConsent: true }) })).rejects.toMatchObject({ code: "document_translation_failed" });
    expect(await (await h.request(`/${uploaded.id}`)).json()).toMatchObject({ status: "uploaded", translatedText: "", sourceText: uploaded.sourceText });
  });

  it("removes the stored original if the database insert fails", async () => {
    const h = harness();
    h.sqlite.exec("CREATE TRIGGER reject_document_insert BEFORE INSERT ON medical_documents BEGIN SELECT RAISE(ABORT,'simulated write failure'); END");
    await expect(h.upload()).rejects.toThrow("simulated write failure");
    expect(h.objects.size).toBe(0);
    expect(h.remove).toHaveBeenCalledOnce();
  });
});

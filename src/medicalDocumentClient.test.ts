import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { MAX_MEDICAL_DOCUMENT_BYTES, medicalDocumentFileError, type MedicalDocument } from "./medicalDocuments";

const document: MedicalDocument = {
  id: "medical-document-1",
  name: "prescription.pdf",
  mimeType: "application/pdf",
  size: 20,
  sourceLanguage: "ko",
  targetLanguage: "zh-CN",
  status: "uploaded",
  sourceText: "약 1정, 하루 2회",
  translatedText: "",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const fetchMock = vi.fn<typeof fetch>();
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
};

function pdf() {
  return new File(["%PDF-1.7\nmedical prescription"], "prescription.pdf", { type: "application/pdf" });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  storage.clear();
  storage.set("narucare-session", "private-session-token");
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("medical document uploads", () => {
  it("never transmits a file or text without explicit consent", async () => {
    await expect(api.uploadDocument(pdf(), "ko", "en")).rejects.toMatchObject({ code: "document_consent_required" });
    await expect(api.uploadDocument(pdf(), "ko", "en", { processingConsent: false })).rejects.toMatchObject({ code: "document_consent_required" });
    await expect(api.translateDocument(document.id, { sourceText: "private text", sourceLanguage: "en", targetLanguage: "ko" })).rejects.toMatchObject({ code: "document_consent_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uploads the original bytes and languages as authenticated multipart data with an automatic boundary", async () => {
    fetchMock.mockResolvedValue(jsonResponse(document));
    const original = pdf();

    await expect(api.uploadDocument(original, "ko", "zh-CN", { processingConsent: true })).resolves.toEqual(document);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/documents$/);
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer private-session-token");
    expect(headers.has("content-type")).toBe(false);
    expect(init?.body).toBeInstanceOf(FormData);
    const form = init?.body as FormData;
    const uploaded = form.get("file") as File;
    expect(uploaded.name).toBe(original.name);
    expect(uploaded.type).toBe(original.type);
    expect(await uploaded.arrayBuffer()).toEqual(await original.arrayBuffer());
    expect(form.get("sourceLanguage")).toBe("ko");
    expect(form.get("targetLanguage")).toBe("zh-CN");
    expect(form.get("processingConsent")).toBe("true");
    expect(form.get("saveToHistory")).toBe("false");

    const browserRequest = new Request("https://narucare.test/api/documents", init);
    expect(browserRequest.headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=.+/);
  });

  it.each([
    ["report.pdf", "application/pdf"],
    ["photo.jpg", "image/jpeg"],
    ["photo.JPEG", "image/jpeg"],
    ["photo.png", "image/png"],
    ["report.txt", "text/plain"],
    ["report.pdf", ""],
    ["photo.jpg", "application/octet-stream"],
  ])("accepts a supported file selected as %s (%s)", async (name, type) => {
    fetchMock.mockResolvedValue(jsonResponse(document));
    await expect(api.uploadDocument(new File(["medical document"], name, { type }), "auto", "en", { processingConsent: true }))
      .resolves.toEqual(document);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["empty file", new File([], "empty.pdf", { type: "application/pdf" }), "invalid_document"],
    ["oversize file", new File([new Uint8Array(MAX_MEDICAL_DOCUMENT_BYTES + 1)], "large.pdf", { type: "application/pdf" }), "document_too_large"],
    ["unsupported extension", new File(["medical document"], "report.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "unsupported_document_type"],
    ["unsupported photo", new File(["photo"], "photo.heic", { type: "image/heic" }), "unsupported_document_type"],
    ["PDF extension with PNG MIME", new File(["photo"], "report.pdf", { type: "image/png" }), "unsupported_document_type"],
    ["JPEG extension with PNG MIME", new File(["photo"], "photo.jpg", { type: "image/png" }), "unsupported_document_type"],
    ["executable renamed as text", new File(["executable"], "report.txt", { type: "application/x-msdownload" }), "unsupported_document_type"],
  ])("rejects %s before contacting the server", async (_label, file, code) => {
    await expect(api.uploadDocument(file, "auto", "ko", { processingConsent: true })).rejects.toMatchObject({ status: 400, code });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the exact documented size limit in shared validation", () => {
    expect(medicalDocumentFileError({ name: "report.pdf", type: "application/pdf", size: MAX_MEDICAL_DOCUMENT_BYTES })).toBeNull();
  });

  it("preserves actionable server upload errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "document_storage_unavailable", message: "Document storage is unavailable" }, 503));
    await expect(api.uploadDocument(pdf(), "ko", "en", { processingConsent: true })).rejects.toMatchObject({
      status: 503,
      code: "document_storage_unavailable",
      message: "Document storage is unavailable",
    });
  });
});

describe("private medical document API", () => {
  it("downloads original bytes with bearer authentication and an encoded document ID", async () => {
    const original = new Blob(["private prescription"], { type: "application/pdf" });
    fetchMock.mockResolvedValue(new Response(original));

    const downloaded = await api.documentFile("medical/id with space");

    expect(await downloaded.text()).toBe(await original.text());
    expect(downloaded.type).toBe("application/pdf");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/documents\/medical%2Fid%20with%20space\/file$/);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-session-token");
    expect(url).not.toContain("private-session-token");
  });

  it("propagates denied original-file access instead of returning the error response as a file", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "document_not_found", message: "Document not found" }, 404));
    await expect(api.documentFile("someone-elses-document")).rejects.toMatchObject({
      status: 404, code: "document_not_found", message: "Document not found",
    });
  });

  it("sends reviewed source text and languages when translating an existing document", async () => {
    const input = { sourceText: "약 1정, 하루 2회", sourceLanguage: "ko", targetLanguage: "zh-CN", processingConsent: true };
    const translated = { ...document, ...input, translatedText: "每次1片，每天2次", status: "translated" };
    fetchMock.mockResolvedValue(jsonResponse(translated));

    await expect(api.translateDocument("medical/id", input)).resolves.toEqual(translated);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/documents\/medical%2Fid\/translate$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-session-token");
  });

  it("returns the server's list rather than deriving document metadata locally", async () => {
    const { sourceText: _sourceText, translatedText: _translatedText, ...summary } = document;
    fetchMock.mockResolvedValue(jsonResponse({ documents: [summary] }));
    await expect(api.documents()).resolves.toEqual([summary]);
  });

  it("does not hide a document list failure as an empty list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "unauthorized", message: "Please sign in again" }, 401));
    await expect(api.documents()).rejects.toMatchObject({ status: 401, code: "unauthorized", message: "Please sign in again" });
  });

  it("propagates provider translation failures without substituting demo text", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "translation_unavailable", message: "Translation service unavailable" }, 502));
    await expect(api.translateDocument(document.id, { sourceText: "无", sourceLanguage: "zh-CN", targetLanguage: "ko", processingConsent: true }))
      .rejects.toMatchObject({ status: 502, code: "translation_unavailable", message: "Translation service unavailable" });
  });

  it.each([
    ["list", () => api.documents()],
    ["read", () => api.document(document.id)],
    ["upload", () => api.uploadDocument(pdf(), "ko", "en", { processingConsent: true })],
    ["translate", () => api.translateDocument(document.id, { sourceText: "无", sourceLanguage: "zh-CN", targetLanguage: "ko" })],
    ["download", () => api.documentFile(document.id)],
    ["delete", () => api.deleteDocument(document.id)],
  ])("rejects %s in demo sessions before network access", async (_label, operation) => {
    storage.set("narucare-session", "demo:patient");
    await expect(operation()).rejects.toMatchObject({ status: 503, code: "documents_require_online" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ["list", () => api.documents()],
    ["upload", () => api.uploadDocument(pdf(), "ko", "en", { processingConsent: true })],
    ["translate", () => api.translateDocument(document.id, { sourceText: "None", sourceLanguage: "en", targetLanguage: "ko", processingConsent: true })],
  ])("propagates %s network errors without creating a local document or demo session", async (_label, operation) => {
    const failure = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(failure);
    await expect(operation()).rejects.toBe(failure);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(storage.get("narucare-session")).toBe("private-session-token");
  });

  it("uses the shared ApiError type for document failures", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "document_not_found" }, 404));
    await expect(api.document("missing")).rejects.toBeInstanceOf(ApiError);
  });
});

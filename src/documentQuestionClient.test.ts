import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import type { DocumentQuestionInput } from "./documentConversation";

const input: DocumentQuestionInput = {
  message: "Is this a confirmed diagnosis?",
  locale: "en",
  sourceText: "폐렴 의심. 추가 검사 후 확인 필요.",
  sourceLanguage: "ko",
  history: [
    { role: "user", content: "What does the first line mean?" },
    { role: "assistant", content: "It records a suspected finding and recommends further testing." },
  ],
};
const fetchMock = vi.fn<typeof fetch>();
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function abortableFetch() {
  fetchMock.mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  storage.clear();
  storage.set("narucare-session", "private-online-session");
  storage.set("narucare-demo-users", "existing offline accounts");
  storage.set("narucare-demo-chat:patient", "existing unrelated conversation");
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_DEMO_MODE", "true");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("document questions API client", () => {
  it("sends the reviewed text and separate conversation roles to the authenticated document endpoint", async () => {
    const response = { reply: "This records a suspicion, so the document alone does not confirm it." };
    fetchMock.mockResolvedValue(json(response));
    await expect(api.askDocument("report/id with space", input)).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/documents\/report%2Fid%20with%20space\/chat$/);
    expect(url).not.toContain("private-online-session");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-online-session");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    expect(storage.get("narucare-demo-chat:patient")).toBe("existing unrelated conversation");
  });

  it("requires an online account even when normal demo fallback is enabled", async () => {
    storage.set("narucare-session", "demo:patient");
    await expect(api.askDocument("report", input)).rejects.toMatchObject({ status: 503, code: "documents_require_online" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(storage.get("narucare-session")).toBe("demo:patient");
  });

  it.each([
    [401, "unauthorized", "Please sign in again"],
    [404, "document_not_found", "Document not found"],
    [400, "invalid_document_question", "Conversation is too long"],
    [502, "document_answer_failed", "Naru could not complete the answer"],
    [503, "openai_rate_limited", "AI service is busy"],
  ])("preserves HTTP %s failures without answering or persisting local data", async (status, code, message) => {
    fetchMock.mockResolvedValue(json({ error: code, message }, status));
    await expect(api.askDocument("report", input)).rejects.toMatchObject({ status, code, message });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(storage.get("narucare-session")).toBe("private-online-session");
  });

  it.each([
    new TypeError("Failed to fetch"),
    new DOMException("Request timed out", "TimeoutError"),
  ])("propagates connection failures without demo answers", async (failure) => {
    fetchMock.mockRejectedValue(failure);
    await expect(api.askDocument("report", input)).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(storage.get("narucare-session")).toBe("private-online-session");
  });

  it("aborts the request when its document conversation is closed", async () => {
    abortableFetch();
    const controller = new AbortController();
    const pending = api.askDocument("report", input, controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("retains the request deadline when an external cancellation signal is present", async () => {
    abortableFetch();
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const controller = new AbortController();
    const pending = api.askDocument("report", input, controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    expect(timeout).toHaveBeenCalledWith(55_000);
    deadline.abort(new DOMException("Request timed out", "TimeoutError"));
    await rejection;
    expect(controller.signal.aborted).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("does not convert a non-JSON failure into a medical answer", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Gateway unavailable</html>", { status: 502, headers: { "content-type": "text/html" } }));
    await expect(api.askDocument("report", input)).rejects.toBeInstanceOf(ApiError);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

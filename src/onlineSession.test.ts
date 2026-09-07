import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

const fetchMock = vi.fn<typeof fetch>();
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
};
const demoData = JSON.stringify({ patient: { password: "secret123", card: { name: "Local patient", symptoms: "Local symptoms" } } });
const demoRecords = JSON.stringify([{ id: "local-record", symptoms: "Local symptoms" }]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function expectLocalDataPreserved() {
  expect(storage.get("narucare-demo-users")).toBe(demoData);
  expect(storage.get("narucare-demo-records:patient")).toBe(demoRecords);
  expect(localStorageMock.removeItem).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  storage.clear();
  storage.set("narucare-session", "demo:patient");
  storage.set("narucare-demo-users", demoData);
  storage.set("narucare-demo-records:patient", demoRecords);
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("fetch", fetchMock);
  // Recovery must remain online-only even when offline demo fallback is enabled.
  vi.stubEnv("VITE_DEMO_MODE", "true");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each([
  ["login", api.loginOnline],
  ["register", api.registerOnline],
] as const)("explicit online %s", (mode, authenticate) => {
  it("stores only the server session and returns the server account without uploading local data", async () => {
    const user = { id: "Patient", card: null };
    fetchMock.mockResolvedValue(jsonResponse({ token: "real-server-session", user }));

    await expect(authenticate(" patient ", "secret123")).resolves.toEqual(user);

    expect(api.isDemo()).toBe(false);
    expect(storage.get("narucare-session")).toBe("real-server-session");
    expect(localStorageMock.setItem).toHaveBeenCalledExactlyOnceWith("narucare-session", "real-server-session");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/api/auth/${mode}$`));
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ id: "patient", password: "secret123" });
    expectLocalDataPreserved();
  });

  it.each([
    ["bad credentials", () => jsonResponse({ error: "invalid_credentials" }, 401), { status: 401, code: "invalid_credentials" }],
    ["account collision", () => jsonResponse({ error: "id_taken" }, 409), { status: 409, code: "id_taken" }],
  ] as const)("preserves the demo session after %s", async (_label, response, expected) => {
    fetchMock.mockResolvedValue(response());
    await expect(authenticate("patient", "secret123")).rejects.toMatchObject(expected);
    expect(storage.get("narucare-session")).toBe("demo:patient");
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectLocalDataPreserved();
  });

  it.each([
    ["network failure", new TypeError("Failed to fetch")],
    ["request timeout", new DOMException("Timed out", "AbortError")],
  ])("propagates %s without offline fallback or replacing the session", async (_label, failure) => {
    fetchMock.mockRejectedValue(failure);
    await expect(authenticate("patient", "secret123")).rejects.toBe(failure);
    expect(storage.get("narucare-session")).toBe("demo:patient");
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectLocalDataPreserved();
  });

  it.each([null, "a-newer-session"])("does not overwrite a concurrent session change to %j", async (nextToken) => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = authenticate("patient", "secret123");
    if (nextToken === null) storage.delete("narucare-session");
    else storage.set("narucare-session", nextToken);
    finish(jsonResponse({ token: "superseded-session", user: { id: "patient", card: null } }));

    await expect(pending).rejects.toMatchObject({ status: 409, code: "session_changed" });
    expect(storage.get("narucare-session") ?? null).toBe(nextToken);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expectLocalDataPreserved();
  });

  it.each([
    ["HTML success", () => new Response("<html>Frontend</html>", { headers: { "content-type": "text/html" } })],
    ["null payload", () => jsonResponse(null)],
    ["missing token", () => jsonResponse({ user: { id: "patient", card: null } })],
    ["blank token", () => jsonResponse({ token: "  ", user: { id: "patient", card: null } })],
    ["demo token", () => jsonResponse({ token: "demo:patient", user: { id: "patient", card: null } })],
    ["missing account", () => jsonResponse({ token: "real-session" })],
    ["different account", () => jsonResponse({ token: "real-session", user: { id: "another", card: null } })],
    ["missing card", () => jsonResponse({ token: "real-session", user: { id: "patient" } })],
    ["invalid card", () => jsonResponse({ token: "real-session", user: { id: "patient", card: [] } })],
  ])("rejects %s before replacing the prior session", async (_label, response) => {
    fetchMock.mockResolvedValue(response());
    await expect(authenticate("patient", "secret123")).rejects.toMatchObject({ status: 502, code: "online_session_invalid" });
    expect(storage.get("narucare-session")).toBe("demo:patient");
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expectLocalDataPreserved();
  });
});

describe("online account validation", () => {
  it.each(["6", "", " ", "invalid name", "a".repeat(49)])("rejects invalid registration ID %j without making a request", async (id) => {
    await expect(api.registerOnline(id, "secret123")).rejects.toMatchObject({ code: "invalid_id" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("returns the backend medical card instead of merging a local demo card", async () => {
    const card = { name: "Online patient", symptoms: "Server symptoms" };
    fetchMock.mockResolvedValue(jsonResponse({ token: "real-session", user: { id: "patient", card } }));
    await expect(api.loginOnline("patient", "secret123")).resolves.toEqual({ id: "patient", card });
    expectLocalDataPreserved();
  });

  it.each(["", "short", "p".repeat(129)])("rejects invalid password length %j without changing the session", async (password) => {
    await expect(api.loginOnline("patient", password)).rejects.toMatchObject({ code: "invalid_password" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

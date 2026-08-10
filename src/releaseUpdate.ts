type ReleaseManifest = {
  buildId?: unknown;
};

const UPDATE_PROMPT_ID = "narucare-release-update";

function releaseManifestUrl() {
  const url = new URL(`${import.meta.env.BASE_URL}release.json`, window.location.href);
  url.searchParams.set("_", Date.now().toString());
  return url;
}

function showUpdatePrompt(buildId: string) {
  if (document.getElementById(UPDATE_PROMPT_ID)) return;

  const status = document.createElement("div");
  status.id = UPDATE_PROMPT_ID;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  Object.assign(status.style, {
    position: "fixed",
    zIndex: "2147483647",
    left: "12px",
    right: "12px",
    bottom: "max(88px, calc(env(safe-area-inset-bottom) + 76px))",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  });

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "发现新版本，点击立即更新";
  button.setAttribute("aria-label", "发现新版本，点击重新载入最新页面");
  Object.assign(button.style, {
    width: "min(100%, 420px)",
    minHeight: "48px",
    padding: "12px 18px",
    border: "1px solid rgba(255, 255, 255, 0.72)",
    borderRadius: "16px",
    color: "#ffffff",
    background: "#16756f",
    boxShadow: "0 10px 28px rgba(15, 80, 76, 0.3)",
    font: "600 15px/1.4 system-ui, sans-serif",
    cursor: "pointer",
    pointerEvents: "auto",
  });
  button.addEventListener("click", () => {
    const updateUrl = new URL(window.location.href);
    updateUrl.searchParams.set("v", buildId);
    window.location.assign(updateUrl.toString());
  });

  status.append(button);
  document.body.append(status);
}

export function startReleaseUpdateMonitor() {
  if (!import.meta.env.PROD) return;

  let requestInFlight = false;

  const checkForUpdate = async () => {
    if (requestInFlight || document.getElementById(UPDATE_PROMPT_ID)) return;
    requestInFlight = true;

    try {
      const response = await fetch(releaseManifestUrl(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;

      const manifest = (await response.json()) as ReleaseManifest;
      if (
        typeof manifest.buildId === "string" &&
        manifest.buildId.length > 0 &&
        manifest.buildId !== __NARU_BUILD_ID__
      ) {
        showUpdatePrompt(manifest.buildId);
      }
    } catch {
      // Release checks must never interrupt the application.
    } finally {
      requestInFlight = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  };

  void checkForUpdate();
  window.setInterval(() => void checkForUpdate(), 60_000);
  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

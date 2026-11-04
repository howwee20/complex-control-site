// Runs in the phone's browser, never on the Pi. The browser chooses its internet
// route; this cannot force iOS to use cellular or run while Safari is suspended.
export type PhoneUpdateState = "checking" | "current" | "sending" | "saved" | "offline" | "unavailable" | "failed";
const FEED = "https://raw.githubusercontent.com/howwee20/complex-control-updates/main/latest.json";
const RELEASES = "https://raw.githubusercontent.com/howwee20/complex-control-updates/main/releases/";
const rejected = new Set<string>();
const MAX_BYTES = 200 * 1024 * 1024;

export async function carryPhoneUpdate(fetcher: typeof fetch = fetch, signal?: AbortSignal,
  report: (state: PhoneUpdateState) => void = () => {}): Promise<PhoneUpdateState> {
  try {
    const capability = await fetcher("/api/system/phone-update", { signal });
    if (!capability.ok || !(await capability.json()).enabled) return "unavailable";
    const statusResponse = await fetcher("/api/system/update", { signal, cache: "no-store" });
    if (!statusResponse.ok) return "unavailable";
    const status = await statusResponse.json();
    if (status.installer_active) return "saved";
    const response = await fetcher(FEED, { signal, cache: "no-store", credentials: "omit" });
    if (!response.ok) return "offline";
    const release = await response.json();
    if (release.format !== "complex-control-encrypted-feed-v1" ||
        !/^[a-f0-9]{40}$/.test(release.commit) || !/^[a-f0-9]{64}$/.test(release.sha256) ||
        typeof release.bundle_url !== "string" || !release.bundle_url.startsWith(RELEASES) ||
        !Number.isSafeInteger(release.bytes) || release.bytes <= 0 || release.bytes > MAX_BYTES) return "failed";
    if (status.current?.commit === release.commit) return "current";
    if (status.staged?.commit === release.commit) return status.state === "failed" ? "failed" : "saved";
    if (rejected.has(release.commit)) return "failed";
    report("sending");
    const download = await fetcher(release.bundle_url, { signal, credentials: "omit" });
    if (!download.ok) return "offline";
    const body = await download.arrayBuffer();
    if (body.byteLength !== release.bytes || body.byteLength > MAX_BYTES) return "failed";
    // Hash, decryption, signature, version and compatibility checks belong to
    // the Pi. Web Crypto is unavailable on its local HTTP origin on some phones.
    const delivered = await fetcher("/api/system/phone-update", {
      method: "POST", signal, headers: { "Content-Type": "application/octet-stream",
        "X-Release-Commit": release.commit, "X-Release-SHA256": release.sha256 }, body,
    });
    if (delivered.status === 422) rejected.add(release.commit);
    if (delivered.status === 409) {
      const error = await delivered.json().catch(() => ({}));
      if (String(error.detail).includes("older")) { rejected.add(release.commit); return "current"; }
    }
    return delivered.ok ? "saved" : "failed";
  } catch { return "offline"; }
}

export function startPhoneUpdates(): () => void {
  let stopped = false;
  let busy = false;
  let active: AbortController | null = null;
  const report = (state: PhoneUpdateState) => window.dispatchEvent(new CustomEvent("phone-update", { detail: state }));
  const check = async () => {
    if (stopped || busy || document.visibilityState === "hidden") return;
    busy = true;
    active = new AbortController();
    const timeout = window.setTimeout(() => active?.abort(), 120000);
    try { const state = await carryPhoneUpdate(fetch, active.signal, report); if (!stopped) report(state); }
    finally { window.clearTimeout(timeout); busy = false; }
  };
  void check();
  const timer = window.setInterval(() => void check(), 30000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  return () => { stopped = true; active?.abort(); window.clearInterval(timer);
    document.removeEventListener("visibilitychange", check); window.removeEventListener("online", check); };
}

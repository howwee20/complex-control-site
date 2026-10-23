// Carries signed controller updates from mycomplexcontrol.com to a Pi that has
// no Internet, using only the phone browser.
//
// While the phone has Internet, the website caches the newest signed capsule
// in IndexedDB (the same store /field-update.html uses). When the operator taps
// Open Race Control, the controller's receiver page opens in a named window in
// that same tap. A receiver that reports protocol 2 saves the capsule on the
// controller, which installs it only while no race is running, and then opens
// Race Control. Older receivers belong to controllers whose software finished
// races to update, so nothing is sent to them; they are simply navigated to
// Race Control.
//
// Browser limits: the website tab must stay open in the foreground until the
// controller page appears. A closed, locked, or backgrounded phone cannot carry
// an update, and racing continues on the installed version.

export const CAPSULE_DB = "complex-control-field-updates";
export const CAPSULE_STORE = "capsules";
export const CAPSULE_KEY = "latest";
export const RECEIVER_PATH = "/field-update-receiver.html";
export const CONTROLLER_WINDOW = "complex-control-controller";
export const CONTROLLER_ORIGINS = ["http://10.42.0.1:8000", "http://complex-control.local:8000"] as const;
export const RECEIVER_PROTOCOL = 2;

export interface CapsuleManifest {
  version: string;
  site_commit?: string;
  backend_api?: string;
  created_at?: string;
  filename: string;
  capsule_url: string;
  signature_url: string;
  sha256: string;
  bytes?: number;
}

export interface CachedCapsule {
  manifest: CapsuleManifest;
  capsule: ArrayBuffer;
  signature: ArrayBuffer;
  cached_at: string;
}

export interface CapsuleStore {
  read(): Promise<CachedCapsule | null>;
  write(value: CachedCapsule): Promise<void>;
}

export type CourierOutcome =
  | { kind: "blocked" }
  | { kind: "current"; version: string | null }
  | { kind: "delivered"; version: string; state: "complete" | "staged" }
  | { kind: "rejected"; version: string; detail: string }
  | { kind: "legacy" }
  | { kind: "unreachable" };

interface ReceiverReady {
  type: "complex-control-field-receiver-ready";
  protocol?: number;
  installed?: string | null;
  staged?: string | null;
}

interface MessageSource {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

export interface CourierEnvironment {
  open(url: string, name: string): Window | null;
  events: MessageSource;
  store: CapsuleStore;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export function controllerUrl(origin: string, destination: string): string {
  return `${origin}/?view=${encodeURIComponent(destination)}`;
}

export function receiverUrl(origin: string, destination: string): string {
  const then = `/?view=${encodeURIComponent(destination)}`;
  return `${origin}${RECEIVER_PATH}?then=${encodeURIComponent(then)}`;
}

/** Whether a carried capsule should be offered to a receiver. */
export function shouldDeliver(cached: CachedCapsule | null, ready: ReceiverReady): cached is CachedCapsule {
  if (!cached || (ready.protocol ?? 1) < RECEIVER_PROTOCOL) return false;
  const version = cached.manifest.version;
  return version !== ready.installed && version !== ready.staged;
}

/**
 * Open Race Control at ``origin`` and hand over a newer carried update.
 * Must be called synchronously inside the operator's tap.
 */
export function openControllerWithUpdate(
  origin: string,
  destination: string,
  environment: CourierEnvironment,
  timeoutMs = 20000,
): Promise<CourierOutcome> {
  const receiver = environment.open(receiverUrl(origin, destination), CONTROLLER_WINDOW);
  if (!receiver) return Promise.resolve({ kind: "blocked" });

  return new Promise((resolve) => {
    let finished = false;
    let deliveredVersion: string | null = null;
    const finish = (outcome: CourierOutcome) => {
      if (finished) return;
      finished = true;
      environment.clearTimeout(timer);
      environment.events.removeEventListener("message", onMessage);
      resolve(outcome);
    };
    const timer = environment.setTimeout(() => finish({ kind: "unreachable" }), timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== receiver) return;
      const data = event.data as { type?: string; version?: string; state?: string; detail?: string };
      if (data?.type === "complex-control-field-receiver-ready") {
        const ready = data as ReceiverReady;
        if ((ready.protocol ?? 1) < RECEIVER_PROTOCOL) {
          // Older controller software: never send it an update; just open it.
          try { receiver.location.replace(controllerUrl(origin, destination)); } catch { /* window closed */ }
          finish({ kind: "legacy" });
          return;
        }
        void environment.store.read().catch(() => null).then((cached) => {
          if (!shouldDeliver(cached, ready)) {
            receiver.postMessage({ type: "complex-control-field-no-update" }, origin);
            finish({ kind: "current", version: ready.installed ?? null });
            return;
          }
          deliveredVersion = cached.manifest.version;
          receiver.postMessage(
            {
              type: "complex-control-field-capsule",
              capsule: cached.capsule,
              signature: cached.signature,
              filename: cached.manifest.filename,
              sha256: cached.manifest.sha256,
              version: cached.manifest.version,
              site_commit: cached.manifest.site_commit,
            },
            origin,
            [cached.capsule, cached.signature],
          );
        });
        return;
      }
      const version = data?.version ?? deliveredVersion ?? "";
      if (data?.type === "complex-control-field-update-complete") {
        finish({ kind: "delivered", version, state: data.state === "staged" ? "staged" : "complete" });
      } else if (data?.type === "complex-control-field-update-staged") {
        finish({ kind: "delivered", version, state: "staged" });
      } else if (data?.type === "complex-control-field-update-error") {
        finish({ kind: "rejected", version, detail: data.detail ?? "The controller rejected the update." });
      }
    };
    environment.events.addEventListener("message", onMessage);
  });
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Download and verify the newest capsule while online; keep the old copy on failure. */
export async function refreshCarriedUpdate(
  store: CapsuleStore,
  fetcher: typeof fetch = fetch,
  base = "",
): Promise<CachedCapsule | null> {
  const cached = await store.read().catch(() => null);
  try {
    const response = await fetcher(`${base}/field/latest.json?check=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return cached;
    const manifest = (await response.json()) as CapsuleManifest;
    if (cached?.manifest.version === manifest.version && cached.manifest.sha256 === manifest.sha256) return cached;
    const [capsuleResponse, signatureResponse] = await Promise.all([
      fetcher(manifest.capsule_url, { cache: "no-store" }),
      fetcher(manifest.signature_url, { cache: "no-store" }),
    ]);
    if (!capsuleResponse.ok || !signatureResponse.ok) return cached;
    const capsule = await capsuleResponse.arrayBuffer();
    const signature = await signatureResponse.arrayBuffer();
    if (signature.byteLength !== 64 || (await sha256Hex(capsule)) !== manifest.sha256) return cached;
    const fresh: CachedCapsule = { manifest, capsule, signature, cached_at: new Date().toISOString() };
    await store.write(fresh);
    return fresh;
  } catch {
    return cached;
  }
}

export function indexedDbCapsuleStore(factory: IDBFactory = indexedDB): CapsuleStore {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(CAPSULE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(CAPSULE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    async read() {
      const db = await open();
      try {
        return await new Promise<CachedCapsule | null>((resolve, reject) => {
          const request = db.transaction(CAPSULE_STORE).objectStore(CAPSULE_STORE).get(CAPSULE_KEY);
          request.onsuccess = () => resolve((request.result as CachedCapsule | undefined) ?? null);
          request.onerror = () => reject(request.error);
        });
      } finally {
        db.close();
      }
    },
    async write(value) {
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(CAPSULE_STORE, "readwrite");
          transaction.objectStore(CAPSULE_STORE).put(value, CAPSULE_KEY);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
  };
}

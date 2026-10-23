import { describe, expect, it, vi } from "vitest";
import {
  openControllerWithUpdate,
  receiverUrl,
  refreshCarriedUpdate,
  sha256Hex,
  type CachedCapsule,
  type CapsuleStore,
  type CourierEnvironment,
} from "./fieldCourier";

const ORIGIN = "http://10.42.0.1:8000";

function cached(version = "site-new", backendApi = "4"): CachedCapsule {
  return {
    manifest: {
      version,
      backend_api: backendApi,
      filename: `${version}.tgz`,
      capsule_url: "https://mycomplexcontrol.com/field/c.tgz",
      signature_url: "https://mycomplexcontrol.com/field/c.tgz.sig",
      sha256: "abc",
    },
    capsule: new ArrayBuffer(8),
    signature: new ArrayBuffer(64),
    cached_at: "2026-10-23T00:00:00Z",
  };
}

function memoryStore(value: CachedCapsule | null): CapsuleStore & { writes: CachedCapsule[] } {
  const writes: CachedCapsule[] = [];
  return {
    writes,
    read: async () => value,
    write: async (next) => { writes.push(next); value = next; },
  };
}

function harness(value: CachedCapsule | null, opened: "window" | "blocked" = "window") {
  const events = new EventTarget();
  const receiver = { postMessage: vi.fn(), location: { replace: vi.fn() } } as unknown as Window & {
    postMessage: ReturnType<typeof vi.fn>;
    location: { replace: ReturnType<typeof vi.fn> };
  };
  const timers: Array<() => void> = [];
  const environment: CourierEnvironment = {
    open: vi.fn(() => (opened === "window" ? receiver : null)),
    events: events as unknown as CourierEnvironment["events"],
    store: memoryStore(value),
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout: () => undefined,
  };
  const send = (data: unknown, origin = ORIGIN, source: unknown = receiver) => {
    const event = new MessageEvent("message", { data, origin });
    Object.defineProperty(event, "source", { value: source });
    events.dispatchEvent(event);
  };
  return { environment, receiver, send, timers };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("phone courier", () => {
  it("opens the receiver with a safe return path in the same tap", () => {
    const { environment } = harness(null);
    void openControllerWithUpdate(ORIGIN, "profiles", environment);
    expect(environment.open).toHaveBeenCalledWith(
      `${ORIGIN}/field-update-receiver.html?then=%2F%3Fview%3Dprofiles`,
      "complex-control-controller",
    );
    expect(receiverUrl(ORIGIN, "setup")).toContain("then=%2F%3Fview%3Dsetup");
  });

  it("hands a newer update to a protocol 2 receiver and reports it saved", async () => {
    const { environment, receiver, send } = harness(cached("site-new"));
    const result = openControllerWithUpdate(ORIGIN, "setup", environment);
    send({ type: "complex-control-field-receiver-ready", protocol: 2, installed: "site-old", staged: null });
    await flush();
    const [message, origin, transfer] = receiver.postMessage.mock.calls[0]!;
    expect(message.type).toBe("complex-control-field-capsule");
    expect(message.version).toBe("site-new");
    expect(origin).toBe(ORIGIN);
    expect(transfer).toHaveLength(2);
    send({ type: "complex-control-field-update-staged", version: "site-new", state: "staged" });
    await expect(result).resolves.toEqual({ kind: "delivered", version: "site-new", state: "staged" });
  });

  it("sends nothing when the controller already has or holds that version", async () => {
    for (const ready of [{ installed: "site-new", staged: null }, { installed: "site-old", staged: "site-new" }]) {
      const { environment, receiver, send } = harness(cached("site-new"));
      const result = openControllerWithUpdate(ORIGIN, "setup", environment);
      send({ type: "complex-control-field-receiver-ready", protocol: 2, ...ready });
      await expect(result).resolves.toMatchObject({ kind: "current" });
      expect(receiver.postMessage).toHaveBeenCalledWith({ type: "complex-control-field-no-update" }, ORIGIN);
    }
  });

  it("never sends an update to older controller software, it just opens Race Control", async () => {
    const { environment, receiver, send } = harness(cached("site-new", "3"));
    const result = openControllerWithUpdate(ORIGIN, "setup", environment);
    send({ type: "complex-control-field-receiver-ready" });
    await expect(result).resolves.toEqual({ kind: "legacy" });
    expect(receiver.postMessage).not.toHaveBeenCalled();
    expect(receiver.location.replace).toHaveBeenCalledWith(`${ORIGIN}/?view=setup`);
  });

  it("ignores messages from other origins or windows", async () => {
    const { environment, receiver, send, timers } = harness(cached());
    const result = openControllerWithUpdate(ORIGIN, "setup", environment);
    send({ type: "complex-control-field-receiver-ready", protocol: 2 }, "https://evil.example");
    send({ type: "complex-control-field-receiver-ready", protocol: 2 }, ORIGIN, {});
    await flush();
    expect(receiver.postMessage).not.toHaveBeenCalled();
    timers[0]!();
    await expect(result).resolves.toEqual({ kind: "unreachable" });
  });

  it("reports a rejected update without blocking racing", async () => {
    const { environment, send } = harness(cached());
    const result = openControllerWithUpdate(ORIGIN, "setup", environment);
    send({ type: "complex-control-field-receiver-ready", protocol: 2, installed: "site-old" });
    await flush();
    send({ type: "complex-control-field-update-error", version: "site-new", detail: "Controller update signature did not match" });
    await expect(result).resolves.toEqual({ kind: "rejected", version: "site-new", detail: "Controller update signature did not match" });
  });

  it("reports a blocked pop-up", async () => {
    const { environment } = harness(cached(), "blocked");
    await expect(openControllerWithUpdate(ORIGIN, "setup", environment)).resolves.toEqual({ kind: "blocked" });
  });
});

describe("carried update refresh", () => {
  const capsuleBytes = new TextEncoder().encode("capsule").buffer;

  async function fetcherFor(sha: string, signatureBytes = 64) {
    return vi.fn(async (url: string) => {
      if (url.startsWith("/field/latest.json")) {
        return new Response(JSON.stringify({ ...cached("site-fresh").manifest, sha256: sha }));
      }
      if (url.endsWith(".sig")) return new Response(new Uint8Array(signatureBytes));
      return new Response(capsuleBytes.slice(0));
    }) as unknown as typeof fetch;
  }

  it("stores a verified newer capsule", async () => {
    const store = memoryStore(cached("site-old"));
    const fresh = await refreshCarriedUpdate(store, await fetcherFor(await sha256Hex(capsuleBytes)));
    expect(fresh?.manifest.version).toBe("site-fresh");
    expect(store.writes).toHaveLength(1);
  });

  it("keeps the previous capsule when the download does not verify or the phone is offline", async () => {
    const store = memoryStore(cached("site-old"));
    expect((await refreshCarriedUpdate(store, await fetcherFor("0".repeat(64))))?.manifest.version).toBe("site-old");
    expect((await refreshCarriedUpdate(store, await fetcherFor(await sha256Hex(capsuleBytes), 10)))?.manifest.version).toBe("site-old");
    const offline = vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect((await refreshCarriedUpdate(store, offline))?.manifest.version).toBe("site-old");
    expect(store.writes).toHaveLength(0);
  });
});

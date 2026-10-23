import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const linkScript = readFileSync(new URL("../../field-controller-link.js", import.meta.url), "utf8");
const updaterScript = readFileSync(new URL("../../field-update.js", import.meta.url), "utf8");
const receiver = readFileSync(new URL("../public/field-update-receiver.html", import.meta.url), "utf8");
const receiverScript = receiver.match(/<script>([\s\S]*?)<\/script>/)[1];
const SITE = "https://mycomplexcontrol.com";
const PI = "http://10.42.0.1:8000";

function runReceiver({ search = "?then=%2F%3Fview%3Dprofiles", status = { current: { version: "site-old" }, staged: null }, post } = {}) {
  const listeners = {};
  const opener = { postMessage: vi.fn() };
  const replace = vi.fn();
  const text = { textContent: "" };
  const link = { setAttribute: vi.fn() };
  const fetch = vi.fn(async (_url, options) => {
    if (options?.method === "POST") return post ?? { ok: true, json: async () => ({ state: "staged", current: { version: "site-old" } }) };
    return { ok: true, json: async () => status };
  });
  const timers = [];
  runInNewContext(receiverScript, {
    document: { querySelector: (selector) => (selector === "#status" ? text : link) },
    fetch, ArrayBuffer, Uint8Array, URLSearchParams, String, btoa,
    window: {
      opener,
      location: { search, replace },
      addEventListener: (name, fn) => { listeners[name] = fn; },
      setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
      clearTimeout: () => undefined,
    },
  });
  const deliver = (data, origin = SITE, source = opener) => listeners.message({ origin, source, data });
  return { opener, replace, fetch, deliver, timers, text, link };
}

const capsule = (version) => ({
  type: "complex-control-field-capsule", capsule: new ArrayBuffer(4), signature: new ArrayBuffer(64),
  version, filename: `${version}.tgz`, sha256: "a".repeat(64),
});

describe("field navigation", () => {
  it("leaves current React navigation alone instead of intercepting Race Control", () => {
    const nav = { hasAttribute: () => true, append: vi.fn() };
    const document = { querySelector: () => nav, documentElement: {}, addEventListener: vi.fn() };
    runInNewContext(linkScript, { document, MutationObserver: class { observe() {} } });
    expect(document.addEventListener).not.toHaveBeenCalled();
    expect(nav.append).not.toHaveBeenCalled();
  });
});

describe("controller receiver (protocol 2)", () => {
  it("announces protocol 2 with the installed and saved versions", async () => {
    const { opener } = runReceiver({ status: { current: { version: "site-old" }, staged: { version: "site-mid" } } });
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalled());
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: "complex-control-field-receiver-ready", protocol: 2, installed: "site-old", staged: "site-mid" }, SITE,
    );
  });

  it("opens the requested controller screen without posting when the version is already installed", async () => {
    const { deliver, opener, fetch, replace, timers } = runReceiver({ status: { current: { version: "site-current" }, staged: null } });
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalled());
    deliver(capsule("site-current"));
    await vi.waitFor(() => expect(timers.some((timer) => timer.ms === 0)).toBe(true));
    timers.find((timer) => timer.ms === 0).fn();
    expect(replace).toHaveBeenCalledWith("/?view=profiles");
    expect(fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("saves a newer update, reports it staged, and continues to Race Control", async () => {
    const { deliver, opener, fetch, replace, timers } = runReceiver();
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalled());
    deliver(capsule("site-new"));
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complex-control-field-update-staged", version: "site-new" }), SITE,
    ));
    const post = fetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(post[1].headers["X-Frontend-Version"]).toBe("site-new");
    timers.at(-1).fn();
    expect(replace).toHaveBeenCalledWith("/?view=profiles");
  });

  it("reports a rejected update and still opens Race Control", async () => {
    const { deliver, opener, replace, timers } = runReceiver({
      post: { ok: false, json: async () => ({ detail: "Controller update signature did not match" }) },
    });
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalled());
    deliver(capsule("site-new"));
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complex-control-field-update-error", detail: "Controller update signature did not match" }), SITE,
    ));
    timers.at(-1).fn();
    expect(replace).toHaveBeenCalled();
  });

  it("goes straight to Race Control when the website has nothing to carry", async () => {
    const { deliver, opener, replace, timers } = runReceiver();
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalled());
    deliver({ type: "complex-control-field-no-update" });
    timers.at(-1).fn();
    expect(replace).toHaveBeenCalledWith("/?view=profiles");
  });

  it("ignores other origins and never follows an off-site return path", async () => {
    const { deliver, opener, fetch, link } = runReceiver({ search: "?then=%2F%2Fevil.example%2F" });
    await vi.waitFor(() => expect(opener.postMessage).toHaveBeenCalled());
    deliver(capsule("site-new"), "https://evil.example");
    deliver(capsule("site-new"), SITE, {});
    expect(fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    expect(link.setAttribute).toHaveBeenCalledWith("href", "/?view=setup");
  });

  it("does not keep the operator waiting if the website tab stops responding", async () => {
    const { replace, timers } = runReceiver();
    const fallback = timers.find((timer) => timer.ms === 8000);
    fallback.fn();
    expect(replace).toHaveBeenCalledWith("/?view=profiles");
  });
});

function fakeIndexedDb(value) {
  const request = (result) => {
    const item = { result };
    queueMicrotask(() => item.onsuccess?.());
    return item;
  };
  const db = {
    transaction: () => {
      const transaction = {
        objectStore: () => ({
          get: () => request(value),
          put: (next) => { value = next; queueMicrotask(() => transaction.oncomplete?.()); },
        }),
      };
      return transaction;
    },
    close: () => undefined,
  };
  return {
    open: () => request(db),
    deleteDatabase: () => request(undefined),
  };
}

function runUpdater(cached) {
  const listeners = {};
  let click;
  const receiverWindow = { postMessage: vi.fn(), close: vi.fn(), location: { replace: vi.fn() } };
  const status = { textContent: "" };
  const button = { disabled: false, textContent: "", addEventListener: (_name, fn) => { click = fn; } };
  runInNewContext(updaterScript, {
    document: { querySelector: (selector) => (selector === "#status" ? status : button) },
    indexedDB: fakeIndexedDb(cached),
    localStorage: { getItem: () => "8", setItem: () => undefined },
    navigator: {},
    fetch: vi.fn(async () => { throw new TypeError("offline"); }),
    crypto: globalThis.crypto,
    queueMicrotask, Date, Error, Promise, Uint8Array,
    window: {
      open: () => receiverWindow,
      addEventListener: (name, fn) => { listeners[name] = fn; },
      removeEventListener: () => undefined,
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    },
  });
  const ready = (data) => listeners.message({ origin: PI, source: receiverWindow, data: { type: "complex-control-field-receiver-ready", ...data } });
  return { click: () => click(), ready, receiverWindow, status, listeners };
}

const cachedCapsule = (backendApi) => ({
  manifest: { version: "site-new", backend_api: backendApi, filename: "c.tgz", sha256: "a" },
  capsule: new ArrayBuffer(4), signature: new ArrayBuffer(64), cached_at: "now",
});

describe("Update Pi page (updater 8)", () => {
  it("sends the update to a protocol 2 controller and reports it saved", async () => {
    const page = runUpdater(cachedCapsule("4"));
    page.click();
    await vi.waitFor(() => expect(page.listeners.message).toBeDefined());
    page.ready({ protocol: 2 });
    expect(page.receiverWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({ version: "site-new" }), PI, expect.anything());
    page.listeners.message({ origin: PI, source: page.receiverWindow, data: { type: "complex-control-field-update-complete", state: "staged" } });
    await vi.waitFor(() => expect(page.status.textContent).toContain("installs automatically when no race is running"));
  });

  it("never sends a capsule older controller software could accept", async () => {
    const page = runUpdater(cachedCapsule("3"));
    page.click();
    await vi.waitFor(() => expect(page.listeners.message).toBeDefined());
    page.ready({});
    expect(page.receiverWindow.postMessage).not.toHaveBeenCalled();
    expect(page.receiverWindow.location.replace).toHaveBeenCalledWith(`${PI}/?view=setup`);
    await vi.waitFor(() => expect(page.status.textContent).toContain("one-time system update"));
  });

  it("may send a newer-API capsule to older controller software, which rejects it before acting", async () => {
    const page = runUpdater(cachedCapsule("4"));
    page.click();
    await vi.waitFor(() => expect(page.listeners.message).toBeDefined());
    page.ready({});
    expect(page.receiverWindow.postMessage).toHaveBeenCalled();
  });
});

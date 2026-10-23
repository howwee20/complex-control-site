import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const linkScript = readFileSync(new URL("../../field-controller-link.js", import.meta.url), "utf8");
const receiver = readFileSync(new URL("../public/field-update-receiver.html", import.meta.url), "utf8");
const receiverScript = receiver.match(/<script>([\s\S]*?)<\/script>/)[1];

describe("field navigation", () => {
  it("leaves current React navigation alone instead of intercepting Race Control", () => {
    const nav = { hasAttribute: () => true, append: vi.fn() };
    const document = { querySelector: () => nav, documentElement: {}, addEventListener: vi.fn() };
    runInNewContext(linkScript, { document, MutationObserver: class { observe() {} } });
    expect(document.addEventListener).not.toHaveBeenCalled();
    expect(nav.append).not.toHaveBeenCalled();
  });

  it("opens the controller immediately when its installed interface already matches", async () => {
    const listeners = {};
    const status = { textContent: "" };
    const opener = { postMessage: vi.fn() };
    const replace = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: { version: "site-current" } }) });
    runInNewContext(receiverScript, {
      document: { querySelector: () => status }, fetch, ArrayBuffer,
      window: { opener, location: { replace }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    });
    listeners.message({
      origin: "https://mycomplexcontrol.com", source: opener,
      data: { type: "complex-control-field-capsule", capsule: new ArrayBuffer(0), signature: new ArrayBuffer(0), version: "site-current" },
    });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/?view=setup"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).not.toHaveProperty("method", "POST");
  });
});

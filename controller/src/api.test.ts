import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectRace } from "./api";
import type { RaceSnapshot } from "./types";

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: () => void;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  close() { this.onclose?.(); }
}
const race = (status: "RUNNING" | "FINISHED") => ({ id: "race-1", status } as RaceSnapshot);
const response = (status: "RUNNING" | "FINISHED") => new Response(JSON.stringify(race(status)));
let dispose: (() => void) | undefined;
let windowEvents: EventTarget;
let documentEvents: EventTarget & { visibilityState: string };

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  windowEvents = new EventTarget();
  documentEvents = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", documentEvents);
  vi.stubGlobal("window", Object.assign(windowEvents, {
    location: { protocol: "http:", hostname: "10.42.0.1", host: "10.42.0.1:8000", port: "8000" },
    setTimeout, clearTimeout, setInterval, clearInterval,
  }));
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });

async function flush() { await vi.advanceTimersByTimeAsync(0); }

describe("race display recovery", () => {
  it("loads saved final results when the phone reconnects after missing the finish", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response("RUNNING")).mockResolvedValueOnce(response("FINISHED"));
    vi.stubGlobal("fetch", fetch);
    const onMessage = vi.fn();
    dispose = connectRace("race-1", onMessage, vi.fn());
    FakeSocket.instances[0]!.onopen?.();
    await flush();
    FakeSocket.instances[0]!.close();
    await vi.advanceTimersByTimeAsync(1500);
    FakeSocket.instances[1]!.onopen?.();
    await flush();
    expect(onMessage.mock.lastCall?.[0].race.status).toBe("FINISHED");
  });
  it("recovers a missed final message even if the socket never closes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("FINISHED")));
    const onMessage = vi.fn();
    dispose = connectRace("race-1", onMessage, vi.fn());
    await vi.advanceTimersByTimeAsync(5000);
    expect(onMessage.mock.lastCall?.[0].race.status).toBe("FINISHED");
  });
  it("does not overwrite a newer live finish with a slower running snapshot", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const onMessage = vi.fn();
    dispose = connectRace("race-1", onMessage, vi.fn());
    FakeSocket.instances[0]!.onopen?.();
    FakeSocket.instances[0]!.onmessage?.({ data: JSON.stringify({ type: "race.updated", race: race("FINISHED") }) });
    resolve(response("RUNNING"));
    await flush();
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.lastCall?.[0].race.status).toBe("FINISHED");
  });
  it("refreshes on wake and retries after an offline failure", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response("FINISHED"));
    vi.stubGlobal("fetch", fetch);
    const onMessage = vi.fn();
    dispose = connectRace("race-1", onMessage, vi.fn());
    FakeSocket.instances[0]!.onopen?.();
    await flush();
    documentEvents.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    documentEvents.visibilityState = "visible";
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(onMessage.mock.lastCall?.[0].race.status).toBe("FINISHED");
  });
  it("aborts pending reads and removes all recovery work when leaving a race", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn((_path, options) => new Promise<Response>((done) => { resolve = done; void options; }));
    vi.stubGlobal("fetch", fetch);
    const onMessage = vi.fn();
    dispose = connectRace("race-1", onMessage, vi.fn());
    FakeSocket.instances[0]!.onopen?.();
    dispose();
    resolve(response("FINISHED"));
    windowEvents.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
    expect(onMessage).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(1);
  });
});

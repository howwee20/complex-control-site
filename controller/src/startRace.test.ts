import { afterEach, describe, expect, it, vi } from "vitest";
import { startSelectedRace } from "./startRace";
import type { RaceSnapshot, RaceSummary, ControlState } from "./types";

function setup(overrides: Partial<RaceSnapshot> = {}, previous = true) {
  let current = { id: "selected", status: "READY", started_at: null, control_state: "RED", superseded: false, format: "QUALIFYING_PRACTICE", ...overrides } as RaceSnapshot;
  const old = { id: "old", status: "RUNNING", entrants: [{ laps_completed: 7 }] };
  const calls: string[] = [];
  const client = {
    getRace: vi.fn(async () => ({ ...current })),
    listRaces: vi.fn(async () => (previous ? [old] : []) as unknown as RaceSummary[]),
    finishRace: vi.fn(async (id: string) => {
      calls.push(`finish:${id}`);
      old.status = "FINISHED";
      return old as unknown as RaceSnapshot;
    }),
    startRace: vi.fn(async (id: string) => {
      calls.push(`start:${id}`);
      current = { ...current, status: "RUNNING" };
      return { ...current };
    }),
    setControlState: vi.fn(async (id: string, state: ControlState) => {
      calls.push(`flag:${state}:${id}`);
      current = { ...current, control_state: state, started_at: "2026-10-03T12:00:00" };
      return { ...current };
    }),
  };
  return { client, calls, old, set: (patch: Partial<RaceSnapshot>) => { current = { ...current, ...patch }; } };
}

afterEach(() => vi.useRealTimers());

describe("one-tap race start", () => {
  it("finishes the previous race with results intact and starts the selected race GREEN", async () => {
    const { client, calls, old } = setup();
    const result = await startSelectedRace("selected", client);
    expect(calls).toEqual(["finish:old", "start:selected", "flag:GREEN:selected"]);
    expect(old.entrants[0]?.laps_completed).toBe(7);
    expect(result.control_state).toBe("GREEN");
    expect(result.started_at).not.toBeNull();
  });
  it("starts with no previous active race", async () => {
    const { client } = setup({}, false);
    expect((await startSelectedRace("selected", client)).status).toBe("RUNNING");
    expect(client.finishRace).not.toHaveBeenCalled();
  });
  it("does not reset a running race on a repeated request", async () => {
    const { client } = setup({ status: "RUNNING", control_state: "YELLOW", started_at: "original" });
    expect((await startSelectedRace("selected", client)).started_at).toBe("original");
    expect(client.listRaces).not.toHaveBeenCalled();
    expect(client.setControlState).not.toHaveBeenCalled();
  });
  it("recovers an old staged race without staging it again", async () => {
    const { client } = setup({ status: "RUNNING" }, false);
    expect((await startSelectedRace("selected", client)).control_state).toBe("GREEN");
    expect(client.startRace).not.toHaveBeenCalled();
  });
  it("rejects a completed race without ending another race", async () => {
    const { client } = setup({ status: "FINISHED" });
    await expect(startSelectedRace("selected", client)).rejects.toThrow("Restart race");
    expect(client.finishRace).not.toHaveBeenCalled();
  });
  it("does not start when the prior race cannot be finished", async () => {
    const { client } = setup();
    client.finishRace.mockRejectedValueOnce(new Error("offline"));
    await expect(startSelectedRace("selected", client)).rejects.toThrow("offline");
    expect(client.startRace).not.toHaveBeenCalled();
    expect(client.setControlState).not.toHaveBeenCalled();
  });
  it("can retry after a failed GREEN request", async () => {
    const { client } = setup({}, false);
    client.setControlState.mockRejectedValueOnce(new Error("offline"));
    await expect(startSelectedRace("selected", client)).rejects.toThrow("offline");
    expect((await startSelectedRace("selected", client)).control_state).toBe("GREEN");
    expect(client.startRace).toHaveBeenCalledTimes(1);
  });
  it("recovers a lost start response", async () => {
    const { client, set } = setup({}, false);
    client.startRace.mockImplementationOnce(async () => { set({ status: "RUNNING" }); throw new Error("lost response"); });
    await expect(startSelectedRace("selected", client)).rejects.toThrow("lost response");
    expect((await startSelectedRace("selected", client)).control_state).toBe("GREEN");
    expect(client.startRace).toHaveBeenCalledTimes(1);
  });
  it("deduplicates double taps", async () => {
    const { client } = setup();
    const first = startSelectedRace("selected", client);
    expect(startSelectedRace("selected", client)).toBe(first);
    await first;
    expect(client.startRace).toHaveBeenCalledTimes(1);
    expect(client.finishRace).toHaveBeenCalledTimes(1);
  });
  it("retains the configured barrel random start delay", async () => {
    vi.useFakeTimers();
    const { client } = setup({ format: "BARREL_RACING", mode_config: { barrel_start_mode: "GREEN", barrel_random_start_min_seconds: 2, barrel_random_start_max_seconds: 2 } as RaceSnapshot["mode_config"] }, false);
    const result = startSelectedRace("selected", client);
    await vi.advanceTimersByTimeAsync(1999);
    expect(client.setControlState).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).control_state).toBe("GREEN");
  });
  it("does not send a delayed GREEN after a barrel race has ended", async () => {
    vi.useFakeTimers();
    const { client, set } = setup({ format: "BARREL_RACING", mode_config: { barrel_start_mode: "GREEN", barrel_random_start_min_seconds: 2, barrel_random_start_max_seconds: 2 } as RaceSnapshot["mode_config"] }, false);
    const result = startSelectedRace("selected", client);
    const rejection = expect(result).rejects.toThrow("ended before");
    await vi.advanceTimersByTimeAsync(1000);
    set({ status: "FINISHED" });
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(client.setControlState).not.toHaveBeenCalled();
  });
});

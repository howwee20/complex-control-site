import type { api } from "./api";
import type { RaceSnapshot } from "./types";

type RaceApi = Pick<typeof api, "getRace" | "listRaces" | "finishRace" | "startRace" | "setControlState">;
const pending = new Map<string, Promise<RaceSnapshot>>();

// Compatible with the installed Pi API: finish the previous race without deleting
// its results, then start this race and release it from the legacy staging state.
export function startSelectedRace(raceId: string, client: RaceApi): Promise<RaceSnapshot> {
  const existing = pending.get(raceId);
  if (existing) return existing;
  const operation = start(raceId, client).finally(() => pending.delete(raceId));
  pending.set(raceId, operation);
  return operation;
}

async function start(raceId: string, client: RaceApi): Promise<RaceSnapshot> {
  let race = await client.getRace(raceId);
  if (race.superseded || !["READY", "RUNNING"].includes(race.status)) {
    throw new Error("This race has ended. Use Restart race to create a new attempt.");
  }
  if (race.status === "RUNNING" && race.started_at !== null) return race;
  for (const previous of await client.listRaces()) {
    if (previous.id !== raceId && previous.status === "RUNNING") {
      await client.finishRace(previous.id);
    }
  }
  // Read again after ending the previous race, including when recovering from a
  // lost response. Never reset a race that another request already started.
  race = await client.getRace(raceId);
  if (race.status === "READY") race = await client.startRace(raceId);
  if (race.status !== "RUNNING") throw new Error("The race changed before it could start. Open it again to check its status.");
  if (race.started_at !== null || race.control_state === "GREEN") return race;

  if (race.format === "BARREL_RACING" && race.mode_config.barrel_start_mode === "GREEN") {
    const minimum = race.mode_config.barrel_random_start_min_seconds;
    const maximum = race.mode_config.barrel_random_start_max_seconds;
    await new Promise((resolve) => setTimeout(resolve, (minimum + Math.random() * Math.max(0, maximum - minimum)) * 1000));
    race = await client.getRace(raceId);
    if (race.status !== "RUNNING") throw new Error("The run ended before the random green.");
    if (race.started_at !== null || race.control_state === "GREEN") return race;
  }
  return client.setControlState(raceId, "GREEN");
}

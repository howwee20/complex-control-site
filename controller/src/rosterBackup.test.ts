import { describe, expect, it } from "vitest";
import { downloadName, parseRosterFile, phoneCopyForRestore, previewDocument, readPhoneCopy, savePhoneCopy, summarizeRestore } from "./rosterBackup";
import type { RacerProfile, RosterDocument } from "./types";

class MemoryStorage {
  values = new Map<string, string>();
  full = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.full) throw new DOMException("full", "QuotaExceededError"); this.values.set(key, value); }
}

const profile = (index: number): RacerProfile => ({
  id: `preview-profile-${index}`, driver_name: `Racer ${index}`, kart_number: String(index), tag_id: `TAG-${index}`,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
});

const controllerDocument = (controllerId: string | null = "controller-1"): RosterDocument => ({
  format: "complex-control-roster-v1", controller_id: controllerId, source: "controller", roster_seq: 3,
  exported_at: "2026-10-23T18:00:00Z", profiles: [{ ...profile(1), revision: 2 }], tombstones: [],
});

describe("roster files", () => {
  it("exports website preview racers in the controller restore format", () => {
    const document = previewDocument([profile(0), profile(1)], new Date("2026-10-23T18:00:00Z"));
    expect(document.format).toBe("complex-control-roster-v1");
    expect(document.source).toBe("website-preview");
    expect(document.profiles.map((item) => item.revision)).toEqual([1, 1]);
    expect(downloadName(document)).toBe("complex-control-roster-preview-2026-10-23-18-00.json");
  });

  it("accepts roster backups and rejects anything else with a clear message", () => {
    expect(parseRosterFile(JSON.stringify(controllerDocument())).profiles).toHaveLength(1);
    expect(() => parseRosterFile("not json")).toThrow("not a Complex Control roster backup");
    expect(() => parseRosterFile(JSON.stringify({ format: "other", profiles: [] }))).toThrow("not a Complex Control roster backup");
    expect(parseRosterFile(JSON.stringify({ format: "complex-control-roster-v1", profiles: [] })).tombstones).toEqual([]);
  });

  it("keeps a per-controller copy on the phone and survives full storage", () => {
    const storage = new MemoryStorage();
    expect(savePhoneCopy(storage as unknown as Storage, controllerDocument(), new Date("2026-10-23T18:00:00Z"))).toBe(true);
    expect(readPhoneCopy(storage as unknown as Storage, "controller-1")?.document.profiles).toHaveLength(1);
    expect(readPhoneCopy(storage as unknown as Storage, "controller-2")).toBeNull();
    expect(savePhoneCopy(storage as unknown as Storage, controllerDocument(null))).toBe(false);
    storage.full = true;
    expect(savePhoneCopy(storage as unknown as Storage, controllerDocument())).toBe(false);
    expect(readPhoneCopy(storage as unknown as Storage, "controller-1")?.saved_at).toBe("2026-10-23T18:00:00.000Z");
  });

  it("summarizes a restore plan in plain words", () => {
    expect(summarizeRestore({ applied: false, conflicts: 1, roster_seq: 4, changes: [], counts: { add: 2, conflict: 1, unchanged: 0 } }))
      .toBe("2 new · 1 need your choice");
    expect(summarizeRestore({ applied: false, conflicts: 0, roster_seq: 4, changes: [], counts: {} })).toBe("Nothing to change");
  });
});

describe("replacement controller", () => {
  it("offers the newest copy from another controller when this one has none", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    savePhoneCopy(storage, controllerDocument("old-controller"), new Date("2026-10-20T00:00:00Z"));
    savePhoneCopy(storage, controllerDocument("other-controller"), new Date("2026-10-22T00:00:00Z"));
    const offered = phoneCopyForRestore(storage, "new-controller");
    expect(offered?.fromOtherController).toBe(true);
    expect(offered?.document.controller_id).toBe("other-controller");
    expect(phoneCopyForRestore(storage, "old-controller")?.fromOtherController).toBe(false);
  });
});

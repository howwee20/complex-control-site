// Portable racer roster files and the phone's own copy of a controller roster.
//
// The controller's database is the real roster. These helpers let the phone
// carry a copy (for a replacement SD card or a lost controller) and let the
// website preview's demo racers be moved onto a controller, always through
// the controller's merge preview so nothing is overwritten blindly.

import type { RacerProfile, RosterDocument, RosterRestoreView } from "./types";

export const ROSTER_FORMAT = "complex-control-roster-v1";
const PHONE_COPY_PREFIX = "complex-control-roster-copy:";

export interface PhoneCopy {
  document: RosterDocument;
  saved_at: string;
}

export function previewDocument(profiles: RacerProfile[], now = new Date()): RosterDocument {
  return {
    format: ROSTER_FORMAT,
    controller_id: null,
    source: "website-preview",
    roster_seq: null,
    exported_at: now.toISOString(),
    profiles: profiles.map((profile) => ({
      id: profile.id.slice(0, 36),
      driver_name: profile.driver_name,
      kart_number: profile.kart_number,
      tag_id: profile.tag_id,
      revision: profile.revision ?? 1,
    })),
    tombstones: [],
  };
}

export function parseRosterFile(text: string): RosterDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not a Complex Control roster backup.");
  }
  const candidate = parsed as Partial<RosterDocument> | null;
  if (!candidate || candidate.format !== ROSTER_FORMAT || !Array.isArray(candidate.profiles)) {
    throw new Error("That file is not a Complex Control roster backup.");
  }
  return { tombstones: [], ...candidate } as RosterDocument;
}

export function savePhoneCopy(storage: Storage, document: RosterDocument, now = new Date()): boolean {
  if (!document.controller_id) return false;
  try {
    const copy: PhoneCopy = { document, saved_at: now.toISOString() };
    storage.setItem(PHONE_COPY_PREFIX + document.controller_id, JSON.stringify(copy));
    return true;
  } catch {
    return false; // Storage full or disabled; the downloaded file is the durable copy.
  }
}

export function readPhoneCopy(storage: Storage, controllerId: string | null): PhoneCopy | null {
  if (!controllerId) return null;
  try {
    const raw = storage.getItem(PHONE_COPY_PREFIX + controllerId);
    if (!raw) return null;
    const copy = JSON.parse(raw) as PhoneCopy;
    return copy.document?.format === ROSTER_FORMAT ? copy : null;
  } catch {
    return null;
  }
}

/**
 * The phone's copy for this controller, or else the newest copy saved from any
 * controller this phone has used (for example before an SD card replacement).
 */
export function phoneCopyForRestore(storage: Storage, controllerId: string | null): (PhoneCopy & { fromOtherController: boolean }) | null {
  const own = readPhoneCopy(storage, controllerId);
  if (own) return { ...own, fromOtherController: false };
  let newest: PhoneCopy | null = null;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(PHONE_COPY_PREFIX)) continue;
      const copy = readPhoneCopy(storage, key.slice(PHONE_COPY_PREFIX.length));
      if (copy && copy.document.profiles.length > 0 && (!newest || copy.saved_at > newest.saved_at)) newest = copy;
    }
  } catch {
    return null;
  }
  return newest ? { ...newest, fromOtherController: true } : null;
}

export function downloadName(document: RosterDocument): string {
  const stamp = (document.exported_at ?? new Date().toISOString()).slice(0, 16).replace(/[:T]/g, "-");
  return `complex-control-roster-${document.source === "website-preview" ? "preview-" : ""}${stamp}.json`;
}

const ACTION_LABELS: Record<string, string> = {
  add: "new",
  update: "updated",
  restore: "restored",
  delete: "deleted",
  unchanged: "already saved",
  keep_local: "kept as saved here",
  conflict: "need your choice",
  skip_delete: "deleted elsewhere but kept here",
};

export function summarizeRestore(view: RosterRestoreView): string {
  const parts = Object.entries(view.counts)
    .filter(([, count]) => count > 0)
    .map(([action, count]) => `${count} ${ACTION_LABELS[action] ?? action}`);
  return parts.length ? parts.join(" · ") : "Nothing to change";
}

import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../format";
import {
  downloadName,
  parseRosterFile,
  phoneCopyForRestore,
  previewDocument,
  savePhoneCopy,
  summarizeRestore,
  type PhoneCopy,
} from "../rosterBackup";
import type { RacerProfile, RosterDocument, RosterResolution, RosterRestoreView } from "../types";

interface Props {
  hardwareAvailable: boolean;
  profiles: RacerProfile[];
  onRestored: () => Promise<void>;
  onError: (message: string | null) => void;
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function saveFile(document: RosterDocument) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = downloadName(document);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RosterBackup({ hardwareAvailable, profiles, onRestored, onError }: Props) {
  const [phoneCopy, setPhoneCopy] = useState<(PhoneCopy & { fromOtherController: boolean }) | null>(null);
  const [pending, setPending] = useState<{ document: RosterDocument; label: string } | null>(null);
  const [plan, setPlan] = useState<RosterRestoreView | null>(null);
  const [choices, setChoices] = useState<Record<string, RosterResolution>>({});
  const [applyDeletions, setApplyDeletions] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Keep this phone's copy of the controller roster current whenever the roster changes.
  useEffect(() => {
    if (!hardwareAvailable) return;
    let cancelled = false;
    void api.rosterBackup().then((document) => {
      const store = storage();
      if (cancelled || !store) return;
      if (document.profiles.length > 0) savePhoneCopy(store, document);
      setPhoneCopy(phoneCopyForRestore(store, document.controller_id ?? null));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [hardwareAvailable, profiles]);

  const preview = async (document: RosterDocument, label: string) => {
    onError(null);
    setResult(null);
    setWorking(true);
    try {
      setPlan(await api.restoreRoster(document));
      setPending({ document, label });
      setChoices({});
      setApplyDeletions(false);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "The roster could not be checked");
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      const applied = await api.restoreRoster(pending.document, { apply: true, applyDeletions, resolutions: choices });
      setResult(`Restored from ${pending.label}: ${summarizeRestore(applied)}.`);
      setPending(null);
      setPlan(null);
      await onRestored();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "The roster could not be restored");
    } finally {
      setWorking(false);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await preview(parseRosterFile(await file.text()), file.name);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "That file could not be read");
    }
  };

  if (!hardwareAvailable) {
    return (
      <section className="roster-backup">
        <div>
          <p className="eyebrow">Move preview racers</p>
          <p>Racers you add here stay in this browser. Download them, then open Racer Profiles on your controller and choose Restore from file. Racers already on the controller are never replaced.</p>
        </div>
        <button className="secondary-button" type="button" disabled={profiles.length === 0} onClick={() => saveFile(previewDocument(profiles))}>Download preview racers</button>
      </section>
    );
  }

  const conflicts = plan?.changes.filter((change) => change.action === "conflict") ?? [];
  const deletions = plan?.counts.skip_delete ?? 0;

  return (
    <section className="roster-backup">
      <div>
        <p className="eyebrow">Backup and restore</p>
        <p>
          {phoneCopy && phoneCopy.fromOtherController
            ? `This phone has a roster copy from another controller: ${phoneCopy.document.profiles.length} racers, saved ${formatDate(phoneCopy.saved_at)}. Restore it to set up this controller.`
            : phoneCopy
              ? `This phone keeps a copy: ${phoneCopy.document.profiles.length} racers, saved ${formatDate(phoneCopy.saved_at)}. The controller also backs up everything daily.`
              : "The controller backs up everything daily. Download a roster file to keep a copy off the controller."}
        </p>
        {result && <p className="roster-result" role="status">{result}</p>}
      </div>
      <div className="roster-actions">
        <a className="secondary-button link-button" href="/api/racer-profiles/backup" download>Download roster backup</a>
        <label className="secondary-button file-button">
          Restore from file
          <input type="file" accept=".json,application/json" disabled={working} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        {phoneCopy && <button className="secondary-button" type="button" disabled={working} onClick={() => void preview(phoneCopy.document, "this phone's copy")}>Restore this phone’s copy</button>}
      </div>

      {pending && plan && (
        <div className="modal-backdrop">
          <div className="confirm-modal roster-plan" role="dialog" aria-label="Restore preview">
            <p className="eyebrow">Restore preview</p>
            <h3>{summarizeRestore(plan)}</h3>
            <p>From {pending.label}. Racers saved on this controller are only changed where the file is newer. Event rosters are never changed.</p>
            {conflicts.length > 0 && (
              <ul className="roster-conflicts">
                {conflicts.map((change) => (
                  <li key={change.profile_id}>
                    <strong>{change.incoming?.driver_name ?? change.local?.driver_name} #{change.incoming?.kart_number}</strong>
                    {change.conflict === "tag_in_use"
                      ? <small>Tag {change.incoming?.tag_id} belongs to another racer here, so this racer is skipped. Change one tag, then restore again.</small>
                      : (
                        <span className="conflict-choice">
                          <small>Changed here and in the file: here “{change.local?.driver_name} #{change.local?.kart_number} · {change.local?.tag_id}”, file “{change.incoming?.driver_name} #{change.incoming?.kart_number} · {change.incoming?.tag_id}”.</small>
                          <label><input type="radio" name={change.profile_id} checked={choices[change.profile_id] !== "use_incoming"} onChange={() => setChoices({ ...choices, [change.profile_id]: "keep_local" })} /> Keep this controller’s</label>
                          <label><input type="radio" name={change.profile_id} checked={choices[change.profile_id] === "use_incoming"} onChange={() => setChoices({ ...choices, [change.profile_id]: "use_incoming" })} /> Use the file’s</label>
                        </span>
                      )}
                  </li>
                ))}
              </ul>
            )}
            {deletions > 0 && (
              <label className="check-field"><input type="checkbox" checked={applyDeletions} onChange={(event) => setApplyDeletions(event.target.checked)} /> Also remove {deletions} racer{deletions === 1 ? "" : "s"} deleted in the file</label>
            )}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => { setPending(null); setPlan(null); }}>Cancel</button>
              <button className="primary-button" type="button" disabled={working} onClick={() => void apply()}>Restore</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

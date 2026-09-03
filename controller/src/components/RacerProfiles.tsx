import { useEffect, useRef, useState } from "react";
import type { EventView, RacerProfile } from "../types";

type ProfileInput = Pick<RacerProfile, "driver_name" | "kart_number" | "tag_id">;

interface Props {
  busy: boolean;
  profiles: RacerProfile[];
  readerEvent: EventView | null;
  onCreate: (profile: ProfileInput) => Promise<void>;
  onUpdate: (profileId: string, profile: ProfileInput) => Promise<void>;
  onDelete: (profileId: string) => Promise<void>;
  hardwareAvailable: boolean;
}

const emptyProfile = (): ProfileInput => ({ driver_name: "", kart_number: "", tag_id: "" });

export function RacerProfiles({ busy, profiles, readerEvent, onCreate, onUpdate, onDelete, hardwareAvailable }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileInput>(emptyProfile);
  const [scanAfter, setScanAfter] = useState<string | null | undefined>(undefined);
  const [calibration, setCalibration] = useState<{ profileId: string; after: string | null } | null>(null);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => {
    if (scanAfter === undefined || !readerEvent || readerEvent.id === scanAfter) return;
    setDraft((current) => ({ ...current, tag_id: readerEvent.tag_id }));
    setScanAfter(undefined);
  }, [readerEvent?.id, scanAfter]);

  useEffect(() => {
    if (!calibration || !readerEvent || readerEvent.id === calibration.after) return;
    const profile = profiles.find((candidate) => candidate.id === calibration.profileId);
    if (!profile) {
      setCalibration(null);
      return;
    }
    setCalibration(null);
    void onUpdate(profile.id, {
      driver_name: profile.driver_name,
      kart_number: profile.kart_number,
      tag_id: readerEvent.tag_id,
    });
  }, [calibration, onUpdate, profiles, readerEvent]);

  const beginCalibrationHold = (profileId: string) => {
    if (!hardwareAvailable || busy) return;
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      setCalibration({ profileId, after: readerEvent?.id ?? null });
    }, 2000);
  };

  const cancelCalibrationHold = () => {
    if (holdTimer.current === null) return;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const reset = () => {
    setEditingId(null);
    setDraft(emptyProfile());
    setScanAfter(undefined);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId) await onUpdate(editingId, draft);
    else await onCreate(draft);
    reset();
  };

  return (
    <section className="profiles-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">RFID roster</p>
          <h2>Racer Profiles</h2>
          <p className="section-copy">Register each racer once, then select them when you build a race.</p>
        </div>
        <span className="quiet-label">{profiles.length} registered</span>
      </div>

      <form className="profile-editor" onSubmit={submit}>
        <div className="profile-editor-heading">
          <h3>{editingId ? "Edit Racer" : "Add Racer"}</h3>
          <span>{scanAfter !== undefined ? "Waiting for a physical tag…" : readerEvent ? `Reader ready · last tag ${readerEvent.tag_id}` : "Reader waiting"}</span>
        </div>
        <label><span>Racer name</span><input value={draft.driver_name} onChange={(event) => setDraft({ ...draft, driver_name: event.target.value })} placeholder="Racer name" required /></label>
        <label><span>Racer number</span><input value={draft.kart_number} onChange={(event) => setDraft({ ...draft, kart_number: event.target.value })} placeholder="#" required /></label>
        <label className="profile-tag-field">
          <span>RFID tag</span>
          <div className="tag-input">
            <input value={draft.tag_id} onChange={(event) => setDraft({ ...draft, tag_id: event.target.value })} placeholder="Scan or enter tag" required />
            <button type="button" className={scanAfter !== undefined ? "scanning" : ""} onClick={() => setScanAfter(readerEvent?.id ?? null)}>{scanAfter !== undefined ? "Waiting…" : "Scan tag"}</button>
          </div>
        </label>
        <div className="profile-form-actions">
          {editingId && <button type="button" className="secondary-button" onClick={reset}>Cancel</button>}
          <button type="submit" className="primary-button" disabled={busy}>{editingId ? "Save racer" : "Add racer"}</button>
        </div>
      </form>

      <div className="profile-list">
        {profiles.length === 0 && <p className="empty-state">No racers yet. Scan the first tag above.</p>}
        {profiles.map((profile) => (
          <article key={profile.id}>
            <span className="profile-number">#{profile.kart_number}</span>
            <div><strong>{profile.driver_name}</strong><small>{profile.tag_id}</small></div>
            <button
              className={calibration?.profileId === profile.id ? "calibrate-button waiting" : "calibrate-button"}
              type="button"
              disabled={busy || !hardwareAvailable}
              onPointerDown={() => beginCalibrationHold(profile.id)}
              onPointerUp={cancelCalibrationHold}
              onPointerLeave={cancelCalibrationHold}
              onPointerCancel={cancelCalibrationHold}
            >
              {!hardwareAvailable ? "Available at track" : calibration?.profileId === profile.id ? "Scan transponder…" : "Hold to Calibrate"}
            </button>
            <button className="secondary-button" type="button" onClick={() => { setEditingId(profile.id); setDraft(profile); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
            <button className="danger-button" type="button" disabled={busy} onClick={() => {
              if (window.confirm(`Delete ${profile.driver_name}'s racer profile?`)) void onDelete(profile.id);
            }}>Delete</button>
          </article>
        ))}
      </div>
    </section>
  );
}

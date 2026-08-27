import { useEffect, useMemo, useState } from "react";
import type { EntrantInput, EventCreate, EventSummary, EventView, RaceFormat, RacerProfile } from "../types";

interface Props {
  busy: boolean;
  readerEvent: EventView | null;
  profiles: RacerProfile[];
  savedEvents: EventSummary[];
  onCreate: (event: EventCreate) => Promise<void>;
  onOpen: (eventId: string) => Promise<void>;
  onDuplicate: (eventId: string) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

const blankRacer = (): EntrantInput => ({ driver_name: "", kart_number: "", tag_id: "", heat_number: 1 });

const formats: Array<{ value: RaceFormat; label: string; detail: string }> = [
  { value: "HEATS", label: "Double Elimination", detail: "Heats qualify racers for the Main; remaining racers get a final chance through the LCQ." },
  { value: "SINGLE_ELIMINATION", label: "Single Elimination", detail: "One loss eliminates a racer; winners advance until the final." },
  { value: "DOUBLE_ELIMINATION", label: "Double-Elimination Bracket", detail: "Two losses eliminate a racer through winners and losers brackets." },
  { value: "HEADS_UP", label: "Heads-Up Bracket", detail: "Two-racer matches advance winners through a direct bracket." },
];

export function RaceSetup({ busy, readerEvent, profiles, savedEvents, onCreate, onOpen, onDuplicate, onDelete, onDeleteAll }: Props) {
  const [selectedSaved, setSelectedSaved] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [format, setFormat] = useState<RaceFormat>("HEATS");
  const [heatLaps, setHeatLaps] = useState(5);
  const [lcqLaps, setLcqLaps] = useState(5);
  const [mainLaps, setMainLaps] = useState(10);
  const [heatCount, setHeatCount] = useState(1);
  const [advanceCount, setAdvanceCount] = useState(1);
  const [lcqCount, setLcqCount] = useState(1);
  const [lcqAdvanceCount, setLcqAdvanceCount] = useState(1);
  const [duplicateWindow, setDuplicateWindow] = useState(3000);
  const [invertMain, setInvertMain] = useState(true);
  const [formationStart, setFormationStart] = useState(true);
  const [formationRestart, setFormationRestart] = useState(false);
  const [cautionSync, setCautionSync] = useState(true);
  const [randomizeGrid, setRandomizeGrid] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [raceDayRacers, setRaceDayRacers] = useState<EntrantInput[]>([]);
  const [scanTarget, setScanTarget] = useState<{ index: number; afterId: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const updateRaceDayRacer = (index: number, field: keyof EntrantInput, value: string | number | null) => {
    setRaceDayRacers((current) => current.map((racer, racerIndex) => racerIndex === index ? { ...racer, [field]: value } : racer));
  };

  useEffect(() => {
    if (!scanTarget || !readerEvent || readerEvent.id === scanTarget.afterId) return;
    updateRaceDayRacer(scanTarget.index, "tag_id", readerEvent.tag_id);
    setScanTarget(null);
  }, [readerEvent?.id, scanTarget]);

  const racers = useMemo(() => {
    const registered = profiles
      .filter((profile) => selectedProfiles.has(profile.id))
      .map((profile, index) => ({
        driver_name: profile.driver_name,
        kart_number: profile.kart_number,
        tag_id: profile.tag_id,
        heat_number: (index % Math.max(1, heatCount)) + 1,
      }));
    return [...registered, ...raceDayRacers];
  }, [profiles, selectedProfiles, raceDayRacers, heatCount]);

  const estimatedRaces = useMemo(() => {
    if (format === "HEATS") return Math.min(heatCount, Math.max(1, racers.length)) + lcqCount + 1;
    if (format === "DOUBLE_ELIMINATION") return Math.max(1, racers.length * 2 - 1);
    return Math.max(1, racers.length - 1);
  }, [format, heatCount, lcqCount, racers.length]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (racers.length === 0) {
      setFormError("Select at least one registered racer or add a race-day racer.");
      return;
    }
    await onCreate({
      name,
      location: location.trim() || null,
      format,
      target_laps: mainLaps,
      heat_laps: heatLaps,
      lcq_laps: lcqLaps,
      main_laps: mainLaps,
      heat_count: format === "HEATS" ? heatCount : 1,
      advance_count: format === "HEATS" ? advanceCount : 1,
      lcq_enabled: format === "HEATS" && lcqCount > 0,
      lcq_count: format === "HEATS" ? lcqCount : 1,
      lcq_advance_count: format === "HEATS" ? lcqAdvanceCount : 1,
      invert_main: format === "HEATS" && invertMain,
      formation_lap_on_start: formationStart,
      formation_lap_on_restart: formationRestart,
      caution_sync_to_leader: cautionSync,
      duplicate_window_ms: duplicateWindow,
      randomize_grid: randomizeGrid,
      racers,
    });
  };

  const allSelected = profiles.length > 0 && profiles.every((profile) => selectedProfiles.has(profile.id));
  const selectedFormat = formats.find((item) => item.value === format)!;

  return (
    <section className="race-hub-shell">
      <div className="section-heading">
        <div><p className="eyebrow">Trackside control</p><h2>Race Hub</h2><p className="section-copy">Build the race here. The Pi stores it and the physical reader scores it.</p></div>
      </div>

      <section className="race-hub-panel saved-races-panel">
        <h3>Current and Past Races</h3>
        <div className="saved-race-actions">
          <select aria-label="Select a saved race" value={selectedSaved} onChange={(event) => setSelectedSaved(event.target.value)}>
            <option value="">Select a saved race</option>
            {savedEvents.map((event) => <option key={event.id} value={event.id}>{event.name} · {event.status}</option>)}
          </select>
          <button className="primary-button open-race-button" type="button" disabled={!selectedSaved || busy} onClick={() => void onOpen(selectedSaved)}>Open Race</button>
          <button className="duplicate-button" type="button" disabled={!selectedSaved || busy} onClick={() => void onDuplicate(selectedSaved)}>Duplicate</button>
          <button className="danger-button" type="button" disabled={!selectedSaved || busy} onClick={() => {
            if (window.confirm("Delete this saved race and all of its results?")) void onDelete(selectedSaved);
          }}>Delete Race</button>
          <button className="danger-button" type="button" disabled={savedEvents.length === 0 || busy} onClick={() => {
            if (window.confirm("Delete every saved race and all results? This cannot be undone.")) void onDeleteAll();
          }}>Delete All Races</button>
        </div>
      </section>

      <form onSubmit={submit} className="race-hub-panel race-create-panel">
        <h3>Create New Race</h3>
        <div className="event-fields race-hub-fields">
          <label><span>Race name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter race name" required /></label>
          <label><span>Race location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter race location" maxLength={160} /></label>
          <label><span>Select race type</span><select value={format} onChange={(event) => setFormat(event.target.value as RaceFormat)}>{formats.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><small className="field-help">{selectedFormat.detail}</small></label>
        </div>

        <div className="racer-selector-heading">
          <h4>Select Racers</h4>
          <div><button type="button" className="primary-button" onClick={() => setSelectedProfiles(new Set(profiles.map((profile) => profile.id)))}>Select All Racers</button><button type="button" className="primary-button" onClick={() => setSelectedProfiles(new Set())} disabled={!allSelected && selectedProfiles.size === 0}>Unselect All Racers</button></div>
        </div>
        <div className="racer-profile-picker">
          {profiles.length === 0 && <p className="empty-state">No registered racers. Open Racer Profiles in the top menu, or add a race-day racer below.</p>}
          {profiles.map((profile) => <label key={profile.id}><input type="checkbox" checked={selectedProfiles.has(profile.id)} onChange={(event) => setSelectedProfiles((current) => { const next = new Set(current); if (event.target.checked) next.add(profile.id); else next.delete(profile.id); return next; })} /><span>{profile.driver_name} (#{profile.kart_number})</span><small>{profile.tag_id}</small></label>)}
        </div>

        {format === "HEATS" && <div className="race-configuration-grid">
          <label><span>Number of racers</span><input value={racers.length} readOnly /></label>
          <label><span>Number of heats</span><input type="number" min="1" max="100" value={heatCount} onChange={(event) => setHeatCount(Number(event.target.value))} /></label>
          <label><span>Advance from each heat</span><input type="number" min="1" max="200" value={advanceCount} onChange={(event) => setAdvanceCount(Number(event.target.value))} /></label>
          <label><span>Number of LCQs</span><input type="number" min="0" max="100" value={lcqCount} onChange={(event) => setLcqCount(Number(event.target.value))} /></label>
          <label><span>Advance from LCQ</span><input type="number" min="1" max="200" value={lcqAdvanceCount} onChange={(event) => setLcqAdvanceCount(Number(event.target.value))} /></label>
          <label><span>Heats laps</span><input type="number" min="1" max="10000" value={heatLaps} onChange={(event) => setHeatLaps(Number(event.target.value))} /></label>
          <label><span>LCQ laps</span><input type="number" min="1" max="10000" value={lcqLaps} onChange={(event) => setLcqLaps(Number(event.target.value))} /></label>
          <label><span>Main event laps</span><input type="number" min="1" max="10000" value={mainLaps} onChange={(event) => setMainLaps(Number(event.target.value))} /></label>
          <label className="wide-toggle"><span>Invert Main field</span><span className="inline-check"><input type="checkbox" checked={invertMain} onChange={(event) => setInvertMain(event.target.checked)} /> Slowest qualifier starts first</span></label>
        </div>}

        {format !== "HEATS" && <div className="race-configuration-grid"><label><span>Race laps</span><input type="number" min="1" max="10000" value={mainLaps} onChange={(event) => setMainLaps(Number(event.target.value))} /></label></div>}

        <details className="rules-panel" open>
          <summary><span className="step-number">✓</span><span><strong>Race Rules</strong><small>Reader and caution behavior</small></span><b>Customize</b></summary>
          <div className="rule-grid">
            <label className="check-field"><input type="checkbox" checked={formationStart} onChange={(event) => setFormationStart(event.target.checked)} /><span>Skip one lap on every first green flag</span></label>
            <label className="check-field"><input type="checkbox" checked={formationRestart} onChange={(event) => setFormationRestart(event.target.checked)} /><span>Skip one lap after every restart</span></label>
            <label className="check-field"><input type="checkbox" checked={cautionSync} onChange={(event) => setCautionSync(event.target.checked)} /><span>Keep racers on the lead lap during cautions</span></label>
            <label className="check-field"><input type="checkbox" checked={randomizeGrid} onChange={(event) => setRandomizeGrid(event.target.checked)} /><span>Randomize starting assignments</span></label>
            <label className="rule-field"><span>Ignore repeat scans for</span><div className="input-suffix"><input type="number" min="0" max="60" step="0.1" value={duplicateWindow / 1000} onChange={(event) => setDuplicateWindow(Math.round(Number(event.target.value) * 1000))} /><em>seconds</em></div></label>
          </div>
        </details>

        <details className="race-day-editor">
          <summary>+ Add a race-day racer without saving a profile</summary>
          <div className="entrant-editor">
            {raceDayRacers.map((racer, index) => <div className="entrant-row" key={index}>
              <input aria-label={`Racer ${index + 1}`} value={racer.driver_name} onChange={(event) => updateRaceDayRacer(index, "driver_name", event.target.value)} placeholder="Racer name" required />
              <input aria-label={`Kart ${index + 1}`} value={racer.kart_number} onChange={(event) => updateRaceDayRacer(index, "kart_number", event.target.value)} placeholder="Kart #" required />
              <div className="tag-input"><input aria-label={`Tag ${index + 1}`} value={racer.tag_id} onChange={(event) => updateRaceDayRacer(index, "tag_id", event.target.value)} placeholder="Scan or enter tag" required /><button type="button" className={scanTarget?.index === index ? "scanning" : ""} onClick={() => setScanTarget({ index, afterId: readerEvent?.id ?? null })}>{scanTarget?.index === index ? "Waiting…" : "Scan tag"}</button></div>
              <button className="icon-button" type="button" onClick={() => setRaceDayRacers((current) => current.filter((_, item) => item !== index))}>×</button>
            </div>)}
            <button className="text-button" type="button" onClick={() => setRaceDayRacers((current) => [...current, blankRacer()])}>+ Add race-day racer</button>
          </div>
        </details>

        {formError && <p className="inline-form-error" role="alert">{formError}</p>}
        <section className="race-plan-preview"><div><span>Race plan preview</span><strong>{racers.length} racers</strong></div><div><span>Program</span><strong>{estimatedRaces} races</strong></div><div><span>Final distance</span><strong>{mainLaps} laps</strong></div><div><span>Grid</span><strong>{randomizeGrid ? "Randomized" : "Assigned"}</strong></div></section>
        <div className="form-footer"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create Race"}</button></div>
      </form>
    </section>
  );
}

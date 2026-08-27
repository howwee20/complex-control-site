import { useEffect, useMemo, useState } from "react";
import type { EntrantInput, EventCreate, EventView, RaceFormat } from "../types";

interface Props {
  busy: boolean;
  readerEvent: EventView | null;
  onCreate: (event: EventCreate) => Promise<void>;
}

const blankRacer = (): EntrantInput => ({
  driver_name: "",
  kart_number: "",
  tag_id: "",
  heat_number: 1,
});

const formats: Array<{ value: RaceFormat; label: string }> = [
  { value: "HEATS", label: "Heats and main" },
  { value: "HEADS_UP", label: "Heads-up bracket" },
  { value: "SINGLE_ELIMINATION", label: "Single elimination" },
  { value: "DOUBLE_ELIMINATION", label: "Double elimination" },
];

export function RaceSetup({ busy, readerEvent, onCreate }: Props) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [format, setFormat] = useState<RaceFormat>("HEATS");
  const [targetLaps, setTargetLaps] = useState(5);
  const [heatCount, setHeatCount] = useState(2);
  const [advanceCount, setAdvanceCount] = useState(1);
  const [lcqEnabled, setLcqEnabled] = useState(false);
  const [lcqAdvanceCount, setLcqAdvanceCount] = useState(1);
  const [duplicateWindow, setDuplicateWindow] = useState(3000);
  const [invertMain, setInvertMain] = useState(false);
  const [formationStart, setFormationStart] = useState(true);
  const [formationRestart, setFormationRestart] = useState(false);
  const [cautionSync, setCautionSync] = useState(true);
  const [randomizeGrid, setRandomizeGrid] = useState(false);
  const [racers, setRacers] = useState<EntrantInput[]>([
    { driver_name: "Driver 1", kart_number: "1", tag_id: "", heat_number: 1 },
  ]);
  const [scanTarget, setScanTarget] = useState<{ index: number; afterId: string | null } | null>(
    null,
  );

  const updateRacer = (
    index: number,
    field: keyof EntrantInput,
    value: string | number | null,
  ) => {
    setRacers((current) =>
      current.map((racer, racerIndex) =>
        racerIndex === index ? { ...racer, [field]: value } : racer,
      ),
    );
  };

  useEffect(() => {
    if (!scanTarget || !readerEvent || readerEvent.id === scanTarget.afterId) return;
    updateRacer(scanTarget.index, "tag_id", readerEvent.tag_id);
    setScanTarget(null);
  }, [readerEvent?.id, scanTarget]);

  const estimatedRaces = useMemo(() => {
    if (format === "HEATS") return Math.min(heatCount, racers.length) + 1 + (lcqEnabled ? 1 : 0);
    if (format === "DOUBLE_ELIMINATION") return Math.max(1, racers.length * 2 - 1);
    return Math.max(1, racers.length - 1);
  }, [format, heatCount, lcqEnabled, racers.length]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onCreate({
      name,
      location: location.trim() || null,
      format,
      target_laps: targetLaps,
      heat_count: format === "HEATS" ? heatCount : 1,
      advance_count: format === "HEATS" ? advanceCount : 1,
      lcq_enabled: format === "HEATS" && lcqEnabled,
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

  return (
    <section className="setup-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Race setup</p>
          <h2>Create new race</h2>
          <p className="section-copy">Name the race, choose the format, and register the tags that can score.</p>
        </div>
      </div>
      <form onSubmit={submit} className="setup-form">
        <section className="setup-section">
          <div className="setup-section-title">
            <span className="step-number">1</span>
            <div><h3>Race setup</h3><small>{estimatedRaces} scheduled race{estimatedRaces === 1 ? "" : "s"}</small></div>
          </div>
          <div className="event-fields">
            <label className="wide-field">
              <span>Race name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter race name" required />
            </label>
            <label>
              <span>Location</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional track name" maxLength={160} />
            </label>
            <label>
              <span>Select race type</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as RaceFormat)}>
                {formats.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Race laps</span>
              <input type="number" min="1" max="10000" value={targetLaps} onChange={(e) => setTargetLaps(Number(e.target.value))} required />
            </label>
            {format === "HEATS" && <>
              <label>
                <span>Number of heats</span>
                <input type="number" min="1" max="100" value={heatCount} onChange={(e) => setHeatCount(Number(e.target.value))} required />
              </label>
              <label>
                <span>Advance from each heat</span>
                <input type="number" min="1" max="200" value={advanceCount} onChange={(e) => setAdvanceCount(Number(e.target.value))} required />
              </label>
            </>}
          </div>
        </section>

        <details className="rules-panel">
          <summary>
            <span className="step-number">2</span>
            <span><strong>Race rules</strong><small>Formation laps, cautions, LCQ, and starting order</small></span>
            <b>Customize</b>
          </summary>
          <div className="rule-grid">
            <label className="check-field"><input type="checkbox" checked={formationStart} onChange={(e) => setFormationStart(e.target.checked)} /><span>Ignore the first crossing after the race starts</span></label>
            <label className="check-field"><input type="checkbox" checked={formationRestart} onChange={(e) => setFormationRestart(e.target.checked)} /><span>Ignore the first crossing after every restart</span></label>
            <label className="check-field"><input type="checkbox" checked={cautionSync} onChange={(e) => setCautionSync(e.target.checked)} /><span>On red or yellow, move the field to the leader’s lap</span></label>
            {format === "HEATS" && <label className="check-field"><input type="checkbox" checked={invertMain} onChange={(e) => setInvertMain(e.target.checked)} /><span>Reverse qualifying order for the main</span></label>}
            {format === "HEATS" && <label className="check-field"><input type="checkbox" checked={lcqEnabled} onChange={(e) => setLcqEnabled(e.target.checked)} /><span>Run a last chance qualifier before the main</span></label>}
            {format === "HEATS" && lcqEnabled && <label className="rule-field"><span>Advance from the LCQ</span><input type="number" min="1" max="200" value={lcqAdvanceCount} onChange={(e) => setLcqAdvanceCount(Number(e.target.value))} required /></label>}
            <label className="check-field"><input type="checkbox" checked={randomizeGrid} onChange={(e) => setRandomizeGrid(e.target.checked)} /><span>Randomize the opening heat assignments</span></label>
            <label className="rule-field">
              <span>Ignore repeat scans for</span>
              <div className="input-suffix">
                <input type="number" min="0" max="60" step="0.1" value={duplicateWindow / 1000} onChange={(e) => setDuplicateWindow(Math.round(Number(e.target.value) * 1000))} required />
                <em>seconds</em>
              </div>
            </label>
          </div>
        </details>

        <div className="entrant-editor">
          <div className="section-heading compact">
            <div className="setup-section-title">
              <span className="step-number">3</span>
              <div><h3>Racers in this race</h3><small>Only registered tags can record laps.</small></div>
            </div>
            <span className="quiet-label">{racers.length} selected</span>
          </div>
          <div className={`entrant-header ${format === "HEATS" ? "with-heat" : ""}`}>
            <span>Racer</span><span>Kart</span>{format === "HEATS" && <span>Heat</span>}<span>Tag ID</span><span />
          </div>
          {racers.map((racer, index) => (
            <div className={`entrant-row ${format === "HEATS" ? "with-heat" : ""}`} key={index}>
              <input aria-label={`Racer ${index + 1}`} value={racer.driver_name} onChange={(e) => updateRacer(index, "driver_name", e.target.value)} placeholder="Racer name" required />
              <input aria-label={`Kart ${index + 1}`} value={racer.kart_number} onChange={(e) => updateRacer(index, "kart_number", e.target.value)} placeholder="Kart #" required />
              {format === "HEATS" && <select aria-label={`Heat ${index + 1}`} value={racer.heat_number ?? 1} onChange={(e) => updateRacer(index, "heat_number", Number(e.target.value))} disabled={randomizeGrid}>
                {Array.from({ length: heatCount }, (_, heat) => <option value={heat + 1} key={heat + 1}>H{heat + 1}</option>)}
              </select>}
              <div className="tag-input">
                <input aria-label={`Tag ${index + 1}`} value={racer.tag_id} onChange={(e) => updateRacer(index, "tag_id", e.target.value)} placeholder="Scan or enter tag" required />
                <button type="button" className={scanTarget?.index === index ? "scanning" : ""} onClick={() => setScanTarget({ index, afterId: readerEvent?.id ?? null })}>
                  {scanTarget?.index === index ? "Waiting…" : "Scan"}
                </button>
              </div>
              <button className="icon-button" type="button" aria-label={`Remove racer ${index + 1}`} disabled={racers.length === 1} onClick={() => setRacers((current) => current.filter((_, item) => item !== index))}>×</button>
            </div>
          ))}
          <button className="text-button" type="button" onClick={() => setRacers((current) => [...current, blankRacer()])}>+ Add racer to field</button>
          <p className="reader-capture-status">
            {scanTarget ? "Pass one tag through the reader." : readerEvent ? `Last tag: ${readerEvent.tag_id}` : "No physical tag has been received yet."}
          </p>
        </div>

        <section className="race-plan-preview" aria-label="Race plan preview">
          <div>
            <span>Race plan preview</span>
            <strong>{racers.length} racer{racers.length === 1 ? "" : "s"}</strong>
          </div>
          <div>
            <span>Program</span>
            <strong>{estimatedRaces} race{estimatedRaces === 1 ? "" : "s"}</strong>
          </div>
          <div>
            <span>Distance</span>
            <strong>{targetLaps} lap{targetLaps === 1 ? "" : "s"}</strong>
          </div>
          <div>
            <span>Grid</span>
            <strong>{randomizeGrid ? "Randomized" : "Assigned"}</strong>
          </div>
        </section>

        <div className="form-footer">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create event"}</button>
        </div>
      </form>
    </section>
  );
}

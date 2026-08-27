import { useEffect, useMemo, useRef, useState } from "react";
import { formatClock, formatDate, formatDuration } from "../format";
import type { ControlState, EntrantStanding, EventView, RaceSnapshot } from "../types";

interface Props {
  race: RaceSnapshot;
  events: EventView[];
  busy: boolean;
  onStart: () => Promise<void>;
  onRandomize: () => Promise<void>;
  onRestart: () => Promise<void>;
  onControlState: (state: ControlState) => Promise<void>;
  onCorrectLap: (entrantId: string, targetLap: number, reason: string) => Promise<void>;
  onSimulate: (tagId: string, timestamp: string) => Promise<void>;
  onShowDisplay: () => void;
  showSimulator: boolean;
  exportUrl: string;
}

const statusLabel: Record<RaceSnapshot["status"], string> = {
  DRAFT: "Draft",
  READY: "Ready",
  RUNNING: "Race active",
  FINISHED: "Final",
  INTERRUPTED: "Interrupted",
};

const flags: Array<{ state: ControlState; label: string }> = [
  { state: "OFF", label: "Off" },
  { state: "RED", label: "Red" },
  { state: "YELLOW", label: "Yellow" },
  { state: "GREEN", label: "Green" },
  { state: "CHECKERED", label: "Checkered" },
];

function simulationTimestamp(race: RaceSnapshot, entrantIndex: number, lapsCompleted: number): string {
  const start = new Date(`${race.started_at ?? race.created_at}Z`).getTime();
  const lapBase = 41_500 + entrantIndex * 900;
  const variation = ((lapsCompleted * 313 + entrantIndex * 127) % 1100) - 550;
  return new Date(start + (lapsCompleted + 1) * lapBase + variation).toISOString();
}

export function RaceControl({
  race,
  events,
  busy,
  onStart,
  onRandomize,
  onRestart,
  onControlState,
  onCorrectLap,
  onSimulate,
  onShowDisplay,
  showSimulator,
  exportUrl,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const [correction, setCorrection] = useState<EntrantStanding | null>(null);
  const [correctedLap, setCorrectedLap] = useState(0);
  const [correctionReason, setCorrectionReason] = useState("");
  const [restartOpen, setRestartOpen] = useState(false);
  const [randomGreenStatus, setRandomGreenStatus] = useState<string | null>(null);
  const randomGreenTimer = useRef<number | null>(null);
  const [clockAnchor, setClockAnchor] = useState({
    raceId: race.id,
    elapsed: race.elapsed_ms,
    receivedAt: Date.now(),
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setClockAnchor({ raceId: race.id, elapsed: race.elapsed_ms, receivedAt: Date.now() });
  }, [race.id, race.elapsed_ms, race.control_state, race.status]);

  useEffect(() => () => {
    if (randomGreenTimer.current !== null) window.clearTimeout(randomGreenTimer.current);
  }, [race.id]);

  const elapsed = useMemo(() => {
    if (clockAnchor.raceId !== race.id) return race.elapsed_ms;
    if (race.status !== "RUNNING" || race.control_state !== "GREEN") {
      return clockAnchor.elapsed;
    }
    return clockAnchor.elapsed + Math.max(0, now - clockAnchor.receivedAt);
  }, [clockAnchor, now, race.control_state, race.elapsed_ms, race.id, race.status]);

  const openCorrection = (entrant: EntrantStanding) => {
    setCorrection(entrant);
    setCorrectedLap(entrant.laps_completed);
    setCorrectionReason("");
  };

  const submitCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!correction) return;
    await onCorrectLap(correction.id, correctedLap, correctionReason);
    setCorrection(null);
  };

  const armRandomGreen = () => {
    if (randomGreenTimer.current !== null) return;
    const minimum = race.mode_config.barrel_random_start_min_seconds;
    const maximum = race.mode_config.barrel_random_start_max_seconds;
    const delay = Math.round((minimum + Math.random() * Math.max(0, maximum - minimum)) * 1000);
    setRandomGreenStatus("Armed — green will appear after the hidden random delay.");
    randomGreenTimer.current = window.setTimeout(() => {
      randomGreenTimer.current = null;
      setRandomGreenStatus("GREEN — first tag pass records reaction and starts the run.");
      void onControlState("GREEN");
    }, delay);
  };

  const barrel = race.format === "BARREL_RACING";
  const randomBarrelStart = barrel && race.mode_config.barrel_start_mode === "GREEN";

  return (
    <div className="race-layout">
      <section className="race-hero">
        <div>
          <p className="eyebrow">{race.stage.replaceAll("_", " ")}</p>
          <h2>{race.name}</h2>
          <div className="race-actions">
            {race.status === "READY" && <button className="start-button" onClick={() => void onStart()} disabled={busy}>Stage race</button>}
            {race.status === "READY" && race.entrants.length > 1 && <button className="secondary-button" onClick={() => void onRandomize()} disabled={busy}>Randomize grid</button>}
            {(race.status === "FINISHED" || race.status === "INTERRUPTED") && <a className="primary-button link-button" href={exportUrl}>Export CSV</a>}
            {!race.superseded && ["RUNNING", "FINISHED", "INTERRUPTED"].includes(race.status) && <button className="secondary-button restart-button" type="button" onClick={() => setRestartOpen(true)} disabled={busy}>Restart race</button>}
            <button className="secondary-button" type="button" onClick={onShowDisplay}>Public display</button>
          </div>
        </div>
        <div className="clock-block">
          <span className={`status-pill status-${race.status.toLowerCase()}`}><i /> {race.status === "RUNNING" ? race.control_state : statusLabel[race.status]}</span>
          <strong>{formatClock(elapsed)}</strong>
          <small>{race.final_lap && race.control_state === "GREEN" ? "Final lap" : `Leader lap ${race.leader_lap} of ${race.target_laps}`}</small>
        </div>
      </section>

      {barrel && <section className="mode-instructions">
        <div><p className="eyebrow">Barrel timer</p><h3>{randomBarrelStart ? "Random-green start" : "Rider-triggered start"}</h3></div>
        <p>{randomBarrelStart ? "Stage the run, then arm the random green. The first tag pass after green records reaction time and starts the run; the second pass stops it." : "Set the run GREEN. The rider’s first tag pass starts the timer and the second pass stops it."}</p>
        {randomGreenStatus && <strong>{randomGreenStatus}</strong>}
      </section>}

      {race.status === "RUNNING" && <section className="flag-console">
        <div><p className="eyebrow">Race control</p><h3>Flag state</h3></div>
        <div className="flag-buttons">
          {flags.filter((flag) => !randomBarrelStart || flag.state !== "GREEN").map((flag) => (
            <button
              key={flag.state}
              className={`flag-button flag-${flag.state.toLowerCase()} ${race.control_state === flag.state ? "active" : ""}`}
              disabled={busy || race.control_state === flag.state}
              onClick={() => void onControlState(flag.state)}
            >
              <i />{flag.label}
            </button>
          ))}
          {randomBarrelStart && race.control_state !== "GREEN" && <button className="flag-button flag-green" disabled={busy || randomGreenTimer.current !== null} onClick={armRandomGreen}><i />{randomGreenTimer.current !== null ? "Armed" : "Arm random green"}</button>}
        </div>
      </section>}

      {race.leaderboard.length > 0 && <section className="leaderboard-card race-team-card">
        <div className="section-heading compact"><div><p className="eyebrow">Team score</p><h3>Race team standings</h3></div><span className="quiet-label">Lowest points leads</span></div>
        <div className="program-leaderboard">{race.leaderboard.map((entry) => <article key={entry.name}><span className="position">{entry.position}</span><div><strong>{entry.name}</strong><small>{entry.members.join(" · ")}</small></div><b>{entry.score}</b></article>)}</div>
      </section>}

      <section className="leaderboard-card">
        <div className="section-heading compact">
          <div><p className="eyebrow">Official order</p><h3>Leaderboard</h3></div>
          <span className="quiet-label">Updated live</span>
        </div>
        <div className="table-scroll">
          <table className="leaderboard">
            <thead><tr><th>Pos</th><th>Racer</th><th>Kart</th><th>Laps</th><th>Last lap</th><th>Best lap</th><th>Status</th><th /></tr></thead>
            <tbody>
              {race.entrants.map((entrant) => (
                <tr key={entrant.id}>
                  <td><span className="position">{entrant.position}</span></td>
                  <td><strong>{entrant.driver_name}</strong><small>{entrant.tag_id}{entrant.team_number ? ` · Team ${entrant.team_number}` : ""}</small></td>
                  <td><span className="kart-number">{entrant.kart_number}</span></td>
                  <td><strong>{entrant.laps_completed}</strong><small> / {race.target_laps}</small>{entrant.adjustment_total !== 0 && <em className="adjustment-mark">adjusted</em>}</td>
                  <td className="time-cell">{formatDuration(entrant.last_lap_ms)}</td>
                  <td className="time-cell best">{formatDuration(entrant.best_lap_ms)}</td>
                  <td><span className={`driver-status ${entrant.finished_at || entrant.eliminated_at_lap ? "finished" : "racing"}`}>{entrant.eliminated_at_lap ? `Eliminated at lap ${entrant.eliminated_at_lap}` : entrant.finished_at ? "Finished" : race.control_state === "GREEN" ? "Racing" : "Held"}</span>{entrant.reaction_time_ms !== null && <small>Reaction {formatDuration(entrant.reaction_time_ms)}</small>}</td>
                  <td><button className="table-action" onClick={() => openCorrection(entrant)}>Edit lap</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {correction && <section className="correction-card">
        <form onSubmit={submitCorrection}>
          <div><p className="eyebrow">Official correction</p><h3>{correction.driver_name}</h3></div>
          <label><span>Official lap</span><input type="number" min="0" max="10000" value={correctedLap} onChange={(e) => setCorrectedLap(Number(e.target.value))} required /></label>
          <label className="correction-reason"><span>Reason</span><input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Reason for correction" minLength={3} required /></label>
          <button className="primary-button" disabled={busy || correctedLap === correction.laps_completed}>Save</button>
          <button className="secondary-button" type="button" onClick={() => setCorrection(null)}>Cancel</button>
        </form>
      </section>}

      <div className={`lower-grid ${showSimulator ? "" : "single"}`}>
        {showSimulator && <section className="simulator-card">
          <div className="section-heading compact"><div><p className="eyebrow">Development reader</p><h3>Crossing simulator</h3></div><span className="mode-chip">MOCK</span></div>
          <p className="section-copy">These controls enter through the physical-reader ingestion path.</p>
          <div className="simulator-grid">
            {race.entrants.map((entrant, index) => (
              <button key={entrant.id} disabled={busy || race.status !== "RUNNING" || race.control_state !== "GREEN" || Boolean(entrant.finished_at)} onClick={() => void onSimulate(entrant.tag_id, simulationTimestamp(race, index, entrant.laps_completed + (entrant.formation_complete ? 1 : 0)))}>
                <span>Kart {entrant.kart_number}</span><strong>Trigger {entrant.driver_name}</strong>
              </button>
            ))}
          </div>
        </section>}

        <section className="event-card">
          <div className="section-heading compact"><div><p className="eyebrow">Reader evidence</p><h3>Recent observations</h3></div><span className="quiet-label">Active-race tags only · {events.length} shown</span></div>
          <div className="event-list">
            {events.length === 0 && <p className="empty-state">No reader observations yet.</p>}
            {events.slice(0, 12).map((event) => (
              <article key={event.id}>
                <span className={`event-dot disposition-${event.disposition?.toLowerCase() ?? "unknown"}`} />
                <div><strong>{event.driver_name ?? event.tag_id}</strong><small>{event.disposition?.replaceAll("_", " ") ?? "UNCLASSIFIED"}{event.lap_number ? ` · Lap ${event.lap_number}` : ""}</small></div>
                <time>{formatDate(event.received_at)}</time>
              </article>
            ))}
          </div>
        </section>
      </div>

      {restartOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setRestartOpen(false)}>
        <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="restart-title" onMouseDown={(event) => event.stopPropagation()}>
          <p className="eyebrow">Confirm restart</p>
          <h3 id="restart-title">Restart this race?</h3>
          <p>The current attempt stays in the audit history. The same racers and tags carry into a clean race, so no one needs to be registered again.</p>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setRestartOpen(false)}>Cancel</button>
            <button className="danger-button" type="button" disabled={busy} onClick={() => void onRestart().then(() => setRestartOpen(false))}>{busy ? "Restarting…" : "Restart race"}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}

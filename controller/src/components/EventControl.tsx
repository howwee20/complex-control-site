import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate, formatDuration } from "../format";
import type { EventSnapshot, EventView, RacerDetail } from "../types";

interface Props {
  event: EventSnapshot;
  busy: boolean;
  readerEvent: EventView | null;
  onOpenRace: (raceId: string) => Promise<void>;
  onAdvance: () => Promise<void>;
}

const formatLabel = (value: string) => value.replaceAll("_", " ").toLowerCase();

function advanceLabel(event: EventSnapshot, currentStage: string | undefined): string {
  if (["QUALIFYING_PRACTICE", "TEAM_RACE", "KNOCKOUT", "BARREL_RACING"].includes(event.format)) {
    return "Complete event and lock results";
  }
  if (event.format === "TRIPLE_ELIMINATION") {
    if (currentStage === "HEAT") return "Build second-chance races";
    if (currentStage === "SECOND_CHANCE") return "Build last-chance races";
    if (currentStage === "LAST_CHANCE") return "Build main from qualifiers";
    return "Complete event";
  }
  if (event.format !== "HEATS") return "Advance bracket";
  if (currentStage === "HEAT" && event.lcq_enabled) return "Build LCQ from heat results";
  if (currentStage === "HEAT") return "Build main from heat results";
  if (currentStage === "LCQ") return "Build main from LCQ results";
  return "Complete event";
}

export function EventControl({ event, busy, readerEvent, onOpenRace, onAdvance }: Props) {
  const [verifyTarget, setVerifyTarget] = useState<{ racerId: string; afterId: string | null } | null>(null);
  const [verification, setVerification] = useState<string | null>(null);
  const [racerDetail, setRacerDetail] = useState<RacerDetail | null>(null);
  useEffect(() => {
    if (!verifyTarget || !readerEvent || readerEvent.id === verifyTarget.afterId) return;
    const racer = event.racers.find((item) => item.id === verifyTarget.racerId);
    setVerification(
      racer?.tag_id.toLowerCase() === readerEvent.tag_id.toLowerCase()
        ? `${racer.driver_name} verified`
        : `Different tag detected: ${readerEvent.tag_id}`,
    );
    setVerifyTarget(null);
  }, [event.racers, readerEvent?.id, verifyTarget]);
  const currentRaces = event.races.filter(
    (race) => !race.superseded && !race.results_advanced,
  );
  const currentStage = currentRaces[0]?.stage;
  return (
    <section className="event-shell">
      <div className="event-hero">
        <div>
          <p className="eyebrow">{formatLabel(event.format)}</p>
          <h2>{event.name}</h2>
          <p className="event-meta">
            {event.location && <>{event.location} · </>}{event.racers.length} racers · {event.target_laps} laps · Created {formatDate(event.created_at)}
          </p>
        </div>
        <span className={`event-status event-${event.status.toLowerCase()}`}>{event.status}</span>
      </div>

      <div className="event-dashboard-grid">
        <section className="schedule-card">
          <div className="section-heading compact">
            <div><p className="eyebrow">Race order</p><h3>Schedule</h3></div>
            <span className="quiet-label">{event.races.length} races</span>
          </div>
          <div className="schedule-list">
            {event.races.map((race) => (
              <button key={race.id} onClick={() => void onOpenRace(race.id)}>
                <span className="sequence-number">{race.sequence_number}</span>
                <div>
                  <strong>{race.name}</strong>
                  <small>{race.entrant_count} racers · {formatLabel(race.stage)}</small>
                </div>
                <span className={`race-state race-state-${race.status.toLowerCase()}`}>
                  {race.superseded
                    ? "RESTARTED"
                    : race.status === "RUNNING"
                      ? race.control_state
                      : race.status}
                </span>
                <b>→</b>
              </button>
            ))}
          </div>
          {event.can_advance && (
            <button className="primary-button advance-button" disabled={busy} onClick={() => void onAdvance()}>
              {advanceLabel(event, currentStage)}
            </button>
          )}
          {!event.can_advance && event.status === "ACTIVE" && currentRaces.length > 0 && (
            <p className="section-copy schedule-help">Finish the current races to unlock advancement.</p>
          )}
        </section>

        <section className="roster-card">
          <div className="section-heading compact">
            <div><p className="eyebrow">Registration</p><h3>Racers</h3></div>
            <span className="quiet-label">Tags assigned</span>
          </div>
          <div className="roster-list">
            {event.racers.map((racer) => (
              <article key={racer.id} className={racer.eliminated ? "eliminated" : ""}>
                <span className="kart-number">{racer.kart_number}</span>
                <div><button className="racer-name" onClick={() => void api.getRacer(event.id, racer.id).then(setRacerDetail)}>{racer.driver_name}</button><small>{racer.tag_id}{racer.team_number ? ` · Team ${racer.team_number}` : ""}</small></div>
                <div className="roster-actions">
                  {event.format === "DOUBLE_ELIMINATION" && <em>{racer.losses} loss{racer.losses === 1 ? "" : "es"}</em>}
                  {racer.eliminated && <em>Eliminated</em>}
                  {!racer.eliminated && <button onClick={() => { setVerification(null); setVerifyTarget({ racerId: racer.id, afterId: readerEvent?.id ?? null }); }}>Verify</button>}
                </div>
              </article>
            ))}
          </div>
          <p className="reader-capture-status">
            {verifyTarget ? "Pass the selected racer’s tag through the reader." : verification ?? "Use Verify to confirm a registered tag."}
          </p>
          {racerDetail && <div className="racer-detail">
            <div className="racer-detail-head"><div><p className="eyebrow">Racer record</p><h3>{racerDetail.racer.driver_name}</h3></div><button onClick={() => setRacerDetail(null)}>×</button></div>
            <div className="racer-stats"><span><small>Races</small><strong>{racerDetail.races_completed}</strong></span><span><small>Wins</small><strong>{racerDetail.wins}</strong></span><span><small>Laps</small><strong>{racerDetail.total_laps}</strong></span><span><small>Fastest</small><strong>{formatDuration(racerDetail.best_lap_ms)}</strong></span></div>
            <div className="racer-results">
              {racerDetail.results.map((result) => <button key={result.race_id} onClick={() => void onOpenRace(result.race_id)}><span>P{result.position}</span><div><strong>{result.race_name}</strong><small>{result.laps_completed} laps · Best {formatDuration(result.best_lap_ms)}</small></div></button>)}
              {racerDetail.results.length === 0 && <p className="empty-state">No race results yet.</p>}
            </div>
          </div>}
        </section>
      </div>

      {event.leaderboard.length > 0 && <section className="leaderboard-card event-results-card">
        <div className="section-heading compact"><div><p className="eyebrow">Program standings</p><h3>{event.format === "TEAM_RACE" ? "Team leaderboard" : "Barrel leaderboard"}</h3></div><span className="quiet-label">Updated after each finished race</span></div>
        <div className="program-leaderboard">
          {event.leaderboard.map((entry) => <article key={`${entry.position}-${entry.name}`}><span className="position">{entry.position}</span><div><strong>{entry.name}</strong>{entry.members.length > 0 && <small>{entry.members.join(" · ")}</small>}</div><b>{entry.score}</b></article>)}
        </div>
      </section>}
    </section>
  );
}

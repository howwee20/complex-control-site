import { formatDuration } from "../format";
import type { RaceSnapshot } from "../types";

interface Props {
  race: RaceSnapshot;
}

export function PublicDisplay({ race }: Props) {
  return (
    <section className={`public-display public-${race.control_state.toLowerCase()}`}>
      <header>
        <div>
          <img className="public-logo" src="/complex-control-logo-red-blue.png" alt="Complex Control" />
          <h1>{race.name}</h1>
        </div>
        <div className="public-flag">
          <i />
          <strong>{race.final_lap && race.control_state === "GREEN" ? "FINAL LAP" : race.control_state}</strong>
        </div>
      </header>
      <div className="public-leaderboard">
        <div className="public-row public-head">
          <span>POS</span><span>RACER</span><span>KART</span><span>LAPS</span><span>LAST</span><span>BEST</span>
        </div>
        {race.entrants.map((entrant) => (
          <div className="public-row" key={entrant.id}>
            <b>{entrant.position}</b>
            <strong>{entrant.driver_name}</strong>
            <span className="public-kart">{entrant.kart_number}</span>
            <span className="public-laps">{entrant.laps_completed} / {race.target_laps}</span>
            <span className="public-last">{formatDuration(entrant.last_lap_ms)}</span>
            <span className="public-best">{formatDuration(entrant.best_lap_ms)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

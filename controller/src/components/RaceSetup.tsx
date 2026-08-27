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
  { value: "QUALIFYING_PRACTICE", label: "Qualifying/Practice", detail: "Run every racer together and rank the field by each racer’s fastest recorded lap." },
  { value: "SINGLE_ELIMINATION", label: "Single Elimination", detail: "One loss eliminates a racer; winners advance through head-to-head rounds to the final." },
  { value: "HEATS", label: "Double Elimination", detail: "Heats qualify racers for the Main; remaining racers get a final chance through the LCQ." },
  { value: "TRIPLE_ELIMINATION", label: "Triple Elimination", detail: "First-chance heats feed second-chance and last-chance races before the Main." },
  { value: "TEAM_RACE", label: "Team Race", detail: "Score teams across one or more races. The lowest combined finishing-position points win." },
  { value: "KNOCKOUT", label: "Knockout Challenge", detail: "At each lap threshold the last-place racer is eliminated until one racer remains." },
  { value: "BARREL_RACING", label: "Barrel Racing", detail: "Run one racer at a time; the first tag pass starts the run and the second pass stops it." },
  { value: "DOUBLE_ELIMINATION", label: "Double-Elimination Bracket", detail: "Two losses eliminate a racer through winners and losers brackets." },
  { value: "HEADS_UP", label: "Heads-Up Bracket", detail: "Two-racer matches advance winners through a direct bracket." },
];

const chanceFormats: RaceFormat[] = ["HEATS", "TRIPLE_ELIMINATION"];

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
  const [secondChanceCount, setSecondChanceCount] = useState(1);
  const [secondChanceAdvance, setSecondChanceAdvance] = useState(1);
  const [secondChanceLaps, setSecondChanceLaps] = useState(5);
  const [lastChanceCount, setLastChanceCount] = useState(1);
  const [lastChanceAdvance, setLastChanceAdvance] = useState(1);
  const [lastChanceLaps, setLastChanceLaps] = useState(5);
  const [teamSize, setTeamSize] = useState(2);
  const [teamRaceCount, setTeamRaceCount] = useState(1);
  const [teamMethod, setTeamMethod] = useState<"PICK" | "RANDOM">("PICK");
  const [teamAssignments, setTeamAssignments] = useState<Record<string, number>>({});
  const [knockoutInitialLaps, setKnockoutInitialLaps] = useState(5);
  const [knockoutIntervalLaps, setKnockoutIntervalLaps] = useState(2);
  const [knockoutRepeat, setKnockoutRepeat] = useState(true);
  const [knockoutCustom, setKnockoutCustom] = useState("2, 2, 2");
  const [barrelClassic, setBarrelClassic] = useState(false);
  const [barrelRounds, setBarrelRounds] = useState(1);
  const [barrelRacesPerRound, setBarrelRacesPerRound] = useState(1);
  const [barrelStartMode, setBarrelStartMode] = useState<"RIDER" | "GREEN">("RIDER");
  const [barrelRandomMin, setBarrelRandomMin] = useState(1);
  const [barrelRandomMax, setBarrelRandomMax] = useState(4);
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
      .map((profile) => ({ driver_name: profile.driver_name, kart_number: profile.kart_number, tag_id: profile.tag_id }));
    return [...registered, ...raceDayRacers].map((racer, index) => ({
      ...racer,
      heat_number: (index % Math.max(1, heatCount)) + 1,
      team_number: format === "TEAM_RACE" && teamMethod === "PICK"
        ? (teamAssignments[racer.tag_id] ?? Math.floor(index / Math.max(2, teamSize)) + 1)
        : null,
    }));
  }, [profiles, selectedProfiles, raceDayRacers, heatCount, format, teamMethod, teamAssignments, teamSize]);

  const knockoutIntervals = useMemo(() => knockoutCustom
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0), [knockoutCustom]);

  const estimatedRaces = useMemo(() => {
    const field = Math.max(1, racers.length);
    if (format === "QUALIFYING_PRACTICE" || format === "KNOCKOUT") return 1;
    if (format === "HEATS") return Math.min(heatCount, field) + (lcqCount > 0 ? Math.min(lcqCount, field) : 0) + 1;
    if (format === "TRIPLE_ELIMINATION") return Math.min(heatCount, field) + Math.min(secondChanceCount, field) + Math.min(lastChanceCount, field) + 1;
    if (format === "TEAM_RACE") return teamRaceCount;
    if (format === "BARREL_RACING") return field * (barrelClassic ? 3 : barrelRounds) * (barrelClassic ? 3 : barrelRacesPerRound);
    if (format === "DOUBLE_ELIMINATION") return Math.max(1, field * 2 - 1);
    return Math.max(1, field - 1);
  }, [format, racers.length, heatCount, lcqCount, secondChanceCount, lastChanceCount, teamRaceCount, barrelClassic, barrelRounds, barrelRacesPerRound]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (racers.length === 0) {
      setFormError("Select at least one registered racer or add a race-day racer.");
      return;
    }
    if (format === "BARREL_RACING" && barrelStartMode === "GREEN" && barrelRandomMin > barrelRandomMax) {
      setFormError("The earliest random green time must be less than or equal to the latest time.");
      return;
    }
    if (format === "KNOCKOUT" && !knockoutRepeat && knockoutIntervals.length === 0) {
      setFormError("Enter at least one custom knockout interval.");
      return;
    }
    const barrel = format === "BARREL_RACING";
    await onCreate({
      name,
      location: location.trim() || null,
      format,
      target_laps: barrel ? 1 : mainLaps,
      heat_laps: heatLaps,
      lcq_laps: lcqLaps,
      main_laps: barrel ? 1 : mainLaps,
      heat_count: chanceFormats.includes(format) ? heatCount : 1,
      advance_count: chanceFormats.includes(format) ? advanceCount : 1,
      lcq_enabled: format === "HEATS" && lcqCount > 0,
      lcq_count: format === "HEATS" ? Math.max(1, lcqCount) : 1,
      lcq_advance_count: format === "HEATS" ? lcqAdvanceCount : 1,
      invert_main: chanceFormats.includes(format) && invertMain,
      formation_lap_on_start: !barrel && formationStart,
      formation_lap_on_restart: !barrel && formationRestart,
      caution_sync_to_leader: !barrel && cautionSync,
      duplicate_window_ms: barrel ? Math.max(2000, duplicateWindow) : duplicateWindow,
      randomize_grid: format === "TEAM_RACE" ? teamMethod === "RANDOM" : randomizeGrid,
      mode_config: {
        second_chance_count: secondChanceCount,
        second_chance_advance_count: secondChanceAdvance,
        second_chance_laps: secondChanceLaps,
        last_chance_count: lastChanceCount,
        last_chance_advance_count: lastChanceAdvance,
        last_chance_laps: lastChanceLaps,
        team_size: teamSize,
        team_race_count: teamRaceCount,
        team_method: teamMethod,
        knockout_initial_laps: knockoutInitialLaps,
        knockout_interval_laps: knockoutIntervalLaps,
        knockout_repeat: knockoutRepeat,
        knockout_custom_intervals: knockoutIntervals,
        barrel_classic: barrelClassic,
        barrel_rounds: barrelClassic ? 3 : barrelRounds,
        barrel_races_per_round: barrelClassic ? 3 : barrelRacesPerRound,
        barrel_start_mode: barrelStartMode,
        barrel_random_start_min_seconds: barrelRandomMin,
        barrel_random_start_max_seconds: barrelRandomMax,
      },
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
          <button className="danger-button" type="button" disabled={!selectedSaved || busy} onClick={() => { if (window.confirm("Delete this saved race and all of its results?")) void onDelete(selectedSaved); }}>Delete Race</button>
          <button className="danger-button" type="button" disabled={savedEvents.length === 0 || busy} onClick={() => { if (window.confirm("Delete every saved race and all results? This cannot be undone.")) void onDeleteAll(); }}>Delete All Races</button>
        </div>
      </section>

      <form onSubmit={submit} className="race-hub-panel race-create-panel">
        <h3>Create New Race</h3>
        <div className="event-fields race-hub-fields">
          <label><span>Race name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter race name" required /></label>
          <label><span>Race location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter race location" maxLength={160} /></label>
          <label><span>Select race type</span><select value={format} onChange={(event) => { const next = event.target.value as RaceFormat; setFormat(next); if (next === "BARREL_RACING") setDuplicateWindow((value) => Math.max(2000, value)); }}>{formats.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><small className="field-help">{selectedFormat.detail}</small></label>
        </div>

        <div className="racer-selector-heading">
          <h4>Select Racers</h4>
          <div><button type="button" className="primary-button" onClick={() => setSelectedProfiles(new Set(profiles.map((profile) => profile.id)))}>Select All Racers</button><button type="button" className="primary-button" onClick={() => setSelectedProfiles(new Set())} disabled={!allSelected && selectedProfiles.size === 0}>Unselect All Racers</button></div>
        </div>
        <div className="racer-profile-picker">
          {profiles.length === 0 && <p className="empty-state">No registered racers. Open Racer Profiles in the top menu, or add a race-day racer below.</p>}
          {profiles.map((profile) => <label key={profile.id}><input type="checkbox" checked={selectedProfiles.has(profile.id)} onChange={(event) => setSelectedProfiles((current) => { const next = new Set(current); if (event.target.checked) next.add(profile.id); else next.delete(profile.id); return next; })} /><span>{profile.driver_name} (#{profile.kart_number})</span><small>{profile.tag_id}</small></label>)}
        </div>

        {format === "QUALIFYING_PRACTICE" && <div className="race-configuration-grid">
          <label><span>Number of laps</span><input type="number" min="1" max="25" value={mainLaps} onChange={(event) => setMainLaps(Number(event.target.value))} /></label>
          <p className="field-help">The live leaderboard ranks fastest lap first and preserves every completed lap.</p>
        </div>}

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

        {format === "TRIPLE_ELIMINATION" && <div className="race-configuration-grid">
          <label><span>First-chance heats</span><input type="number" min="1" max="100" value={heatCount} onChange={(event) => setHeatCount(Number(event.target.value))} /></label>
          <label><span>Advance from each first chance</span><input type="number" min="1" max="200" value={advanceCount} onChange={(event) => setAdvanceCount(Number(event.target.value))} /></label>
          <label><span>First-chance laps</span><input type="number" min="1" max="10000" value={heatLaps} onChange={(event) => setHeatLaps(Number(event.target.value))} /></label>
          <label><span>Second-chance races</span><input type="number" min="1" max="100" value={secondChanceCount} onChange={(event) => setSecondChanceCount(Number(event.target.value))} /></label>
          <label><span>Advance from each second chance</span><input type="number" min="1" max="200" value={secondChanceAdvance} onChange={(event) => setSecondChanceAdvance(Number(event.target.value))} /></label>
          <label><span>Second-chance laps</span><input type="number" min="1" max="10000" value={secondChanceLaps} onChange={(event) => setSecondChanceLaps(Number(event.target.value))} /></label>
          <label><span>Last-chance races</span><input type="number" min="1" max="100" value={lastChanceCount} onChange={(event) => setLastChanceCount(Number(event.target.value))} /></label>
          <label><span>Advance from each last chance</span><input type="number" min="1" max="200" value={lastChanceAdvance} onChange={(event) => setLastChanceAdvance(Number(event.target.value))} /></label>
          <label><span>Last-chance laps</span><input type="number" min="1" max="10000" value={lastChanceLaps} onChange={(event) => setLastChanceLaps(Number(event.target.value))} /></label>
          <label><span>Main event laps</span><input type="number" min="1" max="10000" value={mainLaps} onChange={(event) => setMainLaps(Number(event.target.value))} /></label>
          <label className="wide-toggle"><span>Invert Main field</span><span className="inline-check"><input type="checkbox" checked={invertMain} onChange={(event) => setInvertMain(event.target.checked)} /> Slowest qualifier starts first</span></label>
        </div>}

        {format === "TEAM_RACE" && <>
          <div className="race-configuration-grid">
            <label><span>Team size</span><select value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))}><option value="2">2 racers</option><option value="3">3 racers</option><option value="4">4 racers</option></select></label>
            <label><span>Number of team races</span><input type="number" min="1" max="100" value={teamRaceCount} onChange={(event) => setTeamRaceCount(Number(event.target.value))} /></label>
            <label><span>Team selection</span><select value={teamMethod} onChange={(event) => setTeamMethod(event.target.value as "PICK" | "RANDOM")}><option value="PICK">Pick teams</option><option value="RANDOM">Random teams</option></select></label>
            <label><span>Laps per race</span><input type="number" min="1" max="10000" value={mainLaps} onChange={(event) => setMainLaps(Number(event.target.value))} /></label>
          </div>
          {teamMethod === "PICK" && racers.length > 0 && <div className="team-assignment-grid">
            {racers.map((racer, index) => <label key={racer.tag_id || `${racer.kart_number}-${index}`}><span>{racer.driver_name || `Racer ${index + 1}`}</span><select value={racer.team_number ?? 1} onChange={(event) => setTeamAssignments((current) => ({ ...current, [racer.tag_id]: Number(event.target.value) }))}>{Array.from({ length: Math.max(1, Math.ceil(racers.length / teamSize)) }, (_, team) => <option value={team + 1} key={team + 1}>Team {team + 1}</option>)}</select></label>)}
          </div>}
          <p className="field-help">Lowest total finishing-position points wins; the final race breaks a tie.</p>
        </>}

        {format === "KNOCKOUT" && <div className="race-configuration-grid">
          <label><span>First elimination after</span><div className="input-suffix"><input type="number" min="1" max="10000" value={knockoutInitialLaps} onChange={(event) => setKnockoutInitialLaps(Number(event.target.value))} /><em>laps</em></div></label>
          <label><span>Next elimination interval</span><div className="input-suffix"><input type="number" min="1" max="10000" value={knockoutIntervalLaps} onChange={(event) => setKnockoutIntervalLaps(Number(event.target.value))} /><em>laps</em></div></label>
          <label className="wide-toggle"><span>Elimination schedule</span><span className="inline-check"><input type="checkbox" checked={knockoutRepeat} onChange={(event) => setKnockoutRepeat(event.target.checked)} /> Repeat this interval until one racer remains</span></label>
          {!knockoutRepeat && <label className="wide-toggle"><span>Custom intervals after first elimination</span><input value={knockoutCustom} onChange={(event) => setKnockoutCustom(event.target.value)} placeholder="2, 3, 3, 4" /><small className="field-help">Comma-separated lap intervals. Missing entries use the standard interval.</small></label>}
        </div>}

        {format === "BARREL_RACING" && <div className="race-configuration-grid">
          <label className="wide-toggle"><span>Classic barrel program</span><span className="inline-check"><input type="checkbox" checked={barrelClassic} onChange={(event) => setBarrelClassic(event.target.checked)} /> Three rounds with three races per round</span></label>
          {!barrelClassic && <><label><span>Rounds</span><input type="number" min="1" max="100" value={barrelRounds} onChange={(event) => setBarrelRounds(Number(event.target.value))} /></label><label><span>Races per round</span><input type="number" min="1" max="100" value={barrelRacesPerRound} onChange={(event) => setBarrelRacesPerRound(Number(event.target.value))} /></label></>}
          <label><span>Timer start</span><select value={barrelStartMode} onChange={(event) => setBarrelStartMode(event.target.value as "RIDER" | "GREEN")}><option value="RIDER">First transponder pass</option><option value="GREEN">Random green, then first pass</option></select></label>
          {barrelStartMode === "GREEN" && <><label><span>Earliest random green</span><div className="input-suffix"><input type="number" min="1" max="60" value={barrelRandomMin} onChange={(event) => setBarrelRandomMin(Number(event.target.value))} /><em>seconds</em></div></label><label><span>Latest random green</span><div className="input-suffix"><input type="number" min="1" max="60" value={barrelRandomMax} onChange={(event) => setBarrelRandomMax(Number(event.target.value))} /><em>seconds</em></div></label></>}
          <p className="field-help">One racer runs at a time. The first accepted pass starts the run and the second accepted pass finishes it. Classic scoring is Round 1 best time plus Round 2 average plus Round 3 average.</p>
        </div>}

        {["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "HEADS_UP"].includes(format) && <div className="race-configuration-grid"><label><span>Race laps</span><input type="number" min="1" max="10000" value={mainLaps} onChange={(event) => setMainLaps(Number(event.target.value))} /></label></div>}

        <details className="rules-panel" open>
          <summary><span className="step-number">✓</span><span><strong>Race Rules</strong><small>Reader and caution behavior</small></span><b>Customize</b></summary>
          <div className="rule-grid">
            {format !== "BARREL_RACING" && <><label className="check-field"><input type="checkbox" checked={formationStart} onChange={(event) => setFormationStart(event.target.checked)} /><span>Skip one lap on every first green flag</span></label><label className="check-field"><input type="checkbox" checked={formationRestart} onChange={(event) => setFormationRestart(event.target.checked)} /><span>Skip one lap after every restart</span></label><label className="check-field"><input type="checkbox" checked={cautionSync} onChange={(event) => setCautionSync(event.target.checked)} /><span>Keep racers on the lead lap during cautions</span></label><label className="check-field"><input type="checkbox" checked={randomizeGrid} onChange={(event) => setRandomizeGrid(event.target.checked)} disabled={format === "TEAM_RACE" && teamMethod === "RANDOM"} /><span>Randomize starting assignments</span></label></>}
            <label className="rule-field"><span>{format === "BARREL_RACING" ? "Minimum rescan delay" : "Ignore repeat scans for"}</span><div className="input-suffix"><input type="number" min={format === "BARREL_RACING" ? 2 : 0} max="60" step="0.1" value={duplicateWindow / 1000} onChange={(event) => setDuplicateWindow(Math.round(Number(event.target.value) * 1000))} /><em>seconds</em></div></label>
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
        <section className="race-plan-preview"><div><span>Race plan preview</span><strong>{racers.length} racers</strong></div><div><span>Program</span><strong>{estimatedRaces} races</strong></div><div><span>{format === "BARREL_RACING" ? "Timer" : "Final distance"}</span><strong>{format === "BARREL_RACING" ? "Two tag passes" : `${mainLaps} laps`}</strong></div><div><span>Grid</span><strong>{((format === "TEAM_RACE" && teamMethod === "RANDOM") || randomizeGrid) ? "Randomized" : "Assigned"}</strong></div></section>
        <div className="form-footer"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create Race"}</button></div>
      </form>
    </section>
  );
}

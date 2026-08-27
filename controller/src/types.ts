export type RaceStatus = "DRAFT" | "READY" | "RUNNING" | "FINISHED" | "INTERRUPTED";
export type EventStatus = "DRAFT" | "ACTIVE" | "COMPLETED";
export type RaceFormat = "HEATS" | "HEADS_UP" | "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";
export type RaceStage = "HEAT" | "LCQ" | "MAIN" | "BRACKET" | "WINNERS" | "LOSERS" | "FINAL" | "RESET_FINAL";
export type ControlState = "OFF" | "RED" | "YELLOW" | "GREEN" | "CHECKERED";
export type ReadDisposition =
  | "ACCEPTED"
  | "DUPLICATE"
  | "UNKNOWN_TAG"
  | "NO_ACTIVE_RACE"
  | "ENTRANT_FINISHED"
  | "FLAG_INACTIVE"
  | "FORMATION_LAP";

export interface EntrantInput {
  driver_name: string;
  kart_number: string;
  tag_id: string;
  heat_number?: number | null;
}

export interface RaceCreate {
  name: string;
  target_laps: number;
  duplicate_window_ms: number;
  entrants: EntrantInput[];
}

export interface EventCreate {
  name: string;
  location?: string | null;
  format: RaceFormat;
  target_laps: number;
  heat_laps: number;
  lcq_laps: number;
  main_laps: number;
  heat_count: number;
  advance_count: number;
  lcq_enabled: boolean;
  lcq_count: number;
  lcq_advance_count: number;
  invert_main: boolean;
  formation_lap_on_start: boolean;
  formation_lap_on_restart: boolean;
  caution_sync_to_leader: boolean;
  duplicate_window_ms: number;
  randomize_grid: boolean;
  racers: EntrantInput[];
}

export interface RacerProfile extends EntrantInput {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface EntrantStanding extends EntrantInput {
  id: string;
  position: number;
  laps_completed: number;
  last_lap_ms: number | null;
  best_lap_ms: number | null;
  elapsed_ms: number | null;
  finished_at: string | null;
  adjustment_total: number;
  formation_complete: boolean;
}

export interface RaceSnapshot {
  id: string;
  name: string;
  status: RaceStatus;
  target_laps: number;
  duplicate_window_ms: number;
  event_id: string | null;
  format: RaceFormat;
  stage: RaceStage;
  control_state: ControlState;
  round_number: number;
  heat_number: number;
  sequence_number: number;
  advance_count: number;
  formation_lap_on_start: boolean;
  formation_lap_on_restart: boolean;
  caution_sync_to_leader: boolean;
  green_period: number;
  results_advanced: boolean;
  superseded: boolean;
  restart_number: number;
  elapsed_ms: number;
  leader_lap: number;
  final_lap: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  entrants: EntrantStanding[];
}

export interface RaceSummary {
  id: string;
  name: string;
  status: RaceStatus;
  target_laps: number;
  entrant_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  event_id: string | null;
  stage: RaceStage;
  control_state: ControlState;
  round_number: number;
  heat_number: number;
  sequence_number: number;
  results_advanced: boolean;
  superseded: boolean;
  restart_number: number;
}

export interface EventRacerView extends EntrantInput {
  id: string;
  seed_order: number;
  initial_heat: number | null;
  losses: number;
  eliminated: boolean;
}

export interface EventSnapshot {
  id: string;
  name: string;
  location: string | null;
  format: RaceFormat;
  status: EventStatus;
  target_laps: number;
  heat_laps: number;
  lcq_laps: number;
  main_laps: number;
  heat_count: number;
  advance_count: number;
  lcq_enabled: boolean;
  lcq_count: number;
  lcq_advance_count: number;
  invert_main: boolean;
  formation_lap_on_start: boolean;
  formation_lap_on_restart: boolean;
  caution_sync_to_leader: boolean;
  duplicate_window_ms: number;
  created_at: string;
  completed_at: string | null;
  racers: EventRacerView[];
  races: RaceSummary[];
  can_advance: boolean;
}

export interface EventSummary {
  id: string;
  name: string;
  location: string | null;
  format: RaceFormat;
  status: EventStatus;
  racer_count: number;
  race_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface RacerRaceResult {
  race_id: string;
  race_name: string;
  stage: RaceStage;
  status: RaceStatus;
  position: number;
  laps_completed: number;
  best_lap_ms: number | null;
}

export interface RacerDetail {
  racer: EventRacerView;
  races_completed: number;
  wins: number;
  total_laps: number;
  best_lap_ms: number | null;
  results: RacerRaceResult[];
}

export interface LapAdjustmentView {
  id: string;
  entrant_id: string;
  delta: number;
  resulting_lap: number;
  reason: string;
  actor: string;
  created_at: string;
}

export interface EventView {
  id: string;
  reader_id: string | null;
  source_event_id: string | null;
  tag_id: string;
  received_at: string;
  reader_timestamp: string | null;
  raw_payload: string;
  disposition: ReadDisposition | null;
  reason: string | null;
  driver_name: string | null;
  kart_number: string | null;
  lap_number: number | null;
  lap_time_ms: number | null;
}

export interface LiveMessage {
  type: "race.updated" | "race.restarted" | "observation.processed";
  race: RaceSnapshot;
  event?: EventView;
}

export interface ReaderMessage {
  type: "reader.observation";
  event: EventView;
}

export interface HealthView {
  status: string;
  version: string;
  environment: string;
  reader_mode: string;
  database: string;
}

export interface OperatorSessionView {
  enabled: boolean;
  authenticated: boolean;
}

export interface UpdateStatus {
  state: "idle" | "staged" | "installing" | "complete" | "failed" | "error";
  message: string;
  filename?: string;
  sha256?: string;
  bytes?: number;
  updated_at?: string;
}

export interface FrontendRelease {
  version: string;
  site_commit?: string | null;
  created_at?: string | null;
  backend_api: string;
}

export interface FrontendUpdateStatus extends UpdateStatus {
  version?: string;
  site_commit?: string | null;
  current: FrontendRelease;
}

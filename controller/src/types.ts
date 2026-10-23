export type RaceStatus = "DRAFT" | "READY" | "RUNNING" | "FINISHED" | "INTERRUPTED";
export type EventStatus = "DRAFT" | "ACTIVE" | "COMPLETED";
export type RaceFormat =
  | "HEATS"
  | "HEADS_UP"
  | "SINGLE_ELIMINATION"
  | "DOUBLE_ELIMINATION"
  | "QUALIFYING_PRACTICE"
  | "TRIPLE_ELIMINATION"
  | "TEAM_RACE"
  | "KNOCKOUT"
  | "BARREL_RACING";
export type RaceStage =
  | "HEAT"
  | "LCQ"
  | "MAIN"
  | "PRACTICE"
  | "SECOND_CHANCE"
  | "LAST_CHANCE"
  | "TEAM"
  | "KNOCKOUT"
  | "BARREL"
  | "BRACKET"
  | "WINNERS"
  | "LOSERS"
  | "FINAL"
  | "RESET_FINAL";
export type ControlState = "OFF" | "RED" | "YELLOW" | "GREEN" | "CHECKERED";
export type ReadDisposition =
  | "ACCEPTED"
  | "DUPLICATE"
  | "UNKNOWN_TAG"
  | "NO_ACTIVE_RACE"
  | "ENTRANT_FINISHED"
  | "FLAG_INACTIVE"
  | "FORMATION_LAP"
  | "BARREL_START";

export interface EntrantInput {
  driver_name: string;
  kart_number: string;
  tag_id: string;
  heat_number?: number | null;
  team_number?: number | null;
}

export interface EventModeConfig {
  second_chance_count: number;
  second_chance_advance_count: number;
  second_chance_laps: number;
  last_chance_count: number;
  last_chance_advance_count: number;
  last_chance_laps: number;
  team_size: number;
  team_race_count: number;
  team_method: "PICK" | "RANDOM";
  knockout_initial_laps: number;
  knockout_interval_laps: number;
  knockout_repeat: boolean;
  knockout_custom_intervals: number[];
  barrel_classic: boolean;
  barrel_rounds: number;
  barrel_races_per_round: number;
  barrel_start_mode: "RIDER" | "GREEN";
  barrel_random_start_min_seconds: number;
  barrel_random_start_max_seconds: number;
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
  mode_config: EventModeConfig;
  racers: EntrantInput[];
}

export interface RacerProfile extends EntrantInput {
  id: string;
  created_at: string;
  updated_at: string;
  revision?: number;
}

export interface RosterProfileRecord extends EntrantInput {
  id: string;
  revision?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RosterDocument {
  format: "complex-control-roster-v1";
  controller_id?: string | null;
  source?: string | null;
  roster_seq?: number | null;
  exported_at?: string | null;
  profiles: RosterProfileRecord[];
  tombstones: Array<{ id: string; revision: number; deleted_at?: string | null }>;
}

export type RosterResolution = "use_incoming" | "keep_local";

export interface RosterChange {
  action: "add" | "update" | "restore" | "delete" | "unchanged" | "keep_local" | "conflict" | "skip_delete";
  profile_id: string;
  reason: string;
  conflict?: "edited_both" | "tag_in_use" | null;
  incoming?: RosterProfileRecord | null;
  local?: RosterProfileRecord | null;
}

export interface RosterRestoreView {
  applied: boolean;
  counts: Record<string, number>;
  conflicts: number;
  changes: RosterChange[];
  roster_seq: number;
}

export interface ControllerIdentity {
  controller_id: string;
  roster_seq: number;
  version: string;
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
  team_number: number | null;
  eliminated_at_lap: number | null;
  reaction_time_ms: number | null;
}

export interface LeaderboardEntry {
  position: number;
  name: string;
  score: string;
  members: string[];
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
  mode_config: EventModeConfig;
  leaderboard: LeaderboardEntry[];
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
  mode_config: EventModeConfig;
  created_at: string;
  completed_at: string | null;
  racers: EventRacerView[];
  races: RaceSummary[];
  can_advance: boolean;
  leaderboard: LeaderboardEntry[];
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
  schema_revision?: string | null;
  schema_head?: string | null;
  frontend_version?: string | null;
  race_running?: boolean;
}

export interface OperatorSessionView {
  enabled: boolean;
  authenticated: boolean;
  pin_is_default?: boolean | null;
  recovery_configured?: boolean | null;
}

export interface StagedRelease {
  version?: string | null;
  site_commit?: string | null;
  commit?: string | null;
  created_at?: string | null;
  staged_at?: string | null;
}

export interface UpdateStatus {
  state: "idle" | "staged" | "waiting" | "installing" | "verifying" | "complete" | "failed" | "error";
  message: string;
  version?: string;
  filename?: string;
  sha256?: string;
  bytes?: number;
  updated_at?: string;
  deferred_reason?: "race_running" | "recent_activity" | string;
  attempts?: number;
  operator_requested?: boolean;
  last_error?: string;
  staged?: StagedRelease | null;
  current?: { version: string; commit?: string | null; created_at?: string | null };
  install_requested?: boolean;
}

export interface FrontendRelease {
  version: string;
  site_commit?: string | null;
  created_at?: string | null;
  backend_api?: string;
  source?: "capsule" | "bundled" | "missing";
}

export interface FrontendUpdateStatus extends Omit<UpdateStatus, "current"> {
  site_commit?: string | null;
  current: FrontendRelease;
  capabilities?: { deferred_install: boolean; receiver_protocol: number; backend_api: string; frontend_apis: string[] };
}

export interface UpdatesOverview {
  frontend: FrontendUpdateStatus;
  system: UpdateStatus;
  race_running: boolean;
  install_lease: { version: string; granted_at: string; expires_at: string } | null;
}

export interface NetworkLink {
  interface: string;
  address: string;
  kind: "wifi_access_point" | "ethernet" | "ethernet_direct" | "wifi_client" | "other";
  url: string;
}

export interface NetworkStatus {
  hostname: string;
  local_name_url: string;
  access_point: boolean;
  ethernet: boolean;
  links: NetworkLink[];
  internet: { state: "online" | "offline" | "unknown"; checked_at: string | null; detail: string | null };
  timing_requires_internet: boolean;
}

export interface BackupList {
  available: boolean;
  backups: Array<{ name: string; bytes: number; created_at: string }>;
}

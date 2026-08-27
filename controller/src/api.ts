import type {
  ControlState,
  EventCreate,
  EventSnapshot,
  EventSummary,
  EventView,
  FrontendUpdateStatus,
  HealthView,
  LiveMessage,
  OperatorSessionView,
  RaceCreate,
  RacerDetail,
  RaceSnapshot,
  RaceSummary,
  ReaderMessage,
  UpdateStatus,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string | Array<{ msg: string }> };
      if (typeof body.detail === "string") detail = body.detail;
      if (Array.isArray(body.detail)) detail = body.detail.map((item) => item.msg).join("; ");
    } catch {
      // Preserve the status-based message when the response is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export const api = {
  authSession: () => request<OperatorSessionView>("/api/auth/session"),
  login: (pin: string) => request<OperatorSessionView>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  }),
  logout: () => request<OperatorSessionView>("/api/auth/logout", { method: "POST" }),
  changePin: (currentPin: string, newPin: string) =>
    request<OperatorSessionView>("/api/auth/pin", {
      method: "POST",
      body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
    }),
  health: () => request<HealthView>("/api/health"),
  listEvents: () => request<EventSummary[]>("/api/events"),
  getEvent: (eventId: string) => request<EventSnapshot>(`/api/events/${eventId}`),
  getRacer: (eventId: string, racerId: string) =>
    request<RacerDetail>(`/api/events/${eventId}/racers/${racerId}`),
  createEvent: (payload: EventCreate) =>
    request<EventSnapshot>("/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  advanceEvent: (eventId: string) =>
    request<EventSnapshot>(`/api/events/${eventId}/advance`, { method: "POST" }),
  listRaces: () => request<RaceSummary[]>("/api/races"),
  getRace: (raceId: string) => request<RaceSnapshot>(`/api/races/${raceId}`),
  createRace: (payload: RaceCreate) =>
    request<RaceSnapshot>("/api/races", { method: "POST", body: JSON.stringify(payload) }),
  startRace: (raceId: string) =>
    request<RaceSnapshot>(`/api/races/${raceId}/start`, { method: "POST" }),
  finishRace: (raceId: string) =>
    request<RaceSnapshot>(`/api/races/${raceId}/finish`, { method: "POST" }),
  randomizeRace: (raceId: string) =>
    request<RaceSnapshot>(`/api/races/${raceId}/randomize`, { method: "POST" }),
  restartRace: (raceId: string) =>
    request<RaceSnapshot>(`/api/races/${raceId}/restart`, { method: "POST" }),
  setControlState: (raceId: string, state: ControlState) =>
    request<RaceSnapshot>(`/api/races/${raceId}/control-state`, {
      method: "POST",
      body: JSON.stringify({ state }),
    }),
  correctLap: (raceId: string, entrantId: string, targetLap: number, reason: string) =>
    request<RaceSnapshot>(`/api/races/${raceId}/entrants/${entrantId}/lap`, {
      method: "POST",
      body: JSON.stringify({ target_lap: targetLap, reason }),
    }),
  observe: (raceId: string, tagId: string, readerTimestamp?: string) =>
    request<EventView>(`/api/races/${raceId}/observations`, {
      method: "POST",
      body: JSON.stringify({
        tag_id: tagId,
        reader_timestamp: readerTimestamp ?? null,
        raw_payload: `MOCK:${tagId}`,
      }),
    }),
  events: (raceId: string) => request<EventView[]>(`/api/races/${raceId}/events`),
  readerEvents: () => request<EventView[]>("/api/reader/observations?limit=10"),
  updateStatus: () => request<UpdateStatus>("/api/system/update"),
  frontendUpdateStatus: () => request<FrontendUpdateStatus>("/api/system/frontend-update"),
  installUpdate: async (file: File): Promise<UpdateStatus> => {
    const response = await fetch("/api/system/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/gzip",
        "X-Release-Filename": file.name,
      },
      body: file,
    });
    if (!response.ok) {
      let detail = `Update failed (${response.status})`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // Keep the status-based message for non-JSON responses.
      }
      throw new Error(detail);
    }
    return (await response.json()) as UpdateStatus;
  },
  exportUrl: (raceId: string) => `/api/races/${raceId}/export.csv`,
};

function socketHost(): string {
  return window.location.port === "5173"
    ? `${window.location.hostname}:8000`
    : window.location.host;
}

export function connectRace(
  raceId: string,
  onMessage: (message: LiveMessage) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = socketHost();
  let closed = false;
  let socket: WebSocket | undefined;
  let retry: number | undefined;

  const open = () => {
    if (closed) return;
    socket = new WebSocket(`${protocol}//${host}/api/ws/races/${raceId}`);
    socket.onopen = () => onStatus(true);
    socket.onmessage = (event) => onMessage(JSON.parse(event.data) as LiveMessage);
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      onStatus(false);
      if (!closed) retry = window.setTimeout(open, 1500);
    };
  };
  open();

  return () => {
    closed = true;
    if (retry) window.clearTimeout(retry);
    socket?.close();
  };
}

export function connectReader(
  onMessage: (message: ReaderMessage) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let closed = false;
  let socket: WebSocket | undefined;
  let retry: number | undefined;

  const open = () => {
    if (closed) return;
    socket = new WebSocket(`${protocol}//${socketHost()}/api/ws/reader`);
    socket.onopen = () => onStatus(true);
    socket.onmessage = (event) => onMessage(JSON.parse(event.data) as ReaderMessage);
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      onStatus(false);
      if (!closed) retry = window.setTimeout(open, 1500);
    };
  };
  open();

  return () => {
    closed = true;
    if (retry) window.clearTimeout(retry);
    socket?.close();
  };
}

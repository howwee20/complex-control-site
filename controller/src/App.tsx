import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api, connectRace, connectReader } from "./api";
import { EventControl } from "./components/EventControl";
import { OperatorLogin, OperatorPinChange } from "./components/OperatorAccess";
import { PublicDisplay } from "./components/PublicDisplay";
import { RaceControl } from "./components/RaceControl";
import { RaceSetup } from "./components/RaceSetup";
import { RacerProfiles } from "./components/RacerProfiles";
import { SystemUpdates } from "./components/SystemUpdates";
import { formatDate } from "./format";
import type {
  ControlState,
  EventCreate,
  EventSnapshot,
  EventSummary,
  EventView,
  RaceFormat,
  RaceSnapshot,
  RacerProfile,
} from "./types";

type Screen = "product" | "profiles" | "setup" | "event" | "race" | "history" | "updates" | "display";
type AccessState = "checking" | "open" | "locked";

const publicPreview = import.meta.env.VITE_PUBLIC_PREVIEW === "true";
const controllerUrl = import.meta.env.VITE_CONTROLLER_URL || "http://10.42.0.1:8000";
const previewProfilesKey = "complex-control-racer-profiles";
const previewEventsKey = "complex-control-created-races-v2";
const ProductShowcase = lazy(async () => {
  const module = await import("./components/ProductShowcase");
  return { default: module.ProductShowcase };
});

function prependUniqueEvent(current: EventView[], incoming: EventView): EventView[] {
  return [incoming, ...current.filter((event) => event.id !== incoming.id)].slice(0, 50);
}

function previewProfiles(): RacerProfile[] {
  try {
    const values = JSON.parse(localStorage.getItem(previewProfilesKey) ?? "[]") as Array<Record<string, unknown>>;
    return values.map((value, index) => ({
      id: String(value.id ?? `preview-profile-${index}`),
      driver_name: String(value.driver_name ?? value.name ?? "Racer"),
      kart_number: String(value.kart_number ?? value.number ?? index + 1),
      tag_id: String(value.tag_id ?? value.tag ?? `PREVIEW-${index + 1}`),
      created_at: String(value.created_at ?? new Date().toISOString()),
      updated_at: String(value.updated_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

function previewEvents(): EventSummary[] {
  try {
    const values = JSON.parse(localStorage.getItem(previewEventsKey) ?? "[]") as Array<Record<string, unknown>>;
    return values.map((value, index) => ({
      id: String(value.id ?? `preview-event-${index}`),
      name: String(value.name ?? "Preview Race"),
      location: typeof value.location === "string" ? value.location : null,
      format: (typeof value.format === "string" ? value.format : "HEATS") as RaceFormat,
      status: "ACTIVE",
      racer_count: Array.isArray(value.schedule) ? value.schedule.length : Number(value.racer_count ?? 0),
      race_count: Array.isArray(value.schedule) ? value.schedule.length : Number(value.race_count ?? 0),
      created_at: String(value.created_at ?? value.createdAt ?? new Date().toISOString()),
      completed_at: null,
    }));
  } catch {
    return [];
  }
}

function projectedRaceCount(payload: EventCreate): number {
  const racers = Math.max(1, payload.racers.length);
  if (["QUALIFYING_PRACTICE", "KNOCKOUT"].includes(payload.format)) return 1;
  if (payload.format === "HEATS") return Math.min(payload.heat_count, racers) + (payload.lcq_enabled ? Math.min(payload.lcq_count, racers) : 0) + 1;
  if (payload.format === "TRIPLE_ELIMINATION") return Math.min(payload.heat_count, racers) + Math.min(payload.mode_config.second_chance_count, racers) + Math.min(payload.mode_config.last_chance_count, racers) + 1;
  if (payload.format === "TEAM_RACE") return payload.mode_config.team_race_count;
  if (payload.format === "BARREL_RACING") return racers * payload.mode_config.barrel_rounds * payload.mode_config.barrel_races_per_round;
  if (payload.format === "DOUBLE_ELIMINATION") return Math.max(1, racers * 2 - 1);
  return Math.max(1, racers - 1);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    return requestedView === "product" ? "product" : "setup";
  });
  const [savedEvents, setSavedEvents] = useState<EventSummary[]>(() => publicPreview ? previewEvents() : []);
  const [profiles, setProfiles] = useState<RacerProfile[]>(() => publicPreview ? previewProfiles() : []);
  const [event, setEvent] = useState<EventSnapshot | null>(null);
  const [race, setRace] = useState<RaceSnapshot | null>(null);
  const [observations, setObservations] = useState<EventView[]>([]);
  const [readerEvent, setReaderEvent] = useState<EventView | null>(null);
  const [readerMode, setReaderMode] = useState("mock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>(publicPreview ? "open" : "checking");
  const [authEnabled, setAuthEnabled] = useState(false);
  const [pinDialog, setPinDialog] = useState(false);

  const refreshEvents = useCallback(async () => setSavedEvents(await api.listEvents()), []);
  const loadOperatorData = useCallback(async () => {
    const [programs, racers, health, reads] = await Promise.all([api.listEvents(), api.listRacerProfiles(), api.health(), api.readerEvents()]);
    setSavedEvents(programs);
    setProfiles(racers);
    setReaderMode(health.reader_mode);
    setReaderEvent(reads[0] ?? null);
  }, []);

  useEffect(() => {
    if (publicPreview) return;
    void api.authSession()
      .then(async (session) => {
        setAuthEnabled(session.enabled);
        if (!session.enabled || session.authenticated) {
          setAccess("open");
          await loadOperatorData();
        } else {
          setAccess("locked");
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Startup failed"));
  }, [loadOperatorData]);

  useEffect(() => {
    if (publicPreview || access !== "open") return;
    return connectReader((message) => setReaderEvent(message.event), () => undefined);
  }, [access]);

  useEffect(() => {
    if (!race) return;
    return connectRace(
      race.id,
      (message) => {
        setRace(message.race);
        if (message.event) setObservations((current) => prependUniqueEvent(current, message.event!));
      },
      () => undefined,
    );
  }, [race?.id]);

  const guarded = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const createEvent = (payload: EventCreate) => guarded(async () => {
    if (publicPreview) {
      const created: EventSummary = {
        id: crypto.randomUUID(),
        name: payload.name,
        location: payload.location ?? null,
        format: payload.format,
        status: "ACTIVE",
        racer_count: payload.racers.length,
        race_count: projectedRaceCount(payload),
        created_at: new Date().toISOString(),
        completed_at: null,
      };
      setSavedEvents((current) => {
        const next = [created, ...current];
        localStorage.setItem(previewEventsKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    const created = await api.createEvent(payload);
    setEvent(created);
    setRace(null);
    setScreen("event");
    await refreshEvents();
  });

  const duplicateEvent = (eventId: string) => guarded(async () => {
    if (publicPreview) {
      setSavedEvents((current) => {
        const source = current.find((item) => item.id === eventId);
        if (!source) return current;
        const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} 2`, created_at: new Date().toISOString() };
        const next = [copy, ...current];
        localStorage.setItem(previewEventsKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    await api.duplicateEvent(eventId);
    await refreshEvents();
  });

  const deleteEvent = (eventId: string) => guarded(async () => {
    if (publicPreview) {
      setSavedEvents((current) => {
        const next = current.filter((item) => item.id !== eventId);
        localStorage.setItem(previewEventsKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    await api.deleteEvent(eventId);
    if (event?.id === eventId) setEvent(null);
    await refreshEvents();
  });

  const deleteAllEvents = () => guarded(async () => {
    if (publicPreview) {
      setSavedEvents([]);
      localStorage.setItem(previewEventsKey, "[]");
      return;
    }
    await api.deleteAllEvents();
    setEvent(null);
    setRace(null);
    await refreshEvents();
  });

  const refreshProfiles = useCallback(async () => setProfiles(await api.listRacerProfiles()), []);
  const createProfile = (profile: Pick<RacerProfile, "driver_name" | "kart_number" | "tag_id">) => guarded(async () => {
    if (publicPreview) {
      setProfiles((current) => {
        const now = new Date().toISOString();
        const next = [...current, { ...profile, id: crypto.randomUUID(), created_at: now, updated_at: now }];
        localStorage.setItem(previewProfilesKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    await api.createRacerProfile(profile);
    await refreshProfiles();
  });
  const updateProfile = (profileId: string, profile: Pick<RacerProfile, "driver_name" | "kart_number" | "tag_id">) => guarded(async () => {
    if (publicPreview) {
      setProfiles((current) => {
        const next = current.map((item) => item.id === profileId ? { ...item, ...profile, updated_at: new Date().toISOString() } : item);
        localStorage.setItem(previewProfilesKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    await api.updateRacerProfile(profileId, profile);
    await refreshProfiles();
  });
  const deleteProfile = (profileId: string) => guarded(async () => {
    if (publicPreview) {
      setProfiles((current) => {
        const next = current.filter((item) => item.id !== profileId);
        localStorage.setItem(previewProfilesKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    await api.deleteRacerProfile(profileId);
    await refreshProfiles();
  });

  const openEvent = (eventId: string) => guarded(async () => {
    if (publicPreview) {
      setError("This is the website preview. Join the Pi Wi-Fi to open and run the real saved race.");
      return;
    }
    setEvent(await api.getEvent(eventId));
    setRace(null);
    setObservations([]);
    setScreen("event");
  });

  const openRace = (raceId: string) => guarded(async () => {
    const [selected, reads] = await Promise.all([api.getRace(raceId), api.events(raceId)]);
    setRace(selected);
    setObservations(reads);
    setScreen("race");
  });

  const navigate = (next: Screen) => {
    setScreen(next);
    setError(null);
    if (next === "history") void refreshEvents();
    if (next === "event" && event) void openEvent(event.id);
  };

  const openController = () => {
    if (publicPreview) {
      navigate("setup");
      return;
    }
    navigate("setup");
  };

  if (screen === "display" && race) {
    return <div className="display-shell"><button className="display-exit" onClick={() => setScreen("race")}>Exit display</button><PublicDisplay race={race} /></div>;
  }

  return (
    <div className="app-shell trackside-ui">
      <header className="topbar">
        <a
          className="wordmark"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("product");
          }}
          aria-label="Complex Control home"
        >
          <img src="/complex-control-logo.png" alt="Complex Control — Timing, Control, Results" />
        </a>
        <nav>
          {publicPreview && <button className={screen === "product" ? "active" : ""} onClick={() => navigate("product")}>Home</button>}
          {publicPreview && <button className={screen === "profiles" ? "active" : ""} onClick={() => navigate("profiles")}>Racer Profiles</button>}
          {publicPreview && <button className={screen === "setup" ? "active" : ""} onClick={openController}>Let's Go Racing</button>}
          {!publicPreview && access === "open" && <button className={screen === "product" ? "active" : ""} onClick={() => navigate("product")}>Home</button>}
          {!publicPreview && access === "open" && <button className={screen === "profiles" ? "active" : ""} onClick={() => navigate("profiles")}>Racer Profiles</button>}
          {!publicPreview && access === "open" && <button className={screen === "setup" || screen === "history" ? "active" : ""} onClick={() => navigate("setup")}>Let's Go Racing</button>}
          {!publicPreview && access === "open" && event && <button className={screen === "event" ? "active" : ""} onClick={() => navigate("event")}>Schedule</button>}
          {!publicPreview && access === "open" && race && <button className={screen === "race" ? "active" : ""} onClick={() => setScreen("race")}>Race control</button>}
          {!publicPreview && access === "open" && <button className={screen === "updates" ? "active" : ""} onClick={() => navigate("updates")}>Updates</button>}
          {!publicPreview && access === "open" && authEnabled && <button onClick={() => setPinDialog(true)}>PIN</button>}
          {!publicPreview && access === "open" && authEnabled && <button onClick={() => guarded(async () => { await api.logout(); setAccess("locked"); setEvent(null); setRace(null); })}>Lock</button>}
        </nav>
      </header>

      <main>
        {error && <div className="error-banner" role="alert"><strong>Action could not be completed</strong><span>{error}</span><button onClick={() => setError(null)}>×</button></div>}

        {!publicPreview && access === "checking" && <div className="product-loading" role="status">Checking operator access…</div>}

        {!publicPreview && access === "locked" && <OperatorLogin busy={busy} onLogin={(pin) => void guarded(async () => {
          await api.login(pin);
          setAccess("open");
          await loadOperatorData();
        })} />}

        {access === "open" && screen === "product" && (
          <Suspense fallback={<div className="product-loading" role="status">Loading product viewer…</div>}>
            <ProductShowcase onOpenSoftware={openController} />
          </Suspense>
        )}

        {access === "open" && screen === "setup" && (
          <>
            {publicPreview && (
              <section className="preview-banner" aria-label="Software preview status">
                <div>
                  <strong>Software preview</strong>
                  <span>Set up the form here. Live timing opens on the controller connected to this Wi-Fi network.</span>
                </div>
                <a href={controllerUrl}>Connect hardware</a>
              </section>
            )}
            <RaceSetup busy={busy} readerEvent={readerEvent} profiles={profiles} savedEvents={savedEvents} onCreate={createEvent} onOpen={openEvent} onDuplicate={duplicateEvent} onDelete={deleteEvent} onDeleteAll={deleteAllEvents} />
          </>
        )}

        {access === "open" && screen === "profiles" && <RacerProfiles busy={busy} profiles={profiles} readerEvent={readerEvent} onCreate={createProfile} onUpdate={updateProfile} onDelete={deleteProfile} hardwareAvailable={!publicPreview} />}

        {access === "open" && screen === "event" && event && <EventControl event={event} busy={busy} readerEvent={readerEvent} onOpenRace={openRace} onAdvance={() => guarded(async () => setEvent(await api.advanceEvent(event.id)))} />}

        {access === "open" && screen === "race" && race && (
          <RaceControl
            race={race}
            events={observations}
            busy={busy}
            onStart={() => guarded(async () => setRace(await api.startRace(race.id)))}
            onRandomize={() => guarded(async () => setRace(await api.randomizeRace(race.id)))}
            onRestart={() => guarded(async () => {
              const restarted = await api.restartRace(race.id);
              setRace(restarted);
              setObservations([]);
              if (restarted.event_id) setEvent(await api.getEvent(restarted.event_id));
            })}
            onControlState={(state: ControlState) => guarded(async () => setRace(await api.setControlState(race.id, state)))}
            onCorrectLap={(entrantId, targetLap, reason) => guarded(async () => setRace(await api.correctLap(race.id, entrantId, targetLap, reason)))}
            onSimulate={(tagId, timestamp) => guarded(async () => {
              const processed = await api.observe(race.id, tagId, timestamp);
              setObservations((current) => prependUniqueEvent(current, processed));
              setRace(await api.getRace(race.id));
            })}
            onShowDisplay={() => setScreen("display")}
            showSimulator={readerMode === "mock"}
            exportUrl={api.exportUrl(race.id)}
          />
        )}

        {access === "open" && screen === "history" && (
          <section className="history-shell">
            <div className="section-heading"><div><p className="eyebrow">Saved locally</p><h2>Events</h2></div><span className="quiet-label">{savedEvents.length} programs</span></div>
            <div className="history-list">
              {savedEvents.length === 0 && <p className="empty-state">No saved events yet.</p>}
              {savedEvents.map((item) => (
                <button key={item.id} onClick={() => void openEvent(item.id)}>
                  <div><strong>{item.name}</strong><small>{item.location ? `${item.location} · ` : ""}{formatDate(item.created_at)}</small></div>
                  <span>{item.racer_count} racers</span><span>{item.race_count} races</span>
                  <em className={`history-status ${item.status.toLowerCase()}`}>{item.status}</em><b>→</b>
                </button>
              ))}
            </div>
          </section>
        )}

        {access === "open" && screen === "updates" && (
          <SystemUpdates busy={busy} onBusy={setBusy} onError={setError} />
        )}
      </main>
      {pinDialog && <OperatorPinChange busy={busy} onClose={() => setPinDialog(false)} onChange={(currentPin, newPin) => void guarded(async () => {
        await api.changePin(currentPin, newPin);
        setPinDialog(false);
      })} />}
    </div>
  );
}

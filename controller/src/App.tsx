import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api, connectRace, connectReader } from "./api";
import { EventControl } from "./components/EventControl";
import { OperatorLogin, OperatorPinChange } from "./components/OperatorAccess";
import { PublicDisplay } from "./components/PublicDisplay";
import { RaceControl } from "./components/RaceControl";
import { RaceSetup } from "./components/RaceSetup";
import { SystemUpdates } from "./components/SystemUpdates";
import { formatDate } from "./format";
import type {
  ControlState,
  EventCreate,
  EventSnapshot,
  EventSummary,
  EventView,
  RaceSnapshot,
} from "./types";

type Screen = "product" | "setup" | "event" | "race" | "history" | "updates" | "display";
type AccessState = "checking" | "open" | "locked";

const publicPreview = import.meta.env.VITE_PUBLIC_PREVIEW === "true";
const controllerUrl = import.meta.env.VITE_CONTROLLER_URL || "http://10.42.0.1:8000";
const ProductShowcase = lazy(async () => {
  const module = await import("./components/ProductShowcase");
  return { default: module.ProductShowcase };
});

function prependUniqueEvent(current: EventView[], incoming: EventView): EventView[] {
  return [incoming, ...current.filter((event) => event.id !== incoming.id)].slice(0, 50);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    return publicPreview || requestedView === "product" ? "product" : "setup";
  });
  const [savedEvents, setSavedEvents] = useState<EventSummary[]>([]);
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
    const [programs, health, reads] = await Promise.all([api.listEvents(), api.health(), api.readerEvents()]);
    setSavedEvents(programs);
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
      setError("Connect to the trackside controller to create and run an event.");
      return;
    }
    const created = await api.createEvent(payload);
    setEvent(created);
    setRace(null);
    setScreen("event");
    await refreshEvents();
  });

  const openEvent = (eventId: string) => guarded(async () => {
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
      window.location.assign(controllerUrl);
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
          {publicPreview && <button className={screen === "product" ? "active" : ""} onClick={() => navigate("product")}>Product</button>}
          {publicPreview && <button onClick={openController}>Race control</button>}
          {!publicPreview && access === "open" && <button className={screen === "product" ? "active" : ""} onClick={() => navigate("product")}>System</button>}
          {!publicPreview && access === "open" && <button className={screen === "setup" ? "active" : ""} onClick={() => navigate("setup")}>New event</button>}
          {!publicPreview && access === "open" && <button className={screen === "history" ? "active" : ""} onClick={() => navigate("history")}>Events</button>}
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
            <RaceSetup busy={busy} readerEvent={readerEvent} onCreate={createEvent} />
          </>
        )}

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

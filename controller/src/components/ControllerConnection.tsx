import { useEffect, useMemo, useState } from "react";
import {
  CONTROLLER_ORIGINS,
  indexedDbCapsuleStore,
  openControllerWithUpdate,
  refreshCarriedUpdate,
  type CachedCapsule,
  type CourierOutcome,
} from "../fieldCourier";

export type ControllerDestination = "setup" | "profiles";

interface Props {
  destination: ControllerDestination;
  onHome: () => void;
}

function outcomeMessage(outcome: CourierOutcome | null): string | null {
  if (!outcome) return null;
  switch (outcome.kind) {
    case "blocked": return "Your browser blocked the controller tab. Allow pop-ups for this site, then tap again.";
    case "current": return "Race Control is open in the controller tab. The controller already has the latest interface.";
    case "delivered": return outcome.state === "staged"
      ? `Update ${outcome.version} was saved on the controller. It installs automatically when no race is running.`
      : `Update ${outcome.version} is installed. Race Control is open in the controller tab.`;
    case "rejected": return `The controller kept its current version (${outcome.detail}). Racing is not affected.`;
    case "legacy": return "Race Control is open in the controller tab. This controller needs its one-time system update before it can take updates from this phone.";
    case "unreachable": return "The controller tab did not answer. Check that the controller is powered on and this phone is on its Wi-Fi or network, then tap again.";
  }
}

export function ControllerConnection({ destination, onHome }: Props) {
  const action = destination === "profiles" ? "Open racer profiles" : "Open Race Control";
  const store = useMemo(() => {
    try { return typeof indexedDB === "undefined" ? null : indexedDbCapsuleStore(); } catch { return null; }
  }, []);
  const [carried, setCarried] = useState<CachedCapsule | null>(null);
  const [checking, setChecking] = useState(true);
  const [outcome, setOutcome] = useState<CourierOutcome | null>(null);

  useEffect(() => {
    if (!store) { setChecking(false); return; }
    let cancelled = false;
    void refreshCarriedUpdate(store)
      .then((value) => { if (!cancelled) setCarried(value); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [store]);

  const open = (origin: string) => {
    setOutcome(null);
    if (!store) {
      window.open(`${origin}/?view=${destination}`, "complex-control-controller");
      return;
    }
    // Must run inside this tap so the browser allows the controller tab.
    void openControllerWithUpdate(origin, destination, {
      open: (url, name) => window.open(url, name),
      events: window,
      store,
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (handle) => window.clearTimeout(handle),
    }).then(setOutcome);
  };

  const message = outcomeMessage(outcome);
  const [wifi, local] = CONTROLLER_ORIGINS;

  return (
    <section className="controller-connection">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your track. Your controller.</p>
          <h1>Race Control</h1>
          <p className="section-copy">Connect to your controller to use your saved racers, run a race, and see live timing. No app and no internet are needed at the track.</p>
        </div>
        <span className="quiet-label">Racing works offline</span>
      </div>

      {message && <p className="connection-result" role="status">{message}</p>}

      <div className="connection-options">
        <article className="connection-card">
          <span className="connection-number" aria-hidden="true">01</span>
          <p className="eyebrow">At the track</p>
          <h2>Join the Pi’s Wi-Fi</h2>
          <p>Power on your controller and join <strong>ComplexControl</strong> in your phone’s Wi-Fi settings. Stay connected if your phone says this network has no internet.</p>
          <button className="primary-button link-button" type="button" onClick={() => open(wifi)}>{action}</button>
          <small>Opens your controller in another tab. This page stays available for help.</small>
        </article>

        <article className="connection-card">
          <span className="connection-number" aria-hidden="true">02</span>
          <p className="eyebrow">Ethernet</p>
          <h2>Use a router or cable</h2>
          <p>Connect the controller’s Ethernet port to your router and join that router’s Wi-Fi, or plug it straight into a laptop. Neither needs internet. A direct cable takes about 30 seconds after power-on.</p>
          <button className="secondary-button link-button" type="button" onClick={() => open(local)}>Open on local network</button>
          <small>If your device cannot find the controller by name, open Race Control over ComplexControl Wi-Fi and use the address shown under Updates → Network.</small>
        </article>
      </div>

      <aside className="connection-help">
        <h2>Updates travel with your phone</h2>
        <p>
          {checking
            ? "Checking for the newest controller update…"
            : carried
              ? `This phone is carrying controller update ${carried.manifest.version}. Opening Race Control saves it on the controller, which installs it only when no race is running.`
              : "This phone has no controller update to carry yet. Open this page once with internet before heading to the track."}
        </p>
        <p>Keep this page open until the controller page appears. A locked or closed phone cannot carry an update, and racing always continues on the version already installed. A controller wired to an internet router downloads updates itself.</p>
        <h2>Looking for your saved racers?</h2>
        <p>Your track’s profiles and results are stored on its controller. The website preview has its own demo profiles in each browser. Connect above to open the track’s roster.</p>
        <p>Tip: once the controller opens, use your browser’s Share → Add to Home Screen to open it directly next time you join its Wi-Fi.</p>
        <p>Prefer to update without opening Race Control? Use <a href="/field-update.html">controller updates</a>.</p>
        <button className="text-button" type="button" onClick={onHome}>Back to Home</button>
      </aside>
    </section>
  );
}

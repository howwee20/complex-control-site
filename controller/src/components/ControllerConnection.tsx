export type ControllerDestination = "setup" | "profiles";

interface Props {
  destination: ControllerDestination;
  onHome: () => void;
}

export function ControllerConnection({ destination, onHome }: Props) {
  const action = destination === "profiles" ? "Open racer profiles" : "Open Race Control";

  return (
    <section className="controller-connection">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your track. Your controller.</p>
          <h1>Race Control</h1>
          <p className="section-copy">Connect to your controller to use your saved racers, run a race, and see live timing.</p>
        </div>
        <span className="quiet-label">Racing works offline</span>
      </div>

      <div className="connection-options">
        <article className="connection-card">
          <span className="connection-number" aria-hidden="true">01</span>
          <p className="eyebrow">At the track</p>
          <h2>Join the Pi’s Wi-Fi</h2>
          <p>Power on your controller and join <strong>ComplexControl</strong> in your phone’s Wi-Fi settings. Stay connected if your phone says this network has no internet.</p>
          <a className="primary-button link-button" href={`http://10.42.0.1:8000/?view=${destination}`} target="complex-control-controller" rel="noopener">{action}</a>
          <small>Opens your controller in another tab. This page stays available for help.</small>
        </article>

        <article className="connection-card">
          <span className="connection-number" aria-hidden="true">02</span>
          <p className="eyebrow">Wired to your router</p>
          <h2>Use the local network</h2>
          <p>Connect the controller’s Ethernet port to your router, then join that router’s Wi-Fi on your phone. The network does not need an internet connection.</p>
          <a className="secondary-button link-button" href={`http://complex-control.local:8000/?view=${destination}`} target="complex-control-controller" rel="noopener">Open on local network</a>
          <small>If your router cannot find the controller by name, use its assigned address or connect through ComplexControl Wi-Fi.</small>
        </article>
      </div>

      <aside className="connection-help">
        <h2>Looking for your saved racers?</h2>
        <p>Your track’s profiles and results are stored on its controller. The website preview has its own demo profiles in each browser. Connect above to open the track’s roster.</p>
        <p>If the controller tab cannot connect, check that the Pi is powered on and your phone is on the same network, then try again here.</p>
        <p>Need a software update? Open <a href="/field-update.html">controller updates</a> after you finish racing.</p>
        <button className="text-button" type="button" onClick={onHome}>Back to Home</button>
      </aside>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { FrontendUpdateStatus, UpdateStatus } from "../types";

interface SystemUpdatesProps {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
}

export function SystemUpdates({ busy, onBusy, onError }: SystemUpdatesProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle", message: "Checking update status…" });
  const [frontend, setFrontend] = useState<FrontendUpdateStatus | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const refresh = async () => {
    let keepPolling = false;
    try {
      const current = await api.updateStatus();
      setStatus(current);
      const interfaceUpdate = await api.frontendUpdateStatus();
      setFrontend(interfaceUpdate);
      keepPolling = [current.state, interfaceUpdate.state].some((state) => state === "installing" || state === "staged");
    } catch {
      // The API briefly disappears while systemd replaces and restarts it.
      keepPolling = true;
    }
    if (timer.current) window.clearTimeout(timer.current);
    if (keepPolling) {
      timer.current = window.setTimeout(() => void refresh().catch(() => undefined), 1500);
    }
  };

  useEffect(() => {
    void refresh().catch((caught: unknown) => {
      onError(caught instanceof Error ? caught.message : "Update status could not be loaded");
    });
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const install = async () => {
    if (!file || busy) return;
    onBusy(true);
    onError(null);
    try {
      const staged = await api.installUpdate(file);
      setStatus(staged);
      window.setTimeout(() => void refresh().catch(() => undefined), 1500);
    } catch (caught: unknown) {
      onError(caught instanceof Error ? caught.message : "Update could not be installed");
    } finally {
      onBusy(false);
    }
  };

  return (
    <section className="updates-shell">
      <div className="section-heading">
        <div><p className="eyebrow">Controller software</p><h2>Updates</h2></div>
        <span className={`update-state ${frontend?.state ?? "idle"}`}>{frontend?.state ?? "checking"}</span>
      </div>
      <div className="update-card">
        <div>
          <h3>Jake’s live field interface</h3>
          <p>Your phone carries the newest signed interface from <code>mycomplexcontrol.com</code> into this offline Pi. The timing engine, racers, PIN, race history and RFID settings stay on the controller.</p>
          <p className="update-message">Automatic phone bridge is active for signed offline race-day interface updates.</p>
          <p className="update-message">{frontend?.message ?? "Checking the installed interface…"}</p>
          {frontend?.current && <small>Installed: {frontend.current.version}</small>}
        </div>
        <a className="primary-button update-link" href="https://mycomplexcontrol.com/field-update.html">Prepare latest on this phone</a>
      </div>
      <p className="update-note">Prepare while cellular data is available, join ComplexControl, then return to the prepared page. It hands a newer interface to the Pi automatically; the Pi verifies, installs, and health-checks it. Safari shows one finish button only if it blocks the local controller window. A race must be stopped first; failed updates roll back automatically.</p>
      <details className="recovery-update">
        <summary>Advanced full-controller recovery</summary>
        <div className="update-card">
          <div>
            <h3>Install a complete approved release</h3>
            <p>Use this only for a complete backend recovery package supplied by the system owner.</p>
            <p className="update-message">{status.message}</p>
            {status.filename && <small>{status.filename}</small>}
          </div>
          <label className="release-picker">
            <span>{file?.name ?? "Select recovery release"}</span>
            <input type="file" accept=".tgz,.tar.gz,application/gzip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button className="primary-button" disabled={!file || busy || status.state === "installing"} onClick={() => void install()}>
            {busy ? "Uploading…" : "Install recovery"}
          </button>
        </div>
      </details>
    </section>
  );
}

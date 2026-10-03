import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { FrontendUpdateStatus, UpdateStatus } from "../types";

interface SystemUpdatesProps {
  onError: (message: string | null) => void;
}

function updateResult(status: FrontendUpdateStatus | null): string {
  if (!status) return "Last update: checking…";
  const version = status.current?.version ?? status.version ?? "unknown";
  if (status.state === "failed" || status.state === "error") {
    return `Last update: ${version} · Failed`;
  }
  if (status.state === "staged" || status.state === "installing") {
    return `Last update: ${version} · Installing`;
  }
  return `Last update: ${version} · Successful`;
}

export function SystemUpdates({ onError }: SystemUpdatesProps) {
  const [frontend, setFrontend] = useState<FrontendUpdateStatus | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [system, setSystem] = useState<UpdateStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [installing, setInstalling] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const mounted = useRef(true);

  const installSystem = async () => {
    if (!file || installing) return;
    setInstalling(true);
    onError(null);
    try {
      setSystem(await api.installUpdate(file));
      void refresh();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "System update failed");
      setInstalling(false);
    }
  };

  const refresh = async () => {
    let keepPolling = false;
    try {
      const [current, full, health] = await Promise.all([
        api.frontendUpdateStatus(), api.updateStatus(), api.health(),
      ]);
      if (!mounted.current) return;
      setFrontend(current);
      setSystem(full);
      setBackendVersion(health.version);
      const systemPending = full.state === "installing" || full.state === "staged";
      setInstalling(systemPending);
      keepPolling = systemPending || current.state === "installing" || current.state === "staged";
    } catch {
      // The API briefly disappears while systemd installs and restarts it.
      keepPolling = true;
    }
    if (!mounted.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (keepPolling) {
      timer.current = window.setTimeout(() => void refresh().catch(() => undefined), 1500);
    }
  };

  useEffect(() => {
    mounted.current = true;
    void refresh().catch((caught: unknown) => {
      onError(caught instanceof Error ? caught.message : "Update status could not be loaded");
    });
    return () => {
      mounted.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <section className="updates-shell">
      <div className="section-heading"><div><h2>Updates</h2></div></div>
      <div className="update-card update-card-simple">
        <a className="primary-button update-link" href="https://mycomplexcontrol.com/field-update.html">Update Pi</a>
        <p className="update-message">{updateResult(frontend)}</p>
        {backendVersion && <p className="update-message">Timing system: {backendVersion}</p>}
        <details>
          <summary>Install full system package</summary>
          <p>Choose the prepared .tgz package from Files. Installation ends any active race, saves its results, and restarts the controller. Keep the Pi powered on.</p>
          <input type="file" accept=".tgz,.tar.gz,application/gzip" disabled={installing} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="primary-button" disabled={!file || installing} onClick={() => void installSystem()}>{installing ? "Installing…" : "Install system update"}</button>
          {system && <p role="status">{system.message}</p>}
        </details>
      </div>
    </section>
  );
}

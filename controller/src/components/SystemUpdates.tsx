import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { FrontendUpdateStatus } from "../types";

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

  const refresh = async () => {
    let keepPolling = false;
    try {
      const current = await api.frontendUpdateStatus();
      setFrontend(current);
      keepPolling = current.state === "installing" || current.state === "staged";
    } catch {
      // The API briefly disappears while systemd installs and restarts it.
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

  return (
    <section className="updates-shell">
      <div className="section-heading"><div><h2>Updates</h2></div></div>
      <div className="update-card update-card-simple">
        <a className="primary-button update-link" href="https://mycomplexcontrol.com/field-update.html">Update Pi</a>
        <p className="update-message">{updateResult(frontend)}</p>
      </div>
    </section>
  );
}

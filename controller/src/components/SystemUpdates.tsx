import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatDate } from "../format";
import type { BackupList, FrontendUpdateStatus, NetworkLink, NetworkStatus, UpdateStatus } from "../types";

interface SystemUpdatesProps {
  onError: (message: string | null) => void;
}

const PENDING = new Set(["staged", "waiting", "installing", "verifying"]);

export function interfaceSummary(status: FrontendUpdateStatus | null): string {
  if (!status) return "Checking…";
  const installed = status.current?.version ?? "unknown";
  if (status.staged?.version && PENDING.has(status.state)) {
    return status.deferred_reason === "race_running"
      ? `${installed} in use · ${status.staged.version} is saved and installs after the current race`
      : `${installed} in use · installing ${status.staged.version}`;
  }
  if (status.state === "failed" || status.state === "error") return `${installed} in use · last update failed, nothing changed`;
  return `${installed} · up to date on this controller`;
}

export function systemSummary(status: UpdateStatus | null, version: string | null): string {
  const installed = version ?? status?.current?.version ?? "unknown";
  if (!status) return installed;
  if (status.state === "installing" || status.state === "verifying") return `Installing ${status.version ?? "update"} · racing resumes automatically`;
  if (PENDING.has(status.state) && status.staged?.version) {
    if (status.deferred_reason === "race_running") return `${installed} · ${status.staged.version} installs after racing`;
    return status.operator_requested
      ? `${installed} · ${status.staged.version} installs as soon as no race is running`
      : `${installed} · ${status.staged.version} installs after a few quiet minutes`;
  }
  if (status.state === "failed") return `${installed} · last install failed and was rolled back`;
  return installed;
}

const LINK_LABELS: Record<NetworkLink["kind"], string> = {
  wifi_access_point: "ComplexControl Wi-Fi",
  ethernet: "Ethernet router",
  ethernet_direct: "Direct cable",
  wifi_client: "Joined Wi-Fi / hotspot",
  other: "Other network",
};

export function internetSummary(network: NetworkStatus | null): string {
  if (!network) return "Checking…";
  if (network.internet.state === "online") return "Internet available · this controller downloads interface updates itself between races";
  if (network.internet.state === "offline") return "Local only · phones carry updates; racing does not need internet";
  return "Racing does not need internet";
}

export function SystemUpdates({ onError }: SystemUpdatesProps) {
  const [frontend, setFrontend] = useState<FrontendUpdateStatus | null>(null);
  const [system, setSystem] = useState<UpdateStatus | null>(null);
  const [raceRunning, setRaceRunning] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkStatus | null>(null);
  const [backups, setBackups] = useState<BackupList | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  const refresh = async () => {
    // Older controllers lack some endpoints; show whatever is available.
    const [overview, health, net, saved] = await Promise.allSettled([
      api.updatesOverview(), api.health(), api.networkStatus(), api.backups(),
    ]);
    if (!mounted.current) return;
    let pending = false;
    if (overview.status === "fulfilled") {
      setFrontend(overview.value.frontend);
      setSystem(overview.value.system);
      setRaceRunning(overview.value.race_running);
      pending = PENDING.has(overview.value.frontend.state) || PENDING.has(overview.value.system.state);
    } else {
      const [current, full] = await Promise.allSettled([api.frontendUpdateStatus(), api.updateStatus()]);
      if (current.status === "fulfilled") setFrontend(current.value);
      if (full.status === "fulfilled") setSystem(full.value);
      pending = true;
    }
    if (health.status === "fulfilled") setBackendVersion(health.value.version);
    else pending = true; // The service restarts briefly while a system release installs.
    if (net.status === "fulfilled") setNetwork(net.value);
    if (saved.status === "fulfilled") setBackups(saved.value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void refresh(), pending ? 2000 : 15000);
  };

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    onError(null);
    try {
      setSystem(await api.installUpdate(file));
      setFile(null);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "System update could not be saved");
    } finally {
      setUploading(false);
      void refresh();
    }
  };

  const installNow = async () => {
    onError(null);
    try {
      setSystem(await api.installSystemNow());
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Install could not be requested");
    } finally {
      void refresh();
    }
  };

  const systemPending = system?.staged?.version && system.state !== "installing" && PENDING.has(system.state);
  const newestBackup = backups?.backups[0];

  return (
    <section className="updates-shell">
      <div className="section-heading"><div><h2>Updates</h2><p className="section-copy">Updates are saved immediately and install only when no race is running. Racing is never interrupted.</p></div></div>
      <div className="update-grid">
        <article className="update-card update-card-simple">
          <p className="eyebrow">Controller interface</p>
          <p className="update-message">{interfaceSummary(frontend)}</p>
          <a className="primary-button update-link" href="https://mycomplexcontrol.com/field-update.html">Update Pi from this phone</a>
          {frontend?.state === "failed" && frontend.message && <p className="update-detail">{frontend.message}</p>}
        </article>

        <article className="update-card update-card-simple">
          <p className="eyebrow">Timing system</p>
          <p className="update-message">{systemSummary(system, backendVersion)}</p>
          {system?.last_error && system.state === "failed" && <p className="update-detail">{system.last_error}</p>}
          {systemPending && (
            <button className="primary-button" type="button" disabled={raceRunning} onClick={() => void installNow()}>
              {raceRunning ? "Installs after the current race" : "Install now"}
            </button>
          )}
          <details>
            <summary>Install a system update file</summary>
            <p>Choose the signed <code>.signed.tgz</code> file from Files. It is checked and saved now, then installs when no race is running (about one minute). If anything goes wrong, the previous version and data are restored automatically.</p>
            <input type="file" accept=".tgz,.tar.gz,application/gzip" disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <button className="secondary-button" type="button" disabled={!file || uploading} onClick={() => void upload()}>{uploading ? "Checking…" : "Save system update"}</button>
          </details>
        </article>

        <article className="update-card update-card-simple">
          <p className="eyebrow">Network</p>
          <p className="update-message">{internetSummary(network)}</p>
          {network && (
            <ul className="network-list">
              {network.links.map((link) => (
                <li key={`${link.interface}-${link.address}`}><span>{LINK_LABELS[link.kind]}</span><a href={link.url}>{link.url}</a></li>
              ))}
              <li><span>Name on local networks</span><a href={network.local_name_url}>{network.local_name_url}</a></li>
            </ul>
          )}
        </article>

        <article className="update-card update-card-simple">
          <p className="eyebrow">Backups</p>
          <p className="update-message">
            {newestBackup
              ? `Last automatic backup ${formatDate(newestBackup.created_at)} · ${backups?.backups.length} kept on this controller`
              : backups?.available === false ? "Automatic backups are not available on this device" : "First automatic backup runs when no race is running"}
          </p>
          <a className="secondary-button update-link" href={api.backupDownloadUrl} download>Download full backup to this device</a>
        </article>
      </div>
    </section>
  );
}

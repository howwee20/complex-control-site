import type { PhoneUpdateState } from "../phoneUpdates";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatDate } from "../format";
import type { BackupList, FrontendUpdateStatus, NetworkStatus, UpdateStatus } from "../types";

interface SystemUpdatesProps {
  onError: (message: string | null) => void;
  onChangePin?: () => void;
  onLock?: () => void;
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
  return `${installed} installed`;
}

export function automaticUpdateSummary(network: NetworkStatus | null): string {
  const status = network?.updates;
  if (!status || status.state === "unchecked") return "Waiting for an automatic update check.";
  if (!status.enabled) return "Automatic downloads are not configured on this controller.";
  if (status.state === "current") return "The latest checked interface is installed.";
  if (status.state === "ahead") return "This controller is newer than the published interface.";
  if (status.state === "staged") return "The latest interface is saved and will install when racing is idle.";
  if (status.state === "offline" || status.state === "download_failed") return "Cannot reach the update server. The installed version keeps working.";
  if (status.state === "incompatible") return "A newer interface needs a timing-system update first.";
  return "The latest download could not be verified. The installed version keeps working.";
}

export function backendDownloadSummary(status: UpdateStatus | null): string {
  const feed = status?.feed;
  if (!feed || !feed.enabled) return "Automatic system downloads are not configured on this controller.";
  if (feed.state === "current") return "The latest checked timing system is installed.";
  if (feed.state === "downloading") return "Downloading a timing-system update. Racing keeps working.";
  if (feed.state === "staged" || feed.state === "waiting") return "Update saved. Installation waits until racing is idle.";
  if (feed.state === "offline") return "Offline. Updates resume when this controller has internet; racing keeps working.";
  if (feed.state === "ahead") return "This controller is newer than the published timing system.";
  if (feed.state === "failed" || feed.state === "rejected") return "Update needs attention. The installed version keeps working.";
  return "Waiting for the automatic system update check.";
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

export function internetSummary(network: NetworkStatus | null): string {
  if (!network) return "Checking…";
  if (network.internet.state === "online") return "Internet available · this controller downloads interface updates itself between races";
  if (network.internet.state === "offline") return "Local only · phones carry updates; racing does not need internet";
  return "Racing does not need internet";
}

export function SystemUpdates({ onChangePin, onLock }: SystemUpdatesProps) {
  const [phoneState, setPhoneState] = useState<PhoneUpdateState>("checking");
  const [system, setSystem] = useState<UpdateStatus | null>(null);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkStatus | null>(null);
  const [backups, setBackups] = useState<BackupList | null>(null);
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
      setSystem(overview.value.system);
      pending = PENDING.has(overview.value.frontend.state) || PENDING.has(overview.value.system.state);
    } else {
      const [, full] = await Promise.allSettled([api.frontendUpdateStatus(), api.updateStatus()]);
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
    const receive = (event: Event) => setPhoneState((event as CustomEvent<PhoneUpdateState>).detail);
    window.addEventListener("phone-update", receive);
    mounted.current = true;
    void refresh();
    return () => {
      window.removeEventListener("phone-update", receive);
      mounted.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const phoneText = { checking: "Checking updates", current: "Up to date", sending: "Receiving update from phone", saved: "Update saved", offline: "Updates waiting for phone internet", unavailable: "", failed: "Update not applied" }[phoneState];
  const newestBackup = backups?.backups[0];

  return (
    <section className="updates-shell">
      <h2>Settings</h2>
      <div className="settings-compact">
        <div><strong>Software</strong><span>{systemSummary(system, backendVersion)}{phoneText && ` · ${phoneText}`}</span></div>
        <div><strong>Connection</strong><span>{network?.links.some(link => link.kind === "wifi_access_point") ? "ComplexControl Wi-Fi" : "Connected to controller"}</span></div>
        <div><strong>Backup</strong><span>{newestBackup ? formatDate(newestBackup.created_at) : "No backup yet"}</span><a href={api.backupDownloadUrl} download>Download</a></div>
        <div><strong>PIN</strong><span />{onChangePin && <button className="text-button" onClick={onChangePin}>Change PIN</button>}{onLock && <button className="text-button" onClick={onLock}>Lock</button>}</div>
      </div>
    </section>
  );
}

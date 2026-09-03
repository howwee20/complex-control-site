(() => {
  "use strict";

  const DB_NAME = "complex-control-field-updates";
  const STORE = "capsules";
  const KEY = "latest";
  const UPDATER_VERSION = "6";
  const UPDATER_VERSION_KEY = "complex-control-field-updater-version";
  const CONTROLLER_ORIGIN = "http://10.42.0.1:8000";
  const RECEIVER_URL = `${CONTROLLER_ORIGIN}/field-update-receiver.html`;
  const status = document.querySelector("#status");
  const updateButton = document.querySelector("#prepare");
  let updateInProgress = false;

  const setStatus = (message) => { status.textContent = message; };
  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const writeCached = async (value) => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  };
  const readCached = async () => {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  };
  const clearOldCache = async () => {
    if (localStorage.getItem(UPDATER_VERSION_KEY) === UPDATER_VERSION) return;
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = resolve;
    });
    localStorage.setItem(UPDATER_VERSION_KEY, UPDATER_VERSION);
  };
  const sha256 = async (buffer) => {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  };

  const downloadLatest = async () => {
    setStatus("Downloading latest update…");
    try {
      const manifestResponse = await fetch(`/field/latest.json?download=${Date.now()}`, { cache: "no-store" });
      if (!manifestResponse.ok) throw new Error("Latest release manifest is unavailable");
      const manifest = await manifestResponse.json();
      const [capsuleResponse, signatureResponse] = await Promise.all([
        fetch(manifest.capsule_url, { cache: "no-store" }),
        fetch(manifest.signature_url, { cache: "no-store" }),
      ]);
      if (!capsuleResponse.ok || !signatureResponse.ok) throw new Error("Latest release files are unavailable");
      const capsule = await capsuleResponse.arrayBuffer();
      const signature = await signatureResponse.arrayBuffer();
      if (await sha256(capsule) !== manifest.sha256) throw new Error("Downloaded update checksum did not match");
      if (signature.byteLength !== 64) throw new Error("Downloaded update signature is invalid");
      const cached = { manifest, capsule, signature, cached_at: new Date().toISOString() };
      await writeCached(cached);
      return cached;
    } catch (error) {
      const cached = await readCached().catch(() => null);
      if (!cached) throw error;
      setStatus(`Using ${cached.manifest.version} already downloaded to this phone…`);
      return cached;
    }
  };

  const openReceiverFromTap = () => {
    return window.open(`${RECEIVER_URL}?connect=${Date.now()}`, "complex-control-field-receiver");
  };

  const deliver = (cached, receiver) => new Promise((resolve, reject) => {
    let sent = false;
    let receiverReady = false;
    let retryTimer = null;
    const deadline = window.setTimeout(() => {
      finish(new Error("Could not reach the Pi. Stay connected to ComplexControl and tap Update Pi again."));
    }, 120000);

    const finish = (error) => {
      window.clearTimeout(deadline);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener("message", onMessage);
      if (error) reject(error);
      else resolve();
    };

    const connect = () => {
      if (receiverReady) return;
      try {
        receiver.location.replace(`${RECEIVER_URL}?connect=${Date.now()}`);
      } catch {
        // Safari can briefly reject navigation while changing Wi-Fi routes.
      }
      retryTimer = window.setTimeout(connect, 4000);
    };

    const onMessage = (event) => {
      if (event.origin !== CONTROLLER_ORIGIN || event.source !== receiver) return;
      if (event.data?.type === "complex-control-field-update-complete") {
        finish();
        return;
      }
      if (event.data?.type !== "complex-control-field-receiver-ready" || sent) return;
      receiverReady = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      sent = true;
      receiver.postMessage(
        {
          type: "complex-control-field-capsule",
          capsule: cached.capsule,
          signature: cached.signature,
          filename: cached.manifest.filename,
          sha256: cached.manifest.sha256,
          version: cached.manifest.version,
          site_commit: cached.manifest.site_commit,
        },
        CONTROLLER_ORIGIN,
        [cached.capsule, cached.signature],
      );
      setStatus("Update delivered. The Pi is verifying, installing, and health-checking it…");
    };

    window.addEventListener("message", onMessage);
    connect();
  });

  const updatePi = async () => {
    if (updateInProgress) return;
    const receiver = openReceiverFromTap();
    if (!receiver) {
      setStatus("Allow pop-ups, then tap Update Pi again.");
      return;
    }

    updateInProgress = true;
    updateButton.disabled = true;
    try {
      const cached = await readCached();
      if (!cached) throw new Error("Open this page with cellular service before updating the Pi.");
      setStatus("Connecting to the Pi…");
      await deliver(cached, receiver);
      setStatus(`Last update: ${cached.manifest.version} · Successful`);
      updateButton.textContent = "Pi is up to date";
    } catch (error) {
      try { receiver.close(); } catch { /* The local receiver may already have closed itself. */ }
      setStatus(error instanceof Error ? error.message : "The update could not be completed.");
      updateButton.textContent = "Try Update Pi again";
    } finally {
      updateInProgress = false;
      updateButton.disabled = false;
    }
  };

  updateButton.addEventListener("click", () => void updatePi());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/field-update-sw.js?updater=6").catch(() => undefined);
  updateButton.disabled = true;
  void clearOldCache()
    .then(() => downloadLatest())
    .then((cached) => {
      setStatus(`Ready: ${cached.manifest.version}`);
    })
    .catch((error) => {
      setStatus(error instanceof Error ? error.message : "Open this page with cellular service.");
    })
    .finally(() => { updateButton.disabled = false; });
})();

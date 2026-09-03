(() => {
  "use strict";

  const DB_NAME = "complex-control-field-updates";
  const STORE = "capsules";
  const KEY = "latest";
  const CONTROLLER_ORIGIN = "http://10.42.0.1:8000";
  const RECEIVER_URL = `${CONTROLLER_ORIGIN}/field-update-receiver.html`;
  const status = document.querySelector("#status");
  const details = document.querySelector("#details");
  const updateButton = document.querySelector("#prepare");
  const retryButton = document.querySelector("#install");
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
  const sha256 = async (buffer) => {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  };

  const describe = (cached) => {
    details.textContent = `Jake’s ${cached.manifest.version} interface · Published ${cached.manifest.created_at} · ${(cached.capsule.byteLength / 1048576).toFixed(1)} MB`;
  };

  const downloadLatest = async () => {
    setStatus("Getting Jake’s newest approved interface over cellular…");
    try {
      const manifestResponse = await fetch("/field/latest.json", { cache: "no-store" });
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
      describe(cached);
      return cached;
    } catch (error) {
      const cached = await readCached().catch(() => null);
      if (!cached) throw error;
      setStatus(`Cellular is unavailable. Using the prepared ${cached.manifest.version} interface already on this phone…`);
      describe(cached);
      return cached;
    }
  };

  const openReceiverFromTap = () => {
    // Open synchronously from the tap so Safari keeps the user gesture while
    // the cellular download is in progress.
    const receiver = window.open("about:blank", "complex-control-field-receiver");
    if (!receiver) return null;
    try {
      receiver.document.title = "Connecting to Complex Control";
      receiver.document.body.innerHTML = "<p style='font:700 20px system-ui;padding:30px'>Connecting to the Pi…</p>";
    } catch {
      // A receiver left open from an earlier run can already be cross-origin.
    }
    return receiver;
  };

  const deliver = (cached, receiver) => new Promise((resolve, reject) => {
    let sent = false;
    const deadline = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("The Pi did not answer. Confirm the phone joined ComplexControl and tap Update Pi again."));
    }, 30000);

    const finish = (error) => {
      window.clearTimeout(deadline);
      window.removeEventListener("message", onMessage);
      if (error) reject(error);
      else resolve();
    };

    const onMessage = (event) => {
      if (event.origin !== CONTROLLER_ORIGIN || event.source !== receiver) return;
      if (event.data?.type === "complex-control-field-update-complete") {
        finish();
        return;
      }
      if (event.data?.type !== "complex-control-field-receiver-ready" || sent) return;
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
    receiver.location.replace(RECEIVER_URL);
  });

  const updatePi = async () => {
    if (updateInProgress) return;
    const receiver = openReceiverFromTap();
    if (!receiver) {
      setStatus("Safari blocked the Pi window. Allow pop-ups for this page, then tap Update Pi again.");
      retryButton.hidden = false;
      retryButton.disabled = false;
      return;
    }

    updateInProgress = true;
    updateButton.disabled = true;
    retryButton.disabled = true;
    retryButton.hidden = true;
    try {
      const cached = await downloadLatest();
      setStatus("Newest interface secured. Connecting to the Pi over ComplexControl…");
      await deliver(cached, receiver);
      setStatus(`Done. Jake’s ${cached.manifest.version} interface is installed and healthy on the Pi.`);
      updateButton.textContent = "Pi is up to date";
    } catch (error) {
      try { receiver.close(); } catch { /* The local receiver may already have closed itself. */ }
      setStatus(error instanceof Error ? error.message : "The update could not be completed.");
      updateButton.textContent = "Try Update Pi again";
    } finally {
      updateInProgress = false;
      updateButton.disabled = false;
      retryButton.disabled = false;
    }
  };

  updateButton.addEventListener("click", () => void updatePi());
  retryButton.addEventListener("click", () => void updatePi());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/field-update-sw.js").catch(() => undefined);
  void readCached().then((cached) => {
    if (!cached) {
      setStatus("Ready. Walk within range of the powered Pi and tap Update Pi.");
      return;
    }
    describe(cached);
    setStatus("Ready. Tap Update Pi to get the newest release and install it.");
  });
})();

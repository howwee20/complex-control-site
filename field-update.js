(() => {
  "use strict";
  const DB_NAME = "complex-control-field-updates";
  const STORE = "capsules";
  const KEY = "latest";
  const CONTROLLER_ORIGIN = "http://10.42.0.1:8000";
  const status = document.querySelector("#status");
  const details = document.querySelector("#details");
  const prepareButton = document.querySelector("#prepare");
  const installButton = document.querySelector("#install");

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

  const showCached = (cached) => {
    if (!cached) return false;
    setStatus(`Ready on this phone: Jake’s ${cached.manifest.version} interface.`);
    details.textContent = `Published ${cached.manifest.created_at} · ${(cached.capsule.byteLength / 1048576).toFixed(1)} MB · ${cached.manifest.site_commit.slice(0, 12)}`;
    installButton.disabled = false;
    prepareButton.textContent = "Refresh latest update";
    return true;
  };

  const prepareLatest = async () => {
    prepareButton.disabled = true;
    setStatus("Downloading and verifying Jake’s latest interface…");
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
      showCached(cached);
    } catch (error) {
      const cached = await readCached().catch(() => null);
      if (cached) {
        showCached(cached);
        setStatus(`Offline—keeping the prepared ${cached.manifest.version} interface on this phone.`);
      } else {
        setStatus(error instanceof Error ? error.message : "The update could not be prepared.");
      }
    } finally {
      prepareButton.disabled = false;
    }
  };

  installButton.addEventListener("click", async () => {
    const receiver = window.open(`${CONTROLLER_ORIGIN}/field-update-receiver.html`, "_blank");
    if (!receiver) {
      setStatus("Allow the controller window to open, then try again.");
      return;
    }
    setStatus("Connecting to the Pi. Keep this page open…");
    const deadline = window.setTimeout(() => {
      setStatus("The Pi did not answer. Confirm this phone is connected to ComplexControl, then try again.");
    }, 15000);
    const onReady = async (event) => {
      if (event.origin !== CONTROLLER_ORIGIN || event.source !== receiver) return;
      if (event.data?.type !== "complex-control-field-receiver-ready") return;
      window.clearTimeout(deadline);
      window.removeEventListener("message", onReady);
      const cached = await readCached();
      if (!cached) {
        setStatus("No prepared update remains on this phone. Reconnect to cellular and prepare it again.");
        return;
      }
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
      setStatus("Update delivered to the Pi. Continue in the controller window.");
    };
    window.addEventListener("message", onReady);
  });

  prepareButton.addEventListener("click", () => void prepareLatest());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/field-update-sw.js").catch(() => undefined);
  void readCached().then((cached) => {
    if (cached) showCached(cached);
    void prepareLatest();
  });
})();

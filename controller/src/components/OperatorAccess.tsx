import { FormEvent, useState } from "react";

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

interface LoginProps {
  busy: boolean;
  onLogin: (pin: string) => void;
  onRecover: (recoveryCode: string, newPin: string) => void;
}

export function OperatorLogin({ busy, onLogin, onRecover }: LoginProps) {
  const [pin, setPin] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (/^\d{4}$/.test(pin)) onLogin(pin);
  };

  if (recovering) {
    const valid = code.replace(/[^0-9a-z]/gi, "").length >= 20 && /^\d{4}$/.test(newPin) && newPin === confirmation;
    return (
      <section className="access-shell">
        <form className="access-card" onSubmit={(event) => { event.preventDefault(); if (valid) onRecover(code, newPin); }}>
          <p className="eyebrow">Owner recovery</p>
          <h1>Reset PIN</h1>
          <p>Enter the owner recovery code saved when this controller was set up. Every other phone is signed out and you get a new recovery code. Works without internet.</p>
          <label><span>Recovery code</span><input autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" /></label>
          <label><span>New PIN</span><input inputMode="numeric" maxLength={4} type="password" value={newPin} onChange={(event) => setNewPin(digits(event.target.value))} /></label>
          <label><span>Confirm new PIN</span><input inputMode="numeric" maxLength={4} type="password" value={confirmation} onChange={(event) => setConfirmation(digits(event.target.value))} /></label>
          <button className="primary-button" disabled={busy || !valid} type="submit">{busy ? "Resetting…" : "Reset PIN"}</button>
          <p className="access-footnote">No recovery code? Power off the controller, put its SD card in any computer, create an empty file named <code>complex-control-reset-pin</code> on the boot drive, and power on. The PIN returns to the initial PIN.</p>
          <button className="text-button" type="button" onClick={() => setRecovering(false)}>Back to PIN</button>
        </form>
      </section>
    );
  }

  return (
    <section className="access-shell">
      <form className="access-card" onSubmit={submit}>
        <p className="eyebrow">Operator access</p>
        <h1>Enter PIN</h1>
        <p>Use the four-digit PIN for this controller. Sign-in works without internet, and this browser stays signed in for up to 30 days.</p>
        <label>
          <span>Operator PIN</span>
          <input
            autoFocus
            autoComplete="current-password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            type="password"
            value={pin}
            onChange={(event) => setPin(digits(event.target.value))}
          />
        </label>
        <button className="primary-button" disabled={busy || pin.length !== 4} type="submit">
          {busy ? "Opening…" : "Open race control"}
        </button>
        <button className="text-button" type="button" onClick={() => setRecovering(true)}>Forgot PIN?</button>
      </form>
    </section>
  );
}

interface PinChangeProps {
  busy: boolean;
  recoveryConfigured: boolean;
  onClose: () => void;
  onChange: (currentPin: string, newPin: string) => void;
  onCreateRecovery: (currentPin: string) => void;
}

export function OperatorPinChange({ busy, recoveryConfigured, onClose, onChange, onCreateRecovery }: PinChangeProps) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const valid = /^\d{4}$/.test(currentPin) && /^\d{4}$/.test(newPin) && newPin === confirmation;

  return (
    <div className="modal-backdrop">
      <form className="confirm-modal access-change" onSubmit={(event) => {
        event.preventDefault();
        if (valid) onChange(currentPin, newPin);
      }}>
        <p className="eyebrow">Operator access</p>
        <h3>Change PIN</h3>
        <label><span>Current PIN</span><input inputMode="numeric" maxLength={4} type="password" value={currentPin} onChange={(event) => setCurrentPin(digits(event.target.value))} /></label>
        <label><span>New PIN</span><input inputMode="numeric" maxLength={4} type="password" value={newPin} onChange={(event) => setNewPin(digits(event.target.value))} /></label>
        <label><span>Confirm new PIN</span><input inputMode="numeric" maxLength={4} type="password" value={confirmation} onChange={(event) => setConfirmation(digits(event.target.value))} /></label>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy || !valid} type="submit">Save PIN</button>
        </div>
        <div className="recovery-setup">
          <p className="eyebrow">Owner recovery code</p>
          <p>{recoveryConfigured
            ? "A recovery code exists. Creating a new one replaces it."
            : "Create a code that resets a forgotten PIN without internet. Enter the current PIN above first."}</p>
          <button className="secondary-button" type="button" disabled={busy || !/^\d{4}$/.test(currentPin)} onClick={() => onCreateRecovery(currentPin)}>
            {recoveryConfigured ? "Replace recovery code" : "Create recovery code"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface RecoveryCodeProps {
  code: string;
  onClose: () => void;
}

export function RecoveryCodeDialog({ code, onClose }: RecoveryCodeProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="modal-backdrop">
      <div className="confirm-modal" role="dialog" aria-label="Owner recovery code">
        <p className="eyebrow">Owner recovery code</p>
        <h3 className="recovery-code">{code}</h3>
        <p>Write this down and keep it away from the track. It is shown only once and resets a forgotten PIN on this controller without internet.</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => undefined);
          }}>{copied ? "Copied" : "Copy"}</button>
          <button className="primary-button" type="button" onClick={onClose}>I saved it</button>
        </div>
      </div>
    </div>
  );
}

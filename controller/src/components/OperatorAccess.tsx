import { FormEvent, useState } from "react";

interface LoginProps {
  busy: boolean;
  onLogin: (pin: string) => void;
}

export function OperatorLogin({ busy, onLogin }: LoginProps) {
  const [pin, setPin] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (/^\d{4}$/.test(pin)) onLogin(pin);
  };

  return (
    <section className="access-shell">
      <form className="access-card" onSubmit={submit}>
        <p className="eyebrow">Operator access</p>
        <h1>Enter PIN</h1>
        <p>Use the four-digit PIN for this controller.</p>
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
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <button className="primary-button" disabled={busy || pin.length !== 4} type="submit">
          {busy ? "Opening…" : "Open race control"}
        </button>
      </form>
    </section>
  );
}

interface PinChangeProps {
  busy: boolean;
  onClose: () => void;
  onChange: (currentPin: string, newPin: string) => void;
}

export function OperatorPinChange({ busy, onClose, onChange }: PinChangeProps) {
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
        <label><span>Current PIN</span><input inputMode="numeric" maxLength={4} type="password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <label><span>New PIN</span><input inputMode="numeric" maxLength={4} type="password" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <label><span>Confirm new PIN</span><input inputMode="numeric" maxLength={4} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy || !valid} type="submit">Save PIN</button>
        </div>
      </form>
    </div>
  );
}

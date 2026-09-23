import { FormEvent, useState } from "react";
import { api, type ApiError } from "../lib/api";

/**
 * Rotating a console password otherwise means shelling into the server and re-running the
 * seed script, so in practice it never happens.
 */
export default function AdminPasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    if (next.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }

    setSaving(true);
    try {
      await api.adminChangePassword({ current_password: current, new_password: next });
      setMessage("Password updated. Your current session stays signed in.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as ApiError | undefined)?.detail || "Unable to change the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-card">
      <div className="admin-card-header compact">
        <h3>Change your password</h3>
      </div>
      <form className="settings-grid admin-form-grid" onSubmit={submit}>
        <label className="field">
          Current password
          <input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="field">
          New password
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            minLength={10}
            required
          />
          <span className="field-note">At least 10 characters.</span>
        </label>
        <label className="field">
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>
      {(message || error) && <p className={`status ${error ? "error" : ""}`}>{error ?? message}</p>}
    </section>
  );
}

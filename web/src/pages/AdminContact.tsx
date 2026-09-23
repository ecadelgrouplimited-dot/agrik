import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Message = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  topic: string;
  message: string;
  status: string;
  admin_note?: string | null;
  notified: boolean;
  acknowledged: boolean;
  created_at: string;
};

const STATUSES = ["new", "read", "replied", "closed"];

function formatWhen(value: string) {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "--" : new Date(ms).toLocaleString();
}

export default function AdminContact() {
  const [items, setItems] = useState<Message[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .adminContact(statusFilter ? `?status=${statusFilter}` : "")
      .then((res) => {
        setItems(res.items);
        setSelectedId((current) => (current && res.items.some((m) => m.id === current) ? current : res.items[0]?.id ?? null));
      })
      .catch(() => setError("Unable to load messages."));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => items.find((m) => m.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    setNote(selected?.admin_note ?? "");
  }, [selected?.id, selected?.admin_note]);

  // Opening an unread enquiry marks it read, so the queue reflects what has been seen
  // without anyone having to remember to click.
  useEffect(() => {
    if (!selected || selected.status !== "new") return;
    api
      .adminUpdateContact(selected.id, { status: "read" })
      .then(() => setItems((prev) => prev.map((m) => (m.id === selected.id ? { ...m, status: "read" } : m))))
      .catch(() => undefined);
  }, [selected]);

  const update = async (payload: { status?: string; admin_note?: string | null }, note: string) => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      await api.adminUpdateContact(selected.id, payload);
      setStatusMessage(note);
      load();
    } catch {
      setError("Unable to update that message.");
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await api.adminResendContact(selected.id);
      setStatusMessage(
        result.notified && result.acknowledged
          ? "Both emails sent."
          : `Sent what we could — team notified: ${result.notified}, sender acknowledged: ${result.acknowledged}.`
      );
      load();
    } catch (err) {
      setError((err as { detail?: string })?.detail || "Still unable to send.");
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(
    () => ({
      total: items.length,
      open: items.filter((m) => m.status === "new" || m.status === "read").length,
      undelivered: items.filter((m) => !m.notified).length,
      replied: items.filter((m) => m.status === "replied").length,
    }),
    [items]
  );

  return (
    <section className="admin-page">
      {error && <p className="status error">{error}</p>}
      {statusMessage && <p className="status">{statusMessage}</p>}

      {counts.undelivered > 0 ? (
        <p className="status error">
          {counts.undelivered} message{counts.undelivered === 1 ? "" : "s"} never reached the team inbox — the sender
          still got through, but check the mail configuration.
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        {[
          { label: "Messages", value: counts.total, meta: "In this view" },
          { label: "Awaiting reply", value: counts.open, meta: "New or read, not answered" },
          { label: "Replied", value: counts.replied, meta: "Marked as answered" },
          { label: "Not delivered", value: counts.undelivered, meta: "Email to the inbox failed" },
        ].map((item) => (
          <div key={item.label} className="admin-kpi-card">
            <div className="admin-kpi-label">{item.label}</div>
            <div className="admin-kpi-value">{item.value}</div>
            <div className="admin-kpi-meta">{item.meta}</div>
          </div>
        ))}
      </div>

      <section className="admin-listings-layout">
        <section className="admin-card">
          <div className="admin-card-header compact">
            <h3>Inbox</h3>
            <div className="admin-filter-bar">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button className="btn ghost small" type="button" onClick={load}>
                Refresh
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="admin-empty">No messages in this view.</p>
          ) : (
            <div className="admin-grid-wrap">
              <table className="admin-grid">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={selected?.id === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}>
                      <td>
                        <strong>{item.name}</strong>
                        <span className="admin-grid-sub">{item.email}</span>
                      </td>
                      <td>{item.topic}</td>
                      <td>
                        <span className={`pill ${item.status === "new" ? "" : "pill-muted"}`}>{item.status}</span>
                      </td>
                      <td>{formatWhen(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="admin-card admin-listing-detail">
          {!selected ? (
            <p className="admin-empty">Select a message to read it.</p>
          ) : (
            <>
              <div className="admin-card-header compact">
                <h3>{selected.topic}</h3>
                <span className={`pill ${selected.status === "new" ? "" : "pill-muted"}`}>{selected.status}</span>
              </div>

              <div className="admin-detail-grid">
                <div>
                  <span className="label">From</span>
                  <strong>{selected.name}</strong>
                </div>
                <div>
                  <span className="label">Received</span>
                  <strong>{formatWhen(selected.created_at)}</strong>
                </div>
                <div>
                  <span className="label">Email</span>
                  <strong>{selected.email}</strong>
                </div>
                <div>
                  <span className="label">Phone</span>
                  <strong>{selected.phone || "not given"}</strong>
                </div>
              </div>

              <div className="admin-detail-block">
                <div className="label">Message</div>
                <p className="admin-contact-body">{selected.message}</p>
              </div>

              <div className="admin-detail-block">
                <div className="label">Delivery</div>
                <div className="admin-chip-row">
                  <span className="admin-filter-chip">{selected.notified ? "Team notified" : "Inbox email failed"}</span>
                  <span className="admin-filter-chip">
                    {selected.acknowledged ? "Sender acknowledged" : "Acknowledgement failed"}
                  </span>
                  {!selected.notified || !selected.acknowledged ? (
                    <button className="btn ghost small" type="button" disabled={saving} onClick={resend}>
                      Resend
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="admin-detail-block">
                <div className="label">Internal note</div>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What was done, or what still needs doing."
                />
                <button className="btn ghost small" type="button" disabled={saving} onClick={() => update({ admin_note: note }, "Note saved.")}>
                  Save note
                </button>
              </div>

              <div className="admin-detail-block">
                <div className="label">Answer</div>
                <a className="btn small" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.topic} (#${selected.id}) — AGRIK`)}`}>
                  Reply by email
                </a>
                <div className="admin-chip-row">
                  <button className="btn ghost small" type="button" disabled={saving} onClick={() => update({ status: "replied" }, "Marked as replied.")}>
                    Mark replied
                  </button>
                  <button className="btn ghost small" type="button" disabled={saving} onClick={() => update({ status: "closed" }, "Closed.")}>
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </section>
    </section>
  );
}

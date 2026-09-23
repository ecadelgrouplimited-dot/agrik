import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Plan = {
  id: number;
  code: string;
  name: string;
  summary?: string | null;
  price: number;
  currency: string;
  billing_period: string;
  duration_days?: number | null;
  status: string;
  sort_order: number;
  updated_at?: string | null;
};

type PlanFilters = {
  billing_period: string;
  status: string;
};

type PlanDraft = {
  code: string;
  name: string;
  summary: string;
  price: string;
  currency: string;
  billing_period: string;
  duration_days: string;
  status: string;
  sort_order: string;
};

const BILLING_PERIODS = [
  { value: "monthly", label: "Monthly", hint: "Renews every 30 days" },
  { value: "quarterly", label: "Quarterly", hint: "Renews every 91 days" },
  { value: "annual", label: "Annual", hint: "Renews every 365 days" },
  { value: "seasonal", label: "Seasonal", hint: "Runs for one planting season — set the days" },
  { value: "one_off", label: "One-off", hint: "Charged once, no renewal — set how long access lasts" },
];

/** The two periods that are not a calendar interval and so carry their own term. */
const NEEDS_DURATION = new Set(["seasonal", "one_off"]);

const defaultDraft: PlanDraft = {
  code: "",
  name: "",
  summary: "",
  price: "",
  currency: "UGX",
  billing_period: "monthly",
  duration_days: "",
  status: "active",
  sort_order: "0",
};

const periodLabel = (value?: string | null) =>
  BILLING_PERIODS.find((item) => item.value === value)?.label ?? value ?? "--";

/** What a farmer sees on the plan card: "UGX 15,000 / month". */
function priceLine(plan: Plan) {
  const amount = `${plan.currency} ${plan.price.toLocaleString()}`;
  switch (plan.billing_period) {
    case "monthly":
      return `${amount} / month`;
    case "quarterly":
      return `${amount} / quarter`;
    case "annual":
      return `${amount} / year`;
    case "seasonal":
      return `${amount} / season${plan.duration_days ? ` (${plan.duration_days} days)` : ""}`;
    case "one_off":
      return `${amount} once${plan.duration_days ? ` (${plan.duration_days} days access)` : ""}`;
    default:
      return amount;
  }
}

/** Derive a stable code from the plan name, so the admin rarely has to think about it. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function exportPlansCsv(items: Plan[]) {
  const headers = ["id", "code", "name", "summary", "price", "currency", "billing_period", "duration_days", "status", "sort_order"];
  const csv = [
    headers.join(","),
    ...items.map((item) =>
      [
        item.id,
        item.code,
        item.name,
        item.summary ?? "",
        item.price,
        item.currency,
        item.billing_period,
        item.duration_days ?? "",
        item.status,
        item.sort_order,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `service-plans-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function AdminServices() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filters, setFilters] = useState<PlanFilters>({ billing_period: "", status: "" });
  const [draft, setDraft] = useState<PlanDraft>(defaultDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPlans = useCallback(() => {
    setError(null);
    api
      .adminServices()
      .then((res) => {
        const rows = ((res as { items: Plan[] }).items || []).slice();
        setPlans(rows);
        setSelectedPlanId((current) => (current && rows.some((item) => item.id === current) ? current : rows[0]?.id ?? null));
      })
      .catch(() => setError("Unable to load plans."));
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Filtering is local: the catalog is a short list that is always loaded in full.
  const visiblePlans = useMemo(
    () =>
      plans.filter((plan) => {
        if (filters.billing_period && plan.billing_period !== filters.billing_period) return false;
        if (filters.status && plan.status !== filters.status) return false;
        return true;
      }),
    [filters, plans]
  );

  const resetDraft = () => {
    setDraft(defaultDraft);
    setEditingId(null);
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setDraft({
      code: plan.code,
      name: plan.name,
      summary: plan.summary ?? "",
      price: String(plan.price),
      currency: plan.currency,
      billing_period: plan.billing_period,
      duration_days: plan.duration_days ? String(plan.duration_days) : "",
      status: plan.status,
      sort_order: String(plan.sort_order ?? 0),
    });
  };

  const handleSave = async () => {
    setError(null);
    setStatusMessage(null);

    const name = draft.name.trim();
    if (!name) {
      setError("A plan needs a name.");
      return;
    }
    if (!draft.price.trim() || Number.isNaN(Number(draft.price))) {
      setError("A plan needs a price. Use 0 for a free plan.");
      return;
    }
    const durationDays = draft.duration_days ? Number(draft.duration_days) : null;
    if (NEEDS_DURATION.has(draft.billing_period) && (!durationDays || durationDays < 1)) {
      setError(`A ${periodLabel(draft.billing_period).toLowerCase()} plan needs a duration in days.`);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.adminUpdateService(editingId, {
          name,
          summary: draft.summary || null,
          price: Number(draft.price),
          currency: draft.currency || "UGX",
          billing_period: draft.billing_period,
          duration_days: NEEDS_DURATION.has(draft.billing_period) ? durationDays : null,
          status: draft.status,
          sort_order: Number(draft.sort_order) || 0,
        });
        setStatusMessage(`${name} updated.`);
      } else {
        const code = (draft.code.trim() || slugify(name)) as string;
        if (!code) {
          setError("Could not derive a code from that name — enter one.");
          setSaving(false);
          return;
        }
        await api.adminCreateService({
          code,
          name,
          summary: draft.summary || null,
          price: Number(draft.price),
          currency: draft.currency || "UGX",
          billing_period: draft.billing_period,
          duration_days: NEEDS_DURATION.has(draft.billing_period) ? durationDays : null,
          status: draft.status,
          sort_order: Number(draft.sort_order) || 0,
        });
        setStatusMessage(`${name} created.`);
      }
      resetDraft();
      loadPlans();
    } catch (err) {
      setError((err as { detail?: string })?.detail || "Unable to save plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    setError(null);
    setStatusMessage(null);
    try {
      await api.adminDeleteService(plan.id);
      loadPlans();
      setStatusMessage(`${plan.name} deleted.`);
    } catch (err) {
      setError((err as { detail?: string })?.detail || "Unable to delete plan.");
    }
  };

  const handleSeed = async () => {
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await api.adminSeedServices();
      await loadPlans();
      setStatusMessage(
        result.skipped
          ? `${result.created} plan(s) added, ${result.skipped} already existed.`
          : `${result.created} starter plan(s) added.`
      );
    } catch {
      setError("Unable to seed starter plans.");
    } finally {
      setSaving(false);
    }
  };

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? visiblePlans[0] ?? null,
    [plans, selectedPlanId, visiblePlans]
  );

  const summary = useMemo(
    () => ({
      total: plans.length,
      active: plans.filter((plan) => plan.status === "active").length,
      paused: plans.filter((plan) => plan.status === "paused").length,
      incomplete: plans.filter((plan) => !plan.summary).length,
    }),
    [plans]
  );

  const durationRequired = NEEDS_DURATION.has(draft.billing_period);
  const selectedPeriodHint = BILLING_PERIODS.find((item) => item.value === draft.billing_period)?.hint;

  return (
    <section className="admin-page">
      {error && <p className="status error">{error}</p>}
      {statusMessage && <p className="status">{statusMessage}</p>}

      <div className="admin-kpi-grid">
        {[
          { label: "Catalog", value: summary.total, meta: "Plans defined" },
          { label: "Active", value: summary.active, meta: "Farmers can subscribe" },
          { label: "Paused", value: summary.paused, meta: "Hidden from farmers" },
          { label: "No summary", value: summary.incomplete, meta: "Farmers see a blank card" },
        ].map((item) => (
          <div key={item.label} className="admin-kpi-card">
            <div className="admin-kpi-label">{item.label}</div>
            <div className="admin-kpi-value">{item.value}</div>
            <div className="admin-kpi-meta">{item.meta}</div>
          </div>
        ))}
      </div>

      <section className="admin-card">
        <div className="admin-card-header compact">
          <h3>{editingId ? `Edit ${draft.name || "plan"}` : "New plan"}</h3>
          <div className="admin-page-actions">
            <button className="btn ghost small" type="button" onClick={handleSeed} disabled={saving}>
              Seed starter plans
            </button>
            {editingId && (
              <button className="btn ghost small" type="button" onClick={resetDraft}>
                Cancel edit
              </button>
            )}
          </div>
        </div>

        <div className="settings-grid admin-form-grid">
          <label className="field">
            Plan name
            <input
              placeholder="Advanced Advisory (Image Diagnosis)"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="field">
            Billing period
            <select
              value={draft.billing_period}
              onChange={(event) => setDraft((prev) => ({ ...prev, billing_period: event.target.value }))}
            >
              {BILLING_PERIODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {selectedPeriodHint ? <span className="field-note">{selectedPeriodHint}</span> : null}
          </label>
          <label className="field">
            Price
            <input
              type="number"
              min="0"
              value={draft.price}
              onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))}
            />
          </label>
          <label className="field">
            Currency
            <input value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value }))} />
          </label>
          {durationRequired ? (
            <label className="field">
              Duration (days)
              <input
                type="number"
                min="1"
                placeholder={draft.billing_period === "seasonal" ? "150" : "7"}
                value={draft.duration_days}
                onChange={(event) => setDraft((prev) => ({ ...prev, duration_days: event.target.value }))}
              />
            </label>
          ) : null}
          <label className="field">
            Status
            <select value={draft.status} onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="retired">retired</option>
            </select>
          </label>
          <label className="field">
            Order
            <input
              type="number"
              value={draft.sort_order}
              onChange={(event) => setDraft((prev) => ({ ...prev, sort_order: event.target.value }))}
            />
          </label>
          <label className="field farmer-form-span">
            Summary
            <input
              placeholder="What the farmer gets, in one line."
              value={draft.summary}
              onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
            />
          </label>
          <button className="btn" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create plan"}
          </button>
        </div>
      </section>

      <section className="admin-listings-layout">
        <section className="admin-card">
          <div className="admin-card-header compact">
            <h3>Plan catalog</h3>
            <div className="admin-filter-bar">
              <button className="btn ghost small" type="button" onClick={() => exportPlansCsv(visiblePlans)}>
                Export
              </button>
              <select
                value={filters.billing_period}
                onChange={(event) => setFilters((prev) => ({ ...prev, billing_period: event.target.value }))}
              >
                <option value="">All periods</option>
                {BILLING_PERIODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">All status</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="retired">retired</option>
              </select>
            </div>
          </div>

          {visiblePlans.length === 0 ? (
            <p className="admin-empty">
              No plans yet. "Seed starter plans" fills the catalog with a set you can edit.
            </p>
          ) : (
            <div className="admin-grid-wrap">
              <table className="admin-grid">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Period</th>
                    <th className="admin-grid-num">Price</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visiblePlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className={selectedPlan?.id === plan.id ? "active" : ""}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <td>
                        <strong>{plan.name}</strong>
                        <span className="admin-grid-sub">{plan.code}</span>
                      </td>
                      <td>
                        {periodLabel(plan.billing_period)}
                        {plan.duration_days ? <span className="admin-grid-sub">{plan.duration_days} days</span> : null}
                      </td>
                      {/* Just the amount: the Period column already carries the term, and
                          the detail panel shows the full line a farmer sees. */}
                      <td className="admin-grid-num">
                        {plan.currency} {plan.price.toLocaleString()}
                      </td>
                      <td>
                        <span className={`pill ${plan.status === "active" ? "" : "pill-muted"}`}>{plan.status}</span>
                      </td>
                      <td className="admin-grid-actions">
                        <button
                          className="btn ghost small"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEdit(plan);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost small"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(plan);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="admin-card admin-listing-detail">
          {!selectedPlan ? (
            <p className="admin-empty">Select a plan to inspect it.</p>
          ) : (
            <>
              <div className="admin-card-header compact">
                <h3>{selectedPlan.name}</h3>
                <span className={`pill ${selectedPlan.status === "active" ? "" : "pill-muted"}`}>{selectedPlan.status}</span>
              </div>

              <div className="admin-detail-grid">
                <div>
                  <span className="label">Farmers see</span>
                  <strong>{priceLine(selectedPlan)}</strong>
                </div>
                <div>
                  <span className="label">Billing period</span>
                  <strong>{periodLabel(selectedPlan.billing_period)}</strong>
                </div>
                <div>
                  <span className="label">Code</span>
                  <strong>{selectedPlan.code}</strong>
                </div>
                <div>
                  <span className="label">Updated</span>
                  <strong>{selectedPlan.updated_at ? new Date(selectedPlan.updated_at).toLocaleDateString() : "--"}</strong>
                </div>
              </div>

              <div className="admin-detail-block">
                <div className="label">Summary</div>
                <p>{selectedPlan.summary || "No summary — farmers will see a blank card."}</p>
              </div>

              <div className="admin-detail-block">
                <div className="label">Notes</div>
                <div className="admin-chip-row">
                  {!selectedPlan.summary && <span className="admin-filter-chip">Summary missing</span>}
                  {selectedPlan.status !== "active" && <span className="admin-filter-chip">Not sellable</span>}
                  {NEEDS_DURATION.has(selectedPlan.billing_period) && !selectedPlan.duration_days && (
                    <span className="admin-filter-chip">Duration missing</span>
                  )}
                  <span className="admin-filter-chip">The code is fixed once live</span>
                </div>
              </div>
            </>
          )}
        </aside>
      </section>
    </section>
  );
}

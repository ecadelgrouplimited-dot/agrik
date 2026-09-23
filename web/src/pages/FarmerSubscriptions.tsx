import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { api, type ApiError } from "../lib/api";
import { Icon } from "../components/Visuals";

type Subscription = {
  id?: number;
  plan: string;
  plan_name?: string | null;
  billing_period?: string | null;
  status: string;
  starts_at?: string;
  ends_at?: string | null;
  provider?: string | null;
};

type Plan = {
  id: number;
  code: string;
  name: string;
  summary?: string | null;
  price: number;
  currency: string;
  billing_period: string;
  duration_days?: number | null;
};

const periodLabel: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  seasonal: "Seasonal",
  one_off: "One-off",
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "UGX", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency || "UGX"} ${value.toLocaleString()}`;
  }
}

function priceLine(plan: Plan) {
  const amount = formatMoney(plan.price, plan.currency);
  switch (plan.billing_period) {
    case "monthly":
      return `${amount} / month`;
    case "quarterly":
      return `${amount} / quarter`;
    case "annual":
      return `${amount} / year`;
    case "seasonal":
      return plan.duration_days ? `${amount} / season · ${plan.duration_days} days` : `${amount} / season`;
    case "one_off":
      return plan.duration_days ? `${amount} once · ${plan.duration_days} days access` : `${amount} once`;
    default:
      return amount;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "--" : new Date(ms).toLocaleDateString();
}

export default function FarmerSubscriptions() {
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.allSettled([api.subscription(), api.subscriptionHistory(50), api.servicePlans()])
      .then(([currentRes, historyRes, plansRes]) => {
        setCurrent(currentRes.status === "fulfilled" ? (currentRes.value as Subscription) : null);
        setHistory(historyRes.status === "fulfilled" ? (historyRes.value as Subscription[]) : []);
        setPlans(plansRes.status === "fulfilled" ? plansRes.value.items : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const subscribe = async (plan: Plan) => {
    setSavingPlan(plan.code);
    setMessage(null);
    setError(null);
    try {
      await api.startSubscription({ plan: plan.code, status: "trial", provider: "platform" });
      setMessage(`${plan.name} is now active on this account.`);
      loadAll();
    } catch (err) {
      setError((err as ApiError | undefined)?.detail || "Unable to start this plan.");
    } finally {
      setSavingPlan(null);
    }
  };

  // A plan the account held before the catalog existed has no matching row, so name it
  // from whatever the subscription itself recorded rather than showing a bare code.
  const currentName = current?.plan_name || current?.plan;
  const currentIsInCatalog = useMemo(
    () => (current ? plans.some((plan) => plan.code === current.plan) : true),
    [current, plans]
  );

  if (loading) return <section className="farmer-page">Loading plans...</section>;

  return (
    <section className="farmer-page fw">
      <div className="fw-bar">
        <span className="fw-farm-label">Plan</span>
        <strong className="fw-plan-current">{currentName ?? "None active"}</strong>
        {current ? (
          <span className="fw-farm-meta">
            {current.status}
            {current.ends_at ? ` · renews ${formatDate(current.ends_at)}` : ""}
          </span>
        ) : (
          <span className="fw-farm-meta">Choose a plan to activate advisory, alerts, or market support.</span>
        )}
        <div className="fw-actions">
          <button className="btn ghost small" type="button" onClick={loadAll}>
            Refresh
          </button>
          <NavLink to="/dashboard/services" className="btn small">
            <Icon name="services" size={13} />
            Services
          </NavLink>
        </div>
      </div>

      {(message || error) && <p className={`status ${error ? "error" : ""}`}>{error ?? message}</p>}

      {current && !currentIsInCatalog ? (
        <p className="status">
          Your plan &ldquo;{currentName}&rdquo; predates the current catalog. Pick a plan below to move across; nothing
          changes until you do.
        </p>
      ) : null}

      {plans.length === 0 ? (
        <section className="fw-panel">
          <p className="muted">No plans are available yet.</p>
        </section>
      ) : (
        <div className="fw-plan-grid">
          {plans.map((plan) => {
            const isCurrent = current?.plan === plan.code;
            return (
              <section key={plan.id} className={`fw-plan-card${isCurrent ? " current" : ""}`}>
                <div className="fw-plan-head">
                  <h3>{plan.name}</h3>
                  <span className="fw-plan-period">{periodLabel[plan.billing_period] ?? plan.billing_period}</span>
                </div>
                <div className="fw-plan-price">{priceLine(plan)}</div>
                <p className="fw-plan-summary">{plan.summary || "No description provided for this plan yet."}</p>
                <button
                  className={`btn${isCurrent ? " ghost" : ""} small`}
                  type="button"
                  disabled={Boolean(savingPlan) || isCurrent}
                  onClick={() => subscribe(plan)}
                >
                  {isCurrent ? "Current plan" : savingPlan === plan.code ? "Starting..." : "Choose plan"}
                </button>
              </section>
            );
          })}
        </div>
      )}

      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>
            Billing history <span className="fw-count">{history.length}</span>
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="muted">No plan events recorded yet.</p>
        ) : (
          <ul className="fw-todo">
            {history.map((item, index) => (
              <li key={item.id ?? `${item.plan}-${index}`} className="fw-todo-item">
                <span className="fw-dot" aria-hidden="true" />
                <div>
                  <strong>{item.plan_name || item.plan}</strong>
                  <p>
                    {formatDate(item.starts_at)}
                    {item.ends_at ? ` to ${formatDate(item.ends_at)}` : ""}
                  </p>
                </div>
                <span className="fw-todo-action">{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

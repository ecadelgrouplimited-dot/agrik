import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../lib/api";
import { Icon } from "../components/Visuals";

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

type Subscription = {
  plan: string;
  plan_name?: string | null;
  billing_period?: string | null;
  status: string;
  ends_at?: string | null;
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "UGX", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency || "UGX"} ${value.toLocaleString()}`;
  }
}

/** The price and its term read as one line, so "how much" and "how long" are never separated. */
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

const periodLabel: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  seasonal: "Seasonal",
  one_off: "One-off",
};

export default function FarmerServices() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.allSettled([api.servicePlans(), api.subscription()])
      .then(([plansRes, subscriptionRes]) => {
        if (plansRes.status === "fulfilled") {
          setPlans(plansRes.value.items);
        } else {
          setPlans([]);
          setError("Unable to load the plan catalog.");
        }
        // A missing subscription is the normal state for a new account, not an error.
        setSubscription(subscriptionRes.status === "fulfilled" ? (subscriptionRes.value as Subscription) : null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const subscribe = async (plan: Plan) => {
    setSavingPlan(plan.code);
    setMessage(null);
    setError(null);
    try {
      // The API derives the term from the plan's billing period; the client does not set it.
      await api.startSubscription({ plan: plan.code, status: "trial", provider: "platform" });
      setMessage(`${plan.name} is now active on this account.`);
      loadAll();
    } catch (err) {
      setError((err as { detail?: string })?.detail || "Unable to start this plan.");
    } finally {
      setSavingPlan(null);
    }
  };

  const visiblePlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plans;
    return plans.filter((plan) => plan.name.toLowerCase().includes(query) || (plan.summary || "").toLowerCase().includes(query));
  }, [plans, search]);

  if (loading) return <section className="farmer-page">Loading plans...</section>;

  const currentName = subscription?.plan_name ?? subscription?.plan;

  return (
    <section className="farmer-page fw">
      {/* One bar: what you are on now, and the two things you might do about it. */}
      <div className="fw-bar">
        <span className="fw-farm-label">Plan</span>
        <strong className="fw-plan-current">{currentName ?? "None active"}</strong>
        {subscription ? (
          <span className="fw-farm-meta">
            {subscription.status}
            {subscription.ends_at ? ` · renews ${new Date(subscription.ends_at).toLocaleDateString()}` : ""}
          </span>
        ) : (
          <span className="fw-farm-meta">Pick a plan below to activate advisory, alerts, or market support.</span>
        )}
        <div className="fw-actions">
          <input
            className="fw-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search plans"
            aria-label="Search plans"
          />
          <button className="btn ghost small" type="button" onClick={loadAll}>
            Refresh
          </button>
          <NavLink to="/dashboard/subscriptions" className="btn small">
            <Icon name="subscriptions" size={13} />
            Billing
          </NavLink>
        </div>
      </div>

      {(message || error) && <p className={`status ${error ? "error" : ""}`}>{error ?? message}</p>}

      {visiblePlans.length === 0 ? (
        <section className="fw-panel">
          <p className="muted">
            {plans.length === 0 ? "No plans are available yet." : "No plan matches that search."}
          </p>
        </section>
      ) : (
        <div className="fw-plan-grid">
          {visiblePlans.map((plan) => {
            const isCurrent = subscription?.plan === plan.code;
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
    </section>
  );
}

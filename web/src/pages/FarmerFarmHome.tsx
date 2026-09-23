import { NavLink, useOutletContext } from "react-router-dom";
import { Icon } from "../components/Visuals";
import {
  farmRiskAverage,
  formatDecimal,
  formatMoney,
  inferProjectedRevenue,
  type FarmerFarmWorkspaceContext,
} from "./FarmerFarm";

export default function FarmerFarmHome() {
  const {
    farms,
    activeFarm,
    activeFarmId,
    uniqueCropCount,
    farmsWithWaterAccess,
    insuredFarms,
    totalAreaAcres,
    totalProjectedRevenue,
    totalPlannedCost,
    portfolioMargin,
    primaryCurrency,
    activeFarmReadinessItems,
    activeFarmReadinessScore,
    activeFarmInsights,
    setActiveFarmId,
    removeFarm,
    markPrimaryFarm,
  } = useOutletContext<FarmerFarmWorkspaceContext>();

  // Only surface figures that actually have a value. A wall of "--" tells the farmer nothing
  // and buries the two or three numbers that are real.
  const stats: { label: string; value: string }[] = [
    { label: "Farms", value: String(farms.length) },
    { label: "Crops", value: String(uniqueCropCount) },
  ];
  if (activeFarm) stats.push({ label: "Readiness", value: `${activeFarmReadinessScore}/5` });
  if (totalAreaAcres > 0) stats.push({ label: "Total acres", value: formatDecimal(totalAreaAcres) });
  if (farmsWithWaterAccess > 0) stats.push({ label: "With water", value: String(farmsWithWaterAccess) });
  if (insuredFarms > 0) stats.push({ label: "Insured", value: String(insuredFarms) });
  if (totalProjectedRevenue > 0) stats.push({ label: "Expected revenue", value: formatMoney(totalProjectedRevenue, primaryCurrency) });
  if (totalPlannedCost > 0) stats.push({ label: "Planned cost", value: formatMoney(totalPlannedCost, primaryCurrency) });
  if (portfolioMargin !== 0) stats.push({ label: "Margin", value: formatMoney(portfolioMargin, primaryCurrency) });

  const pendingReadiness = activeFarmReadinessItems.filter((item) => !item.ready);
  const insights = activeFarmInsights.slice(0, 4);

  return (
    <>
      {activeFarm && insights.length > 0 ? (
        <section className="fw-panel">
          <div className="fw-panel-head">
            <h2>Needs your attention</h2>
            <NavLink to="/dashboard/farm/manage" className="fw-panel-link">
              Edit farm
            </NavLink>
          </div>
          <ul className="fw-todo">
            {insights.map((insight) => (
              <li key={insight.id} className={`fw-todo-item ${insight.level}`}>
                <span className={`fw-dot ${insight.level}`} aria-hidden="true" />
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                </div>
                <span className="fw-todo-action">{insight.action}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>Snapshot</h2>
          {pendingReadiness.length > 0 ? (
            <span className="fw-panel-note">
              {pendingReadiness.length} setup step{pendingReadiness.length === 1 ? "" : "s"} left
            </span>
          ) : (
            <span className="fw-panel-note done">Setup complete</span>
          )}
        </div>

        <div className="fw-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="fw-stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>

        {activeFarm && activeFarmReadinessItems.length > 0 ? (
          <div className="fw-readiness">
            {activeFarmReadinessItems.map((item) => (
              <span key={item.label} className={`fw-ready-pill${item.ready ? " done" : ""}`}>
                {item.ready ? <Icon name="check-circle" size={12} /> : null}
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>
            Your farms <span className="fw-count">{farms.length}</span>
          </h2>
          <NavLink to="/dashboard/farm/create" className="fw-panel-link">
            Add farm
          </NavLink>
        </div>

        <div className="fw-farm-list">
          {farms.map((farm) => {
            const revenue = inferProjectedRevenue(farm);
            return (
              <div key={farm.id} className={`fw-farm-row${farm.id === activeFarmId ? " active" : ""}`}>
                <button className="fw-farm-pick" type="button" onClick={() => setActiveFarmId(farm.id)}>
                  <span className="fw-farm-name">
                    {farm.name || "Unnamed farm"}
                    {farm.isPrimary ? <span className="fw-badge">primary</span> : null}
                  </span>
                  <span className="fw-farm-sub">
                    {[farm.parish, farm.district].filter(Boolean).join(", ") || "Location not set"} · {farm.crops.length} crop
                    {farm.crops.length === 1 ? "" : "s"}
                    {revenue > 0 ? ` · ${formatMoney(revenue, farm.finance.currency || "UGX")}` : ""}
                    {farmRiskAverage(farm) != null ? ` · risk ${formatDecimal(farmRiskAverage(farm))}/5` : ""}
                  </span>
                </button>
                <div className="fw-farm-row-actions">
                  {!farm.isPrimary ? (
                    <button
                      className="fw-icon-btn"
                      type="button"
                      onClick={() => markPrimaryFarm(farm.id)}
                      title="Set as primary farm"
                      aria-label={`Set ${farm.name || "farm"} as primary`}
                    >
                      <Icon name="shield" size={13} />
                    </button>
                  ) : null}
                  <button
                    className="fw-icon-btn danger"
                    type="button"
                    onClick={() => removeFarm(farm.id)}
                    disabled={farms.length <= 1}
                    title={farms.length <= 1 ? "You need at least one farm" : "Remove farm"}
                    aria-label={`Remove ${farm.name || "farm"}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

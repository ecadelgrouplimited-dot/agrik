import { Icon } from "../components/Visuals";
import { formatMoney, useMarketWorkspace } from "./FarmerMarketHub";

export default function FarmerMarketOverview() {
  const {
    myListings,
    discoverListings,
    predictions,
    serviceFeed,
    profileDistrict,
    profileCrops,
    mediaReadyListings,
    openMyListings,
    publishChecklist,
    publishReadyCount,
    leadPrediction,
  } = useMarketWorkspace();

  return (
    <>
      <section className="farmer-card farmer-command-hero">
        <div className="farmer-command-hero-copy">
          <div className="label">Market posture</div>
          <h3>{openMyListings > 0 ? `${openMyListings} listing(s) live` : "No live listings yet"}</h3>
          <div className="farmer-chip-row">
            <span className="chip">District: {profileDistrict || "Not set"}</span>
            <span className="chip">Crops: {profileCrops.length}</span>
            <span className="chip">Evidence-ready: {mediaReadyListings}</span>
          </div>
        </div>
        <div className="farmer-command-hero-side">
          <article className="farmer-command-mini-card">
            <span className="label">My listings</span>
            <strong>{myListings.length}</strong>
          </article>
          <article className="farmer-command-mini-card">
            <span className="label">Open market</span>
            <strong>{discoverListings.length}</strong>
          </article>
        </div>
      </section>

      <div className="farmer-kpi-grid">
        <div className="farmer-kpi-card">
          <div className="farmer-kpi-head">
            <span className="kpi-icon">
              <Icon name="listings" size={16} />
            </span>
            <div className="farmer-kpi-label">Open listings</div>
          </div>
          <div className="farmer-kpi-value">{openMyListings}</div>
        </div>
        <div className="farmer-kpi-card">
          <div className="farmer-kpi-head">
            <span className="kpi-icon">
              <Icon name="upload" size={16} />
            </span>
            <div className="farmer-kpi-label">Publish readiness</div>
          </div>
          <div className="farmer-kpi-value">{publishReadyCount}/5</div>
        </div>
        <div className="farmer-kpi-card">
          <div className="farmer-kpi-head">
            <span className="kpi-icon">
              <Icon name="prices" size={16} />
            </span>
            <div className="farmer-kpi-label">Price signals</div>
          </div>
          <div className="farmer-kpi-value">{predictions.length}</div>
        </div>
        <div className="farmer-kpi-card">
          <div className="farmer-kpi-head">
            <span className="kpi-icon">
              <Icon name="services" size={16} />
            </span>
            <div className="farmer-kpi-label">Providers</div>
          </div>
          <div className="farmer-kpi-value">{serviceFeed.length}</div>
        </div>
      </div>

      <section className="farmer-card">
        <div className="farmer-card-header">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="overview" size={18} />
            </span>
            <h3>Listing quality</h3>
          </div>
        </div>
        <div className="farmer-dashboard-grid market-publish-grid">
          <div className="farmer-side-summary">
            {publishChecklist.map((item) => (
              <div key={item.label} className="farmer-side-summary-item">
                <span>{item.label}</span>
                <strong>{item.ready ? "Ready" : "Pending"}</strong>
              </div>
            ))}
          </div>
          <div className="market-phase-note">
            <strong>Market signal</strong>
            <p>{leadPrediction ? `${leadPrediction.crop} is trending ${leadPrediction.direction} with ${Math.round((leadPrediction.confidence ?? 0) * 100)}% confidence.` : "No lead price signal is available yet."}</p>
          </div>
        </div>
      </section>

      {predictions.length > 0 ? (
        <section className="farmer-card">
          <div className="farmer-card-header">
            <div className="section-title-with-icon">
              <span className="section-icon">
                <Icon name="prices" size={18} />
              </span>
              <h3>Price pulse</h3>
            </div>
          </div>
          <div className="market-pulse-grid">
            {predictions.slice(0, 6).map((item, index) => (
              <article key={`${item.crop}-${item.district}-${index}`} className="market-pulse-card">
                <div className="market-pulse-top">
                  <strong>{item.crop}</strong>
                  <span className={`pill ${item.direction === "down" ? "pill-muted" : ""}`}>{item.direction}</span>
                </div>
                <div className="market-pulse-value">
                  {item.predictedPrice != null ? formatMoney(item.predictedPrice, item.currency || "UGX") : "--"}
                </div>
                <div className="farmer-inline-meta">{item.district || "District n/a"}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

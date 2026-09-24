import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type District = {
  district: string;
  farms_with_crops: number;
  farms_total: number;
  farms_with_dates: number;
  crops: { crop: string; farms: number }[];
  next_planting: string | null;
  planting_in_window: number;
};

const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 120, label: "120 days" },
];

function formatDate(value: string | null) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString();
}

export default function SupplierPlanting() {
  const [windowDays, setWindowDays] = useState(60);
  const [districts, setDistricts] = useState<District[]>([]);
  const [coverage, setCoverage] = useState<{ farms_total: number; farms_with_crops: number; farms_with_dates: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .plantingDemand(windowDays)
      .then((res) => {
        setDistricts(res.districts);
        setCoverage(res.coverage);
      })
      .catch(() => setError("Unable to load planting demand."))
      .finally(() => setLoading(false));
  }, [windowDays]);

  /** What to stock overall, before a supplier drills into one district. */
  const topCrops = useMemo(() => {
    const totals = new Map<string, number>();
    districts.forEach((d) => d.crops.forEach((c) => totals.set(c.crop, (totals.get(c.crop) ?? 0) + c.farms)));
    return [...totals.entries()]
      .map(([crop, farms]) => ({ crop, farms }))
      .sort((a, b) => b.farms - a.farms)
      .slice(0, 6);
  }, [districts]);

  const dateCoverage = coverage && coverage.farms_with_crops > 0
    ? Math.round((coverage.farms_with_dates / coverage.farms_with_crops) * 100)
    : 0;

  if (loading) return <section className="farmer-card">Loading planting demand...</section>;
  if (error) return <section className="farmer-card status error">{error}</section>;

  return (
    <section className="farmer-page fw">
      <div className="fw-bar">
        <span className="fw-farm-label">Planting window</span>
        <nav className="fw-tabs" aria-label="Planting window">
          {WINDOWS.map((option) => (
            <button
              key={option.days}
              type="button"
              className={`fw-tab${windowDays === option.days ? " active" : ""}`}
              onClick={() => setWindowDays(option.days)}
            >
              {option.label}
            </button>
          ))}
        </nav>
        {coverage ? (
          <span className="fw-farm-meta">
            {coverage.farms_with_crops} of {coverage.farms_total} farms have a crop profile
          </span>
        ) : null}
      </div>

      {/* Stated plainly, because a crop ranking drawn from three farms looks exactly like
          one drawn from forty unless the page says which it is. */}
      <p className="status">
        This is what farmers recorded about their own farms, not a forecast.{" "}
        {dateCoverage === 0
          ? "No farm in this set has recorded a planting date yet, so the crop mix below is the reliable part and the timing is not."
          : `Only ${dateCoverage}% of them recorded a planting date, so treat the timing as a sample.`}
      </p>

      {districts.length === 0 ? (
        <section className="fw-panel">
          <p className="muted">No farmer has recorded a crop profile yet.</p>
        </section>
      ) : (
        <>
          <section className="fw-panel">
            <div className="fw-panel-head">
              <h2>What to stock</h2>
              <span className="fw-panel-note">Across every district</span>
            </div>
            <div className="fw-stats">
              {topCrops.map((crop) => (
                <div key={crop.crop} className="fw-stat">
                  <span style={{ textTransform: "capitalize" }}>{crop.crop}</span>
                  <strong>
                    {crop.farms} farm{crop.farms === 1 ? "" : "s"}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section className="fw-panel">
            <div className="fw-panel-head">
              <h2>
                By district <span className="fw-count">{districts.length}</span>
              </h2>
            </div>
            <div className="plant-list">
              {districts.map((row) => {
                const next = formatDate(row.next_planting);
                return (
                  <article key={row.district} className="plant-row">
                    <div className="plant-row-head">
                      <strong>{row.district}</strong>
                      <span>
                        {row.farms_with_crops} of {row.farms_total} farm{row.farms_total === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="plant-crops">
                      {row.crops.map((crop) => (
                        <span key={crop.crop} className="plant-crop">
                          {crop.crop}
                          <b>{crop.farms}</b>
                        </span>
                      ))}
                    </div>
                    <div className="plant-row-foot">
                      {row.planting_in_window > 0 ? (
                        <span className="price-tag ok">
                          {row.planting_in_window} planting in the next {windowDays} days
                        </span>
                      ) : (
                        <span className="price-tag">No planting dates recorded</span>
                      )}
                      {next ? <span className="price-tag">Next recorded planting {next}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

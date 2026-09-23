import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Icon } from "../components/Visuals";
import { useMarketWorkspace } from "./FarmerMarketHub";

type Price = {
  id: number;
  crop: string;
  market?: string | null;
  district?: string | null;
  price: number;
  currency: string;
  source?: string | null;
  captured_at: string;
};

type CropRow = {
  crop: string;
  /** The nearest quote: the farmer's own district when there is one, else the best covered. */
  local: Price | null;
  best: Price;
  spread: number;
  quotes: Price[];
  verified: boolean;
};

const STALE_DAYS = 14;

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "UGX", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency || "UGX"} ${Math.round(value).toLocaleString()}`;
  }
}

function daysSince(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 86400000);
}

function ageLabel(iso: string) {
  const days = daysSince(iso);
  if (days == null) return "date unknown";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function FarmerMarketPrices() {
  const { profileDistrict, profileCrops, cropOptions } = useMarketWorkspace();
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cropFilter, setCropFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [onlyMyCrops, setOnlyMyCrops] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .marketPrices("?limit=500")
      .then((res) => setPrices(res.items))
      .catch(() => setError("Unable to load market prices."))
      .finally(() => setLoading(false));
  }, []);

  const districts = useMemo(
    () => Array.from(new Set(prices.map((p) => p.district).filter(Boolean) as string[])).sort(),
    [prices]
  );

  // One row per crop, because a farmer asks "what is maize worth", not "list every quote".
  const rows = useMemo<CropRow[]>(() => {
    const byCrop = new Map<string, Price[]>();
    prices.forEach((price) => {
      if (districtFilter && price.district !== districtFilter) return;
      const list = byCrop.get(price.crop) ?? [];
      list.push(price);
      byCrop.set(price.crop, list);
    });

    const myCrops = new Set(profileCrops.map((crop) => crop.toLowerCase()));
    return Array.from(byCrop.entries())
      .filter(([crop]) => {
        if (cropFilter && crop !== cropFilter) return false;
        if (onlyMyCrops && myCrops.size > 0 && !myCrops.has(crop.toLowerCase())) return false;
        return true;
      })
      .map(([crop, quotes]) => {
        const sorted = [...quotes].sort((a, b) => b.price - a.price);
        const local = sorted.find((q) => q.district && q.district.toLowerCase() === profileDistrict.toLowerCase()) ?? null;
        const best = sorted[0];
        const low = sorted[sorted.length - 1];
        return {
          crop,
          local,
          best,
          spread: best.price - low.price,
          quotes: sorted,
          verified: quotes.some((q) => q.source && q.source !== "placeholder"),
        };
      })
      .sort((a, b) => a.crop.localeCompare(b.crop));
  }, [cropFilter, districtFilter, onlyMyCrops, prices, profileCrops, profileDistrict]);

  const unverifiedCount = useMemo(() => rows.filter((row) => !row.verified).length, [rows]);
  const myCropsAvailable = profileCrops.length > 0;

  if (loading) return <section className="farmer-card">Loading market prices...</section>;
  if (error) return <section className="farmer-card status error">{error}</section>;

  return (
    <>
      <div className="fw-bar">
        <label className="fw-farm">
          <span className="fw-farm-label">Crop</span>
          <select value={cropFilter} onChange={(event) => setCropFilter(event.target.value)} aria-label="Filter by crop">
            <option value="">All crops</option>
            {cropOptions.map((crop) => (
              <option key={crop} value={crop}>
                {crop}
              </option>
            ))}
          </select>
        </label>
        <label className="fw-farm">
          <span className="fw-farm-label">Where</span>
          <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} aria-label="Filter by district">
            <option value="">All districts</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </label>
        {myCropsAvailable ? (
          <button
            type="button"
            className={`fw-tab${onlyMyCrops ? " active" : ""}`}
            onClick={() => setOnlyMyCrops((value) => !value)}
          >
            {onlyMyCrops ? "My crops" : "Every crop"}
          </button>
        ) : null}
      </div>

      {unverifiedCount > 0 ? (
        <p className="status">
          {unverifiedCount === rows.length ? "These prices are" : `${unverifiedCount} of these crops are`} indicative
          starting figures, not surveyed rates. Confirm with your buyer before you agree a price.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <section className="fw-panel">
          <p className="muted">
            {onlyMyCrops && myCropsAvailable
              ? "No prices yet for the crops on your farm. Switch to Every crop to see the whole board."
              : "No prices published for this filter yet."}
          </p>
        </section>
      ) : (
        <div className="price-board">
          {rows.map((row) => {
            const headline = row.local ?? row.best;
            const isOpen = expanded === row.crop;
            const stale = (daysSince(headline.captured_at) ?? 0) > STALE_DAYS;
            return (
              <section key={row.crop} className="price-card">
                <div className="price-card-head">
                  <div>
                    <h3>{row.crop}</h3>
                    <span className="price-card-where">
                      {headline.district || "Unknown district"}
                      {row.local ? " · your district" : " · best covered"}
                    </span>
                  </div>
                  <div className="price-card-amount">
                    <strong>{formatMoney(headline.price, headline.currency)}</strong>
                    <span>per kg</span>
                  </div>
                </div>

                <div className="price-card-tags">
                  <span className={`price-tag${row.verified ? " ok" : ""}`}>
                    <Icon name={row.verified ? "check-circle" : "alerts"} size={11} />
                    {row.verified ? "Surveyed" : "Indicative"}
                  </span>
                  <span className={`price-tag${stale ? " warn" : ""}`}>{ageLabel(headline.captured_at)}</span>
                  {row.spread > 0 ? (
                    <span className="price-tag">
                      {formatMoney(row.spread, headline.currency)} between best and worst district
                    </span>
                  ) : null}
                </div>

                {/* The line that changes a decision: where the crop is worth more than it is
                    here, or that here is already the best on the board. */}
                {row.local && row.best.price > row.local.price ? (
                  <p className="price-card-lead">
                    {row.best.district} is paying {formatMoney(row.best.price - row.local.price, headline.currency)} more
                    per kg than {row.local.district}.
                  </p>
                ) : row.local && row.quotes.length > 1 ? (
                  <p className="price-card-lead">
                    {row.local.district} is the best-paying district on this board.
                  </p>
                ) : null}

                <button
                  className="fw-panel-link"
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.crop)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? "Hide districts" : `Compare ${row.quotes.length} district${row.quotes.length === 1 ? "" : "s"}`}
                </button>

                {isOpen ? (
                  <ul className="price-quote-list">
                    {row.quotes.map((quote) => (
                      <li key={quote.id} className={quote.district === profileDistrict ? "here" : ""}>
                        <span>{quote.district || "--"}</span>
                        <strong>{formatMoney(quote.price, quote.currency)}</strong>
                        <span className="price-quote-age">{ageLabel(quote.captured_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

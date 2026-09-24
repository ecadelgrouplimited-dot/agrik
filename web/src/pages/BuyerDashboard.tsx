import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "../components/Visuals";
import { api } from "../lib/api";
import { useAuth } from "../state/auth";

type Listing = {
  id: number;
  crop: string;
  quantity?: number | null;
  unit?: string | null;
  price?: number | null;
  currency?: string | null;
  grade?: string | null;
  status: string;
  district: string;
  contactPhone?: string | null;
  contactName?: string | null;
  hasMedia: boolean;
  createdAt: string;
};

type Offer = { id: number; listingId: number; status: string; createdAt: string };

type Price = { crop: string; district?: string | null; price: number; currency: string; source?: string | null };

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeListing(raw: unknown): Listing | null {
  const row = asRecord(raw);
  const id = num(row.id);
  if (id == null) return null;
  const location = asRecord(row.location);
  const media = Array.isArray(row.media_urls) ? row.media_urls : [];
  return {
    id,
    crop: str(row.crop) || "unknown",
    quantity: num(row.quantity),
    unit: str(row.unit) || null,
    price: num(row.price),
    currency: str(row.currency) || "UGX",
    grade: str(row.grade) || null,
    status: str(row.status) || "open",
    district: str(location.district) || str(row.district),
    contactPhone: str(row.contact_phone) || null,
    contactName: str(row.contact_name) || null,
    hasMedia: media.length > 0,
    createdAt: str(row.created_at),
  };
}

function normalizeOffer(raw: unknown): Offer | null {
  const row = asRecord(raw);
  const id = num(row.id);
  const listingId = num(row.listing_id);
  if (id == null || listingId == null) return null;
  return { id, listingId, status: str(row.status) || "pending", createdAt: str(row.created_at) };
}

function money(value?: number | null, currency?: string | null) {
  if (value == null) return "Price on request";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "UGX", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency || "UGX"} ${value.toLocaleString()}`;
  }
}

function ageLabel(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function BuyerDashboard() {
  const { user } = useAuth();
  const isOfftaker = user?.role === "offtaker";

  const [supply, setSupply] = useState<Listing[]>([]);
  const [myDemand, setMyDemand] = useState<Listing[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [cropFilter, setCropFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [withMediaOnly, setWithMediaOnly] = useState(false);

  useEffect(() => {
    if (!user?.phone) return;
    setLoading(true);
    Promise.allSettled([
      api.marketListings("?status=open&role=seller&limit=120"),
      api.marketListings(`?phone=${encodeURIComponent(user.phone)}&role=buyer&limit=40`),
      api.marketOffers(`?phone=${encodeURIComponent(user.phone)}&limit=120`),
      api.marketPrices("?limit=300"),
    ])
      .then(([supplyRes, demandRes, offerRes, priceRes]) => {
        const listOf = (res: PromiseSettledResult<{ items: unknown[] }>) =>
          res.status === "fulfilled" ? (res.value.items ?? []) : [];
        setSupply(listOf(supplyRes).map(normalizeListing).filter((x): x is Listing => x !== null));
        setMyDemand(listOf(demandRes).map(normalizeListing).filter((x): x is Listing => x !== null));
        setOffers(listOf(offerRes).map(normalizeOffer).filter((x): x is Offer => x !== null));
        setPrices(priceRes.status === "fulfilled" ? (priceRes.value.items as Price[]) : []);
      })
      .finally(() => setLoading(false));
  }, [user?.phone]);

  // The crops this account already works in: what they have asked for, or offered on.
  const myCrops = useMemo(() => {
    const fromDemand = myDemand.map((l) => l.crop.toLowerCase());
    const offeredIds = new Set(offers.map((o) => o.listingId));
    const fromOffers = supply.filter((l) => offeredIds.has(l.id)).map((l) => l.crop.toLowerCase());
    return new Set([...fromDemand, ...fromOffers]);
  }, [myDemand, offers, supply]);

  const crops = useMemo(() => Array.from(new Set(supply.map((l) => l.crop))).sort(), [supply]);
  const districts = useMemo(() => Array.from(new Set(supply.map((l) => l.district).filter(Boolean))).sort(), [supply]);

  const matches = useMemo(() => {
    const offeredIds = new Set(offers.map((o) => o.listingId));
    return supply
      .filter((l) => {
        if (cropFilter && l.crop !== cropFilter) return false;
        if (districtFilter && l.district !== districtFilter) return false;
        if (withMediaOnly && !l.hasMedia) return false;
        return true;
      })
      .map((l) => ({ ...l, alreadyOffered: offeredIds.has(l.id), matchesMyCrops: myCrops.has(l.crop.toLowerCase()) }))
      // Lots in crops this buyer actually trades come first; then evidence; then newest.
      .sort((a, b) => {
        if (a.matchesMyCrops !== b.matchesMyCrops) return a.matchesMyCrops ? -1 : 1;
        if (a.hasMedia !== b.hasMedia) return a.hasMedia ? -1 : 1;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [cropFilter, districtFilter, myCrops, offers, supply, withMediaOnly]);

  /** Cheapest quote per crop — a buyer reads the price board from the other side. */
  const cheapest = useMemo(() => {
    const best = new Map<string, Price>();
    prices.forEach((p) => {
      const current = best.get(p.crop);
      if (!current || p.price < current.price) best.set(p.crop, p);
    });
    const relevant = [...best.values()].filter((p) => myCrops.size === 0 || myCrops.has(p.crop.toLowerCase()));
    return relevant.sort((a, b) => a.crop.localeCompare(b.crop)).slice(0, 6);
  }, [myCrops, prices]);

  const unanswered = useMemo(() => {
    const byListing = new Set(offers.map((o) => o.listingId));
    return myDemand.filter((d) => !byListing.has(d.id)).length;
  }, [myDemand, offers]);

  if (loading) return <section className="farmer-page">Loading supply...</section>;

  return (
    <section className="farmer-page fw">
      <div className="fw-bar">
        <label className="fw-farm">
          <span className="fw-farm-label">Crop</span>
          <select value={cropFilter} onChange={(event) => setCropFilter(event.target.value)} aria-label="Filter by crop">
            <option value="">All crops</option>
            {crops.map((crop) => (
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
        <button
          type="button"
          className={`fw-tab${withMediaOnly ? " active" : ""}`}
          onClick={() => setWithMediaOnly((value) => !value)}
          title="A lot with photos can be judged before you travel"
        >
          With photos
        </button>
        <div className="fw-actions">
          <NavLink className="btn small" to="/buyer/market">
            <Icon name="market" size={13} />
            Full marketplace
          </NavLink>
        </div>
      </div>

      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>
            Available to buy <span className="fw-count">{matches.length}</span>
          </h2>
          {myCrops.size > 0 ? <span className="fw-panel-note">Your crops listed first</span> : null}
        </div>

        {matches.length === 0 ? (
          <p className="muted">
            {supply.length === 0
              ? "No farmer has an open lot right now. Post what you need and sellers can answer it."
              : "No lot matches those filters."}
          </p>
        ) : (
          <div className="buy-list">
            {matches.slice(0, 12).map((lot) => (
              <article key={lot.id} className={`buy-row${lot.matchesMyCrops ? " mine" : ""}`}>
                <div className="buy-row-main">
                  <strong>
                    {lot.crop}
                    {lot.quantity ? ` · ${lot.quantity.toLocaleString()}${lot.unit ? ` ${lot.unit}` : ""}` : ""}
                  </strong>
                  <span className="buy-row-sub">
                    {lot.district || "District not set"}
                    {lot.grade ? ` · grade ${lot.grade}` : ""} · {ageLabel(lot.createdAt)}
                  </span>
                  <div className="buy-row-tags">
                    {lot.hasMedia ? (
                      <span className="price-tag ok">
                        <Icon name="camera" size={11} />
                        Photos
                      </span>
                    ) : (
                      <span className="price-tag">No photos</span>
                    )}
                    {lot.alreadyOffered ? <span className="price-tag ok">You offered</span> : null}
                  </div>
                </div>
                <div className="buy-row-end">
                  <strong>{money(lot.price, lot.currency)}</strong>
                  {lot.contactPhone ? (
                    <a className="btn ghost small" href={`tel:${lot.contactPhone}`}>
                      Call seller
                    </a>
                  ) : (
                    <NavLink className="btn ghost small" to="/buyer/market">
                      View
                    </NavLink>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="buy-split">
        <section className="fw-panel">
          <div className="fw-panel-head">
            <h2>
              What you asked for <span className="fw-count">{myDemand.length}</span>
            </h2>
            <NavLink to="/buyer/market" className="fw-panel-link">
              Post a request
            </NavLink>
          </div>
          {myDemand.length === 0 ? (
            <p className="muted">You have no open requests. Posting one lets sellers come to you.</p>
          ) : (
            <>
              {unanswered > 0 ? (
                <p className="fw-panel-note">
                  {unanswered} of your request{unanswered === 1 ? " has" : "s have"} had no offer yet.
                </p>
              ) : null}
              <ul className="fw-todo">
                {myDemand.slice(0, 5).map((demand) => {
                  const count = offers.filter((o) => o.listingId === demand.id).length;
                  return (
                    <li key={demand.id} className="fw-todo-item">
                      <span className="fw-dot" aria-hidden="true" />
                      <div>
                        <strong>{demand.crop}</strong>
                        <p>
                          {demand.district || "Anywhere"}
                          {demand.quantity ? ` · ${demand.quantity.toLocaleString()}${demand.unit ? ` ${demand.unit}` : ""}` : ""}
                        </p>
                      </div>
                      <span className="fw-todo-action">{count === 0 ? "no offers" : `${count} offer${count === 1 ? "" : "s"}`}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="fw-panel">
          <div className="fw-panel-head">
            <h2>Cheapest on the board</h2>
            <NavLink to="/buyer/market" className="fw-panel-link">
              All prices
            </NavLink>
          </div>
          {cheapest.length === 0 ? (
            <p className="muted">No market prices published yet.</p>
          ) : (
            <ul className="fw-todo">
              {cheapest.map((price) => (
                <li key={price.crop} className="fw-todo-item">
                  <span className="fw-dot" aria-hidden="true" />
                  <div>
                    <strong>{price.crop}</strong>
                    <p>{price.district || "District not set"}</p>
                  </div>
                  <span className="fw-todo-action">{money(price.price, price.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          {cheapest.some((p) => p.source === "placeholder") ? (
            <p className="fw-panel-note">Some figures are indicative, not surveyed.</p>
          ) : null}
        </section>
      </div>

      {isOfftaker ? (
        <section className="fw-panel">
          <div className="fw-panel-head">
            <h2>Sourcing so far</h2>
            <span className="fw-panel-note">Offers you have made</span>
          </div>
          <div className="fw-stats">
            <div className="fw-stat">
              <span>Offers made</span>
              <strong>{offers.length}</strong>
            </div>
            <div className="fw-stat">
              <span>Suppliers</span>
              <strong>{new Set(supply.filter((l) => offers.some((o) => o.listingId === l.id)).map((l) => l.contactPhone ?? l.id)).size}</strong>
            </div>
            <div className="fw-stat">
              <span>Districts</span>
              <strong>{new Set(supply.filter((l) => offers.some((o) => o.listingId === l.id)).map((l) => l.district).filter(Boolean)).size}</strong>
            </div>
          </div>
          <p className="fw-panel-note">
            Volume commitments are not tracked yet, so this counts activity rather than progress against a contract.
          </p>
        </section>
      ) : null}
    </section>
  );
}

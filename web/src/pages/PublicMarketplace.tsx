import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Icon } from "../components/Visuals";
import {
  MarketListingRecord,
  asRecord,
  buildTelHref,
  buildWhatsappHref,
  compactText,
  formatDate,
  formatMoney,
  listingLocationLabel,
  normalizeListing,
  toMediaUrls,
  toNumberValue,
  toStringValue,
} from "../lib/marketplace";
import { useAuth } from "../state/auth";

type PublicService = {
  id: number;
  serviceType: string;
  description: string;
  price: number | null;
  currency: string;
  district: string;
  parish: string;
  mediaUrls: string[];
  status: string;
};

type FeedView = "all" | "listings" | "services";
type SortKey = "newest" | "price_asc" | "price_desc" | "media_desc";
type RoleFilter = "all" | "seller" | "buyer";

const DENSITY_KEY = "agrik_marketplace_density";

function normalizeService(raw: unknown): PublicService | null {
  const row = asRecord(raw);
  const location = asRecord(row.location);
  const id = toNumberValue(row.id);
  if (id == null) return null;
  return {
    id,
    serviceType: toStringValue(row.service_type),
    description: toStringValue(row.description),
    price: toNumberValue(row.price),
    currency: toStringValue(row.currency) || "UGX",
    district: toStringValue(location.district),
    parish: toStringValue(location.parish),
    mediaUrls: toMediaUrls(row.media_urls),
    status: toStringValue(row.status) || "open",
  };
}

function asOptionalNumber(value: string) {
  const parsed = toNumberValue(value);
  return parsed == null ? null : parsed;
}

function joinLocation(parish: string, district: string) {
  return [parish, district].filter(Boolean).join(", ") || "Location unavailable";
}

/** Top values with counts, so the quick filters always reflect what is actually listed right now. */
function topFacets(values: string[], limit: number): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

export default function PublicMarketplace() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<MarketListingRecord[]>([]);
  const [services, setServices] = useState<PublicService[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Uploaded media can go missing; fall back to the placeholder instead of a broken image.
  const [brokenMedia, setBrokenMedia] = useState<Set<number>>(new Set());
  const [density, setDensity] = useState<"comfortable" | "compact">(() =>
    localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable"
  );

  // Filters live in the URL so a filtered marketplace view can be shared or bookmarked.
  const search = params.get("q") ?? "";
  const filterCrop = params.get("crop") ?? "";
  const filterDistrict = params.get("where") ?? "";
  const filterRole = (params.get("role") as RoleFilter) || "all";
  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";
  const mediaOnly = params.get("media") === "1";
  const sortBy = (params.get("sort") as SortKey) || "newest";
  const feedView = (params.get("view") as FeedView) || "all";

  const setParam = (key: string, value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([api.marketListings("?status=open&limit=240"), api.marketServices("?status=open&limit=120")])
      .then(([listingRes, serviceRes]) => {
        setListings(
          listingRes.status === "fulfilled"
            ? (listingRes.value.items ?? []).map(normalizeListing).filter((item): item is MarketListingRecord => item != null)
            : []
        );
        setServices(
          serviceRes.status === "fulfilled"
            ? (serviceRes.value.items ?? []).map(normalizeService).filter((item): item is PublicService => item != null)
            : []
        );
      })
      .catch(() => setError("Unable to load marketplace feed."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filteredListings = useMemo(() => {
    const min = asOptionalNumber(minPrice);
    const max = asOptionalNumber(maxPrice);
    const query = search.trim().toLowerCase();
    const output = listings
      .filter((item) => (filterRole === "all" ? true : item.role === filterRole))
      .filter((item) => (filterCrop.trim() ? item.crop.toLowerCase().includes(filterCrop.trim().toLowerCase()) : true))
      .filter((item) => {
        if (!filterDistrict.trim()) return true;
        const target = filterDistrict.trim().toLowerCase();
        return item.location.district.toLowerCase().includes(target) || item.location.parish.toLowerCase().includes(target);
      })
      .filter((item) =>
        !query
          ? true
          : [item.crop, item.grade, item.description, item.location.district, item.location.parish]
              .join(" ")
              .toLowerCase()
              .includes(query)
      )
      .filter((item) => (mediaOnly ? item.mediaUrls.length > 0 : true))
      .filter((item) => (min != null ? (item.price ?? Number.NEGATIVE_INFINITY) >= min : true))
      .filter((item) => (max != null ? (item.price ?? Number.POSITIVE_INFINITY) <= max : true));
    output.sort((a, b) => {
      if (sortBy === "price_asc") return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      if (sortBy === "price_desc") return (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY);
      if (sortBy === "media_desc") return b.mediaUrls.length - a.mediaUrls.length;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return output.slice(0, 120);
  }, [filterCrop, filterDistrict, filterRole, listings, maxPrice, mediaOnly, minPrice, search, sortBy]);

  const filteredServices = useMemo(() => {
    const min = asOptionalNumber(minPrice);
    const max = asOptionalNumber(maxPrice);
    const query = search.trim().toLowerCase();
    return services
      .filter((item) => (mediaOnly ? item.mediaUrls.length > 0 : true))
      .filter((item) => {
        if (!filterDistrict.trim()) return true;
        const target = filterDistrict.trim().toLowerCase();
        return item.district.toLowerCase().includes(target) || item.parish.toLowerCase().includes(target);
      })
      .filter((item) => (min != null ? (item.price ?? Number.NEGATIVE_INFINITY) >= min : true))
      .filter((item) => (max != null ? (item.price ?? Number.POSITIVE_INFINITY) <= max : true))
      .filter((item) =>
        !query ? true : [item.serviceType, item.description, item.district, item.parish].join(" ").toLowerCase().includes(query)
      )
      .slice(0, 80);
  }, [filterDistrict, maxPrice, mediaOnly, minPrice, search, services]);

  const cropFacets = useMemo(() => topFacets(listings.map((item) => item.crop), 8), [listings]);
  const districtFacets = useMemo(
    () => topFacets([...listings.map((item) => item.location.district), ...services.map((item) => item.district)], 8),
    [listings, services]
  );

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (search.trim()) chips.push({ key: "q", label: `"${search.trim()}"`, onClear: () => setParam("q", null) });
    if (filterCrop.trim()) chips.push({ key: "crop", label: filterCrop.trim(), onClear: () => setParam("crop", null) });
    if (filterDistrict.trim()) chips.push({ key: "where", label: filterDistrict.trim(), onClear: () => setParam("where", null) });
    if (filterRole !== "all")
      chips.push({ key: "role", label: filterRole === "buyer" ? "Buyer demand" : "Seller supply", onClear: () => setParam("role", null) });
    if (minPrice.trim()) chips.push({ key: "min", label: `Min ${minPrice.trim()}`, onClear: () => setParam("min", null) });
    if (maxPrice.trim()) chips.push({ key: "max", label: `Max ${maxPrice.trim()}`, onClear: () => setParam("max", null) });
    if (mediaOnly) chips.push({ key: "media", label: "Has media", onClear: () => setParam("media", null) });
    if (sortBy !== "newest") {
      const labels: Record<SortKey, string> = {
        newest: "Newest",
        price_asc: "Price low to high",
        price_desc: "Price high to low",
        media_desc: "Most media",
      };
      chips.push({ key: "sort", label: labels[sortBy], onClear: () => setParam("sort", null) });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterCrop, filterDistrict, filterRole, minPrice, maxPrice, mediaOnly, sortBy]);

  const totalResults = filteredListings.length + filteredServices.length;
  const mediaBackedPct = listings.length
    ? Math.round((listings.filter((item) => item.mediaUrls.length > 0).length / listings.length) * 100)
    : 0;

  function resetFilters() {
    setParams(
      (current) => {
        const next = new URLSearchParams();
        const view = current.get("view");
        if (view) next.set("view", view);
        return next;
      },
      { replace: true }
    );
  }

  const showListings = feedView !== "services";
  const showServices = feedView !== "listings";

  return (
    <section className={`mk mk-${density}`}>
      <header className="mk-bar">
        <div className="mk-bar-lead">
          <h1>Marketplace</h1>
          <p>
            {loading ? (
              "Loading live listings..."
            ) : (
              <>
                <strong>{filteredListings.length}</strong> produce · <strong>{filteredServices.length}</strong> services
                {listings.length > 0 ? <> · {mediaBackedPct}% with media</> : null}
              </>
            )}
          </p>
        </div>

        <div className="mk-search">
          <Icon name="market" size={15} />
          <input
            value={search}
            onChange={(event) => setParam("q", event.target.value || null)}
            placeholder="Search maize, transport, Gulu..."
            aria-label="Search the marketplace"
          />
          {search ? (
            <button type="button" onClick={() => setParam("q", null)} aria-label="Clear search">
              ×
            </button>
          ) : null}
        </div>

        <div className="mk-bar-actions">
          <div className="mk-segmented" role="tablist" aria-label="Marketplace view">
            {([
              ["all", "All"],
              ["listings", "Produce"],
              ["services", "Services"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={feedView === value}
                className={feedView === value ? "active" : ""}
                onClick={() => setParam("view", value === "all" ? null : value)}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            className="mk-select"
            value={sortBy}
            onChange={(event) => setParam("sort", event.target.value === "newest" ? null : event.target.value)}
            aria-label="Sort results"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="media_desc">Most media</option>
          </select>

          <button
            type="button"
            className={`mk-icon-btn${filtersOpen ? " active" : ""}`}
            onClick={() => setFiltersOpen((open) => !open)}
            title="Filters"
            aria-label="Toggle filters"
          >
            <Icon name="settings" size={15} />
            {activeChips.length > 0 ? <span className="mk-badge">{activeChips.length}</span> : null}
          </button>

          <button
            type="button"
            className="mk-icon-btn"
            onClick={() => setDensity((current) => (current === "compact" ? "comfortable" : "compact"))}
            title={density === "compact" ? "Comfortable view" : "Compact view"}
            aria-label={density === "compact" ? "Switch to comfortable view" : "Switch to compact view"}
          >
            <Icon name={density === "compact" ? "listings" : "overview"} size={15} />
          </button>
        </div>
      </header>

      {activeChips.length > 0 ? (
        <div className="mk-chipbar">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" className="mk-chip active" onClick={chip.onClear} title="Remove filter">
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="mk-link" onClick={resetFilters}>
            Clear all
          </button>
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="mk-filters">
          <div className="mk-filter-grid">
            <label className="mk-field">
              <span>Crop</span>
              <input value={filterCrop} onChange={(event) => setParam("crop", event.target.value || null)} placeholder="Beans" />
            </label>
            <label className="mk-field">
              <span>District or parish</span>
              <input value={filterDistrict} onChange={(event) => setParam("where", event.target.value || null)} placeholder="Gulu" />
            </label>
            <label className="mk-field">
              <span>Listing type</span>
              <select value={filterRole} onChange={(event) => setParam("role", event.target.value === "all" ? null : event.target.value)}>
                <option value="all">All listings</option>
                <option value="seller">Seller supply</option>
                <option value="buyer">Buyer demand</option>
              </select>
            </label>
            <label className="mk-field">
              <span>Min price</span>
              <input type="number" value={minPrice} onChange={(event) => setParam("min", event.target.value || null)} placeholder="1000" />
            </label>
            <label className="mk-field">
              <span>Max price</span>
              <input type="number" value={maxPrice} onChange={(event) => setParam("max", event.target.value || null)} placeholder="5000" />
            </label>
            <label className="mk-check">
              <input type="checkbox" checked={mediaOnly} onChange={(event) => setParam("media", event.target.checked ? "1" : null)} />
              <span>Media evidence only</span>
            </label>
          </div>

          {cropFacets.length > 0 || districtFacets.length > 0 ? (
            <div className="mk-facets">
              {cropFacets.length > 0 ? (
                <div className="mk-facet-row">
                  <span className="mk-facet-label">Crops</span>
                  {cropFacets.map((facet) => (
                    <button
                      key={facet.value}
                      type="button"
                      className={`mk-chip${filterCrop === facet.value ? " active" : ""}`}
                      onClick={() => setParam("crop", filterCrop === facet.value ? null : facet.value)}
                    >
                      {facet.value} <em>{facet.count}</em>
                    </button>
                  ))}
                </div>
              ) : null}
              {districtFacets.length > 0 ? (
                <div className="mk-facet-row">
                  <span className="mk-facet-label">Places</span>
                  {districtFacets.map((facet) => (
                    <button
                      key={facet.value}
                      type="button"
                      className={`mk-chip${filterDistrict === facet.value ? " active" : ""}`}
                      onClick={() => setParam("where", filterDistrict === facet.value ? null : facet.value)}
                    >
                      {facet.value} <em>{facet.count}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="status error">{error}</p> : null}

      {!loading && totalResults === 0 ? (
        <div className="mk-empty">
          <Icon name="market" size={26} />
          <h3>{listings.length + services.length === 0 ? "Nothing is listed yet" : "No results match these filters"}</h3>
          <p>
            {listings.length + services.length === 0
              ? "Produce and service listings will appear here as soon as they are published."
              : "Try a wider price range, a different place, or clear the filters."}
          </p>
          {activeChips.length > 0 ? (
            <button type="button" className="btn small" onClick={resetFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {showListings && (loading || filteredListings.length > 0) ? (
        <section className="mk-section">
          <div className="mk-section-head">
            <h2>
              Produce <span>{filteredListings.length}</span>
            </h2>
            <p>Seller supply and buyer demand</p>
          </div>
          {loading ? (
            <div className="mk-skeleton-grid">
              {[0, 1, 2, 3].map((key) => (
                <div key={key} className="mk-skeleton" />
              ))}
            </div>
          ) : (
            <div className="mk-grid">
              {filteredListings.map((item) => {
                const telHref = item.contactUnlocked ? buildTelHref(item.contactPhone) : null;
                const whatsappHref = item.contactUnlocked
                  ? buildWhatsappHref(
                      item.contactWhatsapp || item.contactPhone,
                      `Hello, I am interested in your ${item.crop} listing on AGRIK marketplace.`
                    )
                  : null;
                return (
                  <article key={item.id} className="mk-card">
                    <Link className="mk-card-media" to={`/marketplace/listings/${item.id}`}>
                      {item.mediaUrls[0] && !brokenMedia.has(item.id) ? (
                        <img
                          src={item.mediaUrls[0]}
                          alt={`${item.crop} listing`}
                          loading="lazy"
                          onError={() => setBrokenMedia((current) => new Set(current).add(item.id))}
                        />
                      ) : (
                        <span className="mk-card-noimg">No photo</span>
                      )}
                      <span className={`mk-tag ${item.role === "buyer" ? "buyer" : "seller"}`}>
                        {item.role === "buyer" ? "Wanted" : "For sale"}
                      </span>
                      {item.mediaUrls.length > 1 ? <span className="mk-media-count">{item.mediaUrls.length}</span> : null}
                    </Link>

                    <div className="mk-card-body">
                      <div className="mk-card-title">
                        <h3>{item.crop || "Listing"}</h3>
                        <strong>{item.price != null ? formatMoney(item.price, item.currency || "UGX") : "Negotiable"}</strong>
                      </div>
                      <p className="mk-card-where">
                        <Icon name="location" size={12} /> {listingLocationLabel(item)}
                      </p>
                      <p className="mk-card-meta">
                        {item.quantity != null ? `${item.quantity} ${item.unit || "units"}` : "Open quantity"}
                        {item.grade ? ` · ${item.grade}` : ""} · {formatDate(item.createdAt)}
                      </p>
                      {density === "comfortable" && item.description ? (
                        <p className="mk-card-desc">{compactText(item.description, 96)}</p>
                      ) : null}
                      <div className="mk-card-actions">
                        <Link className="btn ghost small" to={`/marketplace/listings/${item.id}`}>
                          Details
                        </Link>
                        {telHref ? (
                          <a className="btn ghost small" href={telHref}>
                            Call
                          </a>
                        ) : null}
                        {whatsappHref ? (
                          <a className="btn ghost small" href={whatsappHref} target="_blank" rel="noreferrer">
                            WhatsApp
                          </a>
                        ) : !item.contactUnlocked ? (
                          <Link className="btn small" to="/auth">
                            Sign in to contact
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {showServices && (loading || filteredServices.length > 0) ? (
        <section className="mk-section">
          <div className="mk-section-head">
            <h2>
              Services <span>{filteredServices.length}</span>
            </h2>
            <p>Transport, inputs, and field support</p>
          </div>
          {loading ? null : (
            <div className="mk-grid mk-grid-services">
              {filteredServices.map((item) => (
                <article key={item.id} className="mk-card mk-card-service">
                  <div className="mk-card-body">
                    <div className="mk-card-title">
                      <h3>{item.serviceType || "Service"}</h3>
                      <strong>{item.price != null ? formatMoney(item.price, item.currency || "UGX") : "On request"}</strong>
                    </div>
                    <p className="mk-card-where">
                      <Icon name="location" size={12} /> {joinLocation(item.parish, item.district)}
                    </p>
                    {density === "comfortable" && item.description ? (
                      <p className="mk-card-desc">{compactText(item.description, 96)}</p>
                    ) : null}
                    <div className="mk-card-actions">
                      <span className="mk-card-meta">
                        {item.mediaUrls.length ? `${item.mediaUrls.length} proof files` : "No proof files"}
                      </span>
                      {item.mediaUrls[0] ? (
                        <a className="btn ghost small" href={item.mediaUrls[0]} target="_blank" rel="noreferrer">
                          Evidence
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!user ? (
        <aside className="mk-access">
          <div>
            <strong>Contact details are hidden for guests.</strong>
            <span>Browse everything freely — sign in when you are ready to call or WhatsApp a publisher.</span>
          </div>
          <Link className="btn small" to="/auth">
            Sign in
          </Link>
        </aside>
      ) : null}
    </section>
  );
}

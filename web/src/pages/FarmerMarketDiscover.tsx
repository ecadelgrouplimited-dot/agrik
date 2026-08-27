import { Link } from "react-router-dom";
import { Icon } from "../components/Visuals";
import { formatDate, formatMoney, useMarketWorkspace } from "./FarmerMarketHub";

export default function FarmerMarketDiscover() {
  const { discoverListings, listingFilterCrop, setListingFilterCrop, listingFilterDistrict, setListingFilterDistrict } = useMarketWorkspace();

  return (
    <section className="farmer-card">
      <div className="farmer-card-header">
        <div className="section-title-with-icon">
          <span className="section-icon">
            <Icon name="listings" size={18} />
          </span>
          <h3>Discover</h3>
        </div>
      </div>
      <div className="market-filter-grid">
        <label className="field">
          <Icon name="listings" size={13} /> Crop
          <input value={listingFilterCrop} onChange={(event) => setListingFilterCrop(event.target.value)} placeholder="Maize" />
        </label>
        <label className="field">
          <Icon name="farm" size={13} /> District
          <input value={listingFilterDistrict} onChange={(event) => setListingFilterDistrict(event.target.value)} placeholder="Lira" />
        </label>
      </div>
      {discoverListings.length === 0 ? (
        <p className="muted">No matching listings found.</p>
      ) : (
        <div className="market-list-grid">
          {discoverListings.slice(0, 20).map((item) => (
            <article key={item.id} className="market-list-item">
              <div className="market-list-top">
                <strong>{item.crop}</strong>
                <span className="pill">{item.status || "open"}</span>
              </div>
              <div className="market-list-meta">
                {item.quantity != null ? `${item.quantity} ${item.unit || "units"}` : "Quantity --"} |{" "}
                {item.price != null ? formatMoney(item.price, item.currency || "UGX") : "Price --"}
              </div>
              <div className="market-list-meta">{item.description || "No listing description provided."}</div>
              <div className="market-list-meta">{[item.location.parish, item.location.district].filter(Boolean).join(", ") || "Location --"}</div>
              {item.mediaUrls.length > 0 ? (
                <div className="market-media-grid">
                  {item.mediaUrls.slice(0, 4).map((url, index) => (
                    <a key={`${item.id}-${index}`} href={url} target="_blank" rel="noreferrer" className="market-media-thumb">
                      <img src={url} alt={`${item.crop} evidence ${index + 1}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="farmer-inline-meta">No media evidence attached.</div>
              )}
              <div className="market-inline-actions">
                <Link className="btn ghost tiny" to={`/marketplace/listings/${item.id}`}>
                  View details
                </Link>
              </div>
              <div className="farmer-inline-meta">Published {formatDate(item.createdAt)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

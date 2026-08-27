import { Link } from "react-router-dom";
import { Icon } from "../components/Visuals";
import { formatDate, formatMoney, useMarketWorkspace } from "./FarmerMarketHub";

export default function FarmerMarketListings() {
  const { myListings } = useMarketWorkspace();

  return (
    <section className="farmer-card">
      <div className="farmer-card-header">
        <div className="section-title-with-icon">
          <span className="section-icon">
            <Icon name="farm" size={18} />
          </span>
          <h3>My listings</h3>
        </div>
        <Link className="btn small" to="/dashboard/market/sell">
          <Icon name="plus" size={14} />
          New listing
        </Link>
      </div>
      {myListings.length === 0 ? (
        <p className="muted">No listings published yet.</p>
      ) : (
        <div className="market-list-grid">
          {myListings.map((item) => (
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

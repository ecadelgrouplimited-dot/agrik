import { Icon } from "../components/Visuals";
import { formatMoney, useMarketWorkspace } from "./FarmerMarketHub";

export default function FarmerMarketProviders() {
  const { serviceFeed } = useMarketWorkspace();

  return (
    <section className="farmer-card">
      <div className="farmer-card-header">
        <div className="section-title-with-icon">
          <span className="section-icon">
            <Icon name="services" size={18} />
          </span>
          <h3>Service providers</h3>
        </div>
      </div>
      {serviceFeed.length === 0 ? (
        <p className="muted">No service providers listed yet.</p>
      ) : (
        <div className="market-list-grid">
          {serviceFeed.slice(0, 12).map((item) => (
            <article key={item.id} className="market-list-item">
              <div className="market-list-top">
                <strong>{item.serviceType}</strong>
                <span className="pill">{item.status || "open"}</span>
              </div>
              <div className="market-list-meta">{item.description || "No description provided."}</div>
              <div className="market-list-meta">
                {item.price != null ? formatMoney(item.price, item.currency || "UGX") : "Price by quote"} |{" "}
                {item.coverageRadiusKm != null ? `${item.coverageRadiusKm} km radius` : "Coverage n/a"}
              </div>
              {item.mediaUrls.length > 0 ? (
                <div className="market-media-grid">
                  {item.mediaUrls.slice(0, 4).map((url, index) => (
                    <a key={`${item.id}-${index}`} href={url} target="_blank" rel="noreferrer" className="market-media-thumb">
                      <img src={url} alt={`${item.serviceType} evidence ${index + 1}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="farmer-inline-meta">No media evidence attached.</div>
              )}
              <div className="farmer-inline-meta">{[item.location.parish, item.location.district].filter(Boolean).join(", ") || "Location --"}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Icon } from "../components/Visuals";
import { useAuth } from "../state/auth";

type ProfileDetails = {
  user: { phone: string };
  settings: { district?: string | null; parish?: string | null; preferred_language?: string | null };
  farm: { crops: string[] };
};

type WeatherSummary = {
  location_name?: string | null;
  next_rain_date?: string | null;
  days: { date: string; precipitation_mm?: number | null; temp_max_c?: number | null; temp_min_c?: number | null }[];
};

type MarketPrediction = {
  crop: string;
  district?: string | null;
  predicted_price: number;
  currency: string;
  direction: "up" | "down" | "flat";
  confidence: number;
  horizon_days: number;
};

type MarketIntel = {
  predictions: MarketPrediction[];
};

export default function FarmerBrain() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [market, setMarket] = useState<MarketIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      setLoading(true);
      setContextError(null);
      try {
        const profileRes = (await api.profileDetails()) as ProfileDetails;
        if (!active) return;
        setProfile(profileRes);

        const district = profileRes.settings.district ?? "";
        const marketQuery = district ? `?district=${encodeURIComponent(district)}&limit=6` : "?limit=6";
        const [weatherRes, marketRes] = await Promise.all([
          api.weatherSummary().catch(() => null),
          api.marketIntel(marketQuery).catch(() => null),
        ]);
        if (!active) return;
        setWeather((weatherRes as WeatherSummary | null) ?? null);
        setMarket((marketRes as MarketIntel | null) ?? null);
      } catch {
        if (!active) return;
        setProfile(null);
        setWeather(null);
        setMarket(null);
        setContextError("Unable to load your farm signals right now.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadContext();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const localeHint = profile?.settings.preferred_language?.trim() || undefined;
  const locationHint = useMemo(
    () =>
      [profile?.settings.parish, profile?.settings.district]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .join(", ") || undefined,
    [profile?.settings.district, profile?.settings.parish]
  );
  const topPrediction = market?.predictions?.[0];
  const contextCoverageCount = [
    Boolean(locationHint || weather?.location_name),
    Boolean((profile?.farm.crops ?? []).length),
    Boolean(weather?.days?.length),
    Boolean(topPrediction),
  ].filter(Boolean).length;

  return (
    <section className="farmer-page farmer-brain-page">
      <div className="farmer-page-header grik-page-header">
        <p className="muted">Your farm signals at a glance -- location, weather, crops, and market readiness.</p>
        <Link className="btn small" to="/dashboard/brain">
          <Icon name="brain" size={14} />
          Open Ask GRIK
        </Link>
      </div>

      {contextError ? (
        <div className="grik-status-stack">
          <p className="status error">{contextError}</p>
        </div>
      ) : null}

      <div className="grik-hero-grid">
        <section className="farmer-card grik-hero-card grik-hero-card-primary">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="users" size={16} />
            </span>
            <div>
              <div className="label">Workspace</div>
              <h3>Ready for questions</h3>
            </div>
          </div>
          <div className="farmer-chip-row">
            <span className="chip">{profile?.user.phone ?? user?.phone ?? "Unknown farmer"}</span>
            <span className="chip">{localeHint ?? "Language auto"}</span>
            <span className="chip">{locationHint ?? "Add location in profile"}</span>
          </div>
        </section>

        <section className="farmer-card grik-hero-card">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="check-circle" size={16} />
            </span>
            <div>
              <div className="label">Context coverage</div>
              <h3>{contextCoverageCount}/4 signals ready</h3>
            </div>
          </div>
          <div className="grik-hero-metrics">
            <div className="grik-hero-metric">
              <span>Location</span>
              <strong>{locationHint || weather?.location_name ? "Ready" : "Missing"}</strong>
            </div>
            <div className="grik-hero-metric">
              <span>Crops</span>
              <strong>{(profile?.farm.crops ?? []).length || 0}</strong>
            </div>
            <div className="grik-hero-metric">
              <span>Weather</span>
              <strong>{weather?.days?.length ? `${weather.days.length} days` : "Pending"}</strong>
            </div>
            <div className="grik-hero-metric">
              <span>Market</span>
              <strong>{topPrediction ? topPrediction.direction : "Pending"}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="grik-brain-stats-grid">
        <section className="farmer-card">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="weather" size={16} />
            </span>
            <div>
              <div className="label">Weather context</div>
              <h3>Planning window</h3>
            </div>
          </div>
          {loading ? (
            <p className="muted">Loading context...</p>
          ) : weather && weather.days.length > 0 ? (
            <div className="grik-weather-list">
              {weather.days.slice(0, 3).map((day) => (
                <div key={day.date} className="grik-weather-item">
                  <div>{new Date(day.date).toLocaleDateString()}</div>
                  <div className="muted">
                    {day.temp_max_c != null ? Math.round(day.temp_max_c) : "--"} / {day.temp_min_c != null ? Math.round(day.temp_min_c) : "--"} C
                  </div>
                  <div className="muted">{day.precipitation_mm != null ? `${day.precipitation_mm.toFixed(1)} mm rain` : "No rain data"}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Set district/parish in Farm Profile for localized weather planning.</p>
          )}
          {weather?.next_rain_date ? (
            <p className="muted">Next rain window: {new Date(weather.next_rain_date).toLocaleDateString()}.</p>
          ) : null}
        </section>

        <section className="farmer-card">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="market" size={16} />
            </span>
            <div>
              <div className="label">Market context</div>
              <h3>Price pulse</h3>
            </div>
          </div>
          {topPrediction ? (
            <div className="grik-market-item">
              <div>
                <strong>{topPrediction.crop}</strong>
              </div>
              <div className="muted">
                {topPrediction.district ? `${topPrediction.district} | ` : ""}
                {topPrediction.direction} | {topPrediction.currency}
                {topPrediction.predicted_price}
              </div>
              <div className="muted">Confidence: {Math.min(100, Math.max(0, Math.round(topPrediction.confidence * 100)))}%</div>
            </div>
          ) : (
            <p className="muted">No strong market prediction yet.</p>
          )}
        </section>

        <section className="farmer-card">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="brain" size={16} />
            </span>
            <div>
              <div className="label">How GRIK helps</div>
              <h3>Decision support</h3>
            </div>
          </div>
          <ul className="grik-stack-list grik-icon-list">
            <li>
              <Icon name="location" size={13} />
              Uses your crop, language, and location when available
            </li>
            <li>
              <Icon name="brain" size={13} />
              Combines manuals, recent context, and model reasoning
            </li>
            <li>
              <Icon name="camera" size={13} />
              Reads photos and short video when you attach field evidence
            </li>
            <li>
              <Icon name="check-circle" size={13} />
              Suggests follow-up questions to keep the diagnosis moving
            </li>
          </ul>
          <Link className="btn ghost small" to="/dashboard/brain">
            Ask GRIK a question
          </Link>
        </section>
      </div>
    </section>
  );
}

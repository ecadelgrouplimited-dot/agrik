import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Visuals";
import { api } from "../lib/api";

type StatusMessage = { type: "info" | "error"; message: string };

type FarmLocation = {
  id: string;
  name: string;
  district: string;
  parish: string;
  isPrimary: boolean;
};

const LANGUAGE_OPTIONS = [
  { id: "auto", label: "Auto detect" },
  { id: "en", label: "English" },
  { id: "lg", label: "Luganda" },
  { id: "nyn", label: "Runyankole" },
  { id: "ach", label: "Acholi" },
  { id: "teo", label: "Ateso" },
];

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseFarmUnits(soilProfile: Record<string, unknown>): FarmLocation[] {
  const raw = soilProfile.farm_units;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = asRecord(entry);
      const name = toStringValue(row.name);
      const district = toStringValue(row.district);
      const parish = toStringValue(row.parish);
      if (!name && !district) return null;
      return {
        id: toStringValue(row.id) || name,
        name: name || "Unnamed farm",
        district,
        parish,
        isPrimary: Boolean(row.is_primary),
      };
    })
    .filter((item): item is FarmLocation => item != null);
}

export default function FarmerSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [farms, setFarms] = useState<FarmLocation[]>([]);
  const [preferredLanguage, setPreferredLanguage] = useState("auto");
  const [weatherAlerts, setWeatherAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [voiceOptIn, setVoiceOptIn] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.profileDetails(), api.userSettings()])
      .then(([profileRes, settingsRes]) => {
        if (!active) return;
        setFarms(parseFarmUnits(profileRes.farm.soil_profile));
        setPreferredLanguage(settingsRes.preferred_language || "auto");
        setWeatherAlerts(settingsRes.weather_alerts);
        setPriceAlerts(settingsRes.price_alerts);
        setSmsOptIn(settingsRes.sms_opt_in);
        setVoiceOptIn(settingsRes.voice_opt_in);
      })
      .catch(() => setStatus({ type: "error", message: "Unable to load your settings." }))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateSettings({
        preferred_language: preferredLanguage,
        weather_alerts: weatherAlerts,
        price_alerts: priceAlerts,
        sms_opt_in: smsOptIn,
        voice_opt_in: voiceOptIn,
      });
      setStatus({ type: "info", message: "Settings saved." });
    } catch {
      setStatus({ type: "error", message: "Unable to save settings right now." });
    } finally {
      setSaving(false);
    }
  };

  const primaryFarm = farms.find((farm) => farm.isPrimary) ?? farms[0] ?? null;

  if (loading) return <section className="farmer-page">Loading settings...</section>;

  return (
    <section className="farmer-page">
      <div className="farmer-page-header farmer-command-header header-actions-only">
        <div className="farmer-command-actions">
          <button className="btn" type="button" onClick={handleSave} disabled={saving}>
            <Icon name="send" size={14} />
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      {status ? <p className={`status ${status.type === "error" ? "error" : ""}`}>{status.message}</p> : null}

      <section className="farmer-card">
        <div className="farmer-card-header">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="location" size={18} />
            </span>
            <h3>Farm locations</h3>
          </div>
          <Link className="btn ghost small" to="/dashboard/farm">
            <Icon name="farm" size={14} />
            Manage farms
          </Link>
        </div>
        <p className="muted">
          Weather and price matching use your primary farm&apos;s location. Each farm keeps its own district and parish —
          set them per farm in Farm Workspace, not here.
        </p>
        {farms.length === 0 ? (
          <div className="settings-empty-state">
            <Icon name="farm" size={22} />
            <p>No farms yet. Add one to set a location.</p>
            <Link className="btn small" to="/dashboard/farm/create">
              Create your first farm
            </Link>
          </div>
        ) : (
          <div className="farm-location-list">
            {farms.map((farm) => (
              <div key={farm.id} className="farm-location-row">
                <span className="farm-location-name">
                  <Icon name="farm" size={14} />
                  {farm.name}
                  {farm.isPrimary ? <span className="pill">primary</span> : null}
                </span>
                <span className="farm-location-place">{[farm.parish, farm.district].filter(Boolean).join(", ") || "Location not set"}</span>
              </div>
            ))}
          </div>
        )}
        {primaryFarm ? (
          <div className="field-note">
            Currently using <strong>{primaryFarm.name}</strong>&apos;s location ({[primaryFarm.parish, primaryFarm.district].filter(Boolean).join(", ") || "not set"}) for weather.
          </div>
        ) : null}
      </section>

      <section className="farmer-card">
        <div className="farmer-card-header">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="ai" size={18} />
            </span>
            <h3>Language</h3>
          </div>
        </div>
        <div className="farmer-form-grid">
          <label className="field">
            GRIK Brain replies in
            <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)}>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="farmer-card">
        <div className="farmer-card-header">
          <div className="section-title-with-icon">
            <span className="section-icon">
              <Icon name="alerts" size={18} />
            </span>
            <h3>Notifications</h3>
          </div>
        </div>
        <div className="settings-toggle-list">
          <label className="settings-toggle-row">
            <div>
              <strong>Weather alerts</strong>
              <span className="muted">Rain windows and risk warnings for your primary farm.</span>
            </div>
            <input type="checkbox" checked={weatherAlerts} onChange={(event) => setWeatherAlerts(event.target.checked)} />
          </label>
          <label className="settings-toggle-row">
            <div>
              <strong>Price alerts</strong>
              <span className="muted">Notify me when tracked crop prices move.</span>
            </div>
            <input type="checkbox" checked={priceAlerts} onChange={(event) => setPriceAlerts(event.target.checked)} />
          </label>
          <label className="settings-toggle-row">
            <div>
              <strong>SMS delivery</strong>
              <span className="muted">Send alerts by SMS as well as in-app.</span>
            </div>
            <input type="checkbox" checked={smsOptIn} onChange={(event) => setSmsOptIn(event.target.checked)} />
          </label>
          <label className="settings-toggle-row">
            <div>
              <strong>Voice delivery</strong>
              <span className="muted">Send alerts by voice call as well as in-app.</span>
            </div>
            <input type="checkbox" checked={voiceOptIn} onChange={(event) => setVoiceOptIn(event.target.checked)} />
          </label>
        </div>
      </section>
    </section>
  );
}

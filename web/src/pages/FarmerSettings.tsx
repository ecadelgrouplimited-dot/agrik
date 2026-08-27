import { useEffect, useState } from "react";
import { Icon } from "../components/Visuals";
import { api, type UgandaDistrictOut } from "../lib/api";

type StatusMessage = { type: "info" | "error"; message: string };

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

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function FarmerSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [districts, setDistricts] = useState<UgandaDistrictOut[]>([]);
  const [parishOptions, setParishOptions] = useState<string[]>([]);
  const [loadingParishes, setLoadingParishes] = useState(false);

  const [preferredLanguage, setPreferredLanguage] = useState("auto");
  const [district, setDistrict] = useState("");
  const [parish, setParish] = useState("");
  const [weatherAlerts, setWeatherAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [voiceOptIn, setVoiceOptIn] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.referenceDistricts(), api.userSettings()])
      .then(([districtRes, settingsRes]) => {
        if (!active) return;
        setDistricts(districtRes.items ?? []);
        setPreferredLanguage(settingsRes.preferred_language || "auto");
        setDistrict(settingsRes.district || "");
        setParish(settingsRes.parish || "");
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

  useEffect(() => {
    let active = true;
    if (!district) {
      setParishOptions([]);
      return;
    }
    setLoadingParishes(true);
    api
      .referenceParishes(district)
      .then((res) => {
        if (!active) return;
        setParishOptions(uniqueValues((res.items ?? []).map((item) => toStringValue(item.name))));
      })
      .catch(() => {
        if (active) setParishOptions([]);
      })
      .finally(() => {
        if (active) setLoadingParishes(false);
      });
    return () => {
      active = false;
    };
  }, [district]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateSettings({
        preferred_language: preferredLanguage,
        district: district || null,
        parish: parish || null,
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
            <h3>Location</h3>
          </div>
        </div>
        <p className="muted">Powers weather forecasts, price matching, and the live district map.</p>
        <div className="farmer-form-grid">
          <label className="field">
            District
            <select
              value={district}
              onChange={(event) => {
                setDistrict(event.target.value);
                setParish("");
              }}
            >
              <option value="">Select district</option>
              {districts.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Parish
            {parishOptions.length > 0 ? (
              <select value={parish} onChange={(event) => setParish(event.target.value)} disabled={!district || loadingParishes}>
                <option value="">{loadingParishes ? "Loading..." : "Select parish"}</option>
                {parishOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={parish}
                onChange={(event) => setParish(event.target.value)}
                placeholder={district ? "Type your parish" : "Select a district first"}
                disabled={!district}
              />
            )}
          </label>
        </div>
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
              <span className="muted">Rain windows and risk warnings for your district.</span>
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

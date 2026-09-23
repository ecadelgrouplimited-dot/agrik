import { useOutletContext } from "react-router-dom";
import { type FarmerFarmWorkspaceContext } from "./FarmerFarm";

export default function FarmerFarmSettings() {
  const { settings, activeFarm, onSettingsChange, handleSave, saving } = useOutletContext<FarmerFarmWorkspaceContext>();

  return (
    <>
      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>Channels and defaults</h2>
        </div>

        <div className="farmer-form-grid">
          <label className="field">
            Preferred language
            <input
              value={settings.preferredLanguage}
              onChange={(event) => onSettingsChange("preferredLanguage", event.target.value)}
              placeholder="English / Luganda / Runyankole"
            />
          </label>
          <label className="field">
            Default district
            <input value={settings.district} onChange={(event) => onSettingsChange("district", event.target.value)} placeholder="Lira" />
          </label>
          <label className="field">
            Default parish
            <input value={settings.parish} onChange={(event) => onSettingsChange("parish", event.target.value)} placeholder="Aromo" />
          </label>
        </div>

        <div className="farmer-toggle-grid">
          <label className="toggle">
            <input type="checkbox" checked={settings.smsOptIn} onChange={(event) => onSettingsChange("smsOptIn", event.target.checked)} />
            <span>SMS updates</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.voiceOptIn} onChange={(event) => onSettingsChange("voiceOptIn", event.target.checked)} />
            <span>Voice updates</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.weatherAlerts} onChange={(event) => onSettingsChange("weatherAlerts", event.target.checked)} />
            <span>Weather alerts</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.priceAlerts} onChange={(event) => onSettingsChange("priceAlerts", event.target.checked)} />
            <span>Price alerts</span>
          </label>
        </div>

        <button className="btn" type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save farm settings"}
        </button>
      </section>

      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>How defaults work</h2>
        </div>
        <ul className="grik-stack-list">
          <li>The primary farm remains the source of truth for synced district and parish values on save.</li>
          <li>Alert channels here apply to the farmer profile, not only the selected farm.</li>
          <li>
            Current primary farm: {activeFarm?.isPrimary ? activeFarm.name || "Selected farm" : "Switch to the primary farm from Farm Home if you want to inspect it here."}
          </li>
        </ul>
      </section>
    </>
  );
}

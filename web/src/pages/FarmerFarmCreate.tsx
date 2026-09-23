import { NavLink, useOutletContext } from "react-router-dom";
import { Icon } from "../components/Visuals";
import FarmLocationFields from "../components/FarmLocationFields";
import { type FarmerFarmWorkspaceContext } from "./FarmerFarm";
import FarmerCropSelector from "./FarmerCropSelector";

export default function FarmerFarmCreate() {
  const { activeFarm, cropOptions, soilTypeOptions, isActiveFarmEmpty, addFarm, onActiveFarmChange, onExpectationsChange, handleSave, saving } =
    useOutletContext<FarmerFarmWorkspaceContext>();

  if (!activeFarm) {
    return <section className="farmer-card">No active farm draft is available.</section>;
  }

  return (
    <>
      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>{isActiveFarmEmpty ? "New farm" : `Editing ${activeFarm.name || "selected farm"}`}</h2>
          <button className="fw-panel-link" type="button" onClick={addFarm}>
            Start a blank farm instead
          </button>
        </div>

        <div className="farmer-form-grid">
          <label className="field">
            Farm name
            <input value={activeFarm.name} onChange={(event) => onActiveFarmChange("name", event.target.value)} placeholder="Main farm" />
          </label>
          <FarmLocationFields
            district={activeFarm.district}
            parish={activeFarm.parish}
            onDistrictChange={(value) => onActiveFarmChange("district", value)}
            onParishChange={(value) => onActiveFarmChange("parish", value)}
          />
          <label className="field">
            Farm size (acres)
            <input
              type="number"
              value={activeFarm.farmSizeAcres}
              onChange={(event) => onActiveFarmChange("farmSizeAcres", event.target.value)}
              placeholder="2.5"
            />
          </label>
          <label className="field">
            Soil type
            <select value={activeFarm.soilType} onChange={(event) => onActiveFarmChange("soilType", event.target.value)}>
              <option value="">Select soil type</option>
              {soilTypeOptions.map((soilType) => (
                <option key={soilType} value={soilType}>
                  {soilType}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Last planting date
            <input type="date" value={activeFarm.lastPlantingDate} onChange={(event) => onActiveFarmChange("lastPlantingDate", event.target.value)} />
          </label>
          <label className="field farmer-form-span">
            Crops grown
            <FarmerCropSelector options={cropOptions} selected={activeFarm.crops} onChange={(value) => onActiveFarmChange("crops", value)} />
          </label>
          <label className="field farmer-form-span">
            Farm notes
            <textarea
              rows={3}
              value={activeFarm.notes}
              onChange={(event) => onActiveFarmChange("notes", event.target.value)}
              placeholder="Land access, labor bottlenecks, or any context worth tracking."
            />
          </label>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={activeFarm.hasWaterAccess} onChange={(event) => onActiveFarmChange("hasWaterAccess", event.target.checked)} />
          <span>Water access available on this farm</span>
        </label>
      </section>

      <section className="fw-panel">
        <div className="fw-panel-head">
          <h2>Season plan</h2>
          <NavLink to="/dashboard/farm/manage" className="fw-panel-link">
            Advanced fields
          </NavLink>
        </div>

        <div className="farmer-form-grid">
          <label className="field">
            Season label
            <input
              value={activeFarm.expectations.seasonLabel}
              onChange={(event) => onExpectationsChange("seasonLabel", event.target.value)}
              placeholder="2026 Season A"
            />
          </label>
          <label className="field">
            Planting window start
            <input
              type="date"
              value={activeFarm.expectations.plantingWindowStart}
              onChange={(event) => onExpectationsChange("plantingWindowStart", event.target.value)}
            />
          </label>
          <label className="field">
            Planting window end
            <input
              type="date"
              value={activeFarm.expectations.plantingWindowEnd}
              onChange={(event) => onExpectationsChange("plantingWindowEnd", event.target.value)}
            />
          </label>
          <label className="field">
            Target harvest date
            <input
              type="date"
              value={activeFarm.expectations.targetHarvestDate}
              onChange={(event) => onExpectationsChange("targetHarvestDate", event.target.value)}
            />
          </label>
          <label className="field">
            Target yield (kg)
            <input
              type="number"
              value={activeFarm.expectations.targetYieldKg}
              onChange={(event) => onExpectationsChange("targetYieldKg", event.target.value)}
              placeholder="3600"
            />
          </label>
          <label className="field">
            Expected price per kg
            <input
              type="number"
              value={activeFarm.expectations.expectedPricePerKg}
              onChange={(event) => onExpectationsChange("expectedPricePerKg", event.target.value)}
              placeholder="1200"
            />
          </label>
          <label className="field farmer-form-span">
            Buyer plan / market channel
            <textarea
              rows={2}
              value={activeFarm.expectations.buyerPlan}
              onChange={(event) => onExpectationsChange("buyerPlan", event.target.value)}
              placeholder="Cooperative bulk sale, direct market, contract buyer..."
            />
          </label>
        </div>

        <button className="btn farm-create-bottom-save" type="button" onClick={handleSave} disabled={saving}>
          <Icon name="send" size={14} />
          {saving ? "Saving..." : "Save new farm"}
        </button>
      </section>
    </>
  );
}

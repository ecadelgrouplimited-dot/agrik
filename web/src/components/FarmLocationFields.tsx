import { useEffect, useState } from "react";
import { Icon } from "./Visuals";
import { api, type UgandaDistrictOut } from "../lib/api";

type Props = {
  district: string;
  parish: string;
  onDistrictChange: (value: string) => void;
  onParishChange: (value: string) => void;
};

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function FarmLocationFields({ district, parish, onDistrictChange, onParishChange }: Props) {
  const [districts, setDistricts] = useState<UgandaDistrictOut[]>([]);
  const [parishOptions, setParishOptions] = useState<string[]>([]);
  const [loadingParishes, setLoadingParishes] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .referenceDistricts()
      .then((res) => setDistricts(res.items ?? []))
      .catch(() => setDistricts([]));
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

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocationStatus("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        api
          .referenceNearestDistrict(latitude, longitude)
          .then((res) => {
            if (!res.match) {
              setLocationStatus(res.reason || "Couldn't match a district to this location.");
              return;
            }
            onDistrictChange(res.match.name);
            onParishChange("");
            const distanceNote = res.distance_km != null ? ` (~${res.distance_km} km from district center)` : "";
            setLocationStatus(`Matched to ${res.match.name}${distanceNote}. Confirm the parish below.`);
          })
          .catch(() => setLocationStatus("Couldn't match a district right now. Try again shortly."))
          .finally(() => setLocating(false));
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus("Location permission denied. Allow it in your browser to use this.");
        } else {
          setLocationStatus("Couldn't get your location. Pick district and parish manually instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <>
      <label className="field">
        District
        <div className="location-field-row">
          <select value={district} onChange={(event) => { onDistrictChange(event.target.value); onParishChange(""); }}>
            <option value="">Select district</option>
            {districts.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost tiny location-detect-btn"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            title="Use current location"
          >
            <Icon name="location" size={13} />
            {locating ? "Locating..." : "Use current location"}
          </button>
        </div>
        {locationStatus ? <span className="field-note">{locationStatus}</span> : null}
      </label>
      <label className="field">
        Parish
        {parishOptions.length > 0 ? (
          <select value={parish} onChange={(event) => onParishChange(event.target.value)} disabled={!district || loadingParishes}>
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
            onChange={(event) => onParishChange(event.target.value)}
            placeholder={district ? "Type your parish" : "Select a district first"}
            disabled={!district}
          />
        )}
      </label>
    </>
  );
}

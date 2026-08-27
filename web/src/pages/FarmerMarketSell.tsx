import { Icon } from "../components/Visuals";
import { CROP_OPTIONS, CURRENCY_OPTIONS, GRADE_OPTIONS, UNIT_OPTIONS, useMarketWorkspace } from "./FarmerMarketHub";

export default function FarmerMarketSell() {
  const {
    listingDraft,
    listingMediaUrls,
    cropOptions,
    publishChecklist,
    saving,
    uploadingMedia,
    onDraftChange,
    removeMedia,
    onUploadListingMedia,
    handleCreateListing,
  } = useMarketWorkspace();

  const resolvedCropOptions = cropOptions.length > 0 ? cropOptions : CROP_OPTIONS;

  return (
    <section className="farmer-card">
      <div className="farmer-card-header">
        <div className="section-title-with-icon">
          <span className="section-icon">
            <Icon name="plus" size={18} />
          </span>
          <h3>Publish a listing</h3>
        </div>
      </div>

      <div className="farmer-chip-row">
        {publishChecklist.map((item) => (
          <span key={item.label} className={`chip ${item.ready ? "chip-ready" : ""}`}>
            <Icon name={item.ready ? "shield" : "spark"} size={12} />
            {item.label}
          </span>
        ))}
      </div>

      <form className="market-sell-form" onSubmit={handleCreateListing}>
        <fieldset className="form-fieldset">
          <legend>
            <Icon name="listings" size={14} /> Produce
          </legend>
          <div className="farmer-form-grid">
            <label className="field">
              Crop
              <input
                list="market-crop-options"
                value={listingDraft.crop}
                onChange={(event) => onDraftChange("crop", event.target.value)}
                placeholder="Maize"
              />
              <datalist id="market-crop-options">
                {resolvedCropOptions.map((crop) => (
                  <option key={crop} value={crop} />
                ))}
              </datalist>
            </label>
            <label className="field">
              Quantity
              <input type="number" value={listingDraft.quantity} onChange={(event) => onDraftChange("quantity", event.target.value)} placeholder="300" />
            </label>
            <label className="field">
              Unit
              <select value={listingDraft.unit} onChange={(event) => onDraftChange("unit", event.target.value)}>
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Price
              <input type="number" value={listingDraft.price} onChange={(event) => onDraftChange("price", event.target.value)} placeholder="1200" />
            </label>
            <label className="field">
              Currency
              <select value={listingDraft.currency} onChange={(event) => onDraftChange("currency", event.target.value)}>
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Grade
              <select value={listingDraft.grade} onChange={(event) => onDraftChange("grade", event.target.value)}>
                <option value="">Select grade</option>
                {GRADE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field farmer-form-span">
              Description
              <textarea
                rows={2}
                value={listingDraft.description}
                onChange={(event) => onDraftChange("description", event.target.value)}
                placeholder="Quality, harvest date, packaging, delivery options."
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-fieldset">
          <legend>
            <Icon name="services" size={14} /> Contact &amp; location
          </legend>
          <div className="farmer-form-grid">
            <label className="field">
              Contact name
              <input value={listingDraft.contactName} onChange={(event) => onDraftChange("contactName", event.target.value)} placeholder="Okello Moses" />
            </label>
            <label className="field">
              Contact phone
              <input value={listingDraft.contactPhone} onChange={(event) => onDraftChange("contactPhone", event.target.value)} placeholder="+256700000000" />
            </label>
            <label className="field">
              WhatsApp
              <input value={listingDraft.contactWhatsapp} onChange={(event) => onDraftChange("contactWhatsapp", event.target.value)} placeholder="+256700000000" />
            </label>
            <label className="field">
              District
              <input value={listingDraft.district} onChange={(event) => onDraftChange("district", event.target.value)} placeholder="Lira" />
            </label>
            <label className="field">
              Parish
              <input value={listingDraft.parish} onChange={(event) => onDraftChange("parish", event.target.value)} placeholder="Aromo" />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-fieldset">
          <legend>
            <Icon name="upload" size={14} /> Media evidence
          </legend>
          <label className="field">
            <input type="file" multiple accept="image/*" onChange={onUploadListingMedia} disabled={uploadingMedia} />
            <span className="field-note">Photos build buyer trust faster.</span>
          </label>
          {listingMediaUrls.length > 0 ? (
            <div className="market-media-grid">
              {listingMediaUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="market-media-item">
                  <a href={url} target="_blank" rel="noreferrer" className="market-media-thumb">
                    <img src={url} alt={`Listing upload ${index + 1}`} loading="lazy" />
                  </a>
                  <button className="btn ghost tiny market-media-remove" type="button" onClick={() => removeMedia(url)}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </fieldset>

        <div className="market-form-actions">
          <button className="btn" type="submit" disabled={saving || uploadingMedia}>
            {saving ? "Publishing..." : uploadingMedia ? "Uploading media..." : "Publish listing"}
          </button>
        </div>
      </form>
    </section>
  );
}

type FarmerCropSelectorProps = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Defaults to the crops case this was written for; set it when reusing for another list. */
  ariaLabel?: string;
};

export default function FarmerCropSelector({ options, selected, onChange, ariaLabel = "Crops grown" }: FarmerCropSelectorProps) {
  const selectedSet = new Set(selected);

  const toggleCrop = (crop: string, checked: boolean) => {
    if (checked) {
      onChange([...selected, crop]);
      return;
    }
    onChange(selected.filter((item) => item !== crop));
  };

  return (
    <div className="crop-checkbox-grid" role="group" aria-label={ariaLabel}>
      {options.map((crop) => (
        <label key={crop} className={`crop-checkbox-item ${selectedSet.has(crop) ? "selected" : ""}`}>
          <input type="checkbox" checked={selectedSet.has(crop)} onChange={(event) => toggleCrop(crop, event.target.checked)} />
          <span>{crop}</span>
        </label>
      ))}
    </div>
  );
}

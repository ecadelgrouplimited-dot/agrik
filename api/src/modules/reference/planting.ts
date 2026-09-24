import { prisma } from "../../lib/prisma.js";

export type DistrictPlantingRow = {
  district: string;
  /** Farms in this district whose profile records at least one crop. */
  farms_with_crops: number;
  /** Every farm in this district, whether or not it has filled anything in. */
  farms_total: number;
  /** Farms that recorded a planting date. This is usually far smaller than the above. */
  farms_with_dates: number;
  crops: { crop: string; farms: number }[];
  /** Planting dates recorded for the district, soonest first. */
  next_planting: string | null;
  /** Dates inside the coming window, which is what a supplier stocks for. */
  planting_in_window: number;
};

/**
 * Aggregates what farmers recorded about their own crops and planting dates, by district.
 * An input supplier reads this as "stock maize seed in Lira in the next six weeks".
 *
 * It reports coverage alongside every figure on purpose. Planting dates are sparse — most
 * profiles have never had one entered — and a crop ranking drawn from three farms out of
 * forty looks exactly like one drawn from forty unless the page says otherwise.
 */
export async function districtPlantingDemand(windowDays: number): Promise<DistrictPlantingRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "farmer" },
    select: {
      id: true,
      identity: { select: { district: true, crops: true } },
      farm: { select: { crops: true, plantingDates: true } },
    },
  });

  const now = Date.now();
  const windowEnd = now + windowDays * 86400000;
  const byDistrict = new Map<string, DistrictPlantingRow & { cropCounts: Map<string, number>; dates: number[] }>();

  for (const user of users) {
    const district = (user.identity?.district ?? "").trim();
    if (!district) continue;

    let row = byDistrict.get(district);
    if (!row) {
      row = {
        district,
        farms_with_crops: 0,
        farms_total: 0,
        farms_with_dates: 0,
        crops: [],
        next_planting: null,
        planting_in_window: 0,
        cropCounts: new Map(),
        dates: [],
      };
      byDistrict.set(district, row);
    }

    row.farms_total += 1;

    // Onboarding writes crops to Identity; the farm workspace writes them to FarmProfile.
    // A farmer who signed up but never opened the workspace has them only on Identity, and
    // is exactly the farmer a supplier wants to know about.
    const farmCrops = user.farm?.crops ?? [];
    const crops = farmCrops.length > 0 ? farmCrops : user.identity?.crops ?? [];
    if (crops.length > 0) {
      row.farms_with_crops += 1;
      for (const crop of crops) {
        const key = crop.trim().toLowerCase();
        if (!key) continue;
        row.cropCounts.set(key, (row.cropCounts.get(key) ?? 0) + 1);
      }
    }

    // plantingDates is free-form JSON written by the farm workspace; anything that is not
    // a parseable date is skipped rather than guessed at.
    const raw = user.farm?.plantingDates;
    const entries = Array.isArray(raw) ? raw : [];
    let counted = false;
    for (const entry of entries) {
      const value = typeof entry === "object" && entry !== null ? (entry as { date?: unknown }).date : entry;
      const ms = typeof value === "string" ? Date.parse(value) : NaN;
      if (Number.isNaN(ms)) continue;
      row.dates.push(ms);
      if (ms >= now && ms <= windowEnd) row.planting_in_window += 1;
      counted = true;
    }
    if (counted) row.farms_with_dates += 1;
  }

  return [...byDistrict.values()]
    .map(({ cropCounts, dates, ...row }) => {
      const upcoming = dates.filter((ms) => ms >= now).sort((a, b) => a - b);
      return {
        ...row,
        crops: [...cropCounts.entries()]
          .map(([crop, farms]) => ({ crop, farms }))
          .sort((a, b) => b.farms - a.farms || a.crop.localeCompare(b.crop))
          .slice(0, 6),
        next_planting: upcoming.length > 0 ? new Date(upcoming[0]).toISOString() : null,
      };
    })
    .filter((row) => row.farms_with_crops > 0 || row.farms_with_dates > 0)
    .sort((a, b) => b.farms_with_crops - a.farms_with_crops || a.district.localeCompare(b.district));
}

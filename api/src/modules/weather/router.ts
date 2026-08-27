import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { badRequest } from "../../lib/http-error.js";

const router = Router();

const UGANDA_FALLBACK = { latitude: 1.3733, longitude: 32.2903, name: "Uganda" };

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const districtName = String(req.query.district ?? "").trim();
    const latQuery = req.query.latitude ? Number(req.query.latitude) : undefined;
    const lonQuery = req.query.longitude ? Number(req.query.longitude) : undefined;

    let latitude = latQuery;
    let longitude = lonQuery;
    let locationName: string | null = districtName || null;

    if ((latitude == null || longitude == null) && districtName) {
      const district = await prisma.district.findFirst({ where: { name: { equals: districtName, mode: "insensitive" } } });
      if (district?.latitude != null && district?.longitude != null) {
        latitude = district.latitude;
        longitude = district.longitude;
      }
    }

    if (latitude == null || longitude == null) {
      latitude = UGANDA_FALLBACK.latitude;
      longitude = UGANDA_FALLBACK.longitude;
      locationName = locationName ?? UGANDA_FALLBACK.name;
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("daily", "precipitation_sum,temperature_2m_max,temperature_2m_min");
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url);
    if (!response.ok) throw badRequest("Weather provider is currently unavailable.");
    const data = (await response.json()) as {
      daily: { time: string[]; precipitation_sum: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
    };

    const days = data.daily.time.map((date, i) => ({
      date,
      precipitation_mm: data.daily.precipitation_sum[i] ?? null,
      temp_max_c: data.daily.temperature_2m_max[i] ?? null,
      temp_min_c: data.daily.temperature_2m_min[i] ?? null,
    }));

    const nextRain = days.find((d) => (d.precipitation_mm ?? 0) >= 1);

    res.json({
      location_name: locationName,
      latitude,
      longitude,
      next_rain_date: nextRain?.date ?? null,
      days,
      data_source: "open-meteo",
    });
  })
);

export default router;

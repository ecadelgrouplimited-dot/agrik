import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth, optionalAuth } from "../../middleware/auth.js";
import { upload, publicUrlFor } from "../../middleware/upload.js";
import { badRequest, notFound } from "../../lib/http-error.js";

const router = Router();

function listingOut(listing: {
  id: number;
  userId: string | null;
  role: string;
  crop: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  currency: string;
  grade: string | null;
  description: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  mediaUrls: string[];
  availabilityStart: Date | null;
  availabilityEnd: Date | null;
  status: string;
  district: string | null;
  parish: string | null;
  latitude: number | null;
  longitude: number | null;
  geometryWkt: string | null;
  createdAt: Date;
}) {
  return {
    id: listing.id,
    user_id: listing.userId,
    role: listing.role,
    crop: listing.crop,
    quantity: listing.quantity,
    unit: listing.unit,
    price: listing.price,
    currency: listing.currency,
    grade: listing.grade,
    description: listing.description,
    contact_name: listing.contactName,
    contact_phone: listing.contactPhone,
    contact_whatsapp: listing.contactWhatsapp,
    media_urls: listing.mediaUrls,
    availability_start: listing.availabilityStart?.toISOString() ?? null,
    availability_end: listing.availabilityEnd?.toISOString() ?? null,
    status: listing.status,
    location: { district: listing.district, parish: listing.parish, latitude: listing.latitude, longitude: listing.longitude },
    created_at: listing.createdAt.toISOString(),
  };
}

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [listings, offers, services, alerts] = await Promise.all([
      prisma.marketListing.count(),
      prisma.marketOffer.count(),
      prisma.marketService.count(),
      prisma.marketAlert.count(),
    ]);
    res.json({ listings, offers, services, alerts });
  })
);

router.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "").trim();
    const role = String(req.query.role ?? "").trim();
    const phone = String(req.query.phone ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const items = await prisma.marketListing.findMany({
      where: {
        status: status || undefined,
        role: (role as "seller" | "buyer") || undefined,
        contactPhone: phone || undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ items: items.map(listingOut) });
  })
);

router.get(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    const listing = await prisma.marketListing.findUnique({ where: { id: Number(req.params.id) } });
    if (!listing) throw notFound("Listing not found.");
    res.json(listingOut(listing));
  })
);

const locationSchema = z.object({
  district: z.string().nullable().optional(),
  parish: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  geometry_wkt: z.string().nullable().optional(),
});

const createListingSchema = z.object({
  phone: z.string().min(6),
  role: z.enum(["seller", "buyer"]),
  crop: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().optional(),
  grade: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_whatsapp: z.string().nullable().optional(),
  media_urls: z.array(z.string()).nullable().optional(),
  availability_start: z.string().nullable().optional(),
  availability_end: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  location: locationSchema.nullable().optional(),
});

router.post(
  "/listings",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const body = createListingSchema.parse(req.body);
    const listing = await prisma.marketListing.create({
      data: {
        userId: req.userId ?? null,
        role: body.role,
        crop: body.crop,
        quantity: body.quantity ?? null,
        unit: body.unit ?? null,
        price: body.price ?? null,
        currency: body.currency ?? "UGX",
        grade: body.grade ?? null,
        description: body.description ?? null,
        contactName: body.contact_name ?? null,
        contactPhone: body.contact_phone ?? body.phone,
        contactWhatsapp: body.contact_whatsapp ?? null,
        mediaUrls: body.media_urls ?? [],
        availabilityStart: body.availability_start ? new Date(body.availability_start) : null,
        availabilityEnd: body.availability_end ? new Date(body.availability_end) : null,
        status: body.status ?? "open",
        district: body.location?.district ?? null,
        parish: body.location?.parish ?? null,
        latitude: body.location?.latitude ?? null,
        longitude: body.location?.longitude ?? null,
        geometryWkt: body.location?.geometry_wkt ?? null,
      },
    });
    res.json(listingOut(listing));
  })
);

const createOfferSchema = z.object({
  phone: z.string().min(6),
  listing_id: z.number(),
  price: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
});

router.post(
  "/offers",
  asyncHandler(async (req, res) => {
    const body = createOfferSchema.parse(req.body);
    const listing = await prisma.marketListing.findUnique({ where: { id: body.listing_id } });
    if (!listing) throw notFound("Listing not found.");

    const offer = await prisma.marketOffer.create({
      data: {
        listingId: body.listing_id,
        phone: body.phone,
        price: body.price ?? null,
        quantity: body.quantity ?? null,
      },
    });
    res.json({
      id: offer.id,
      listing_id: offer.listingId,
      price: offer.price,
      quantity: offer.quantity,
      status: offer.status,
      created_at: offer.createdAt.toISOString(),
    });
  })
);

router.get(
  "/offers",
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone ?? "").trim();
    const listingId = req.query.listing_id ? Number(req.query.listing_id) : undefined;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const items = await prisma.marketOffer.findMany({
      where: { phone: phone || undefined, listingId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({
      items: items.map((o) => ({
        id: o.id,
        listing_id: o.listingId,
        price: o.price,
        quantity: o.quantity,
        status: o.status,
        created_at: o.createdAt.toISOString(),
      })),
    });
  })
);

router.post(
  "/media/upload",
  requireAuth,
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("No files uploaded.");
    res.json({
      items: files.map((file) => ({
        filename: file.originalname,
        url: publicUrlFor(file.filename),
        content_type: file.mimetype,
        size_bytes: file.size,
      })),
    });
  })
);

function serviceOut(service: {
  id: number;
  userId: string | null;
  serviceType: string;
  description: string | null;
  mediaUrls: string[];
  coverageRadiusKm: number | null;
  price: number | null;
  currency: string;
  status: string;
  district: string | null;
  parish: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: service.id,
    user_id: service.userId,
    service_type: service.serviceType,
    description: service.description,
    media_urls: service.mediaUrls,
    coverage_radius_km: service.coverageRadiusKm,
    price: service.price,
    currency: service.currency,
    status: service.status,
    location: { district: service.district, parish: service.parish, latitude: service.latitude, longitude: service.longitude },
    created_at: service.createdAt.toISOString(),
    updated_at: service.updatedAt.toISOString(),
  };
}

router.get(
  "/services",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const items = await prisma.marketService.findMany({
      where: { status: status || undefined },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ items: items.map(serviceOut) });
  })
);

const createServiceSchema = z.object({
  service_type: z.string().min(1),
  description: z.string().nullable().optional(),
  media_urls: z.array(z.string()).nullable().optional(),
  coverage_radius_km: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().optional(),
  status: z.string().nullable().optional(),
  location: locationSchema.nullable().optional(),
});

router.post(
  "/services",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createServiceSchema.parse(req.body);
    const service = await prisma.marketService.create({
      data: {
        userId: req.userId!,
        serviceType: body.service_type,
        description: body.description ?? null,
        mediaUrls: body.media_urls ?? [],
        coverageRadiusKm: body.coverage_radius_km ?? null,
        price: body.price ?? null,
        currency: body.currency ?? "UGX",
        status: body.status ?? "active",
        district: body.location?.district ?? null,
        parish: body.location?.parish ?? null,
        latitude: body.location?.latitude ?? null,
        longitude: body.location?.longitude ?? null,
        geometryWkt: body.location?.geometry_wkt ?? null,
      },
    });
    res.json(serviceOut(service));
  })
);

const updateServiceSchema = createServiceSchema.partial();

router.patch(
  "/services/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = updateServiceSchema.parse(req.body);
    const existing = await prisma.marketService.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing || existing.userId !== req.userId) throw notFound("Service not found.");

    const service = await prisma.marketService.update({
      where: { id: Number(req.params.id) },
      data: {
        serviceType: body.service_type ?? undefined,
        description: body.description,
        mediaUrls: body.media_urls ?? undefined,
        coverageRadiusKm: body.coverage_radius_km,
        price: body.price,
        currency: body.currency ?? undefined,
        status: body.status ?? undefined,
        district: body.location?.district,
        parish: body.location?.parish,
        latitude: body.location?.latitude,
        longitude: body.location?.longitude,
        geometryWkt: body.location?.geometry_wkt,
      },
    });
    res.json(serviceOut(service));
  })
);

router.delete(
  "/services/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.marketService.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing || existing.userId !== req.userId) throw notFound("Service not found.");
    await prisma.marketService.delete({ where: { id: Number(req.params.id) } });
    res.json({ status: "deleted" });
  })
);

router.get(
  "/prices",
  asyncHandler(async (req, res) => {
    const crop = String(req.query.crop ?? "").trim();
    const district = String(req.query.district ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 200), 1000);
    const items = await prisma.marketPrice.findMany({
      where: { crop: crop || undefined, district: district || undefined },
      orderBy: { capturedAt: "desc" },
      take: limit,
    });
    res.json({
      items: items.map((p) => ({
        id: p.id,
        crop: p.crop,
        market: p.market,
        district: p.district,
        price: p.price,
        currency: p.currency,
        source: p.source,
        captured_at: p.capturedAt.toISOString(),
      })),
    });
  })
);

router.get(
  "/intel",
  asyncHandler(async (req, res) => {
    const crop = String(req.query.crop ?? "").trim();
    const recent = await prisma.marketPrice.findMany({
      where: { crop: crop || undefined },
      orderBy: { capturedAt: "desc" },
      take: 500,
    });

    const byCrop = new Map<string, typeof recent>();
    for (const row of recent) {
      const bucket = byCrop.get(row.crop) ?? [];
      bucket.push(row);
      byCrop.set(row.crop, bucket);
    }

    const predictions: { crop: string; direction: string; confidence: number; latest_price: number; currency: string }[] = [];
    const insights: string[] = [];

    for (const [cropName, rows] of byCrop.entries()) {
      if (rows.length === 0) continue;
      const latest = rows[0];
      const previous = rows[1];
      let direction = "stable";
      let confidence = 0.5;
      if (previous) {
        const delta = latest.price - previous.price;
        const pct = previous.price !== 0 ? delta / previous.price : 0;
        direction = pct > 0.02 ? "rising" : pct < -0.02 ? "falling" : "stable";
        confidence = Math.min(0.95, 0.5 + Math.abs(pct) * 2);
        if (direction !== "stable") {
          insights.push(
            `${cropName} price is ${direction} (${(pct * 100).toFixed(1)}% vs previous reading) at ${latest.market ?? "market"}.`
          );
        }
      }
      predictions.push({
        crop: cropName,
        direction,
        confidence: Number(confidence.toFixed(2)),
        latest_price: latest.price,
        currency: latest.currency,
      });
    }

    res.json({
      prices: recent.map((p) => ({
        id: p.id,
        crop: p.crop,
        market: p.market,
        district: p.district,
        price: p.price,
        currency: p.currency,
        source: p.source,
        captured_at: p.capturedAt.toISOString(),
      })),
      predictions,
      insights,
      updated_at: recent[0]?.capturedAt.toISOString() ?? null,
      source: "agrik_market_prices",
    });
  })
);

router.get(
  "/alerts",
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const items = await prisma.marketAlert.findMany({
      where: { phone: phone || undefined },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({
      items: items.map((a) => ({
        id: a.id,
        phone: a.phone,
        alert_type: a.alertType,
        crop: a.crop,
        threshold: a.threshold,
        channel: a.channel,
        active: a.active,
        min_interval_hours: a.minIntervalHours,
        location: { district: a.district, parish: a.parish },
        created_at: a.createdAt.toISOString(),
      })),
    });
  })
);

export default router;

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import { notFound } from "../../lib/http-error.js";
import { CROPS, CURRENCIES, PRICE_SOURCES, SERVICE_TYPES, ALERT_TYPES, ALERT_CHANNELS } from "../reference/config.js";

const router = Router();
router.use(requireAdminAuth);

async function logActivity(adminId: string, action: string, details: Record<string, unknown>, ip: string | undefined) {
  await prisma.adminActivity.create({
    data: { adminId, action, details: details as Prisma.InputJsonValue, ipAddress: ip ?? null },
  });
}

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [usersTotal, usersVerified, listings, offers, services, alerts, prices] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { verificationStatus: "verified" } }),
      prisma.marketListing.count(),
      prisma.marketOffer.count(),
      prisma.marketService.count(),
      prisma.marketAlert.count(),
      prisma.marketPrice.count(),
    ]);
    res.json({
      users_total: usersTotal,
      users_verified: usersVerified,
      users_pending: usersTotal - usersVerified,
      listings,
      offers,
      services,
      alerts,
      prices,
    });
  })
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { identity: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : undefined,
      include: { identity: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const items = await Promise.all(
      users.map(async (user) => {
        const [marketListings, marketAlerts, marketOffers, chatMessages, lastChat, recentListings] = await Promise.all([
          prisma.marketListing.count({ where: { userId: user.id } }),
          prisma.marketAlert.count({ where: { phone: user.phone } }),
          prisma.marketOffer.count({ where: { phone: user.phone } }),
          prisma.chatMessage.count({ where: { userId: user.id } }),
          prisma.chatMessage.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
          prisma.marketListing.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }),
        ]);

        return {
          id: user.id,
          phone: user.phone,
          role: user.role,
          status: user.status,
          verification_status: user.verificationStatus,
          full_name: user.identity?.fullName ?? null,
          email: user.email,
          district: user.identity?.district ?? null,
          parish: user.identity?.parish ?? null,
          organization_name: user.identity?.organizationName ?? null,
          onboarding_stage: user.identity?.onboardingStage ?? null,
          crops: user.identity?.crops ?? [],
          service_categories: user.identity?.serviceCategories ?? [],
          focus_crops: user.identity?.focusCrops ?? [],
          market_listings: marketListings,
          market_alerts: marketAlerts,
          market_offers: marketOffers,
          chat_messages: chatMessages,
          last_chat_at: lastChat?.createdAt.toISOString() ?? null,
          recent_activity: recentListings.map((listing) => ({
            action: "listing_created",
            created_at: listing.createdAt.toISOString(),
            detail_summary: `${listing.crop} listing (${listing.status})`,
          })),
          created_at: user.createdAt.toISOString(),
          updated_at: user.updatedAt.toISOString(),
          last_login_at: user.lastLoginAt?.toISOString() ?? null,
        };
      })
    );

    res.json(items);
  })
);

const updateUserSchema = z.object({
  role: z.enum(["farmer", "buyer", "offtaker", "service_provider", "input_supplier"]).optional(),
  status: z.string().optional(),
  verification_status: z.string().optional(),
});

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        role: body.role,
        status: body.status,
        verificationStatus: body.verification_status,
      },
    });
    await logActivity(req.adminId!, "user_updated", { userId: user.id, ...body }, req.ip);
    res.json({ status: "updated" });
  })
);

router.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "").trim();
    const items = await prisma.marketListing.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ items });
  })
);

const updateListingSchema = z.object({
  status: z.string().optional(),
  price: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  currency: z.string().optional(),
  grade: z.string().nullable().optional(),
});

router.patch(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    const body = updateListingSchema.parse(req.body);
    const listing = await prisma.marketListing.update({
      where: { id: Number(req.params.id) },
      data: body,
    });
    await logActivity(req.adminId!, "listing_updated", { listingId: listing.id, ...body }, req.ip);
    res.json({ status: "updated" });
  })
);

router.get(
  "/alerts",
  asyncHandler(async (_req, res) => {
    const items = await prisma.marketAlert.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    res.json({ items });
  })
);

const alertSchema = z.object({
  phone: z.string().min(6),
  alert_type: z.string().min(1),
  crop: z.string().nullable().optional(),
  threshold: z.number().nullable().optional(),
  channel: z.string().nullable().optional(),
  active: z.boolean().nullable().optional(),
  min_interval_hours: z.number().nullable().optional(),
  location: z.object({ district: z.string().nullable().optional(), parish: z.string().nullable().optional() }).optional(),
});

router.post(
  "/alerts",
  asyncHandler(async (req, res) => {
    const body = alertSchema.parse(req.body);
    const alert = await prisma.marketAlert.create({
      data: {
        phone: body.phone,
        alertType: body.alert_type,
        crop: body.crop ?? null,
        threshold: body.threshold ?? null,
        channel: body.channel ?? "sms",
        active: body.active ?? true,
        minIntervalHours: body.min_interval_hours ?? null,
        district: body.location?.district ?? null,
        parish: body.location?.parish ?? null,
      },
    });
    await logActivity(req.adminId!, "alert_created", { alertId: alert.id }, req.ip);
    res.json({ status: "created", id: alert.id });
  })
);

const alertBulkSchema = alertSchema.omit({ phone: true }).extend({ phones: z.array(z.string().min(6)).min(1) });

router.post(
  "/alerts/bulk",
  asyncHandler(async (req, res) => {
    const body = alertBulkSchema.parse(req.body);
    const created = await prisma.marketAlert.createMany({
      data: body.phones.map((phone) => ({
        phone,
        alertType: body.alert_type,
        crop: body.crop ?? null,
        threshold: body.threshold ?? null,
        channel: body.channel ?? "sms",
        active: body.active ?? true,
        minIntervalHours: body.min_interval_hours ?? null,
        district: body.location?.district ?? null,
        parish: body.location?.parish ?? null,
      })),
    });
    await logActivity(req.adminId!, "alert_bulk_created", { count: created.count }, req.ip);
    res.json({ created: created.count });
  })
);

const alertUpdateSchema = z.object({
  alert_type: z.string().optional(),
  crop: z.string().nullable().optional(),
  threshold: z.number().nullable().optional(),
  channel: z.string().nullable().optional(),
  active: z.boolean().nullable().optional(),
  min_interval_hours: z.number().nullable().optional(),
  location: z.object({ district: z.string().nullable().optional(), parish: z.string().nullable().optional() }).optional(),
});

router.patch(
  "/alerts/:id",
  asyncHandler(async (req, res) => {
    const body = alertUpdateSchema.parse(req.body);
    const alert = await prisma.marketAlert.update({
      where: { id: Number(req.params.id) },
      data: {
        alertType: body.alert_type,
        crop: body.crop,
        threshold: body.threshold,
        channel: body.channel,
        active: body.active ?? undefined,
        minIntervalHours: body.min_interval_hours,
        district: body.location?.district,
        parish: body.location?.parish,
      },
    });
    await logActivity(req.adminId!, "alert_updated", { alertId: alert.id }, req.ip);
    res.json({ status: "updated" });
  })
);

router.delete(
  "/alerts/:id",
  asyncHandler(async (req, res) => {
    await prisma.marketAlert.delete({ where: { id: Number(req.params.id) } });
    await logActivity(req.adminId!, "alert_deleted", { alertId: Number(req.params.id) }, req.ip);
    res.json({ status: "deleted" });
  })
);

router.get(
  "/prices",
  asyncHandler(async (_req, res) => {
    const items = await prisma.marketPrice.findMany({ orderBy: { capturedAt: "desc" }, take: 500 });
    res.json({ items });
  })
);

const priceSchema = z.object({
  crop: z.string().min(1),
  market: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  price: z.number(),
  currency: z.string().optional(),
  source: z.string().nullable().optional(),
  captured_at: z.string().nullable().optional(),
});

router.post(
  "/prices",
  asyncHandler(async (req, res) => {
    const body = priceSchema.parse(req.body);
    const price = await prisma.marketPrice.create({
      data: {
        crop: body.crop,
        market: body.market ?? null,
        district: body.district ?? null,
        price: body.price,
        currency: body.currency ?? "UGX",
        source: body.source ?? null,
        capturedAt: body.captured_at ? new Date(body.captured_at) : new Date(),
      },
    });
    await logActivity(req.adminId!, "price_created", { priceId: price.id }, req.ip);
    res.json({ status: "created", id: price.id });
  })
);

const priceUpdateSchema = priceSchema.partial();

router.patch(
  "/prices/:id",
  asyncHandler(async (req, res) => {
    const body = priceUpdateSchema.parse(req.body);
    const price = await prisma.marketPrice.update({
      where: { id: Number(req.params.id) },
      data: {
        crop: body.crop,
        market: body.market,
        district: body.district,
        price: body.price,
        currency: body.currency ?? undefined,
        source: body.source,
        capturedAt: body.captured_at ? new Date(body.captured_at) : undefined,
      },
    });
    await logActivity(req.adminId!, "price_updated", { priceId: price.id }, req.ip);
    res.json({ status: "updated" });
  })
);

router.get(
  "/services",
  asyncHandler(async (_req, res) => {
    const items = await prisma.marketService.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    res.json({ items });
  })
);

const adminServiceSchema = z.object({
  service_type: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().optional(),
  status: z.string().nullable().optional(),
});

router.post(
  "/services",
  asyncHandler(async (req, res) => {
    const body = adminServiceSchema.parse(req.body);
    const service = await prisma.marketService.create({
      data: {
        serviceType: body.service_type,
        description: body.description ?? null,
        price: body.price ?? null,
        currency: body.currency ?? "UGX",
        status: body.status ?? "active",
      },
    });
    await logActivity(req.adminId!, "service_created", { serviceId: service.id }, req.ip);
    res.json({ status: "created", id: service.id });
  })
);

router.patch(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const body = adminServiceSchema.partial().parse(req.body);
    const service = await prisma.marketService.update({
      where: { id: Number(req.params.id) },
      data: {
        serviceType: body.service_type,
        description: body.description,
        price: body.price,
        currency: body.currency ?? undefined,
        status: body.status ?? undefined,
      },
    });
    await logActivity(req.adminId!, "service_updated", { serviceId: service.id }, req.ip);
    res.json({ status: "updated" });
  })
);

router.delete(
  "/services/:id",
  asyncHandler(async (req, res) => {
    await prisma.marketService.delete({ where: { id: Number(req.params.id) } });
    await logActivity(req.adminId!, "service_deleted", { serviceId: Number(req.params.id) }, req.ip);
    res.json({ status: "deleted" });
  })
);

const seedSchema = z.object({ service_types: z.array(z.string()).nullable().optional() });

router.post(
  "/services/seed",
  asyncHandler(async (req, res) => {
    const body = seedSchema.parse(req.body);
    const types = body.service_types?.length ? body.service_types : SERVICE_TYPES;
    const created = await prisma.marketService.createMany({
      data: types.map((serviceType) => ({ serviceType, status: "active" })),
    });
    await logActivity(req.adminId!, "services_seeded", { count: created.count }, req.ip);
    res.json({ created: created.count });
  })
);

router.get(
  "/metadata",
  asyncHandler(async (_req, res) => {
    const [districts, users] = await Promise.all([
      prisma.district.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ select: { id: true, phone: true, role: true }, take: 1000 }),
    ]);
    const parishes = await prisma.parish.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 2000 });
    const markets = await prisma.marketPrice
      .findMany({ select: { market: true }, distinct: ["market"] })
      .then((rows) => rows.map((r) => r.market).filter((m): m is string => Boolean(m)));

    res.json({
      crops: CROPS,
      districts: districts.map((d) => d.name),
      parishes: Array.from(new Set(parishes.map((p) => p.name))),
      markets,
      currencies: CURRENCIES,
      price_sources: PRICE_SOURCES,
      service_types: SERVICE_TYPES,
      alert_types: ALERT_TYPES,
      channels: ALERT_CHANNELS,
      users,
    });
  })
);

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const items = await prisma.adminActivity.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    res.json({
      items: items.map((item) => ({
        id: item.id,
        admin_id: item.adminId,
        action: item.action,
        details: item.details,
        ip_address: item.ipAddress,
        created_at: item.createdAt.toISOString(),
      })),
    });
  })
);

router.use((_req, _res, next) => next(notFound()));

export default router;

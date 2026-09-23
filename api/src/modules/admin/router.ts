import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";
import { listingOut } from "../market/router.js";
import {
  CROPS,
  CURRENCIES,
  PRICE_SOURCES,
  SERVICE_TYPES,
  ALERT_TYPES,
  ALERT_CHANNELS,
  BILLING_PERIODS,
  DEFAULT_SERVICE_PLANS,
  DEFAULT_PRICE_SEED,
  DEFAULT_PRICE_DISTRICTS,
} from "../reference/config.js";

const router = Router();
router.use(requireAdminAuth);

/**
 * The console reads the same snake_case shape the rest of the API speaks. These endpoints
 * used to hand back raw Prisma rows, so every field the UI read by its documented name
 * came back undefined — which crashed the alerts and overview pages outright.
 */
function alertOut(alert: {
  id: number;
  phone: string;
  alertType: string;
  crop: string | null;
  threshold: number | null;
  channel: string | null;
  active: boolean;
  minIntervalHours: number | null;
  district: string | null;
  parish: string | null;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: alert.id,
    target_phone: alert.phone,
    alert_type: alert.alertType,
    crop: alert.crop,
    threshold: alert.threshold,
    channel: alert.channel,
    active: alert.active,
    min_interval_hours: alert.minIntervalHours ?? 0,
    location: { district: alert.district, parish: alert.parish },
    last_notified_at: alert.lastTriggeredAt?.toISOString() ?? null,
    created_at: alert.createdAt.toISOString(),
  };
}

function priceOut(price: {
  id: number;
  crop: string;
  market: string | null;
  district: string | null;
  price: number;
  currency: string;
  source: string | null;
  capturedAt: Date;
}) {
  return {
    id: price.id,
    crop: price.crop,
    market: price.market,
    district: price.district,
    price: price.price,
    currency: price.currency,
    source: price.source,
    captured_at: price.capturedAt.toISOString(),
  };
}


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
      // The console's Services section is the plan catalog, so its count is plans, not
      // the provider offers in the marketplace.
      prisma.servicePlan.count(),
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
    // The console sends role, status, verification and a page window on every request.
    // Only `search` used to be read here, so its filters and its Prev/Next were inert.
    const search = String(req.query.search ?? "").trim();
    const role = String(req.query.role ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const verificationStatus = String(req.query.verification_status ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit ?? 500) || 500, 1), 500);
    const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { identity: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (role) where.role = role as Prisma.UserWhereInput["role"];
    if (status) where.status = status;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const users = await prisma.user.findMany({
      where,
      include: { identity: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
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
    res.json({ items: items.map(listingOut) });
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
    res.json({ items: items.map(alertOut) });
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
    res.json({ items: items.map(priceOut) });
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

function servicePlanOut(plan: {
  id: number;
  code: string;
  name: string;
  summary: string | null;
  price: number;
  currency: string;
  billingPeriod: string;
  durationDays: number | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    summary: plan.summary,
    price: plan.price,
    currency: plan.currency,
    billing_period: plan.billingPeriod,
    duration_days: plan.durationDays,
    status: plan.status,
    sort_order: plan.sortOrder,
    created_at: plan.createdAt.toISOString(),
    updated_at: plan.updatedAt.toISOString(),
  };
}

// These routes manage AGRIK's own plan catalog. They used to write into MarketService,
// which published every plan to the public marketplace feed and meant nothing created
// here could ever be subscribed to.
const priceSeedSchema = z.object({
  districts: z.array(z.string()).nullable().optional(),
  crops: z.array(z.string()).nullable().optional(),
});

router.post(
  "/prices/seed",
  asyncHandler(async (req, res) => {
    const body = priceSeedSchema.parse(req.body);
    const districts = body.districts?.length
      ? body.districts.map((name) => ({ name, factor: 1 }))
      : DEFAULT_PRICE_DISTRICTS;
    const crops = body.crops?.length
      ? DEFAULT_PRICE_SEED.filter((row) => body.crops!.includes(row.crop))
      : DEFAULT_PRICE_SEED;

    // Idempotent on crop+district: seeding twice must not double the board, and must
    // never overwrite a price someone has since corrected.
    const existing = await prisma.marketPrice.findMany({ select: { crop: true, district: true } });
    const have = new Set(existing.map((row) => `${row.crop}|${row.district}`));

    const rows = crops.flatMap((row) =>
      districts
        .filter((district) => !have.has(`${row.crop}|${district.name}`))
        .map((district) => ({
          crop: row.crop,
          district: district.name,
          market: `${district.name} main market`,
          // Rounded to the nearest 50 so the board reads like money, not a calculation.
          price: Math.round((row.price * district.factor) / 50) * 50,
          currency: "UGX",
          // Self-labelling: the console and the farmer view both show this.
          source: "placeholder",
        }))
    );

    const created = await prisma.marketPrice.createMany({ data: rows });
    await logActivity(req.adminId!, "prices_seeded", { count: created.count }, req.ip);
    res.json({ created: created.count, skipped: crops.length * districts.length - created.count });
  })
);

router.get(
  "/services",
  asyncHandler(async (_req, res) => {
    const items = await prisma.servicePlan.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 500 });
    res.json({ items: items.map(servicePlanOut) });
  })
);

const planSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores."),
  name: z.string().min(1),
  summary: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  currency: z.string().optional(),
  billing_period: z.enum(BILLING_PERIODS),
  duration_days: z.number().int().positive().nullable().optional(),
  status: z.string().optional(),
  sort_order: z.number().int().optional(),
});

/** `seasonal` and `one_off` are not calendar intervals, so they need an explicit term. */
function requireDurationWhereNeeded(period: string, durationDays: number | null | undefined) {
  if ((period === "seasonal" || period === "one_off") && !durationDays) {
    throw badRequest(`A ${period.replace("_", "-")} plan needs a duration in days.`);
  }
}

router.post(
  "/services",
  asyncHandler(async (req, res) => {
    const body = planSchema.parse(req.body);
    requireDurationWhereNeeded(body.billing_period, body.duration_days);

    const existing = await prisma.servicePlan.findUnique({ where: { code: body.code } });
    if (existing) throw conflict(`A plan with the code "${body.code}" already exists.`);

    const plan = await prisma.servicePlan.create({
      data: {
        code: body.code,
        name: body.name,
        summary: body.summary ?? null,
        price: body.price,
        currency: body.currency ?? "UGX",
        billingPeriod: body.billing_period,
        durationDays: body.duration_days ?? null,
        status: body.status ?? "active",
        sortOrder: body.sort_order ?? 0,
      },
    });
    await logActivity(req.adminId!, "service_created", { planId: plan.id, code: plan.code }, req.ip);
    res.json({ status: "created", id: plan.id });
  })
);

router.patch(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const body = planSchema.partial().parse(req.body);
    const current = await prisma.servicePlan.findUnique({ where: { id: Number(req.params.id) } });
    if (!current) throw notFound("Plan not found.");

    const period = body.billing_period ?? current.billingPeriod;
    const duration = body.duration_days === undefined ? current.durationDays : body.duration_days;
    requireDurationWhereNeeded(period, duration);

    // The code is what live subscriptions point at, so it cannot be edited once a plan
    // exists. Retire the plan and add a new one instead.
    if (body.code && body.code !== current.code) {
      throw badRequest("A plan's code cannot change once it exists — retire it and add a new one.");
    }

    const plan = await prisma.servicePlan.update({
      where: { id: current.id },
      data: {
        name: body.name,
        summary: body.summary,
        price: body.price,
        currency: body.currency ?? undefined,
        billingPeriod: body.billing_period ?? undefined,
        durationDays: body.duration_days === undefined ? undefined : body.duration_days,
        status: body.status ?? undefined,
        sortOrder: body.sort_order ?? undefined,
      },
    });
    await logActivity(req.adminId!, "service_updated", { planId: plan.id, code: plan.code }, req.ip);
    res.json({ status: "updated" });
  })
);

router.delete(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const plan = await prisma.servicePlan.findUnique({ where: { id: Number(req.params.id) } });
    if (!plan) throw notFound("Plan not found.");

    // Deleting a plan someone is paying for would orphan their subscription. Retire it.
    const live = await prisma.subscription.count({ where: { plan: plan.code, status: "active" } });
    if (live > 0) {
      throw conflict(`${live} active subscription(s) use this plan. Set it to retired instead of deleting it.`);
    }

    await prisma.servicePlan.delete({ where: { id: plan.id } });
    await logActivity(req.adminId!, "service_deleted", { planId: plan.id, code: plan.code }, req.ip);
    res.json({ status: "deleted" });
  })
);

router.post(
  "/services/seed",
  asyncHandler(async (_req, res) => {
    // Idempotent: skips codes that already exist, so it is safe to press twice.
    const existing = await prisma.servicePlan.findMany({ select: { code: true } });
    const have = new Set(existing.map((plan) => plan.code));
    const missing = DEFAULT_SERVICE_PLANS.filter((plan) => !have.has(plan.code));

    const created = await prisma.servicePlan.createMany({
      data: missing.map((plan) => ({
        code: plan.code,
        name: plan.name,
        summary: plan.summary,
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        durationDays: plan.durationDays ?? null,
        sortOrder: plan.sortOrder,
      })),
    });
    await logActivity(_req.adminId!, "services_seeded", { count: created.count }, _req.ip);
    res.json({ created: created.count, skipped: DEFAULT_SERVICE_PLANS.length - created.count });
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

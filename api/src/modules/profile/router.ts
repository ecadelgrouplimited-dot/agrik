import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { notFound } from "../../lib/http-error.js";

const router = Router();
router.use(requireAuth);

function toSettingsOut(settings: {
  userId: string;
  preferredLanguage: string | null;
  district: string | null;
  parish: string | null;
  smsOptIn: boolean;
  voiceOptIn: boolean;
  weatherAlerts: boolean;
  priceAlerts: boolean;
  updatedAt: Date;
}) {
  return {
    user_id: settings.userId,
    preferred_language: settings.preferredLanguage,
    district: settings.district,
    parish: settings.parish,
    sms_opt_in: settings.smsOptIn,
    voice_opt_in: settings.voiceOptIn,
    weather_alerts: settings.weatherAlerts,
    price_alerts: settings.priceAlerts,
    updated_at: settings.updatedAt.toISOString(),
  };
}

router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.userId! },
      update: {},
      create: { userId: req.userId! },
    });
    res.json(toSettingsOut(settings));
  })
);

const settingsSchema = z.object({
  preferred_language: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  parish: z.string().nullable().optional(),
  sms_opt_in: z.boolean().optional(),
  voice_opt_in: z.boolean().optional(),
  weather_alerts: z.boolean().optional(),
  price_alerts: z.boolean().optional(),
});

router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.userId! },
      update: {
        preferredLanguage: body.preferred_language,
        district: body.district,
        parish: body.parish,
        smsOptIn: body.sms_opt_in,
        voiceOptIn: body.voice_opt_in,
        weatherAlerts: body.weather_alerts,
        priceAlerts: body.price_alerts,
      },
      create: {
        userId: req.userId!,
        preferredLanguage: body.preferred_language,
        district: body.district,
        parish: body.parish,
        smsOptIn: body.sms_opt_in ?? false,
        voiceOptIn: body.voice_opt_in ?? false,
        weatherAlerts: body.weather_alerts ?? true,
        priceAlerts: body.price_alerts ?? true,
      },
    });
    res.json(toSettingsOut(settings));
  })
);

router.get(
  "/details",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw notFound("Account not found.");

    const [settings, farm, identity] = await Promise.all([
      prisma.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } }),
      prisma.farmProfile.upsert({ where: { farmerId: user.id }, update: {}, create: { farmerId: user.id } }),
      prisma.identity.findUnique({ where: { userId: user.id } }),
    ]);

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
        verification_status: user.verificationStatus,
        created_at: user.createdAt.toISOString(),
      },
      settings: toSettingsOut(settings),
      farm: {
        farmer_id: farm.farmerId,
        crops: farm.crops,
        planting_dates: farm.plantingDates,
        soil_profile: farm.soilProfile,
        climate_exposure: farm.climateExposure,
        yield_estimates: farm.yieldEstimates,
        updated_at: farm.updatedAt.toISOString(),
      },
      identity: identity
        ? {
            user_id: identity.userId,
            full_name: identity.fullName,
            district: identity.district,
            parish: identity.parish,
            crops: identity.crops,
            organization_name: identity.organizationName,
            service_categories: identity.serviceCategories,
            focus_crops: identity.focusCrops,
            onboarding_stage: identity.onboardingStage,
            updated_at: identity.updatedAt.toISOString(),
          }
        : null,
    });
  })
);

const detailsSchema = z.object({
  settings: settingsSchema.optional(),
  farm: z
    .object({
      crops: z.array(z.string()).optional(),
      planting_dates: z.array(z.unknown()).optional(),
      soil_profile: z.record(z.unknown()).optional(),
      climate_exposure: z.record(z.unknown()).optional(),
      yield_estimates: z.array(z.unknown()).optional(),
    })
    .optional(),
});

router.put(
  "/details",
  asyncHandler(async (req, res) => {
    const body = detailsSchema.parse(req.body);

    if (body.settings) {
      await prisma.userSettings.upsert({
        where: { userId: req.userId! },
        update: {
          preferredLanguage: body.settings.preferred_language,
          district: body.settings.district,
          parish: body.settings.parish,
          smsOptIn: body.settings.sms_opt_in,
          voiceOptIn: body.settings.voice_opt_in,
          weatherAlerts: body.settings.weather_alerts,
          priceAlerts: body.settings.price_alerts,
        },
        create: { userId: req.userId! },
      });
    }

    if (body.farm) {
      await prisma.farmProfile.upsert({
        where: { farmerId: req.userId! },
        update: {
          crops: body.farm.crops,
          plantingDates: body.farm.planting_dates as Prisma.InputJsonValue | undefined,
          soilProfile: body.farm.soil_profile as Prisma.InputJsonValue | undefined,
          climateExposure: body.farm.climate_exposure as Prisma.InputJsonValue | undefined,
          yieldEstimates: body.farm.yield_estimates as Prisma.InputJsonValue | undefined,
        },
        create: { farmerId: req.userId! },
      });
    }

    res.json({ status: "updated" });
  })
);

router.get(
  "/subscription",
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.userId! },
      orderBy: { startsAt: "desc" },
    });
    if (!subscription) throw notFound("No subscription found.");
    res.json({
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      starts_at: subscription.startsAt.toISOString(),
      ends_at: subscription.endsAt?.toISOString() ?? null,
      provider: subscription.provider,
      external_ref: subscription.externalRef,
    });
  })
);

router.get(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.userId! },
      orderBy: { startsAt: "desc" },
      take: limit,
    });
    res.json(
      subscriptions.map((s) => ({
        id: s.id,
        plan: s.plan,
        status: s.status,
        starts_at: s.startsAt.toISOString(),
        ends_at: s.endsAt?.toISOString() ?? null,
        provider: s.provider,
        external_ref: s.externalRef,
      }))
    );
  })
);

const startSubscriptionSchema = z.object({
  plan: z.string().min(1),
  status: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  external_ref: z.string().nullable().optional(),
});

router.post(
  "/subscription",
  asyncHandler(async (req, res) => {
    const body = startSubscriptionSchema.parse(req.body);
    const subscription = await prisma.subscription.create({
      data: {
        userId: req.userId!,
        plan: body.plan,
        status: body.status ?? "active",
        endsAt: body.ends_at ? new Date(body.ends_at) : null,
        provider: body.provider ?? null,
        externalRef: body.external_ref ?? null,
      },
    });
    res.json({
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      starts_at: subscription.startsAt.toISOString(),
      ends_at: subscription.endsAt?.toISOString() ?? null,
      provider: subscription.provider,
      external_ref: subscription.externalRef,
    });
  })
);

router.get(
  "/platform-services",
  asyncHandler(async (req, res) => {
    const items = await prisma.platformService.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      items.map((item) => ({
        id: item.id,
        service_type: item.serviceType,
        description: item.description,
        price: item.price,
        currency: item.currency,
        status: item.status,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      }))
    );
  })
);

export default router;

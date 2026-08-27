import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { CROPS, ONBOARDING_ROLES, SERVICE_CATEGORY_OPTIONS } from "./config.js";

const router = Router();

router.get(
  "/uganda/districts",
  asyncHandler(async (_req, res) => {
    const districts = await prisma.district.findMany({
      include: { _count: { select: { parishes: true } } },
      orderBy: { name: "asc" },
    });
    const items = districts.map((d) => ({ id: d.id, name: d.name, parish_count: d._count.parishes }));
    res.json({ country: "Uganda", total: items.length, items });
  })
);

router.get(
  "/uganda/parishes",
  asyncHandler(async (req, res) => {
    const districtName = String(req.query.district ?? "").trim();
    const district = districtName
      ? await prisma.district.findFirst({ where: { name: { equals: districtName, mode: "insensitive" } } })
      : null;

    const parishes = await prisma.parish.findMany({
      where: district ? { districtId: district.id } : undefined,
      include: { district: true },
      orderBy: { name: "asc" },
      take: 2000,
    });

    const items = parishes.map((p) => ({
      id: p.id,
      name: p.name,
      subcounty: p.subcounty,
      district: p.district.name,
      district_id: p.districtId,
    }));

    res.json({ country: "Uganda", district: districtName || null, total: items.length, items });
  })
);

router.get(
  "/uganda/live-map",
  asyncHandler(async (_req, res) => {
    const districts = await prisma.district.findMany();
    const identities = await prisma.identity.findMany({ include: { user: true } });

    const byDistrict = new Map<string, { name: string; lat: number | null; lng: number | null; users: typeof identities }>();
    for (const district of districts) {
      byDistrict.set(district.name.toLowerCase(), {
        name: district.name,
        lat: district.latitude,
        lng: district.longitude,
        users: [],
      });
    }
    for (const identity of identities) {
      const key = identity.district.toLowerCase();
      const bucket = byDistrict.get(key);
      if (bucket) bucket.users.push(identity);
    }

    const roleCounts = { farmers: 0, buyers: 0, offtakers: 0, service_providers: 0, input_suppliers: 0, admins: 0 };
    for (const identity of identities) {
      switch (identity.user.role) {
        case "farmer":
          roleCounts.farmers += 1;
          break;
        case "buyer":
          roleCounts.buyers += 1;
          break;
        case "offtaker":
          roleCounts.offtakers += 1;
          break;
        case "service_provider":
          roleCounts.service_providers += 1;
          break;
        case "input_supplier":
          roleCounts.input_suppliers += 1;
          break;
      }
    }
    const adminsTotal = await prisma.admin.count();
    roleCounts.admins = adminsTotal;

    const [listings, offerListings, services, alerts] = await Promise.all([
      prisma.marketListing.findMany({ select: { district: true } }),
      prisma.marketOffer.findMany({ select: { listing: { select: { district: true } } } }),
      prisma.marketService.findMany({ select: { district: true } }),
      prisma.marketAlert.findMany({ select: { district: true } }),
    ]);
    const offers = offerListings.map((row) => ({ district: row.listing.district }));

    const countByDistrict = (rows: { district: string | null }[]) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        if (!row.district) continue;
        const key = row.district.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };

    const listingsByDistrict = countByDistrict(listings);
    const offersByDistrict = countByDistrict(offers);
    const servicesByDistrict = countByDistrict(services);
    const alertsByDistrict = countByDistrict(alerts);

    let mappedDistricts = 0;
    let districtsWithCoords = 0;

    const markers = Array.from(byDistrict.values())
      .filter((bucket) => bucket.users.length > 0)
      .map((bucket) => {
        mappedDistricts += 1;
        if (bucket.lat != null && bucket.lng != null) districtsWithCoords += 1;

        const key = bucket.name.toLowerCase();
        const farmers = bucket.users.filter((u) => u.user.role === "farmer").length;
        const buyers = bucket.users.filter((u) => u.user.role === "buyer" || u.user.role === "offtaker").length;
        const offtakers = bucket.users.filter((u) => u.user.role === "offtaker").length;
        const serviceProviders = bucket.users.filter((u) => u.user.role === "service_provider").length;
        const inputSuppliers = bucket.users.filter((u) => u.user.role === "input_supplier").length;
        const dominant = [
          ["farmer", farmers],
          ["buyer", buyers],
          ["service_provider", serviceProviders],
          ["input_supplier", inputSuppliers],
        ].sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as string;

        return {
          district_id: districts.find((d) => d.name.toLowerCase() === key)?.id ?? null,
          district: bucket.name,
          latitude: bucket.lat ?? 0,
          longitude: bucket.lng ?? 0,
          users_total: bucket.users.length,
          farmers,
          buyers,
          offtakers,
          service_providers: serviceProviders,
          input_suppliers: inputSuppliers,
          listings: listingsByDistrict.get(key) ?? 0,
          offers: offersByDistrict.get(key) ?? 0,
          services: servicesByDistrict.get(key) ?? 0,
          alerts: alertsByDistrict.get(key) ?? 0,
          dominant_role: dominant,
          readiness: Math.min(100, bucket.users.length * 5),
          last_updated_at: new Date().toISOString(),
        };
      });

    res.json({
      country: "Uganda",
      generated_at: new Date().toISOString(),
      users_total: identities.length,
      active_districts: mappedDistricts,
      districts_total: districts.length,
      coordinate_coverage_pct: districts.length ? Math.round((districtsWithCoords / districts.length) * 100) : 0,
      roles: { total: identities.length, ...roleCounts },
      markers,
    });
  })
);

router.get(
  "/onboarding/options",
  asyncHandler(async (_req, res) => {
    res.json({
      roles: ONBOARDING_ROLES,
      service_categories: SERVICE_CATEGORY_OPTIONS,
      crops: CROPS,
      default_role: "farmer",
    });
  })
);

export default router;

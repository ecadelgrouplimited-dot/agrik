export const CROPS = [
  "maize",
  "beans",
  "cassava",
  "groundnut",
  "banana",
  "coffee",
  "rice",
  "sorghum",
  "millet",
  "sweet potato",
  "irish potato",
  "sunflower",
  "soybean",
  "cotton",
  "sesame",
  "cocoa",
  "tea",
  "sugarcane",
  "onion",
  "tomato",
];

export const CURRENCIES = ["UGX", "USD", "KES", "TZS"];

/**
 * `placeholder` marks a figure that was seeded to give the board shape, not one anyone
 * surveyed. It is shown to farmers alongside the price so a seeded number is never
 * mistaken for a real quote; replace it with a real source when the price is confirmed.
 */
export const PRICE_SOURCES = ["market_survey", "admin_manual", "partner_feed", "farmer_reported", "placeholder"];

/**
 * Starter price board: one row per major crop in the districts with the most activity.
 * Every figure is a plausible order of magnitude for a Ugandan farm gate in UGX/kg, NOT a
 * surveyed rate — that is why they seed with source "placeholder" and why the console
 * flags them. Replace them before anyone trades on them.
 */
export const DEFAULT_PRICE_SEED: { crop: string; price: number }[] = [
  { crop: "maize", price: 1200 },
  { crop: "beans", price: 3200 },
  { crop: "cassava", price: 800 },
  { crop: "groundnut", price: 5500 },
  { crop: "banana", price: 900 },
  { crop: "coffee", price: 9000 },
  { crop: "rice", price: 3500 },
  { crop: "sorghum", price: 1500 },
  { crop: "millet", price: 2600 },
  { crop: "sweet potato", price: 700 },
  { crop: "irish potato", price: 1800 },
  { crop: "sunflower", price: 2200 },
  { crop: "soybean", price: 2800 },
  { crop: "sesame", price: 6000 },
  { crop: "onion", price: 2500 },
  { crop: "tomato", price: 2000 },
];

/**
 * The districts the seeded board covers, each with a multiplier against the base price.
 * Produce is generally dearer near Kampala's demand and cheaper in the producing north,
 * which is the whole point of a price board: a flat number in every district would tell a
 * farmer nothing about where to sell. These ratios are illustrative, not surveyed.
 */
export const DEFAULT_PRICE_DISTRICTS: { name: string; factor: number }[] = [
  { name: "Kampala", factor: 1.15 },
  { name: "Masaka", factor: 1.04 },
  { name: "Mbarara", factor: 1.0 },
  { name: "Mbale", factor: 0.95 },
  { name: "Lira", factor: 0.9 },
  { name: "Gulu", factor: 0.86 },
];

export const SERVICE_TYPES = [
  "mechanization",
  "spraying",
  "transport",
  "storage",
  "irrigation",
  "seed_supply",
  "fertilizer_supply",
  "agrochemical_supply",
  "veterinary",
  "extension_advisory",
];

/**
 * How a plan is charged. `seasonal` and `one_off` are not calendar intervals, so they
 * carry their own `durationDays` instead of deriving an end date from the period.
 */
export const BILLING_PERIODS = ["monthly", "quarterly", "annual", "seasonal", "one_off"] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** Days added to a subscription's start date, per period. Null means "use durationDays". */
export const BILLING_PERIOD_DAYS: Record<BillingPeriod, number | null> = {
  monthly: 30,
  quarterly: 91,
  annual: 365,
  seasonal: null,
  one_off: null,
};

/**
 * Starter catalog. Seeded once so the console opens with something to edit rather than an
 * empty table; prices are placeholders for AGRIK to set, not researched market rates.
 */
export const DEFAULT_SERVICE_PLANS: {
  code: string;
  name: string;
  summary: string;
  price: number;
  billingPeriod: BillingPeriod;
  durationDays?: number;
  sortOrder: number;
}[] = [
  {
    code: "advisory_basic",
    name: "Basic Advisory",
    summary: "Weather and price alerts by SMS for one farm, plus the crop calendar.",
    price: 5000,
    billingPeriod: "monthly",
    sortOrder: 10,
  },
  {
    code: "advisory_advanced",
    name: "Advanced Advisory (Image Diagnosis)",
    summary: "Everything in Basic, plus AI photo diagnosis for pests and disease, and voice replies.",
    price: 15000,
    billingPeriod: "monthly",
    sortOrder: 20,
  },
  {
    code: "advisory_season",
    name: "Season Advisory",
    summary: "Advanced Advisory for one full planting season, paid once at the start.",
    price: 60000,
    billingPeriod: "seasonal",
    durationDays: 150,
    sortOrder: 30,
  },
  {
    code: "market_access",
    name: "Market Access",
    summary: "Priority placement in the marketplace and buyer introductions for your listings.",
    price: 40000,
    billingPeriod: "quarterly",
    sortOrder: 40,
  },
  {
    code: "advisory_annual",
    name: "Advisory Annual",
    summary: "Advanced Advisory billed once a year, at a discount against the monthly rate.",
    price: 150000,
    billingPeriod: "annual",
    sortOrder: 50,
  },
  {
    code: "diagnosis_single",
    name: "Single Image Diagnosis",
    summary: "One AI pest or disease diagnosis with an agronomist-reviewed action plan.",
    price: 3000,
    billingPeriod: "one_off",
    durationDays: 7,
    sortOrder: 60,
  },
];

export const ALERT_TYPES = ["price_threshold", "weather_risk", "pest_outbreak", "market_demand", "system"];

export const ALERT_CHANNELS = ["sms", "voice", "email", "push"];

export type OnboardingRoleOption = {
  id: string;
  label: string;
  description: string;
  required_fields: string[];
};

export const ONBOARDING_ROLES: OnboardingRoleOption[] = [
  {
    id: "farmer",
    label: "Farmer",
    description: "Sell produce and receive digital advisory.",
    required_fields: ["full_name", "phone", "district", "parish", "crops"],
  },
  {
    id: "service_provider",
    label: "Service provider",
    description: "Offer mechanization, spraying, transport, and related services.",
    required_fields: ["full_name", "phone", "district", "parish", "service_categories"],
  },
  {
    id: "input_supplier",
    label: "Input supplier",
    description: "Provide seeds, fertilizer, agrochemicals, and tools.",
    required_fields: ["full_name", "phone", "district", "parish", "organization_name"],
  },
  {
    id: "buyer",
    label: "Buyer",
    description: "Buy produce from farmers and publish demand.",
    required_fields: ["full_name", "phone", "district", "parish"],
  },
  {
    id: "offtaker",
    label: "Offtaker",
    description: "Run structured procurement and contract sourcing.",
    required_fields: ["full_name", "phone", "district", "parish", "organization_name"],
  },
];

export const SERVICE_CATEGORY_OPTIONS = [
  { id: "mechanization", label: "Mechanization" },
  { id: "spraying", label: "Spraying" },
  { id: "transport", label: "Transport" },
  { id: "storage", label: "Storage" },
  { id: "irrigation", label: "Irrigation" },
  { id: "veterinary", label: "Veterinary" },
  { id: "extension_advisory", label: "Extension advisory" },
];

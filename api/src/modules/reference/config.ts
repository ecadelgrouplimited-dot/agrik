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

export const PRICE_SOURCES = ["market_survey", "admin_manual", "partner_feed", "farmer_reported"];

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

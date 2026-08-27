import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router-dom";
import { Icon } from "../components/Visuals";
import { api } from "../lib/api";
import { useAuth } from "../state/auth";

export type ProfileDetails = {
  settings: {
    district?: string | null;
    parish?: string | null;
  };
  farm: {
    crops: string[];
  };
};

export type MarketLocation = {
  district?: string | null;
  parish?: string | null;
};

export type MarketListing = {
  id: number;
  userId: string;
  role: string;
  crop: string;
  quantity: number | null;
  unit: string;
  price: number | null;
  currency: string;
  grade: string;
  description: string;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  mediaUrls: string[];
  status: string;
  createdAt: string;
  location: MarketLocation;
};

export type MarketService = {
  id: number;
  serviceType: string;
  description: string;
  mediaUrls: string[];
  coverageRadiusKm: number | null;
  price: number | null;
  currency: string;
  status: string;
  createdAt: string;
  location: MarketLocation;
};

export type MarketPrediction = {
  crop: string;
  district: string;
  predictedPrice: number | null;
  currency: string;
  direction: "up" | "down" | "flat";
  confidence: number | null;
};

export type ListingFormState = {
  crop: string;
  quantity: string;
  unit: string;
  price: string;
  currency: string;
  grade: string;
  description: string;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  district: string;
  parish: string;
};

export const CROP_OPTIONS = [
  "Maize",
  "Beans",
  "Cassava",
  "Rice",
  "Groundnuts",
  "Sorghum",
  "Millet",
  "Bananas",
  "Coffee",
  "Cotton",
  "Soybeans",
  "Sunflower",
  "Tomatoes",
  "Onions",
  "Cabbage",
];

export const UNIT_OPTIONS = ["kg", "bags", "tons", "crates", "liters"];
export const CURRENCY_OPTIONS = ["UGX", "USD", "KES", "TZS"];
export const GRADE_OPTIONS = ["Premium", "Standard", "Mixed"];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toOptionalNumberInput(value: string): number | undefined {
  const parsed = toNumberValue(value);
  return parsed == null ? undefined : parsed;
}

function toMediaUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = toStringValue(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

export function formatDate(value: string): string {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString();
}

export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "UGX",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || "UGX"} ${value.toFixed(0)}`;
  }
}

function normalizeListing(raw: unknown): MarketListing | null {
  const data = asRecord(raw);
  const id = toNumberValue(data.id);
  if (id == null) return null;
  const location = asRecord(data.location);
  return {
    id,
    userId: toStringValue(data.user_id),
    role: toStringValue(data.role),
    crop: toStringValue(data.crop),
    quantity: toNumberValue(data.quantity),
    unit: toStringValue(data.unit),
    price: toNumberValue(data.price),
    currency: toStringValue(data.currency) || "UGX",
    grade: toStringValue(data.grade),
    description: toStringValue(data.description),
    contactName: toStringValue(data.contact_name),
    contactPhone: toStringValue(data.contact_phone),
    contactWhatsapp: toStringValue(data.contact_whatsapp),
    mediaUrls: toMediaUrlList(data.media_urls),
    status: toStringValue(data.status) || "open",
    createdAt: toStringValue(data.created_at),
    location: {
      district: toStringValue(location.district) || null,
      parish: toStringValue(location.parish) || null,
    },
  };
}

function normalizeService(raw: unknown): MarketService | null {
  const data = asRecord(raw);
  const id = toNumberValue(data.id);
  if (id == null) return null;
  const location = asRecord(data.location);
  return {
    id,
    serviceType: toStringValue(data.service_type),
    description: toStringValue(data.description),
    mediaUrls: toMediaUrlList(data.media_urls),
    coverageRadiusKm: toNumberValue(data.coverage_radius_km),
    price: toNumberValue(data.price),
    currency: toStringValue(data.currency) || "UGX",
    status: toStringValue(data.status) || "open",
    createdAt: toStringValue(data.created_at),
    location: {
      district: toStringValue(location.district) || null,
      parish: toStringValue(location.parish) || null,
    },
  };
}

function normalizePrediction(raw: unknown): MarketPrediction | null {
  const data = asRecord(raw);
  const crop = toStringValue(data.crop);
  if (!crop) return null;
  const directionValue = toStringValue(data.direction).toLowerCase();
  const direction: "up" | "down" | "flat" = directionValue === "up" || directionValue === "down" ? directionValue : "flat";
  return {
    crop,
    district: toStringValue(data.district),
    predictedPrice: toNumberValue(data.predicted_price),
    currency: toStringValue(data.currency) || "UGX",
    direction,
    confidence: toNumberValue(data.confidence),
  };
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export type PublishChecklistItem = { label: string; ready: boolean; detail: string };

export type FarmerMarketWorkspaceContext = {
  loading: boolean;
  saving: boolean;
  uploadingMedia: boolean;
  message: string | null;
  error: string | null;
  profileDistrict: string;
  profileCrops: string[];
  myListings: MarketListing[];
  marketListings: MarketListing[];
  serviceFeed: MarketService[];
  predictions: MarketPrediction[];
  listingFilterCrop: string;
  setListingFilterCrop: (value: string) => void;
  listingFilterDistrict: string;
  setListingFilterDistrict: (value: string) => void;
  listingDraft: ListingFormState;
  listingMediaUrls: string[];
  cropOptions: string[];
  discoverListings: MarketListing[];
  openMyListings: number;
  mediaReadyListings: number;
  publishChecklist: PublishChecklistItem[];
  publishReadyCount: number;
  leadPrediction: MarketPrediction | null;
  onDraftChange: <K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) => void;
  removeMedia: (url: string) => void;
  onUploadListingMedia: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCreateListing: (event: FormEvent) => void;
  loadHubData: () => void;
};

export function useMarketWorkspace() {
  return useOutletContext<FarmerMarketWorkspaceContext>();
}

const marketSections = [
  { path: "/dashboard/market", icon: "overview" as const, label: "Overview", subtitle: "Posture & signals" },
  { path: "/dashboard/market/sell", icon: "plus" as const, label: "Sell", subtitle: "Publish a listing" },
  { path: "/dashboard/market/listings", icon: "farm" as const, label: "My listings", subtitle: "Manage published records" },
  { path: "/dashboard/market/discover", icon: "listings" as const, label: "Discover", subtitle: "Browse open listings" },
  { path: "/dashboard/market/providers", icon: "services" as const, label: "Providers", subtitle: "Service directory" },
];

export default function FarmerMarketHub() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileDistrict, setProfileDistrict] = useState("");
  const [profileParish, setProfileParish] = useState("");
  const [profileCrops, setProfileCrops] = useState<string[]>([]);

  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [serviceFeed, setServiceFeed] = useState<MarketService[]>([]);
  const [predictions, setPredictions] = useState<MarketPrediction[]>([]);

  const [listingFilterCrop, setListingFilterCrop] = useState("");
  const [listingFilterDistrict, setListingFilterDistrict] = useState("");

  const [listingDraft, setListingDraft] = useState<ListingFormState>({
    crop: "",
    quantity: "",
    unit: "kg",
    price: "",
    currency: "UGX",
    grade: "",
    description: "",
    contactName: "",
    contactPhone: user?.phone || "",
    contactWhatsapp: user?.phone || "",
    district: "",
    parish: "",
  });
  const [listingMediaUrls, setListingMediaUrls] = useState<string[]>([]);

  const cropOptions = useMemo(() => {
    const pool = [
      ...CROP_OPTIONS,
      ...profileCrops,
      ...myListings.map((item) => item.crop),
      ...marketListings.map((item) => item.crop),
      ...predictions.map((item) => item.crop),
    ];
    return uniqueStrings(pool);
  }, [marketListings, myListings, predictions, profileCrops]);

  const myUserIds = useMemo(() => new Set(myListings.map((item) => item.userId).filter(Boolean)), [myListings]);

  const discoverListings = useMemo(() => {
    return marketListings
      .filter((item) => !myUserIds.has(item.userId))
      .filter((item) => item.status.toLowerCase() === "open")
      .filter((item) => {
        if (!listingFilterCrop.trim()) return true;
        return item.crop.toLowerCase().includes(listingFilterCrop.trim().toLowerCase());
      })
      .filter((item) => {
        if (!listingFilterDistrict.trim()) return true;
        return (item.location.district || "").toLowerCase().includes(listingFilterDistrict.trim().toLowerCase());
      });
  }, [listingFilterCrop, listingFilterDistrict, marketListings, myUserIds]);

  const openMyListings = useMemo(() => myListings.filter((item) => item.status.toLowerCase() === "open").length, [myListings]);
  const mediaReadyListings = useMemo(() => myListings.filter((item) => item.mediaUrls.length > 0).length, [myListings]);
  const publishChecklist = useMemo<PublishChecklistItem[]>(
    () => [
      { label: "Crop", ready: Boolean(listingDraft.crop.trim()), detail: listingDraft.crop.trim() || "Select produce" },
      {
        label: "Pricing",
        ready: Boolean(listingDraft.price.trim() && listingDraft.quantity.trim()),
        detail: listingDraft.price.trim() && listingDraft.quantity.trim() ? "Price and quantity set" : "Add price and quantity",
      },
      {
        label: "Contacts",
        ready: Boolean(listingDraft.contactPhone.trim() || listingDraft.contactWhatsapp.trim()),
        detail: listingDraft.contactPhone.trim() || listingDraft.contactWhatsapp.trim() ? "Buyer can reach you" : "Add phone or WhatsApp",
      },
      {
        label: "Location",
        ready: Boolean((listingDraft.district || profileDistrict).trim()),
        detail: (listingDraft.district || profileDistrict).trim() ? "Discovery location ready" : "Add district",
      },
      {
        label: "Evidence",
        ready: listingMediaUrls.length > 0,
        detail: listingMediaUrls.length > 0 ? `${listingMediaUrls.length} file(s) attached` : "Add listing media",
      },
    ],
    [listingDraft.contactPhone, listingDraft.contactWhatsapp, listingDraft.crop, listingDraft.district, listingDraft.price, listingDraft.quantity, listingMediaUrls.length, profileDistrict]
  );
  const publishReadyCount = publishChecklist.filter((item) => item.ready).length;
  const leadPrediction = predictions[0] ?? null;

  const loadHubData = () => {
    if (!user?.phone) return;
    setLoading(true);
    setError(null);

    const ownListingsQuery = `?phone=${encodeURIComponent(user.phone)}&limit=30`;
    const openSellerListingsQuery = "?status=open&role=seller&limit=50";

    Promise.allSettled([
      api.profileDetails(),
      api.marketListings(ownListingsQuery),
      api.marketListings(openSellerListingsQuery),
      api.marketServices("?status=open&limit=20"),
      api.marketIntel("?limit=6"),
    ])
      .then(([profileRes, myListingRes, listingRes, serviceRes, intelRes]) => {
        if (profileRes.status === "fulfilled") {
          const profile = profileRes.value as ProfileDetails;
          const district = profile.settings.district ?? "";
          const parish = profile.settings.parish ?? "";
          const crops = profile.farm.crops ?? [];
          setProfileDistrict(district);
          setProfileParish(parish);
          setProfileCrops(crops);
          setListingDraft((prev) => ({
            ...prev,
            crop: prev.crop || crops[0] || "",
            contactPhone: prev.contactPhone || user.phone,
            contactWhatsapp: prev.contactWhatsapp || user.phone,
            district: prev.district || district,
            parish: prev.parish || parish,
          }));
        }

        if (myListingRes.status === "fulfilled") {
          const rows = (myListingRes.value.items ?? [])
            .map((item) => normalizeListing(item))
            .filter((item): item is MarketListing => item != null);
          setMyListings(rows);
        } else {
          setMyListings([]);
        }

        if (listingRes.status === "fulfilled") {
          const rows = (listingRes.value.items ?? [])
            .map((item) => normalizeListing(item))
            .filter((item): item is MarketListing => item != null);
          setMarketListings(rows);
        } else {
          setMarketListings([]);
        }

        if (serviceRes.status === "fulfilled") {
          const rows = (serviceRes.value.items ?? [])
            .map((item) => normalizeService(item))
            .filter((item): item is MarketService => item != null);
          setServiceFeed(rows);
        } else {
          setServiceFeed([]);
        }

        if (intelRes.status === "fulfilled") {
          const raw = (intelRes.value.predictions ?? []) as unknown[];
          const rows = raw.map((item) => normalizePrediction(item)).filter((item): item is MarketPrediction => item != null);
          setPredictions(rows);
        } else {
          setPredictions([]);
        }
      })
      .catch(() => setError("Unable to load market hub data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user?.phone) return;
    loadHubData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);

  const onDraftChange = <K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) => {
    setListingDraft((prev) => ({ ...prev, [field]: value }));
  };

  const removeMedia = (url: string) => {
    setListingMediaUrls((prev) => prev.filter((item) => item !== url));
  };

  const onUploadListingMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!user?.phone || files.length === 0) return;
    setUploadingMedia(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.marketUploadMedia({ files });
      const uploaded = (result.items ?? [])
        .map((item) => toStringValue(asRecord(item).url))
        .filter(Boolean);
      setListingMediaUrls((prev) => uniqueStrings([...prev, ...uploaded]));
      if (uploaded.length > 0) {
        setMessage(`${uploaded.length} media file${uploaded.length === 1 ? "" : "s"} uploaded.`);
      }
    } catch {
      setError("Unable to upload media. Use image files only.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCreateListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.phone) return;

    const crop = listingDraft.crop.trim();
    const district = listingDraft.district.trim() || profileDistrict.trim();
    const parish = listingDraft.parish.trim() || profileParish.trim();

    if (!crop) {
      setError("Crop is required to publish a listing.");
      return;
    }
    if (!district) {
      setError("District is required so buyers can discover your listing.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.marketCreateListing({
        phone: user.phone,
        role: "seller",
        crop,
        quantity: toOptionalNumberInput(listingDraft.quantity),
        unit: listingDraft.unit.trim() || undefined,
        price: toOptionalNumberInput(listingDraft.price),
        currency: listingDraft.currency || "UGX",
        grade: listingDraft.grade.trim() || undefined,
        description: listingDraft.description.trim() || undefined,
        contact_name: listingDraft.contactName.trim() || undefined,
        contact_phone: listingDraft.contactPhone.trim() || undefined,
        contact_whatsapp: listingDraft.contactWhatsapp.trim() || undefined,
        media_urls: listingMediaUrls,
        status: "open",
        location: {
          district,
          parish: parish || undefined,
        },
      });
      setMessage("Listing published to Market Hub.");
      setListingDraft((prev) => ({
        ...prev,
        quantity: "",
        price: "",
        grade: "",
        description: "",
      }));
      setListingMediaUrls([]);
      loadHubData();
    } catch {
      setError("Unable to publish listing right now.");
    } finally {
      setSaving(false);
    }
  };

  const contextValue: FarmerMarketWorkspaceContext = {
    loading,
    saving,
    uploadingMedia,
    message,
    error,
    profileDistrict,
    profileCrops,
    myListings,
    marketListings,
    serviceFeed,
    predictions,
    listingFilterCrop,
    setListingFilterCrop,
    listingFilterDistrict,
    setListingFilterDistrict,
    listingDraft,
    listingMediaUrls,
    cropOptions,
    discoverListings,
    openMyListings,
    mediaReadyListings,
    publishChecklist,
    publishReadyCount,
    leadPrediction,
    onDraftChange,
    removeMedia,
    onUploadListingMedia,
    handleCreateListing,
    loadHubData,
  };

  if (loading) return <section className="farmer-page">Loading market hub...</section>;

  return (
    <section className="farmer-page farm-workspace-shell">
      <div className="farmer-page-header farmer-command-header header-actions-only">
        <div className="farmer-command-actions">
          <button className="btn ghost small" type="button" onClick={loadHubData}>
            Refresh
          </button>
        </div>
      </div>

      {(message || error) && <p className={`status ${error ? "error" : ""}`}>{error ?? message}</p>}

      <section className="farmer-card dashboard-subnav-bar no-picker">
        <nav className="dashboard-subnav" aria-label="Market hub pages">
          {marketSections.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/dashboard/market"}
              className={({ isActive }) => `dashboard-subnav-link ${isActive ? "active" : ""}`}
              title={item.subtitle}
            >
              <span className="nav-icon">
                <Icon name={item.icon} size={15} />
              </span>
              <strong>{item.label}</strong>
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet context={contextValue} />
    </section>
  );
}

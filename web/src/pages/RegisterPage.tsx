import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";
import {
  api,
  type OnboardingOptionsOut,
  type OnboardingRoleOptionOut,
  type ServiceCategoryOptionOut,
  type UgandaDistrictOut,
} from "../lib/api";
import EmailVerifyPanel from "../components/EmailVerifyPanel";

type StatusMessage = { type: "info" | "error"; message: string };

type PhoneCheckState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; normalized: string }
  | { state: "taken"; normalized: string }
  | { state: "invalid"; message: string };

type EmailCheckState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; normalized: string }
  | { state: "taken"; normalized: string }
  | { state: "invalid"; message: string };

const FALLBACK_ROLE_OPTIONS: OnboardingRoleOptionOut[] = [
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
    required_fields: ["full_name", "phone", "district", "parish", "organization_name", "service_categories"],
  },
  {
    id: "input_supplier",
    label: "Input supplier",
    description: "Provide seeds, fertilizer, agrochemicals, and tools.",
    required_fields: ["full_name", "phone", "district", "parish", "organization_name", "service_categories"],
  },
  {
    id: "buyer",
    label: "Buyer",
    description: "Buy produce from farmers and publish demand.",
    required_fields: ["full_name", "phone", "district", "parish", "organization_name", "focus_crops"],
  },
  {
    id: "offtaker",
    label: "Offtaker",
    description: "Run structured procurement and contract sourcing.",
    required_fields: ["full_name", "phone", "district", "parish", "organization_name", "focus_crops"],
  },
];

const FALLBACK_CROPS = ["maize", "beans", "cassava", "groundnut", "banana", "coffee", "rice", "sorghum", "millet"];

const FALLBACK_SERVICE_CATEGORIES: ServiceCategoryOptionOut[] = [
  { id: "mechanization", label: "Mechanization" },
  { id: "transport", label: "Transport" },
  { id: "spraying", label: "Spraying" },
  { id: "storage", label: "Storage" },
  { id: "aggregation", label: "Aggregation" },
  { id: "extension", label: "Extension advisory" },
  { id: "finance", label: "Financial services" },
];

function normalizeSelection(value: string) {
  return value.trim().toLowerCase();
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function RegisterPage() {
  const { register, verify, resendVerificationCode } = useAuth();

  const [fullName, setFullName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [role, setRole] = useState("farmer");
  const [district, setDistrict] = useState("");
  const [parish, setParish] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [crops, setCrops] = useState<string[]>([]);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [focusCrops, setFocusCrops] = useState<string[]>([]);

  const [otpRequired, setOtpRequired] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [phoneCheck, setPhoneCheck] = useState<PhoneCheckState>({ state: "idle" });
  const [emailCheck, setEmailCheck] = useState<EmailCheckState>({ state: "idle" });

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingParishes, setLoadingParishes] = useState(false);
  const [districts, setDistricts] = useState<UgandaDistrictOut[]>([]);
  const [parishOptions, setParishOptions] = useState<string[]>([]);
  const [onboardingOptions, setOnboardingOptions] = useState<OnboardingOptionsOut | null>(null);

  const parseError = (err: unknown) => {
    if (!err || typeof err !== "object") return "Request failed. Try again.";
    const detail = (err as { detail?: string }).detail;
    return detail || "Request failed. Try again.";
  };

  const roleOptions = onboardingOptions?.roles?.length ? onboardingOptions.roles : FALLBACK_ROLE_OPTIONS;
  const cropOptions = onboardingOptions?.crops?.length ? onboardingOptions.crops : FALLBACK_CROPS;
  const categoryOptions = onboardingOptions?.service_categories?.length
    ? onboardingOptions.service_categories
    : FALLBACK_SERVICE_CATEGORIES;

  const selectedRole = useMemo(() => roleOptions.find((item) => item.id === role) ?? roleOptions[0], [role, roleOptions]);
  const isFarmer = role === "farmer";
  const needsOrganization = role !== "farmer";
  const needsServiceCategories = role === "service_provider" || role === "input_supplier";
  const needsFocusCrops = role === "buyer" || role === "offtaker";

  useEffect(() => {
    if (role === "farmer") {
      setOrganizationName("");
      setServiceCategories([]);
      setFocusCrops([]);
      return;
    }
    setCrops([]);
    if (role === "service_provider" || role === "input_supplier") {
      setFocusCrops([]);
      return;
    }
    setServiceCategories([]);
    setCrops([]);
  }, [role]);

  useEffect(() => {
    let active = true;
    const loadMetadata = async () => {
      setLoadingMeta(true);
      try {
        const [optionsRes, districtRes] = await Promise.all([api.onboardingOptions(), api.referenceDistricts()]);
        if (!active) return;
        setOnboardingOptions(optionsRes);
        setDistricts(districtRes.items ?? []);
        const defaultRole = optionsRes.default_role?.trim() || optionsRes.roles?.[0]?.id || "farmer";
        setRole(defaultRole);
      } catch (err) {
        if (!active) return;
        setStatus({ type: "error", message: parseError(err) });
      } finally {
        if (active) setLoadingMeta(false);
      }
    };
    loadMetadata();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadParishes = async () => {
      if (!district) {
        setParishOptions([]);
        return;
      }
      setLoadingParishes(true);
      try {
        const response = await api.referenceParishes(district);
        if (!active) return;
        const names = uniqueValues((response.items ?? []).map((item) => toStringValue(item.name)));
        setParishOptions(names);
      } catch {
        if (!active) return;
        setParishOptions([]);
      } finally {
        if (active) setLoadingParishes(false);
      }
    };
    loadParishes();
    return () => {
      active = false;
    };
  }, [district]);

  const toggleSelection = (value: string, current: string[], setter: (next: string[]) => void) => {
    const key = normalizeSelection(value);
    const exists = current.some((item) => normalizeSelection(item) === key);
    setter(exists ? current.filter((item) => normalizeSelection(item) !== key) : [...current, value]);
  };

  const phoneStatusLabel = useMemo(() => {
    if (phoneCheck.state === "checking") return "Checking phone...";
    if (phoneCheck.state === "available") return `Available (${phoneCheck.normalized})`;
    if (phoneCheck.state === "taken") return `Already registered (${phoneCheck.normalized})`;
    if (phoneCheck.state === "invalid") return phoneCheck.message;
    return "";
  }, [phoneCheck]);

  const emailStatusLabel = useMemo(() => {
    if (emailCheck.state === "checking") return "Checking email...";
    if (emailCheck.state === "available") return `Available (${emailCheck.normalized})`;
    if (emailCheck.state === "taken") return `Already registered (${emailCheck.normalized})`;
    if (emailCheck.state === "invalid") return emailCheck.message;
    return "";
  }, [emailCheck]);

  function validateRegistration() {
    if (!registerPhone.trim()) {
      setStatus({ type: "error", message: "Enter a phone number to continue." });
      return false;
    }
    if (!registerEmail.trim()) {
      setStatus({ type: "error", message: "Enter your email address." });
      return false;
    }
    if (!fullName.trim()) {
      setStatus({ type: "error", message: "Enter your full name." });
      return false;
    }
    if (registerPassword.trim().length < 6) {
      setStatus({ type: "error", message: "Use a password with at least 6 characters." });
      return false;
    }
    if (!district.trim()) {
      setStatus({ type: "error", message: "Select your district." });
      return false;
    }
    if (!parish.trim()) {
      setStatus({ type: "error", message: "Enter your parish." });
      return false;
    }
    if (isFarmer && crops.length === 0) {
      setStatus({ type: "error", message: "Select at least one crop." });
      return false;
    }
    if (needsOrganization && !organizationName.trim()) {
      setStatus({ type: "error", message: "Enter your organization name." });
      return false;
    }
    if (needsServiceCategories && serviceCategories.length === 0) {
      setStatus({ type: "error", message: "Select at least one service category." });
      return false;
    }
    if (needsFocusCrops && focusCrops.length === 0) {
      setStatus({ type: "error", message: "Select at least one focus crop." });
      return false;
    }
    return true;
  }

  const checkPhone = async () => {
    if (!registerPhone.trim()) return null;
    setPhoneCheck({ state: "checking" });
    try {
      const response = await api.authPhoneAvailability(registerPhone.trim());
      setPhoneCheck(
        response.available
          ? { state: "available", normalized: response.normalized_phone }
          : { state: "taken", normalized: response.normalized_phone }
      );
      return response;
    } catch (err) {
      const message = parseError(err);
      setPhoneCheck({ state: "invalid", message });
      setStatus({ type: "error", message });
      return null;
    }
  };

  const checkEmail = async () => {
    if (!registerEmail.trim()) return null;
    setEmailCheck({ state: "checking" });
    try {
      const response = await api.authEmailAvailability(registerEmail.trim());
      setEmailCheck(
        response.available
          ? { state: "available", normalized: response.normalized_email }
          : { state: "taken", normalized: response.normalized_email }
      );
      return response;
    } catch (err) {
      const message = parseError(err);
      setEmailCheck({ state: "invalid", message });
      setStatus({ type: "error", message });
      return null;
    }
  };

  const handleRegister = async () => {
    if (!validateRegistration()) return;
    setStatus({ type: "info", message: "Checking registration details..." });
    const [phoneAvailability, emailAvailability] = await Promise.all([checkPhone(), checkEmail()]);
    if (!phoneAvailability || !emailAvailability) return;
    if (!phoneAvailability.available) {
      setStatus({ type: "error", message: "This phone is already registered. Use Sign in instead." });
      return;
    }
    if (!emailAvailability.available) {
      setStatus({ type: "error", message: "This email is already registered. Use Sign in or reset your password." });
      return;
    }
    setStatus({ type: "info", message: "Creating account..." });
    try {
      const result = await register({
        phone: registerPhone.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
        role,
        full_name: fullName.trim(),
        district,
        parish,
        crops: isFarmer ? crops : undefined,
        organization_name: needsOrganization ? organizationName.trim() : undefined,
        service_categories: needsServiceCategories ? serviceCategories : undefined,
        focus_crops: needsFocusCrops ? focusCrops : undefined,
      });
      if (result.status === "logged_in") {
        setOtpRequired(false);
        setStatus({ type: "info", message: "Account created." });
        return;
      }
      setOtpRequired(true);
      setVerificationEmail(registerEmail.trim());
      setStatus({ type: "info", message: result.message || "Enter the email verification code we sent." });
    } catch (err) {
      setStatus({ type: "error", message: parseError(err) });
    }
  };

  return (
    <div className="auth-page auth-page-modern">
      <div className="auth-page-solo auth-page-solo-wide">
        <section className="auth-card auth-card-modern">
          <div className="auth-panel-head">
            <div>
              <div className="label">Create account</div>
              <h2>Set up your profile</h2>
              <p>Choose a role, add your location, and complete the required profile details.</p>
            </div>
            <div className="auth-head-meta">
              <strong>{districts.length || "--"}</strong>
              <span>Districts loaded</span>
            </div>
          </div>

          <div className="auth-role-grid">
            {roleOptions.map((option) => {
              const active = option.id === role;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`auth-role-chip ${active ? "active" : ""}`}
                  onClick={() => setRole(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              );
            })}
          </div>

          <div className="auth-form-grid">
            <label className="field auth-span-2">
              Full name
              <input placeholder="Jane Adoch" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>

            <label className="field auth-span-2">
              Phone number
              <div className="auth-inline-input">
                <input
                  placeholder="+2567..."
                  value={registerPhone}
                  onChange={(event) => {
                    setRegisterPhone(event.target.value);
                    setPhoneCheck({ state: "idle" });
                  }}
                />
                <button type="button" className="btn ghost auth-inline-btn" onClick={checkPhone} disabled={phoneCheck.state === "checking"}>
                  Check
                </button>
              </div>
            </label>

            <label className="field auth-span-2">
              Email address
              <div className="auth-inline-input">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={registerEmail}
                  onChange={(event) => {
                    setRegisterEmail(event.target.value);
                    setEmailCheck({ state: "idle" });
                  }}
                />
                <button type="button" className="btn ghost auth-inline-btn" onClick={checkEmail} disabled={emailCheck.state === "checking"}>
                  Check
                </button>
              </div>
            </label>

            <label className="field auth-span-2">
              Password
              <input
                type="password"
                placeholder="At least 6 characters"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
            </label>

            {phoneStatusLabel ? (
              <p className={`auth-phone-status ${phoneCheck.state === "taken" || phoneCheck.state === "invalid" ? "error" : ""}`}>
                {phoneStatusLabel}
              </p>
            ) : null}

            {emailStatusLabel ? (
              <p className={`auth-phone-status ${emailCheck.state === "taken" || emailCheck.state === "invalid" ? "error" : ""}`}>
                {emailStatusLabel}
              </p>
            ) : null}

            <label className="field">
              District
              <select
                value={district}
                onChange={(event) => {
                  setDistrict(event.target.value);
                  setParish("");
                }}
                disabled={loadingMeta}
              >
                <option value="">Select district</option>
                {districts.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Parish
              {parishOptions.length > 0 ? (
                <select value={parish} onChange={(event) => setParish(event.target.value)} disabled={!district || loadingParishes}>
                  <option value="">{loadingParishes ? "Loading parishes..." : "Select parish"}</option>
                  {parishOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={parish}
                  onChange={(event) => setParish(event.target.value)}
                  placeholder={district ? "Type your parish" : "Select a district first"}
                  disabled={!district}
                />
              )}
            </label>

            {needsOrganization ? (
              <label className="field auth-span-2">
                Organization
                <input
                  placeholder="Company or cooperative name"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          {isFarmer ? (
            <div className="auth-selector-block">
              <p className="label">Crops</p>
              <div className="auth-chip-grid">
                {cropOptions.map((item) => {
                  const active = crops.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`auth-data-chip ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => toggleSelection(item, crops, setCrops)}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {needsServiceCategories ? (
            <div className="auth-selector-block">
              <p className="label">Service categories</p>
              <div className="auth-chip-grid">
                {categoryOptions.map((item) => {
                  const active = serviceCategories.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`auth-data-chip ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => toggleSelection(item.id, serviceCategories, setServiceCategories)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {needsFocusCrops ? (
            <div className="auth-selector-block">
              <p className="label">Focus crops</p>
              <div className="auth-chip-grid">
                {cropOptions.map((item) => {
                  const active = focusCrops.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`auth-data-chip ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => toggleSelection(item, focusCrops, setFocusCrops)}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="auth-actions auth-actions-split">
            <button className="btn" onClick={handleRegister} disabled={loadingMeta}>
              Create account
            </button>
            <Link className="btn ghost" to="/auth">
              Have an account?
            </Link>
          </div>
        </section>

        {otpRequired ? (
          <EmailVerifyPanel
            email={verificationEmail}
            title="Account verification"
            onStatus={setStatus}
            onVerify={async (code) => {
              await verify(verificationEmail.trim(), code);
              setOtpRequired(false);
              setStatus({ type: "info", message: "Email verified. You are now signed in." });
            }}
            onResend={async () => {
              const result = await resendVerificationCode(verificationEmail.trim());
              return result.message;
            }}
          />
        ) : null}

        {status ? <p className={`status ${status.type === "error" ? "error" : ""}`}>{status.message}</p> : null}

        <aside className="auth-insight-card">
          <div className="label">Selected role</div>
          <h3>{selectedRole?.label ?? "Role"}</h3>
          <p>{selectedRole?.description ?? "Select a role to continue."}</p>
          <ul className="auth-inline-list">
            {(selectedRole?.required_fields ?? []).map((item) => (
              <li key={item}>{item.split("_").join(" ")}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

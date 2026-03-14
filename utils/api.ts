// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 VADI — services/api.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError } from "axios";

// ─── Base URL ─────────────────────────────────
// 🔧 Use EXPO_PUBLIC_API_URL from .env (e.g. http://192.168.1.5:8000/api for local)
// 🚀 PROD: Set EXPO_PUBLIC_API_URL=https://your-api.onrender.com/api
const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "http://192.168.29.55:8000/api";

// ─── Axios Instance ───────────────────────────
// Timeout 45s: Render.com free tier cold start can take 30–60s; 15s was too short
export const API = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Token Storage ────────────────────────────
const TOKEN_KEY = "vadi_token";

export const TokenStore = {
  save: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

// ─── Request Interceptor ──────────────────────
// Auto-attaches token + logs every request
API.interceptors.request.use(async (config) => {
  const token = await TokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 🐛 Debug log — remove in production
  console.log(
    `➡️  [API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
  );

  return config;
});

// ─── Response Interceptor ─────────────────────
// Logs responses + normalises all errors into a single err.message
API.interceptors.response.use(
  (response) => {
    // 🐛 Debug log — remove in production
    console.log(`✅ [API] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    // 🐛 Full debug info
    console.log("❌ [API ERROR]");
    console.log("   URL     :", error.config?.baseURL + error.config?.url);
    console.log("   Code    :", error.code);
    console.log("   Message :", error.message);
    console.log("   Status  :", error.response?.status);
    console.log("   Data    :", JSON.stringify(error.response?.data));

    if (error.code === "ECONNREFUSED") {
      return Promise.reject(
        new Error(
          "Connection refused — check server is running and port is correct",
        ),
      );
    }
    if (error.code === "ENETUNREACH" || error.code === "ENOTFOUND") {
      return Promise.reject(
        new Error("Cannot reach server — check IP address in api.ts"),
      );
    }
    if (error.code === "ECONNABORTED") {
      // Let UI decide how to show timeout vs. other network errors
      return Promise.reject(error);
    }
    if (!error.response) {
      // Generic network error — UI will map this to a friendly Gujarati line
      return Promise.reject(error);
    }

    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message ??
      "Something went wrong";

    return Promise.reject(new Error(message));
  },
);

// ─── Simple, user‑friendly error mapper for UI ──────────────────────────────
export const getFriendlyErrorMessage = (err: unknown): string => {
  const e = err as AxiosError | Error | any;

  // No response / classic axios network error / timeout (incl. server cold start on Render)
  if (
    e.code === "ECONNABORTED" ||
    e.message === "Network Error" ||
    !e.response
  ) {
    if (e.code === "ECONNABORTED") {
      return "સર્વરને જવાબ આપતા વધુ સમય લાગ્યો. થોડી વાર પછી ફરી પ્રયત્ન કરો.";
    }
    return "ઇન્ટરનેટ કનેક્શન ચેક કરો (મોબાઇલ ડેટા / Wi‑Fi) અને ફરી પ્રયત્ન કરો.";
  }

  if (typeof e.message === "string" && e.message.trim()) {
    return e.message;
  }

  return "કંઈક ખોટું થયું. થોડી વારમાં ફરી પ્રયત્ન કરો.";
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 SHARED / COMMON TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type LandUnit = "acre" | "bigha";
export type WaterSource = "Rain" | "Borewell" | "Canal";
export type LabourType = "Family" | "Hired" | "Mixed";
/**
 * Tractor services offered by farmer.
 * This intentionally reuses RentalAssetType so the options
 * match the tractor income (rental) screen exactly.
 */
export type TractorService = RentalAssetType;
/** Ordered list of tractor service options (single source of truth, matches RentalAssetType). */
export const TRACTOR_SERVICES: TractorService[] = [
  "Tractor",
  "Rotavator",
  "RAP",
  "Samar",
  "Sah Nakhya",
  "Vavetar",
  "Kyara Bandhya",
  "Thresher",
  "Bagu",
  "Fukani",
  "Kheti Kari",
  "Other Equipment",
];
export type District =
  | "Rajkot"
  | "Jamnagar"
  | "Junagadh"
  | "Amreli"
  | "Morbi"
  | "Bhavnagar"
  | "Surendranagar"
  | "Other";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔐 AUTH TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SendOtpResponse {
  message: string;
  sessionId: string;
}

export interface VerifyOtpResponse {
  token: string;
  isNewUser: boolean;
  isProfileCompleted: boolean;
  /** false = show consent screen */
  consentGiven: boolean;
}

export interface ConsentResponse {
  message: string;
  analyticsConsent: boolean;
}

/** Returned by GET /auth/me */
export interface CurrentUser {
  _id: string;
  phone: string;
  role: string;
  isProfileCompleted: boolean;
  /** null = not yet asked, true = agreed, false = declined */
  analyticsConsent: boolean | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔐 AUTH APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /auth/send-otp */
export const sendOtp = async (phone: string): Promise<SendOtpResponse> => {
  const res = await API.post<SendOtpResponse>("/auth/send-otp", { phone });
  return res.data;
};

/** POST /auth/verify-otp — token auto-saved to AsyncStorage */
export const verifyOtp = async (
  phone: string,
  otp: string,
  sessionId: string,
): Promise<VerifyOtpResponse> => {
  console.log("verifyOtp: phone", phone, "otp", otp, "sessionId", sessionId);

  const res = await API.post<VerifyOtpResponse>("/auth/verify-otp", {
    phone,
    otp,
    sessionId,
  });
  await TokenStore.save(res.data.token);
  return res.data;
};

/** POST /auth/consent — call once after first profile setup */
export const saveConsent = async (
  consent: boolean,
): Promise<ConsentResponse> => {
  const res = await API.post<ConsentResponse>("/auth/consent", { consent });
  return res.data;
};

/**
 * GET /auth/me
 * Returns current user's account info.
 * Use on app load to check consent & profile status.
 */
export const getMe = async (): Promise<CurrentUser> => {
  const res = await API.get<{ user: CurrentUser }>("/auth/me");
  return res.data.user;
};

/** Logout — clears JWT from AsyncStorage and profile cache */
export const logout = async (): Promise<void> => {
  await TokenStore.clear();
  profileCache = { data: null, ts: 0 };
};

// ─── Profile cache (short TTL so dashboard/profile load fast on tab switch) ───
const PROFILE_CACHE_TTL_MS = 90_000; // 90 seconds
let profileCache: { data: FarmerProfile | null; ts: number } = { data: null, ts: 0 };
function getCachedProfile(): FarmerProfile | null {
  if (profileCache.data && Date.now() - profileCache.ts < PROFILE_CACHE_TTL_MS)
    return profileCache.data;
  return null;
}
function setCachedProfile(p: FarmerProfile) {
  profileCache = { data: p, ts: Date.now() };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📍 LOCATIONS (District / Taluka / Village — dynamic from API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type DropdownItem = { value: string; label: string };
export type VillageItem = { value: string; label: string };

/** GET /locations/districts — returns [{ value, label }] */
export const getLocationsDistricts = async (): Promise<DropdownItem[]> => {
  const res = await API.get<DropdownItem[]>("/locations/districts");
  return Array.isArray(res.data) ? res.data : [];
};

/** GET /locations/talukas?district=X — returns [{ value, label }] */
export const getLocationsTalukas = async (
  district: string,
): Promise<DropdownItem[]> => {
  const res = await API.get<DropdownItem[]>("/locations/talukas", {
    params: { district },
  });
  return Array.isArray(res.data) ? res.data : [];
};

/** GET /locations/villages?district=X&taluka=Y — returns [{ value, label }] */
export const getLocationsVillages = async (
  district: string,
  taluka: string,
): Promise<VillageItem[]> => {
  const res = await API.get<VillageItem[]>("/locations/villages", {
    params: { district, taluka },
  });
  return Array.isArray(res.data) ? res.data : [];
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 PROFILE TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Farm category: lease/contract land is not counted in total land */
export type FarmCategory = "owned" | "lease";

/** Single farm: name, area in bigha, and optional category (default owned; lease not counted in total land) */
export interface ProfileFarm {
  name: string;
  area: number;
  category?: FarmCategory;
}

export interface FarmerProfilePayload {
  name: string;
  district: District;
  taluka: string;
  village: string;
  totalLand: { value: number; unit: LandUnit };
  /** Optional list of farms with area in bigha; stored in backend and loaded when adding crop */
  farms?: ProfileFarm[];
  waterSources: WaterSource[];
  tractorAvailable: boolean;
  /** Services offered when tractor available: Rotavator, RAP, Bagi, Savda, etc. */
  implementsAvailable?: TractorService[];
  labourTypes: LabourType[];
  /** Data sharing / analytics consent (stored on farmer profile) */
  dataSharing?: boolean;
}

export interface FarmerProfile extends FarmerProfilePayload {
  _id: string;
  user: string;
  /** From profile.data_sharing; null = not set */
  analyticsConsent?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  message: string;
  profile: FarmerProfile;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 PROFILE APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /profile/complete — first-time setup only */
export const completeProfile = async (
  payload: FarmerProfilePayload,
): Promise<ProfileResponse> => {
  const res = await API.post<ProfileResponse>("/profile/complete", payload);
  setCachedProfile(res.data.profile);
  return res.data;
};

/** GET /profile/me — uses short-lived cache so dashboard/profile load fast on tab switch */
export const getMyProfile = async (): Promise<FarmerProfile> => {
  const cached = getCachedProfile();
  if (cached) return cached;
  const res = await API.get<{ profile: FarmerProfile }>("/profile/me");
  const profile = res.data.profile;
  setCachedProfile(profile);
  return profile;
};

/** PUT /profile/update */
export const updateProfile = async (
  payload: Partial<FarmerProfilePayload>,
): Promise<ProfileResponse> => {
  const res = await API.put<ProfileResponse>("/profile/update", payload);
  setCachedProfile(res.data.profile);
  return res.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 VADI SCORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CropVadiScore {
  crop_id: string;
  crop_name: string;
  season: string;
  area_bigha: number;
  production_index?: number;
  expense_index?: number;
  profit_index?: number;
  crop_vadi_score?: number;
  outlier?: boolean;
  insufficient_data_for_comparison?: boolean;
}

export interface VadiScoreResponse {
  farmer_vadi_score: number | null;
  crop_vadi_scores: CropVadiScore[];
  production_index: number | null;
  expense_index: number | null;
  profit_index: number | null;
  village_rank: number | null;
  village_total_farmers: number;
  farmer_insights: string[];
  potential_income_improvement: number;
  classification: string | null;
}

/** GET /vadi-score/me — current farmer's VADI score and insights */
export const getVadiScore = async (): Promise<VadiScoreResponse> => {
  const res = await API.get<VadiScoreResponse>("/vadi-score/me");
  return res.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 CROP TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CropSeason = "Chomasu" | "Siyalo" | "Unalo";
export type CropStatus = "Active" | "Harvested" | "Closed";
export type AreaUnit = "Acre" | "Bigha" | "Hectare";

export interface CropPayload {
  season: CropSeason;
  cropName: string;
  cropEmoji?: string;
  /** Variety/sub-type e.g. "Desi", "GW-496" */
  subType?: string;
  /** Batch/lot label if applicable */
  batchLabel?: string;
  /** Financial year June–June e.g. "2025-26" */
  year?: string;
  /** Farm name from profile (e.g. "vadi") for area validation */
  farmName?: string;
  area: number;
  areaUnit?: AreaUnit;
  /** "ghare" = own, "bhagma" = sharecropping; when bhagma, bhagmaPercentage is set (25, 30, 33, 50) */
  landType?: "ghare" | "bhagma" | null;
  bhagmaPercentage?: number | null;
  /** When bhagma: extra expense as % of crop income (e.g. 10 = 10%), shared by bhagma share */
  bhagmaExpensePctOfIncome?: number | null;
  sowingDate?: string | null;
  harvestDate?: string | null;
  status?: CropStatus;
  notes?: string;
}

export interface Crop extends CropPayload {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CropListResponse {
  success: boolean;
  data: Crop[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Yearly report types ───────────────────────────────────────────────────────

export interface CropReportRow extends Crop {
  income: number;
  expense: number;
  profit: number;
  labourShare?: number;
  farmerDirectExpense?: number;
}

export interface SeasonBreakdown {
  income: number;
  expense: number;
  profit: number;
  crops: number;
  area: number;
}

export interface YearlyReportResponse {
  success: boolean;
  year: string;
  financialYear?: string;
  crops: CropReportRow[];
  seasonBreakdown: Record<CropSeason, SeasonBreakdown>;
  summary: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    totalCrops: number;
    totalArea: number;
    /** Crop-linked income for this FY */
    cropIncome?: number;
    /** Crop-linked expense for this FY */
    cropExpense?: number;
    /** Extra income (no crop) for this FY */
    extraIncome?: number;
    /** Extra expense (no crop) for this FY */
    extraExpense?: number;
    /** Tractor/rental income included inside totalIncome */
    tractorIncome?: number;
    /** Bhagya no upad total kept separate from crop expense totals */
    bhagyaUpadTotal?: number;
  };
}

export interface YearsResponse {
  success: boolean;
  /** Sorted newest first — financial years e.g. ["2025-26", "2024-25"] */
  years: string[];
}

/** Financial year: June to June. e.g. "2025-26" = June 2025 – May 2026 */
export function getCurrentFinancialYear(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 5) return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`;
}

/** Options for year picker: current and next financial year only e.g. ["2025-26", "2026-27"] */
export function getFinancialYearOptions(): string[] {
  const [startY] = getCurrentFinancialYear().split("-").map(Number);
  return [
    `${startY}-${String((startY + 1) % 100).padStart(2, "0")}`,
    `${startY + 1}-${String((startY + 2) % 100).padStart(2, "0")}`,
  ];
}

/** Extended options for list filters: 2 past + current + next FY, e.g. ["2023-24", "2024-25", "2025-26", "2026-27"] */
export function getFinancialYearOptionsExtended(): string[] {
  const [startY] = getCurrentFinancialYear().split("-").map(Number);
  const out: string[] = [];
  for (let i = -2; i <= 1; i++) {
    const y = startY + i;
    out.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

// ── Harvest patch types ───────────────────────────────────────────────────────

export interface HarvestPayload {
  /** ISO date string — defaults to today if omitted */
  harvestDate?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 CROP APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /crops */
export const createCrop = async (payload: CropPayload): Promise<Crop> => {
  const res = await API.post<{ success: boolean; data: Crop }>(
    "/crops",
    payload,
  );
  return res.data.data;
};

/** GET /crops */
export const getCrops = async (
  page = 1,
  limit = 20,
  season?: CropSeason,
  status?: CropStatus,
  year?: string,
): Promise<CropListResponse> => {
  const res = await API.get<CropListResponse>("/crops", {
    params: {
      page,
      limit,
      season,
      status,
      financialYear: year || undefined,
      year: year || undefined,
    },
  });
  return res.data;
};

/** GET /crops/:id */
export const getCropById = async (id: string): Promise<Crop> => {
  const res = await API.get<{ success: boolean; data: Crop }>(`/crops/${id}`);
  return res.data.data;
};

/** PUT /crops/:id */
export const updateCrop = async (
  id: string,
  payload: Partial<CropPayload>,
): Promise<Crop> => {
  const res = await API.put<{ success: boolean; data: Crop }>(
    `/crops/${id}`,
    payload,
  );
  return res.data.data;
};

/** PATCH /crops/:id/status */
export const updateCropStatus = async (
  id: string,
  status: CropStatus,
): Promise<Crop> => {
  const res = await API.patch<{ success: boolean; data: Crop }>(
    `/crops/${id}/status`,
    { status },
  );
  return res.data.data;
};

/**
 * PATCH /crops/:id/harvest
 * Marks crop as Harvested and sets harvest date (defaults to today).
 */
export const markCropHarvested = async (
  id: string,
  payload?: HarvestPayload,
): Promise<Crop> => {
  const res = await API.patch<{ success: boolean; data: Crop }>(
    `/crops/${id}/harvest`,
    payload ?? {},
  );
  return res.data.data;
};

/** DELETE /crops/:id — also deletes all linked expenses and income */
export const deleteCrop = async (id: string): Promise<void> => {
  await API.delete(`/crops/${id}`);
};

/** GET /crops/report/years — financial years with data e.g. ["2025-26", "2024-25"] */
export const getCropYears = async (): Promise<string[]> => {
  const res = await API.get<YearsResponse>("/crops/report/years");
  return res.data.years;
};

/**
 * GET /crops/report/yearly
 * Full per-crop income/expense/profit breakdown for a financial year.
 * @param financialYear e.g. "2025-26" — defaults to current FY
 */
export const getYearlyReport = async (
  financialYear?: string,
): Promise<YearlyReportResponse> => {
  const res = await API.get<YearlyReportResponse>("/crops/report/yearly", {
    params: { financialYear: financialYear || getCurrentFinancialYear() },
  });
  return res.data;
};

export interface CompareReportResponse {
  success: boolean;
  financialYear: string;
  cropName: string | null;
  myTotalIncome: number;
  myTotalExpense: number;
  myNetProfit: number;
  myTotalArea: number;
  myIncomePerBigha: number;
  avgIncome: number;
  avgExpense: number;
  avgIncomePerBigha: number;
  percentileIncome: number | null;
  percentileExpense: number | null;
  sampleSize: number;
  /** "average" = vs all others, "peer" = vs selected farmer */
  mode?: "average" | "peer";
  peerUserId?: string | null;
  peerName?: string | null;
  peerVillage?: string | null;
  peerTaluka?: string | null;
  peerDistrict?: string | null;
  peerIncome?: number | null;
  peerExpense?: number | null;
  peerIncomePerBigha?: number | null;
}

/** GET /crops/report/compare — compare with other farmers for a FY and optional crop */
export const getCompareReport = async (
  financialYear?: string,
  cropName?: string,
  peerUserId?: string,
): Promise<CompareReportResponse> => {
  const res = await API.get<CompareReportResponse>("/crops/report/compare", {
    params: {
      financialYear: financialYear || getCurrentFinancialYear(),
      cropName,
      peerUserId,
    },
  });
  return res.data;
};

export interface ComparePeer {
  userId: string;
  name: string;
  village: string;
  taluka: string;
  district: string;
}

export interface ComparePeersResponse {
  success: boolean;
  peers: ComparePeer[];
}

/** GET /crops/report/compare/users — list other data-sharing farmers for peer comparison */
export const getComparePeers = async (): Promise<ComparePeersResponse> => {
  const res = await API.get<ComparePeersResponse>(
    "/crops/report/compare/users",
  );
  return res.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💰 EXPENSE TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ExpenseCategory =
  | "Seed"
  | "Fertilizer"
  | "Pesticide"
  | "Labour"
  | "Machinery"
  | "Irrigation"
  | "Other";

export type SeedType = "Company Brand" | "Local/Desi" | "Hybrid";
export type FertilizerProduct =
  | "Urea"
  | "DAP"
  | "NPK"
  | "Organic"
  | "Sulphur"
  | "Micronutrients";
export type PesticideCategory =
  | "Insecticide"
  | "Fungicide"
  | "Herbicide"
  | "Growth Booster";
export type LabourTask =
  | "Weeding"
  | "Sowing"
  | "Spraying"
  | "Harvesting"
  | "Irrigation";
export type AdvanceReason =
  | "Medical"
  | "Grocery"
  | "Mobile Recharge"
  | "Festival"
  | "Loan"
  | "Other";
// MachineryImplement reuses the same options as RentalAssetType (tractor income)
export type MachineryImplement = RentalAssetType;

// ── Sub-payload types (what you send) ─────────────────────────────────────────

export interface SeedExpensePayload {
  seedType: SeedType;
  quantityKg: number;
  totalCost: number;
}

export interface FertilizerExpensePayload {
  productName: FertilizerProduct;
  numberOfBags: number;
  totalCost: number;
}

export interface PesticideExpensePayload {
  category: PesticideCategory;
  dosageML: number;
  cost: number;
}

export interface LabourDailyPayload {
  task: LabourTask;
  numberOfPeople: number;
  days: number;
  dailyRate: number;
}

/** Sharing for ભાગમા (contract) – used in reports. */
export type SharingOption = "25" | "33" | "50" | "custom";

export interface LabourContractPayload {
  advanceReason: AdvanceReason;
  amountGiven: number;
  /** Optional source marker to separate bhagya upad from general extra expense. */
  sourceTag?: "bhagyaUpad" | "generalExpense";
  /** 25%, 33%, 50%, or "custom". When "custom", use sharingCustom for report. */
  sharingType?: SharingOption;
  /** Percentage (0–100) when sharingType is "custom". */
  sharingCustom?: number;
}

export interface MachineryExpensePayload {
  implement: MachineryImplement;
  isContract: boolean;
  hoursOrAcres: number;
  rate: number;
}

export interface IrrigationExpensePayload {
  amount: number;
}

export interface OtherExpensePayload {
  totalAmount: number;
  description?: string;
}

export interface ExpensePayload {
  /** Omit or null for general expense (સામાન્ય ખર્ચ) not linked to any crop */
  cropId?: string | null;
  category: ExpenseCategory;
  expenseSource?: "cropExpense" | "bhagyaUpad" | "generalExpense";
  date?: string;
  notes?: string;
  seed?: SeedExpensePayload;
  fertilizer?: FertilizerExpensePayload;
  pesticide?: PesticideExpensePayload;
  labourDaily?: LabourDailyPayload;
  labourContract?: LabourContractPayload;
  machinery?: MachineryExpensePayload;
  irrigation?: IrrigationExpensePayload;
  other?: OtherExpensePayload;
}

// ── What the API returns (includes server-derived fields) ─────────────────────

export interface SeedExpense extends SeedExpensePayload {
  /** Server-computed: totalCost / quantityKg */
  ratePerKg?: number;
}

export interface LabourDailyExpense extends LabourDailyPayload {
  /** Server-computed: numberOfPeople × days × dailyRate */
  totalCost: number;
}

export interface MachineryExpense extends MachineryExpensePayload {
  /** Server-computed: hoursOrAcres × rate */
  totalCost: number;
}

export interface Expense {
  _id: string;
  userId: string;
  cropId?: string | null;
  category: ExpenseCategory;
  expenseSource?: "cropExpense" | "bhagyaUpad" | "generalExpense" | null;
  /**
   * Top-level total cost — single source of truth for all report aggregations.
   * Always set by server pre-save hook regardless of category.
   */
  amount: number;
  /** Denormalized year (from date) — enables fast year filtering */
  year: number;
  date: string;
  notes?: string;
  seed?: SeedExpense;
  fertilizer?: FertilizerExpensePayload;
  pesticide?: PesticideExpensePayload;
  labourDaily?: LabourDailyExpense;
  labourContract?: LabourContractPayload;
  machinery?: MachineryExpense;
  irrigation?: { amount?: number };
  other?: { totalAmount?: number; description?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  success: boolean;
  data: Expense[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ExpenseSummaryItem {
  /** ExpenseCategory value */
  _id: string;
  total: number;
  count: number;
}

export interface ExpenseSummaryResponse {
  success: boolean;
  year: string | number;
  summary: ExpenseSummaryItem[];
  grandTotal: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💰 EXPENSE APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /expenses */
export const createExpense = async (
  payload: ExpensePayload,
): Promise<Expense> => {
  const res = await API.post<{ success: boolean; data: Expense }>(
    "/expenses",
    payload,
  );
  return res.data.data;
};

/** GET /expenses — filter by cropId / category / year / financialYear */
export const getExpenses = async (
  cropId?: string,
  category?: ExpenseCategory,
  year?: number,
  page = 1,
  limit = 100,
  financialYear?: string,
): Promise<ExpenseListResponse> => {
  const res = await API.get<ExpenseListResponse>("/expenses", {
    params: { cropId, category, year, page, limit, financialYear },
  });
  return res.data;
};

/**
 * GET /expenses/summary
 * Returns total expenses grouped by category + grandTotal.
 * @param year           e.g. 2025 — pass undefined for all-time
 * @param cropId         filter to a specific crop
 * @param financialYear  e.g. "2025-26" — overrides year when set
 */
export const getExpenseSummary = async (
  year?: number,
  cropId?: string,
  financialYear?: string,
): Promise<ExpenseSummaryResponse> => {
  const res = await API.get<ExpenseSummaryResponse>("/expenses/summary", {
    params: { year, cropId, financialYear },
  });
  return res.data;
};

/** GET /expenses/analytics — per-bigha comparison for exact idea (unit data) */
export interface ExpenseAnalyticsResponse {
  success: boolean;
  financialYear: string;
  mySummary: { _id: string; total: number }[];
  myByCategory: Record<string, number>;
  myArea: number;
  myPerBighaByCategory: Record<string, number>;
  avgByCategory: Record<string, number>;
  avgPerBighaByCategory: Record<string, number>;
  sampleSize: number;
  /** "average" = vs all others, "peer" = vs selected farmer */
  mode?: "average" | "peer";
  peerUserId?: string | null;
  peerName?: string | null;
  peerVillage?: string | null;
  peerTaluka?: string | null;
  peerDistrict?: string | null;
}
export const getExpenseAnalytics = async (
  financialYear?: string,
  peerUserId?: string,
): Promise<ExpenseAnalyticsResponse> => {
  const res = await API.get<ExpenseAnalyticsResponse>("/expenses/analytics", {
    params: {
      financialYear: financialYear || getCurrentFinancialYear(),
      peerUserId,
    },
  });
  return res.data;
};

/** GET /expenses/:id */
export const getExpenseById = async (id: string): Promise<Expense> => {
  const res = await API.get<{ success: boolean; data: Expense }>(
    `/expenses/${id}`,
  );
  return res.data.data;
};

/** PUT /expenses/:id — update expense; server re-computes amount. */
export const updateExpense = async (
  id: string,
  payload: ExpensePayload,
): Promise<Expense> => {
  const res = await API.put<{ success: boolean; data: Expense }>(
    `/expenses/${id}`,
    payload,
  );
  return res.data.data;
};

/** DELETE /expenses/:id */
export const deleteExpense = async (id: string): Promise<void> => {
  await API.delete(`/expenses/${id}`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌱 INCOME TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type IncomeCategory =
  | "Crop Sale"
  | "Subsidy"
  | "Rental Income"
  | "Other";

export type SubsidySchemeType =
  | "PM-KISAN"
  | "Fasal Bima (Crop Insurance)"
  | "Seed Subsidy"
  | "Fertilizer Subsidy"
  | "Irrigation Subsidy"
  | "Equipment Subsidy"
  | "Other Government Scheme";

export type RentalAssetType =
  | "Tractor"
  | "Rotavator"
  | "RAP"
  | "Samar"
  | "Sah Nakhya"
  | "Vavetar"
  | "Kyara Bandhya"
  | "Thresher"
  | "Bagu"
  | "Fukani"
  | "Kheti Kari"
  | "Other Equipment";

export type OtherIncomeSource =
  | "Labour Work"
  | "Animal Husbandry"
  | "Dairy"
  | "Part-time Work"
  | "Loan Received"
  | "Other";

// ── Sub-payload types (what you send) ─────────────────────────────────────────

export interface CropSalePayload {
  // cropName removed — use cropId at the top level to link to the Crop document
  quantityKg: number;
  pricePerKg: number;
  buyerName?: string;
  marketName?: string;
}

export interface SubsidyPayload {
  schemeType: SubsidySchemeType;
  amount: number;
  referenceNumber?: string;
}

export interface RentalIncomePayload {
  assetType: RentalAssetType;
  rentedToName?: string;
  /** Farmer/customer phone from contact picker */
  farmerPhone?: string;
  /** Payment status for tractor rental */
  paymentStatus?: "Pending" | "Completed";
  hoursOrDays: number;
  ratePerUnit: number;
}

export interface OtherIncomePayload {
  source: OtherIncomeSource;
  amount: number;
  description?: string;
}

// ── Full income payload sent to POST /income ──────────────────────────────────

export interface IncomePayload {
  /** Optional — links income to a specific crop (required for Crop Sale) */
  cropId?: string;
  category: IncomeCategory;
  date?: string;
  notes?: string;
  cropSale?: CropSalePayload;
  subsidy?: SubsidyPayload;
  rentalIncome?: RentalIncomePayload;
  otherIncome?: OtherIncomePayload;
}

// ── What the API returns (includes server-derived fields) ─────────────────────

export interface CropSaleIncome extends CropSalePayload {
  /** Server-computed: quantityKg × pricePerKg */
  totalAmount?: number;
}

export interface RentalIncomeIncome extends RentalIncomePayload {
  /** Server-computed: hoursOrDays × ratePerUnit */
  totalAmount?: number;
}

export interface Income {
  _id: string;
  userId: string;
  cropId?: string | { _id: string; cropName: string };
  category: IncomeCategory;
  /**
   * Top-level total amount — single source of truth for all report aggregations.
   * Always set by server pre-save hook regardless of category.
   */
  amount: number;
  /** Denormalized year (from date) — enables fast year filtering */
  year: number;
  date: string;
  notes?: string;
  cropSale?: CropSaleIncome;
  subsidy?: SubsidyPayload;
  rentalIncome?: RentalIncomeIncome;
  otherIncome?: OtherIncomePayload;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeListResponse {
  success: boolean;
  data: Income[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface IncomeSummaryItem {
  /** IncomeCategory value */
  _id: string;
  totalAmount: number;
  count: number;
}

export interface IncomeSummaryResponse {
  success: boolean;
  year: string | number;
  summary: IncomeSummaryItem[];
  grandTotal: number;
}

// ── Analytics response (GET /income/analytics) ────────────────────────────────

export interface TopCropByIncome {
  /** cropName from Crop document */
  _id: string;
  total: number;
}

export interface IncomeAnalyticsResponse {
  success: boolean;
  year: number;
  /** This user's total income for the year */
  myTotal: number;
  /** Average income across all consenting users (filtered by district if passed) */
  avgTotal: number;
  /** % of farmers earning less than this user — null if not enough data */
  percentileRank: number | null;
  /** Top crop by Crop Sale income for this user this year */
  topCropByIncome: TopCropByIncome | null;
  /** Human-readable advice strings based on comparison */
  advice: string[];
  /** How many farmers were included in the benchmark */
  sampleSize: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌱 INCOME APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /income */
export const createIncome = async (payload: IncomePayload): Promise<Income> => {
  const res = await API.post<{ success: boolean; data: Income }>(
    "/income",
    payload,
  );
  return res.data.data;
};

/** GET /income — filter by year / financialYear / category / cropId */
export const getIncomes = async (
  page = 1,
  limit = 20,
  cropId?: string,
  category?: IncomeCategory,
  year?: number,
  financialYear?: string,
): Promise<IncomeListResponse> => {
  const res = await API.get<IncomeListResponse>("/income", {
    params: { page, limit, cropId, category, year, financialYear },
  });
  return res.data;
};

/**
 * GET /income/summary
 * Returns totals grouped by category + grandTotal.
 * @param year           e.g. 2025 — pass undefined for all-time
 * @param financialYear  e.g. "2025-26" — overrides year when set
 */
export const getIncomeSummary = async (
  year?: number,
  financialYear?: string,
): Promise<IncomeSummaryResponse> => {
  const res = await API.get<IncomeSummaryResponse>("/income/summary", {
    params: { year, financialYear },
  });
  return res.data;
};

/**
 * GET /income/analytics
 * Compares this user's income to other consenting users.
 * Returns percentile rank, avg income, and AI advice strings.
 * Will return 403 if the user has not given analytics consent.
 *
 * @param year      defaults to current year
 * @param district  narrow comparison to same district only
 */
export const getIncomeAnalytics = async (
  year?: number,
  district?: District,
  financialYear?: string,
): Promise<IncomeAnalyticsResponse> => {
  const res = await API.get<IncomeAnalyticsResponse>("/income/analytics", {
    params: { year, district, financialYear },
  });
  return res.data;
};

/** GET /income/:id */
export const getIncomeById = async (id: string): Promise<Income> => {
  const res = await API.get<{ success: boolean; data: Income }>(
    `/income/${id}`,
  );
  return res.data.data;
};

/**
 * PUT /income/:id
 * Updates an income entry; server pre-save hook re-computes derived fields.
 */
export const updateIncome = async (
  id: string,
  payload: Partial<IncomePayload>,
): Promise<Income> => {
  const res = await API.put<{ success: boolean; data: Income }>(
    `/income/${id}`,
    payload,
  );
  return res.data.data;
};

/** DELETE /income/:id */
export const deleteIncome = async (id: string): Promise<void> => {
  await API.delete(`/income/${id}`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔔 NOTIFICATION TYPES + APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
  meta?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: AppNotification[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  };
}

/** GET /notifications */
export const getNotifications = async (
  page = 1,
  limit = 20,
  unreadOnly = false,
): Promise<NotificationListResponse> => {
  const res = await API.get<NotificationListResponse>("/notifications", {
    params: { page, limit, unreadOnly },
  });
  return res.data;
};

/** PATCH /notifications/:id/read */
export const markNotificationRead = async (
  id: string,
): Promise<AppNotification> => {
  const res = await API.patch<{ success: boolean; data: AppNotification }>(
    `/notifications/${id}/read`,
  );
  return res.data.data;
};

/** PATCH /notifications/read-all */
export const markAllNotificationsRead = async (): Promise<void> => {
  await API.patch("/notifications/read-all");
};

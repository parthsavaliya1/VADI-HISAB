// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 VADI-HISAAB — services/api.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// ─── Base URL ─────────────────────────────────
// 🔧 LOCAL: Replace IP with YOUR computer's IP (run: ipconfig / ifconfig)
//           Phone & computer must be on SAME WiFi
// 🚀 PROD:  Uncomment the render/production line

const BASE_URL = "http://192.168.1.3:8000/api"; // 🔧 Change IP here
// const BASE_URL = "https://vadi-backend.onrender.com/api"; // 🚀 Production

// ─── Axios Instance ───────────────────────────
export const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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
      return Promise.reject(
        new Error("Request timed out — server took too long to respond"),
      );
    }
    if (!error.response) {
      return Promise.reject(
        new Error(
          "Network error — make sure phone and PC are on same WiFi, and usesCleartextTraffic is enabled in app.json",
        ),
      );
    }

    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message ??
      "Something went wrong";

    return Promise.reject(new Error(message));
  },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type LandUnit = "acre" | "bigha";
export type WaterSource = "Rain" | "Borewell" | "Canal";
export type LabourType = "Family" | "Hired" | "Mixed";
export type District =
  | "Rajkot"
  | "Jamnagar"
  | "Junagadh"
  | "Amreli"
  | "Morbi"
  | "Bhavnagar"
  | "Surendranagar"
  | "Other";

export interface SendOtpResponse {
  message: string;
  sessionId: string;
}

export interface VerifyOtpResponse {
  token: string;
  isNewUser: boolean;
  isProfileCompleted: boolean;
  consentGiven: boolean;
}

export interface ConsentResponse {
  message: string;
  analyticsConsent: boolean;
}

export interface FarmerProfilePayload {
  name: string;
  village: string;
  district: District;
  totalLand: { value: number; unit: LandUnit };
  waterSource: WaterSource;
  tractorAvailable: boolean;
  labourType: LabourType;
}

export interface FarmerProfile extends FarmerProfilePayload {
  _id: string;
  user: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  message: string;
  profile: FarmerProfile;
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
  const res = await API.post<VerifyOtpResponse>("/auth/verify-otp", {
    phone,
    otp,
    sessionId,
  });
  await TokenStore.save(res.data.token);
  return res.data;
};

/** POST /auth/consent */
export const saveConsent = async (
  consent: boolean,
): Promise<ConsentResponse> => {
  const res = await API.post<ConsentResponse>("/auth/consent", { consent });
  return res.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 PROFILE APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /profile/complete */
export const completeProfile = async (
  payload: FarmerProfilePayload,
): Promise<ProfileResponse> => {
  const res = await API.post<ProfileResponse>("/profile/complete", payload);
  return res.data;
};

/** GET /profile/me */
export const getMyProfile = async (): Promise<FarmerProfile> => {
  const res = await API.get<FarmerProfile>("/profile/me");
  return res.data;
};

/** PUT /profile/update */
export const updateProfile = async (
  payload: Partial<FarmerProfilePayload>,
): Promise<ProfileResponse> => {
  const res = await API.put<ProfileResponse>("/profile/update", payload);
  return res.data;
};

/** Logout — clears JWT from AsyncStorage */
export const logout = async (): Promise<void> => {
  await TokenStore.clear();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 CROP TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CropSeason = "Kharif" | "Rabi" | "Summer";
export type CropStatus = "Active" | "Harvested" | "Closed";
export type AreaUnit = "Acre" | "Bigha" | "Hectare";

export interface CropPayload {
  userId?: string;
  season: CropSeason;
  cropName: string;
  cropEmoji?: string;
  area: number;
  areaUnit?: AreaUnit;
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
): Promise<CropListResponse> => {
  const res = await API.get<CropListResponse>("/crops", {
    params: { page, limit, season, status },
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

/** DELETE /crops/:id */
export const deleteCrop = async (id: string): Promise<void> => {
  await API.delete(`/crops/${id}`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💰 EXPENSE TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ExpenseCategory =
  | "Seed"
  | "Fertilizer"
  | "Pesticide"
  | "Labour"
  | "Machinery";

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
export type MachineryImplement =
  | "Rotavator"
  | "Plough"
  | "Sowing Machine"
  | "Thresher"
  | "Tractor Rental"
  | "બલૂન (Baluun)"
  | "રેપ (Rap)";

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

export interface LabourContractPayload {
  advanceReason: AdvanceReason;
  amountGiven: number;
}

export interface MachineryExpensePayload {
  implement: MachineryImplement;
  isContract: boolean;
  hoursOrAcres: number;
  rate: number;
}

export interface ExpensePayload {
  userId?: string;
  cropId: string;
  category: ExpenseCategory;
  date?: string;
  notes?: string;
  seed?: SeedExpensePayload;
  fertilizer?: FertilizerExpensePayload;
  pesticide?: PesticideExpensePayload;
  labourDaily?: LabourDailyPayload;
  labourContract?: LabourContractPayload;
  machinery?: MachineryExpensePayload;
}

export interface SeedExpense extends SeedExpensePayload {
  ratePerKg?: number;
}
export interface LabourDailyExpense extends LabourDailyPayload {
  totalCost: number;
}
export interface MachineryExpense extends MachineryExpensePayload {
  totalCost: number;
}

export interface Expense {
  _id: string;
  userId?: string;
  cropId: string;
  category: ExpenseCategory;
  date: string;
  notes?: string;
  seed?: SeedExpense;
  fertilizer?: FertilizerExpensePayload;
  pesticide?: PesticideExpensePayload;
  labourDaily?: LabourDailyExpense;
  labourContract?: LabourContractPayload;
  machinery?: MachineryExpense;
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

/** GET /expenses — filter by cropId / category / year */
export const getExpenses = async (
  cropId?: string,
  category?: ExpenseCategory,
  page = 1,
  limit = 100,
): Promise<ExpenseListResponse> => {
  const res = await API.get<ExpenseListResponse>("/expenses", {
    params: { cropId, category, page, limit },
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

// ── Sub-payload types (what you send to the API) ──────────────────────────────

export interface CropSalePayload {
  /** If cropId is NOT passed at the top level, provide the crop name here */
  cropName?: string;
  quantityKg: number;
  pricePerKg: number;
  buyerName?: string;
  marketName?: string;
}

export interface SubsidyPayload {
  schemeType: string;
  amount: number;
  referenceNumber?: string;
}

export interface RentalIncomePayload {
  assetType: string;
  rentedToName?: string;
  hoursOrDays: number;
  ratePerUnit: number;
}

export interface OtherIncomePayload {
  source: string;
  amount: number;
  description?: string;
}

// ── What the API returns (includes derived fields) ────────────────────────────

export interface CropSaleIncome extends CropSalePayload {
  /** Server-computed: quantityKg × pricePerKg */
  totalAmount?: number;
}

export interface RentalIncomeIncome extends RentalIncomePayload {
  /** Server-computed: hoursOrDays × ratePerUnit */
  totalAmount?: number;
}

// ── Full income payload sent to POST /income ──────────────────────────────────
export interface IncomePayload {
  /** Optional — links income to a specific crop */
  cropId?: string;
  category: IncomeCategory;
  date?: string;
  notes?: string;
  cropSale?: CropSalePayload;
  subsidy?: SubsidyPayload;
  rentalIncome?: RentalIncomePayload;
  otherIncome?: OtherIncomePayload;
}

// ── Full income document returned by the API ─────────────────────────────────
export interface Income {
  _id: string;
  userId?: string;
  /** Populated when ?populate=true or returned as object by backend */
  cropId?: string | { _id: string; cropName: string };
  category: IncomeCategory;
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌱 INCOME APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /income
 * Supports: year, category, cropId, page, limit
 */
export const getIncomes = async (
  page = 1,
  limit = 20,
  cropId?: string,
  category?: IncomeCategory,
  year?: number,
): Promise<IncomeListResponse> => {
  const res = await API.get<IncomeListResponse>("/income", {
    params: { page, limit, cropId, category, year },
  });
  return res.data;
};

/**
 * GET /income/summary
 * Returns totals grouped by category + grandTotal
 * @param year  e.g. 2024 — pass undefined for all-time
 */
export const getIncomeSummary = async (
  year?: number,
): Promise<IncomeSummaryResponse> => {
  const res = await API.get<IncomeSummaryResponse>("/income/summary", {
    params: { year },
  });
  return res.data;
};

/**
 * GET /income/:id
 * Returns a single income document
 */
export const getIncomeById = async (id: string): Promise<Income> => {
  const res = await API.get<{ success: boolean; data: Income }>(
    `/income/${id}`,
  );
  return res.data.data;
};

/**
 * POST /income
 * Creates a new income entry; pre-save hook computes derived fields
 */
export const createIncome = async (payload: IncomePayload): Promise<Income> => {
  const res = await API.post<{ success: boolean; data: Income }>(
    "/income",
    payload,
  );
  return res.data.data;
};

/**
 * PUT /income/:id
 * Updates an income entry; pre-save hook re-computes derived fields
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

/**
 * DELETE /income/:id
 */
export const deleteIncome = async (id: string): Promise<void> => {
  await API.delete(`/income/${id}`);
};

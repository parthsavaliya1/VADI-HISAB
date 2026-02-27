// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 VADI-HISAAB — services/api.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// ─── Base URL ─────────────────────────────────
// 🔧 LOCAL: Replace IP with YOUR computer's IP (run: ipconfig / ifconfig)
//           Phone & computer must be on SAME WiFi
// 🚀 PROD:  Uncomment the render/production line

const BASE_URL = "http://192.168.1.8:8000/api"; // 🔧 Change IP here
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
    console.log(`➡️  [API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);

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
        console.log("   Code    :", error.code);      // e.g. ECONNREFUSED, ENETUNREACH, ETIMEDOUT
        console.log("   Message :", error.message);
        console.log("   Status  :", error.response?.status);
        console.log("   Data    :", JSON.stringify(error.response?.data));

        // Friendly error codes guide
        if (error.code === "ECONNREFUSED") {
            return Promise.reject(new Error("Connection refused — check server is running and port is correct"));
        }
        if (error.code === "ENETUNREACH" || error.code === "ENOTFOUND") {
            return Promise.reject(new Error("Cannot reach server — check IP address in api.ts"));
        }
        if (error.code === "ECONNABORTED") {
            return Promise.reject(new Error("Request timed out — server took too long to respond"));
        }
        if (!error.response) {
            // No response at all = network level failure
            return Promise.reject(new Error("Network error — make sure phone and PC are on same WiFi, and usesCleartextTraffic is enabled in app.json"));
        }

        // Server responded with an error
        const message =
            error.response?.data?.message ??
            error.response?.data?.error ??
            error.message ??
            "Something went wrong";

        return Promise.reject(new Error(message));
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type LandUnit = "acre" | "bigha";
export type WaterSource = "Rain" | "Borewell" | "Canal";
export type LabourType = "Family" | "Hired" | "Mixed";
export type District =
    | "Rajkot" | "Jamnagar" | "Junagadh" | "Amreli"
    | "Morbi" | "Bhavnagar" | "Surendranagar" | "Other";

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

/** POST /auth/send-otp — Send OTP via 2Factor SMS */
export const sendOtp = async (phone: string): Promise<SendOtpResponse> => {
    const res = await API.post<SendOtpResponse>("/auth/send-otp", { phone });
    return res.data;
};

/**
 * POST /auth/verify-otp — Verify OTP
 * ✅ Token is automatically saved to AsyncStorage here
 */
export const verifyOtp = async (
    phone: string,
    otp: string,
    sessionId: string
): Promise<VerifyOtpResponse> => {
    const res = await API.post<VerifyOtpResponse>("/auth/verify-otp", { phone, otp, sessionId });
    await TokenStore.save(res.data.token); // ✅ auto-save
    return res.data;
};

/** POST /auth/consent — Save analytics consent (token auto-attached) */
export const saveConsent = async (consent: boolean): Promise<ConsentResponse> => {
    const res = await API.post<ConsentResponse>("/auth/consent", { consent });
    return res.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 PROFILE APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /profile/complete — Save profile first time (token auto-attached) */
export const completeProfile = async (payload: FarmerProfilePayload): Promise<ProfileResponse> => {
    const res = await API.post<ProfileResponse>("/profile/complete", payload);
    return res.data;
};

/** GET /profile/me — Get my profile (token auto-attached) */
export const getMyProfile = async (): Promise<FarmerProfile> => {
    const res = await API.get<FarmerProfile>("/profile/me");
    return res.data;
};

/** PUT /profile/update — Update profile (token auto-attached) */
export const updateProfile = async (payload: Partial<FarmerProfilePayload>): Promise<ProfileResponse> => {
    const res = await API.put<ProfileResponse>("/profile/update", payload);
    return res.data;
};

/** Logout — clears JWT from AsyncStorage */
export const logout = async (): Promise<void> => {
    await TokenStore.clear();
};
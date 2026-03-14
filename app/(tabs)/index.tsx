import { HEADER_PADDING_TOP } from "@/constants/theme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { getGujaratiLabel } from "@/data/gujarati-location";
import {
  getCrops,
  getCurrentFinancialYear,
  getExpenses,
  getFinancialYearOptions,
  getIncomes,
  getMyProfile,
  getNotifications,
  getYearlyReport,
  type Crop,
  type Expense,
  type ExpenseCategory,
} from "@/utils/api";
import { getCropColors } from "@/utils/cropColors";
import { formatArea, formatWholeNumber } from "@/utils/format";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
// મારા પાક section: viewport = SCREEN_W - 64; 2px pad each side so right border visible
const CROP_PAGE_WIDTH = SCREEN_W - 64;
const CROP_CARD_PAD = 2;
const CROP_CARD_WIDTH = CROP_PAGE_WIDTH - 2; // 2 + cardWidth = viewport so card right edge visible

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Color System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  green900: "#1B5E20",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green400: "#66BB6A",
  green100: "#C8E6C9",
  green50: "#E8F5E9",

  bg: "#F5F7F2",
  surface: "#FFFFFF",
  surfaceGreen: "#F1F8F1",

  textPrimary: "#0A0E0B",
  textSecondary: "#1A2E1C",
  textMuted: "#2D4230",

  income: "#1B5E20",
  incomePale: "#E8F5E9",
  expense: "#B71C1C",
  expensePale: "#FFEBEE",
  neutral: "#1565C0",
  neutralPale: "#E3F2FD",
  /** Cool blue (cyan-leaning) for accents — eye-catching but cool, not warm */
  coolBlue: "#00838F",
  coolBluePale: "#E0F7FA",
  coolBlueBorder: "#4DD0E1",

  /** Cool orange for tractor — dark orange font, light card */
  tractorOrange: "#E65100",
  tractorOrangePale: "#FFF3E0",
  tractorOrangeBorder: "#FFCC80",

  gold: "#F9A825",
  goldPale: "#FFFDE7",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

// Default static weather (replaced by dynamic fetch when available) — condition set from t() where t is available
function getWeatherDefault(t: (s: string, k: string) => string) {
  return {
    temp: "—",
    condition: t("dashboard", "weatherLoading"),
    humidity: "—",
    wind: "—",
    weatherCode: undefined as number | undefined,
    tempNum: undefined as number | undefined,
  };
}
// Open-Meteo rain codes (for weather box theme)
const WEATHER_RAIN_CODES = new Set([51, 61, 63, 65, 80, 81, 82, 95, 96, 99]);
type WeatherState = ReturnType<typeof getWeatherDefault>;
function getWeatherTheme(weather: WeatherState): "rain" | "clear" | "hot" {
  const code = weather.weatherCode ?? 0;
  const temp = weather.tempNum ?? 0;
  if (WEATHER_RAIN_CODES.has(code)) return "rain";
  if ((code === 0 || code === 1) && temp >= 32) return "hot";
  return "clear";
}

/** Crop display name from translations */
function cropDisplayName(
  name: string,
  t: (s: string, k: string) => string,
): string {
  return t("cropNames", name) || name;
}

/** Season label from translations */
function seasonCategoryLabel(
  season: string | undefined,
  t: (s: string, k: string) => string,
): string {
  if (season === "Chomasu") return t("common", "kharif");
  if (season === "Siyalo") return t("common", "rabi");
  if (season === "Unalo") return t("common", "summer");
  return season ?? "—";
}

/** Area unit in Gujarati (વીઘા / એકર) */
function areaUnitLabel(
  unit: string | undefined,
  t: (s: string, k: string) => string,
): string {
  return unit?.toLowerCase() === "acre"
    ? t("common", "acre")
    : t("common", "bigha");
}

/** Display vigha/bigha area as integer (no decimals). */
function formatVighaDisplay(area: number | string | undefined): string {
  const n = Number(area);
  if (area == null || area === "" || isNaN(n)) return String(area ?? "—");
  return String(Math.round(n));
}

/** Total land in bigha for per-bigha calculations (acre → bigha ≈ ×1.6) */
function totalLandBigha(
  profile: { totalLand?: { value: number; unit?: string } } | null,
): number {
  const tl = profile?.totalLand;
  if (!tl || !tl.value || tl.value <= 0) return 0;
  return tl.unit === "acre" ? tl.value * 1.6 : tl.value;
}

/** Crop area in bigha (Acre → ×1.6, Hectare → ×6.17) */
function cropAreaBigha(
  area: number | undefined,
  areaUnit: string | undefined,
): number {
  const a = Number(area);
  if (!a || a <= 0) return 0;
  if (areaUnit === "Acre") return a * 1.6;
  if (areaUnit === "Hectare") return a * 6.17;
  return a;
}

const HEADER_MAX = 160;
const HEADER_MIN = 72;
const STICKY_THRESHOLD = HEADER_MAX - HEADER_MIN;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 Income types  (mirrors Income.js model)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export type IncomeCategory =
  | "Crop Sale"
  | "Subsidy"
  | "Rental Income"
  | "Other";

export interface Income {
  _id: string;
  category: IncomeCategory;
  /** Server-computed total; use this when present for display */
  amount?: number;
  date: string;
  notes?: string;
  cropId?: string | { _id: string; cropName: string };
  cropSale?: { cropName: string; totalAmount?: number; marketName?: string };
  subsidy?: { schemeType: string; amount: number };
  rentalIncome?: { assetType: string; totalAmount?: number };
  otherIncome?: { source: string; amount: number };
  createdAt: string;
  updatedAt: string;
}

export interface IncomeListResponse {
  success: boolean;
  data: Income[];
  pagination: { total: number; page: number; limit: number };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔀 Transaction helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface Transaction {
  _id: string;
  type: "income" | "expense";
  label: string;
  crop: string;
  cropEmoji?: string;
  amount: number; // positive = income, negative = expense
  date: string; // Gujarati relative label
  rawDate: string; // ISO — used for sorting
  icon: string; // Ionicons name
  category: string;
}

const SEED_TYPE_LABELS: Record<string, string> = {
  "Company Brand": "કંપની બ્રાન્ડ",
  "Local/Desi": "લોકલ/દેશી",
  Hybrid: "હાઇબ્રિડ",
};

const FERTILIZER_LABELS: Record<string, string> = {
  Urea: "યુરિયા",
  DAP: "DAP",
  NPK: "NPK",
  Organic: "ઓર્ગેનિક",
  Sulphur: "સલ્ફર",
  Micronutrients: "માઇક્રોન્યુટ્રિએન્ટ્સ",
};

const PESTICIDE_LABELS: Record<string, string> = {
  Insecticide: "ઇન્સેક્ટિસાઇડ",
  Fungicide: "ફંગિસાઇડ",
  Herbicide: "હર્બિસાઇડ",
  "Growth Booster": "ગ્રોથ બૂસ્ટર",
};

const LABOUR_TASK_LABELS: Record<string, string> = {
  Weeding: "નીંદામણ",
  Sowing: "વાવેતર",
  Spraying: "છંટકાવ",
  Harvesting: "લણણી",
  Irrigation: "સિંચાઈ",
};

const MACHINERY_LABELS: Record<string, string> = {
  Rotavator: "રોટાવેટર",
  Plough: "હળ",
  "Sowing Machine": "સોઇંગ મશીન",
  Thresher: "થ્રેશર",
  "Tractor Rental": "ટ્રેક્ટર ભાડે",
  "બલૂન (Baluun)": "બલૂન",
  "રેપ (Rap)": "રેપ",
};

const RENTAL_ASSET_LABELS: Record<string, string> = {
  Tractor: "ટ્રેક્ટર",
  Rotavator: "રોટાવેટર",
  RAP: "RAP",
  Samar: "સમાર",
  "Sah Nakhya": "સહ નાખ્યા",
  Vavetar: "વાવેતર",
  "Kyara Bandhya": "ક્યારા બાંધ્યા",
  Thresher: "થ્રેશર",
  Bagu: "બાગુ",
  Fukani: "ફુકાણી",
  "Kheti Kari": "ખેતી કરી",
  "Other Equipment": "અન્ય સાધન",
};

function formatRelativeDate(
  iso: string,
  _t: (s: string, k: string) => string,
): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Actual date for crop cards / detail (e.g. "7 Mar 2025") */
function formatDisplayDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCropName(
  cropId: string | { _id: string; cropName: string } | undefined,
  crops: Crop[] | undefined,
  t: (s: string, k: string) => string,
): string {
  if (!cropId) return "";
  if (typeof cropId === "object")
    return cropDisplayName(cropId.cropName ?? "", t);
  if (crops?.length) {
    const c = crops.find((x) => x._id === cropId);
    if (c) return cropDisplayName(c.cropName ?? "", t);
  }
  return "";
}

function getCropEmoji(
  cropId: string | { _id: string; cropName: string } | undefined,
  crops: Crop[] | undefined,
): string | undefined {
  if (!cropId || !crops?.length) return undefined;
  if (typeof cropId === "object") {
    return crops.find((x) => x._id === cropId._id)?.cropEmoji;
  }
  return crops.find((x) => x._id === cropId)?.cropEmoji;
}

// ── Expense helpers ───────────────────────────
function expenseAmount(e: Expense): number {
  const top = (e as any).amount;
  if (typeof top === "number" && !Number.isNaN(top)) return top;
  if (e.category === "Seed") return e.seed?.totalCost ?? 0;
  if (e.category === "Fertilizer") return e.fertilizer?.totalCost ?? 0;
  if (e.category === "Pesticide") return e.pesticide?.cost ?? 0;
  if (e.category === "Labour")
    return e.labourDaily?.totalCost ?? e.labourContract?.amountGiven ?? 0;
  if (e.category === "Machinery") return e.machinery?.totalCost ?? 0;
  if (e.category === "Irrigation") return e.irrigation?.amount ?? 0;
  if (e.category === "Other") return e.other?.totalAmount ?? 0;
  return 0;
}

function expenseLabel(e: Expense): string {
  const labourReasonMap: Record<string, string> = {
    Grocery: "કરીયાણું",
    Loan: "ઉધાર",
    Medical: "દવા/મેડિકલ",
    "Mobile Recharge": "મોબાઇલ રિચાર્જ",
    Festival: "તહેવાર",
    Other: "અન્ય",
  };

  if (e.category === "Labour") {
    if (e.expenseSource === "generalExpense") {
      return e.notes?.trim() || "વધારો નો ખર્ચ";
    }

    if (e.labourDaily?.task) {
      return `મજૂરી - ${LABOUR_TASK_LABELS[e.labourDaily.task] ?? e.labourDaily.task}`;
    }

    if (e.expenseSource === "bhagyaUpad" || e.labourContract?.advanceReason) {
      const reason = e.labourContract?.advanceReason;
      if (reason === "Other") return e.notes?.trim() || labourReasonMap.Other;
      if (reason) return labourReasonMap[reason] ?? reason;
    }
  }

  const m: Record<ExpenseCategory, string> = {
    Seed: `બિયારણ - ${SEED_TYPE_LABELS[e.seed?.seedType ?? ""] ?? e.seed?.seedType ?? ""}`,
    Fertilizer: `ખાતર - ${FERTILIZER_LABELS[e.fertilizer?.productName ?? ""] ?? e.fertilizer?.productName ?? ""}`,
    Pesticide: `જંતુનાશક - ${PESTICIDE_LABELS[e.pesticide?.category ?? ""] ?? e.pesticide?.category ?? ""}`,
    Labour: "મજૂરી",
    Machinery: `ટ્રેક્ટર - ${MACHINERY_LABELS[e.machinery?.implement ?? ""] ?? e.machinery?.implement ?? ""}`,
    Irrigation: "સિંચાઈ",
    Other: e.other?.description
      ? `અન્ય ખર્ચ - ${e.other.description}`
      : "અન્ય ખર્ચ",
  };
  return m[e.category] ?? e.category;
}

function expenseIcon(cat: ExpenseCategory): string {
  const m: Record<ExpenseCategory, string> = {
    Seed: "leaf-outline",
    Fertilizer: "leaf",
    Pesticide: "flask-outline",
    Labour: "people",
    Machinery: "cog-outline",
    Irrigation: "water-outline",
    Other: "ellipsis-horizontal-outline",
  };
  return m[cat] ?? "receipt-outline";
}

function isDedicatedBhagyaUpadExpense(expense: Expense): boolean {
  if (expense.cropId || expense.category !== "Labour") return false;
  if (expense.expenseSource === "bhagyaUpad") return true;
  if (expense.labourContract?.sourceTag === "bhagyaUpad") return true;

  // Legacy bhagya-no-upad rows created before source tagging.
  return (
    !!expense.labourContract?.advanceReason &&
    expense.labourContract.advanceReason !== "Other" &&
    !expense.notes?.trim()
  );
}

// ── Income helpers ────────────────────────────
function incomeAmount(i: Income): number {
  const top = (i as any).amount;
  if (top != null && top !== "") {
    const n = Number(top);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (i.category === "Crop Sale") return (i.cropSale as any)?.totalAmount ?? 0;
  if (i.category === "Subsidy") return i.subsidy?.amount ?? 0;
  if (i.category === "Rental Income")
    return (i.rentalIncome as any)?.totalAmount ?? 0;
  if (i.category === "Other") return i.otherIncome?.amount ?? 0;
  return 0;
}

function incomeLabel(i: Income): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": `વેચાણ - ${i.cropSale?.marketName || "VADI"}`,
    Subsidy: `સહા. - ${i.subsidy?.schemeType ?? ""}`,
    // Tractor / rental income: work type + farmer name (no emoji)
    "Rental Income": (() => {
      const r = i.rentalIncome as any;
      if (!r) return "ભાડા";
      const work =
        RENTAL_ASSET_LABELS[r.assetType ?? ""] ?? r.assetType ?? "ભાડા";
      const name = r.rentedToName?.trim();
      return name ? `${work} - ${name}` : `${work}`;
    })(),
    Other: `અ. - ${i.otherIncome?.source ?? ""}`,
  };
  return m[i.category] ?? i.category;
}

function incomeIcon(cat: IncomeCategory): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": "cash",
    Subsidy: "ribbon-outline",
    // Use car-outline as tractor-style icon for rental income
    "Rental Income": "car-outline",
    Other: "wallet-outline",
  };
  return m[cat] ?? "cash";
}

// ── Merge & sort: combined expenses + incomes by date, show latest 5 total (તાજા વ્યવહાર) ─
const RECENT_TXN_LIMIT = 5;

function buildTransactions(
  expenses: Expense[],
  incomes: Income[],
  t: (s: string, k: string) => string,
  crops: Crop[] = [],
): Transaction[] {
  const expTxns: Transaction[] = expenses.map((e) => ({
    _id: e._id,
    type: "expense" as const,
    label: expenseLabel(e),
    crop: getCropName(e.cropId as any, crops, t),
    cropEmoji: getCropEmoji(e.cropId as any, crops),
    amount: -expenseAmount(e),
    date: formatRelativeDate(e.date, t),
    rawDate: e.date,
    icon: expenseIcon(e.category),
    category: e.category,
  }));

  const incTxns: Transaction[] = incomes.map((i) => {
    const rawDate = i.date ?? (i as any).createdAt ?? "";
    return {
      _id: i._id,
      type: "income" as const,
      label: incomeLabel(i),
      crop: getCropName(i.cropId, crops, t),
      cropEmoji: getCropEmoji(i.cropId, crops),
      amount: incomeAmount(i),
      date: formatRelativeDate(rawDate, t),
      rawDate,
      icon: incomeIcon(i.category),
      category: i.category,
    };
  });

  return [...expTxns, ...incTxns]
    .sort((a, b) => {
      const tb = new Date(b.rawDate).getTime();
      const ta = new Date(a.rawDate).getTime();
      if (Number.isNaN(tb)) return -1;
      if (Number.isNaN(ta)) return 1;
      return tb - ta;
    })
    .slice(0, RECENT_TXN_LIMIT);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔢 Animated counter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AnimatedNumber({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 1400,
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.floor(v)));
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text style={styles.netProfitAmount}>
      {formatWholeNumber(Math.abs(display))}
    </Text>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💀 Skeleton
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SkeletonLine({
  width: w,
  height: h = 14,
  style,
}: {
  width: number | string;
  height?: number;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        {
          width: w as number,
          height: h,
          borderRadius: h / 2,
          backgroundColor: C.green100,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🃏 Spring card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PressableCard({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: object | object[];
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
    }).start();
  const onOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style)
    : (style ?? {});
  const { flex, width: fw, alignSelf, ...restStyle } = flatStyle as any;
  const outer: Record<string, unknown> = {};
  if (flex !== undefined) outer.flex = flex;
  if (fw !== undefined) outer.width = fw;
  if (alignSelf !== undefined) outer.alignSelf = alignSelf;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      style={Object.keys(outer).length ? outer : undefined}
    >
      <Animated.View style={[restStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌾 Crop Picker Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CropPickerModal({
  t,
  tParam,
  visible,
  crops,
  onSelect,
  onClose,
  type,
  onSelectGeneralExpense,
  onSelectGeneralIncome,
}: {
  t: (s: string, k: string) => string;
  tParam: (s: string, k: string, p: Record<string, string | number>) => string;
  visible: boolean;
  crops: Crop[];
  onSelect: (c: Crop) => void;
  onClose: () => void;
  type: "expense" | "income";
  onSelectGeneralExpense?: () => void;
  onSelectGeneralIncome?: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const isExpense = type === "expense";
  const accentColor = isExpense ? C.expense : C.income;
  const accentPale = isExpense ? C.expensePale : C.incomePale;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>
              {isExpense
                ? `💸 ${t("dashboard", "addExpense")}`
                : `💰 ${t("dashboard", "addIncome")}`}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {t("dashboard", "selectCropFirst")}
            </Text>
          </View>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {crops.length === 0 && !onSelectGeneralExpense ? (
          <View style={styles.sheetEmpty}>
            <Text style={{ fontSize: 58, marginBottom: 14 }}>🌱</Text>
            <Text style={styles.sheetEmptyText}>
              {t("dashboard", "noCrops")}
            </Text>
            <TouchableOpacity
              style={[styles.sheetEmptyBtn, styles.sheetEmptyBtnAdd]}
              onPress={() => {
                onClose();
                router.push("/crop/add-crop");
              }}
            >
              <Text style={styles.sheetEmptyBtnTextAdd}>
                + {t("dashboard", "addNewCrop")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {crops.map((crop) => {
              const colors = getCropColors(crop.cropName);
              return (
                <TouchableOpacity
                  key={crop._id}
                  style={styles.sheetCropRow}
                  onPress={() => onSelect(crop)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={colors}
                    style={styles.sheetCropEmojiBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={{ fontSize: 30 }}>
                      {crop.cropEmoji ?? "🌱"}
                    </Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetCropName}>
                      {cropDisplayName(crop.cropName, t)}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <Text style={styles.sheetCropMeta}>
                        {crop.season === "Chomasu"
                          ? `☔ ${t("common", "kharif")}`
                          : crop.season === "Siyalo"
                            ? `❄️ ${t("common", "rabi")}`
                            : `☀️ ${t("common", "summer")}`}
                        {" · "}
                        <Text style={styles.bighaFont}>
                          {formatVighaDisplay(crop.area)}{" "}
                        </Text>
                        {areaUnitLabel(crop.areaUnit, t)}
                      </Text>
                      {crop.landType === "bhagma" &&
                        crop.bhagmaPercentage != null && (
                          <View
                            style={[
                              styles.bhagmaBadge,
                              { backgroundColor: C.expensePale },
                            ]}
                          >
                            <Text
                              style={[
                                styles.bhagmaBadgeText,
                                { color: C.expense },
                              ]}
                            >
                              {tParam("dashboard", "bhagmaPct", {
                                pct: crop.bhagmaPercentage ?? 0,
                              })}
                            </Text>
                          </View>
                        )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.sheetCropStatus,
                      {
                        backgroundColor:
                          crop.status === "Active" ? C.incomePale : C.goldPale,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            crop.status === "Active" ? C.income : C.gold,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.sheetCropStatusText,
                        { color: crop.status === "Active" ? C.income : C.gold },
                      ]}
                    >
                      {crop.status === "Active"
                        ? t("common", "statusActive")
                        : crop.status === "Harvested"
                          ? t("common", "statusHarvested")
                          : t("common", "statusClosed")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={accentColor}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              );
            })}
            {/* સામાન્ય ખર્ચ only when Add Expense; સામાન્ય આવક only when Add Income */}
            {isExpense && onSelectGeneralExpense && (
              <TouchableOpacity
                style={styles.sheetGeneralCard}
                onPress={() => {
                  onSelectGeneralExpense();
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.sheetCropEmojiBg,
                    { backgroundColor: C.expensePale },
                  ]}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={30}
                    color={C.expense}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetCropName}>
                    {t("dashboard", "generalExpense")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={C.expense}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            )}
            {!isExpense && onSelectGeneralIncome && (
              <TouchableOpacity
                style={styles.sheetGeneralCardIncome}
                onPress={() => {
                  onSelectGeneralIncome();
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.sheetCropEmojiBg,
                    { backgroundColor: C.incomePale },
                  ]}
                >
                  <Ionicons name="wallet-outline" size={30} color={C.income} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetCropName}>
                    {t("dashboard", "generalIncome")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={C.income}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚡ Quick Actions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function QuickActions({
  t,
  onAddExpense,
  onAddIncome,
  onAddBhagyaUpad,
  profile,
}: {
  t: (s: string, k: string) => string;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onAddBhagyaUpad: () => void;
  profile: { tractorAvailable?: boolean } | null;
}) {
  const showTractor = !!profile?.tractorAvailable;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        ⚡ {t("dashboard", "quickActions")}
      </Text>
      <View style={{ height: 14 }} />
      <View style={styles.qaRow}>
        <PressableCard onPress={onAddExpense} style={styles.qaHalf}>
          <View
            style={[
              styles.qaCard,
              styles.qaCommonCard,
              { backgroundColor: C.expensePale, borderColor: "#FFCDD2" },
            ]}
          >
            <View style={[styles.qaIcon, { backgroundColor: "#FFCDD2" }]}>
              <Ionicons
                name="remove-circle-outline"
                size={20}
                color={C.expense}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.expense }]}>
                {t("dashboard", "expense")}
              </Text>
            </View>
          </View>
        </PressableCard>

        <PressableCard onPress={onAddIncome} style={styles.qaHalf}>
          <View
            style={[
              styles.qaCard,
              styles.qaCommonCard,
              { backgroundColor: C.incomePale, borderColor: C.green100 },
            ]}
          >
            <View style={[styles.qaIcon, { backgroundColor: C.green100 }]}>
              <Ionicons name="add-circle-outline" size={20} color={C.income} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.income }]}>
                {t("dashboard", "income")}
              </Text>
            </View>
          </View>
        </PressableCard>
      </View>

      {showTractor ? (
        <View style={[styles.qaRow, { marginTop: 10 }]}>
          <PressableCard
            onPress={() => router.push("/income/tractor-income-list" as any)}
            style={styles.qaHalf}
          >
            <View
              style={[
                styles.qaCard,
                styles.qaCommonCard,
                {
                  backgroundColor: C.tractorOrangePale,
                  borderColor: C.tractorOrangeBorder,
                },
              ]}
            >
              <View style={[styles.qaIcon, { backgroundColor: "#FFE0B2" }]}>
                <MaterialCommunityIcons
                  name="tractor-variant"
                  size={20}
                  color={C.tractorOrange}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.qaLabel, { color: C.tractorOrange }]}>
                  ટ્રેક્ટર હિસાબ
                </Text>
              </View>
            </View>
          </PressableCard>

          <PressableCard
            onPress={() => router.push("/expense/bhagya-upad-list" as any)}
            style={styles.qaHalf}
          >
            <View
              style={[
                styles.qaCard,
                styles.qaCommonCard,
                { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" },
              ]}
            >
              <View style={[styles.qaIcon, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons name="wallet-outline" size={20} color="#0369A1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.qaLabel, { color: "#0369A1" }]}>
                  {t("dashboard", "bhagyaUpad")}
                </Text>
              </View>
            </View>
          </PressableCard>
        </View>
      ) : (
        <PressableCard
          onPress={() => router.push("/expense/bhagya-upad-list" as any)}
          style={{ marginTop: 10 }}
        >
          <View
            style={[
              styles.qaCardFull,
              styles.qaCommonCard,
              { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" },
            ]}
          >
            <View style={[styles.qaIcon, { backgroundColor: "#E0F2FE" }]}>
              <Ionicons name="wallet-outline" size={20} color="#0369A1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: "#0369A1" }]}>
                {t("dashboard", "bhagyaUpad")}
              </Text>
            </View>
          </View>
        </PressableCard>
      )}

      <PressableCard
        onPress={() => router.push("/crop/add-crop")}
        style={{ marginTop: 10 }}
      >
        <View
          style={[
            styles.qaCardFull,
            styles.qaCommonCard,
            styles.qaCardFullAddCrop,
          ]}
        >
          <View style={[styles.qaIcon, styles.qaCardFullAddCropIcon]}>
            <Ionicons name="leaf" size={23} color="#5D4037" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.qaLabel, styles.qaCardFullAddCropText]}>
              નવો પાક ઉમેરો
            </Text>
          </View>
        </View>
      </PressableCard>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧾 Recent Transactions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RecentTransactions({
  t,
  transactions,
  loading,
}: {
  t: (s: string, k: string) => string;
  transactions: Transaction[];
  loading: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          🧾 {t("dashboard", "recentTxns")}
        </Text>
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => router.push("/all-transactions" as any)}
        >
          <Text style={styles.seeAll}>{t("dashboard", "seeAll")}</Text>
          <Ionicons name="chevron-forward" size={22} color={C.green700} />
        </TouchableOpacity>
      </View>
      <View style={styles.txnList}>
        {loading ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={C.green500} size="small" />
            <Text style={{ color: C.textMuted, marginTop: 8, fontSize: 17 }}>
              {t("dashboard", "loading")}
            </Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={{ padding: 28, alignItems: "center" }}>
            <Text style={{ fontSize: 42, marginBottom: 10 }}>🧾</Text>
            <Text
              style={{ color: C.textMuted, fontSize: 18, fontWeight: "700" }}
            >
              {t("dashboard", "noTxns")}
            </Text>
            <Text style={{ color: C.textMuted, fontSize: 16, marginTop: 4 }}>
              {t("dashboard", "addExpenseOrIncome")}
            </Text>
          </View>
        ) : (
          transactions.map((t, i) => (
            <TouchableOpacity
              key={t._id}
              style={[
                styles.txnItem,
                i < transactions.length - 1 && styles.txnBorder,
              ]}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  `/transaction/details?id=${t._id}&type=${t.type}` as any,
                )
              }
            >
              <View
                style={[
                  styles.txnIcon,
                  {
                    backgroundColor:
                      t.type === "income" ? C.incomePale : C.expensePale,
                  },
                ]}
              >
                {t.cropEmoji ? (
                  <Text style={styles.txnCropEmoji}>{t.cropEmoji}</Text>
                ) : (
                  <Ionicons
                    name={t.icon as any}
                    size={20}
                    color={t.type === "income" ? C.income : C.expense}
                  />
                )}
              </View>
              <View style={styles.txnInfo}>
                <Text style={styles.txnLabel}>{t.label}</Text>
                {t.crop ? (
                  <Text style={styles.txnMeta}>
                    {t.crop} · {t.date}
                  </Text>
                ) : (
                  <Text style={styles.txnMeta}>{t.date}</Text>
                )}
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text
                  style={[
                    styles.txnAmount,
                    { color: t.type === "income" ? C.income : C.expense },
                  ]}
                >
                  {t.amount > 0 ? "+" : ""}
                  {formatWholeNumber(Math.abs(t.amount))}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={C.textMuted}
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏠 Main Dashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Dashboard() {
  const { t, tParam } = useLanguage();
  const { profile, setProfile } = useProfile();
  const { transactionsRefreshKey } = useRefresh();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
  }>({ totalIncome: 0, totalExpense: 0, netProfit: 0 });
  const [bhagyaUpadTotal, setBhagyaUpadTotal] = useState(0);
  const [tractorIncomeTotal, setTractorIncomeTotal] = useState(0);
  const [tractorPendingTotal, setTractorPendingTotal] = useState(0);
  const [tractorPaidTotal, setTractorPaidTotal] = useState(0);
  const [transactions, setTxns] = useState<Transaction[]>([]);
  const [selectedCrop, setSelected] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"expense" | "income">("expense");
  const [weather, setWeather] = useState<WeatherState>(() =>
    getWeatherDefault(t),
  );
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cropScrollRef = useRef<ScrollView>(null);

  // ── Load all data via api.ts (filtered by selected financial year) ───────────
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const [
          prof,
          cropRes,
          yearlyReport,
          expRes,
          incRes,
          notificationRes,
          bhagyaExpRes,
        ] = await Promise.all([
          getMyProfile(),
          getCrops(1, 100, undefined, undefined, financialYear),
          getYearlyReport(financialYear),
          getExpenses(undefined, undefined, undefined, 1, 30, financialYear),
          getIncomes(1, 30, undefined, undefined, undefined, financialYear),
          getNotifications(1, 20),
          getExpenses(undefined, "Labour", undefined, 1, 500, financialYear),
        ]);
        setProfile(prof);
        setUnreadNotificationCount(
          notificationRes.pagination?.unreadCount ?? 0,
        );
        const reportCrops = yearlyReport.crops ?? [];
        const bhagyaUpadTotal = (bhagyaExpRes.data ?? [])
          .filter(isDedicatedBhagyaUpadExpense)
          .reduce((sum, expense) => sum + expenseAmount(expense as any), 0);
        const reportSummary = yearlyReport.summary ?? {
          totalIncome: 0,
          cropExpense: 0,
          bhagyaUpadTotal: 0,
          tractorIncome: 0,
        };
        const tractorIncomeFromReport = reportSummary.tractorIncome ?? 0;
        const excludeTractor = !prof?.tractorAvailable;
        // When tractor is disabled in profile, exclude tractor from all calculations
        const allIncome =
          (reportSummary.totalIncome ?? 0) -
          (excludeTractor ? tractorIncomeFromReport : 0);
        // Main summary: total income includes extra (minus tractor when disabled); total expense = sum of individual crop expenses only
        const cropExpense =
          reportSummary.cropExpense ??
          reportCrops.reduce((s: number, r: any) => s + (r.expense ?? 0), 0);
        setSummary({
          totalIncome: allIncome,
          totalExpense: cropExpense,
          netProfit: allIncome - cropExpense,
        });
        setBhagyaUpadTotal(bhagyaUpadTotal);
        setTractorIncomeTotal(excludeTractor ? 0 : tractorIncomeFromReport);
        setCrops(
          cropRes.data.map((c: Crop) => {
            const report = reportCrops.find((r) => r._id === c._id);
            return {
              ...c,
              income: report?.income ?? 0,
              expense: report?.expense ?? 0,
              profit:
                report?.profit ??
                (report ? (report.income ?? 0) - (report.expense ?? 0) : 0),
              ...(report?.labourShare != null && {
                labourShare: report.labourShare as number,
              }),
              ...(report?.farmerDirectExpense != null && {
                farmerDirectExpense: report.farmerDirectExpense as number,
              }),
            };
          }),
        );
        const expenses = Array.isArray(expRes?.data) ? expRes.data : [];
        let incomes = Array.isArray(incRes?.data) ? incRes.data : [];
        if (excludeTractor) {
          incomes = incomes.filter((i: any) => i.category !== "Rental Income");
        }

        // Tractor income: split total by payment status (only when tractor enabled)
        const rentalIncomes = excludeTractor
          ? []
          : incomes.filter((i: any) => i.category === "Rental Income");
        let pendingTotal = 0;
        let paidTotal = 0;
        for (const inc of rentalIncomes) {
          const r: any = inc.rentalIncome ?? {};
          const amt = Number(r.totalAmount ?? 0);
          if (!Number.isFinite(amt) || amt <= 0) continue;
          if (r.paymentStatus === "Pending") pendingTotal += amt;
          if (r.paymentStatus === "Completed") paidTotal += amt;
        }
        setTractorPendingTotal(excludeTractor ? 0 : pendingTotal);
        setTractorPaidTotal(excludeTractor ? 0 : paidTotal);
        setTxns(
          buildTransactions(
            expenses,
            incomes as Income[],
            t,
            cropRes.data ?? [],
          ),
        );
      } catch (err) {
        console.log("[Dashboard] loadData error:", (err as Error).message);
      } finally {
        setLoadingProfile(false);
        setLoadingTxns(false);
        setRefreshing(false);
      }
    },
    [t, tParam, financialYear],
  );

  useEffect(() => {
    loadData();
  }, [loadData, transactionsRefreshKey]);

  useFocusEffect(
    useCallback(() => {
      getNotifications(1, 20)
        .then((res) =>
          setUnreadNotificationCount(res.pagination?.unreadCount ?? 0),
        )
        .catch(() => {});
    }, []),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Live weather from Open-Meteo: use device location when allowed, else profile district.
  const defaultCoords: Record<string, [number, number]> = {
    Rajkot: [22.3, 70.8],
    Jamnagar: [22.47, 70.07],
    Junagadh: [21.52, 70.47],
    Amreli: [21.6, 71.22],
    Morbi: [22.82, 70.84],
    Bhavnagar: [21.76, 72.15],
    Surendranagar: [22.7, 71.64],
  };
  const fallbackCoords: [number, number] =
    profile?.district && defaultCoords[profile.district]
      ? defaultCoords[profile.district]
      : [22.3, 70.8];

  useEffect(() => {
    let cancelled = false;
    const fetchWeather = (lat: number, lon: number) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const c = data?.current;
          if (!c) return;
          const temp = Math.round(Number(c.temperature_2m)) ?? 0;
          const humidity = Math.round(Number(c.relative_humidity_2m)) ?? 0;
          const windKmh = Math.round(Number(c.wind_speed_10m) ?? 0);
          const code = Number(c.weather_code) ?? 0;
          const condition =
            t("weather", String(code)) || t("weather", "partlyCloudy");
          setWeather({
            temp: `${temp}°C`,
            condition,
            humidity: `${humidity}%`,
            wind: `${windKmh} km/h`,
            weatherCode: code,
            tempNum: temp,
          });
        })
        .catch(() => {});
    };

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (cancelled) return;
          const { latitude, longitude } = loc.coords;
          fetchWeather(latitude, longitude);
          return;
        }
      } catch {
        // ignore
      }
      fetchWeather(fallbackCoords[0], fallbackCoords[1]);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.district, t]);

  const totalIncome = summary.totalIncome;
  const totalExpense = summary.totalExpense;
  const totalProfit = summary.netProfit;
  const landBigha = totalLandBigha(profile);
  const incomePerBigha = landBigha > 0 ? totalIncome / landBigha : 0;
  const expensePerBigha = landBigha > 0 ? totalExpense / landBigha : 0;

  const farmerName = profile?.name ?? "";
  const villageGujarati = getGujaratiLabel(
    profile?.district ?? "",
    profile?.taluka ?? "",
    profile?.village ?? "",
  ).village;
  const farmerLand = profile?.totalLand
    ? `${profile.totalLand.unit === "bigha" ? formatArea(profile.totalLand.value) : formatWholeNumber(profile.totalLand.value)} ${profile.totalLand.unit === "bigha" ? t("common", "bigha") : t("common", "acre")}`
    : "";
  const avatarChar = farmerName.trim().charAt(0) || "🌾";

  // ── Animated header ────────────────────────────────────────────────────────────
  const headerHeight = scrollY.interpolate({
    inputRange: [0, STICKY_THRESHOLD],
    outputRange: [HEADER_MAX, HEADER_MIN],
    extrapolate: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, STICKY_THRESHOLD * 0.5, STICKY_THRESHOLD],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });
  const stickyOpacity = scrollY.interpolate({
    inputRange: [STICKY_THRESHOLD * 0.6, STICKY_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const paddingTop = HEADER_PADDING_TOP;

  // ── Navigation ─────────────────────────────────────────────────────────────────
  const openExpensePicker = () => {
    setPickerType("expense");
    setPickerVisible(true);
  };
  const openIncomePicker = () => {
    setPickerType("income");
    setPickerVisible(true);
  };
  const openNotifications = () => {
    router.push("/notifications");
  };

  const handleCropSelected = (crop: Crop) => {
    setPickerVisible(false);
    if (pickerType === "expense") {
      router.push(`/expense/add-expense?cropId=${crop._id}` as any);
    } else {
      router.push(`/income/add-income?cropId=${crop._id}` as any); // ✅
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Sticky mini header ── */}
      <Animated.View
        style={[styles.stickyHeader, { opacity: stickyOpacity, paddingTop }]}
      >
        <View style={styles.stickyInner}>
          <View style={styles.stickyLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{avatarChar}</Text>
            </View>
            <Text style={styles.stickyName}>
              {farmerName || t("dashboard", "farmer")}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={openNotifications}>
            <Ionicons
              name="notifications-outline"
              size={28}
              color={C.green700}
            />
            {unreadNotificationCount > 0 ? (
              <View style={styles.notifDot} />
            ) : null}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Collapsible header ── */}
      <Animated.View style={[styles.headerWrapper, { height: headerHeight }]}>
        <LinearGradient
          colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
          style={[styles.header, { paddingTop }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <Animated.View style={{ opacity: headerOpacity }}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                {loadingProfile ? (
                  <SkeletonLine
                    width={180}
                    height={24}
                    style={{ marginVertical: 4 }}
                  />
                ) : (
                  <Text style={styles.farmerName} numberOfLines={1}>
                    {farmerName || t("dashboard", "farmer")}
                  </Text>
                )}
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.notifBtn}
                  onPress={openNotifications}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={28}
                    color={C.green700}
                  />
                  {unreadNotificationCount > 0 ? (
                    <View style={styles.notifDot} />
                  ) : null}
                </TouchableOpacity>
              </View>
            </View>
            {(() => {
              const theme = getWeatherTheme(weather);
              const rainStyle =
                theme === "rain" ? styles.weatherBarRain : undefined;
              const clearStyle =
                theme === "clear" ? styles.weatherBarClear : undefined;
              const hotStyle =
                theme === "hot" ? styles.weatherBarHot : undefined;
              const weatherBarStyle = [
                styles.weatherBar,
                rainStyle,
                clearStyle,
                hotStyle,
              ];
              const iconName =
                theme === "rain"
                  ? "rainy-outline"
                  : theme === "hot"
                    ? "sunny"
                    : "partly-sunny-outline";
              const iconColor =
                theme === "rain"
                  ? "#7EB8DA"
                  : theme === "hot"
                    ? "#C4A574"
                    : "#B8C99E";
              return (
                <View style={weatherBarStyle}>
                  <Ionicons
                    name={iconName as any}
                    size={24}
                    color={iconColor}
                  />
                  <Text style={styles.weatherTemp}>{weather.temp}</Text>
                  <Text style={styles.weatherCond}>{weather.condition}</Text>
                  <View style={styles.weatherDivider} />
                  <Ionicons
                    name="water-outline"
                    size={14}
                    color={C.textMuted}
                  />
                  <Text style={styles.weatherStat}>{weather.humidity}</Text>
                  <Ionicons name="flag-outline" size={14} color={C.textMuted} />
                  <Text style={styles.weatherStat}>{weather.wind}</Text>
                </View>
              );
            })()}
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* ── Scroll body ── */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[C.green500]}
            tintColor={C.green500}
          />
        }
      >
        {/* ── Financial year selector ── */}
        <View style={styles.fyRow}>
          {getFinancialYearOptions().map((y) => (
            <TouchableOpacity
              key={y}
              style={[
                styles.fyChip,
                financialYear === y && styles.fyChipActive,
              ]}
              onPress={() => setFinancialYear(y)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.fyChipText,
                  financialYear === y && styles.fyChipTextActive,
                ]}
              >
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Net Profit Card (કુલ ચોખ્ખો નફો) — compact, tight layout ── */}
        <Animated.View
          style={[
            styles.section,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <PressableCard>
            <View style={styles.profitCard}>
              <View
                style={[
                  styles.profitStrip,
                  {
                    backgroundColor: totalProfit >= 0 ? C.green500 : C.expense,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.profitAmountRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      flex: 1,
                    }}
                  >
                    <Text
                      style={[
                        styles.profitSign,
                        { color: totalProfit >= 0 ? C.income : C.expense },
                      ]}
                    >
                      {totalProfit >= 0 ? "+" : "-"}
                    </Text>
                    <AnimatedNumber value={Math.abs(totalProfit)} />
                    <Text style={styles.profitStatusLabel}>
                      {totalProfit >= 0 ? "કુલ નફો" : "કુલ ખર્ચો"}
                    </Text>
                  </View>
                  <View style={styles.profitPakBadge}>
                    <Text style={styles.profitPakValue}>{crops.length}</Text>
                    <Text style={styles.profitPakLabel}>
                      {t("dashboard", "crops")}
                    </Text>
                  </View>
                </View>
                <View style={styles.profitSubRow}>
                  {(
                    [
                      {
                        icon: "arrow-up-circle-outline",
                        label: t("dashboard", "income"),
                        value: totalIncome,
                        color: C.income,
                      },
                      {
                        icon: "arrow-down-circle-outline",
                        label: t("dashboard", "expense"),
                        value: totalExpense,
                        color: C.expense,
                      },
                    ] as const
                  ).map((item, i) => (
                    <View key={i} style={styles.profitSubItem}>
                      <Ionicons name={item.icon} size={22} color={item.color} />
                      <View>
                        <Text
                          style={[styles.profitSubValue, { color: item.color }]}
                        >
                          {formatWholeNumber(item.value)}
                        </Text>
                        <Text style={styles.profitSubCaption}>
                          {item.label}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                {landBigha > 0 && (
                  <View style={styles.profitPerBighaRow}>
                    <View style={styles.profitPerBighaItem}>
                      <Text
                        style={[
                          styles.profitPerBighaValue,
                          { color: C.income },
                        ]}
                      >
                        {formatWholeNumber(incomePerBigha)}
                      </Text>
                      <Text style={styles.profitPerBighaLabel}>
                        {t("dashboard", "incomePerBighaShort")}
                      </Text>
                    </View>
                    <View style={styles.profitPerBighaItem}>
                      <Text
                        style={[
                          styles.profitPerBighaValue,
                          { color: C.expense },
                        ]}
                      >
                        {formatWholeNumber(expensePerBigha)}
                      </Text>
                      <Text style={styles.profitPerBighaLabel}>
                        {t("dashboard", "expensePerBighaShort")}
                      </Text>
                    </View>
                  </View>
                )}
                {profile?.tractorAvailable && tractorIncomeTotal > 0 && (
                  <PressableCard
                    onPress={() =>
                      router.push("/income/tractor-income-list" as any)
                    }
                    style={styles.tractorIncomeRow}
                  >
                    <Text style={styles.tractorIncomeLabel}>ટ્રેક્ટર હિસાબ</Text>
                    <Text style={styles.tractorIncomeValue}>
                      ₹{formatWholeNumber(tractorIncomeTotal)}
                    </Text>
                  </PressableCard>
                )}
                {bhagyaUpadTotal > 0 && (
                  <PressableCard
                    onPress={() =>
                      router.push("/expense/bhagya-upad-list" as any)
                    }
                    style={styles.bhagyaUpadRow}
                  >
                    <Text style={styles.bhagyaUpadLabel}>
                      {t("dashboard", "bhagyaUpad")}
                    </Text>
                    <Text style={styles.bhagyaUpadValue}>
                      ₹{formatWholeNumber(bhagyaUpadTotal)}
                    </Text>
                  </PressableCard>
                )}
                {profile?.tractorAvailable &&
                  (tractorPendingTotal > 0 || tractorPaidTotal > 0) && (
                  <View style={styles.tractorPaymentRow}>
                    <View style={styles.tractorPaymentCol}>
                      <Text style={styles.tractorPaymentLabel}>બાકી ભાડા</Text>
                      <Text style={styles.tractorPaymentValue}>
                        ₹{formatWholeNumber(tractorPendingTotal)}
                      </Text>
                    </View>
                    <View style={styles.tractorPaymentCol}>
                      <Text style={styles.tractorPaymentLabel}>આપી દીધા</Text>
                      <Text style={styles.tractorPaymentValue}>
                        ₹{formatWholeNumber(tractorPaidTotal)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </PressableCard>
        </Animated.View>

        <QuickActions
          t={t}
          onAddExpense={openExpensePicker}
          onAddIncome={openIncomePicker}
          onAddBhagyaUpad={() => router.push("/expense/add-bhagya-upad" as any)}
          profile={profile}
        />

        {/* ── 2. 🌱 મારા પાક (only active crops in carousel) ── */}
        {(() => {
          const activeCrops = crops.filter((c) => c.status === "Active");
          return (
            <View style={styles.myCropsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.myCropsSectionTitle}>
                  🌱 {t("dashboard", "myCrops")}
                </Text>
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => router.push("/crop" as any)}
                >
                  <Text style={styles.seeAll}>{t("dashboard", "seeAll")}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={C.green700}
                  />
                </TouchableOpacity>
              </View>

              {activeCrops.length === 0 ? (
                <PressableCard
                  onPress={() => router.push("/crop/add-crop")}
                  style={styles.emptyCropCard}
                >
                  <Text style={styles.emptyCropEmoji}>🌱</Text>
                  <Text style={styles.emptyCropText}>
                    {t("dashboard", "noCrops")}
                  </Text>
                  <View style={styles.emptyCropBtn}>
                    <Ionicons name="add" size={20} color="#5D4037" />
                    <Text style={styles.emptyCropBtnText}>
                      {t("dashboard", "addNewCrop")}
                    </Text>
                  </View>
                </PressableCard>
              ) : (
                <View style={styles.cropCarouselWrap}>
                  <ScrollView
                    ref={cropScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: CROP_CARD_PAD }}
                    snapToInterval={CROP_PAGE_WIDTH}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    onScroll={(e) => {
                      const idx = Math.round(
                        e.nativeEvent.contentOffset.x / CROP_PAGE_WIDTH,
                      );
                      setSelected(
                        Math.min(Math.max(0, idx), activeCrops.length - 1),
                      );
                    }}
                    scrollEventThrottle={32}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(
                        e.nativeEvent.contentOffset.x / CROP_PAGE_WIDTH,
                      );
                      setSelected(
                        Math.min(Math.max(0, idx), activeCrops.length - 1),
                      );
                    }}
                  >
                    {activeCrops.slice(0, 10).map((crop, i) => {
                      const colors = getCropColors(crop.cropName);
                      const isSel = selectedCrop === i;
                      const cropDate = formatDisplayDate(crop.createdAt);
                      const farmLabel =
                        (crop as any).farmName ||
                        (crop as any).farm_name ||
                        "—";
                      const areaLine = [
                        farmLabel !== "—" ? farmLabel : null,
                        `${formatVighaDisplay(crop.area)} ${areaUnitLabel(crop.areaUnit, t)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <PressableCard
                          key={crop._id}
                          onPress={() => {
                            setSelected(i);
                            cropScrollRef.current?.scrollTo({
                              x: i * CROP_PAGE_WIDTH,
                              animated: true,
                            });
                          }}
                          style={[
                            styles.cropCard,
                            { width: CROP_CARD_WIDTH },
                            isSel && styles.cropCardSel,
                          ]}
                        >
                          <LinearGradient
                            colors={colors}
                            style={styles.cropCardGrad}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <View style={styles.cropCardLeft}>
                              <Text style={styles.cropCardEmoji}>
                                {crop.cropEmoji ?? "🌱"}
                              </Text>
                            </View>
                            <View style={styles.cropCardRight}>
                              <Text style={styles.cropName} numberOfLines={2}>
                                {cropDisplayName(crop.cropName, t)}
                                {crop.subType ? (
                                  <Text style={styles.cropSubType}>
                                    {" - "}
                                    {crop.subType}
                                  </Text>
                                ) : null}
                              </Text>
                              <Text style={styles.cropMetaLine}>
                                {cropDate}
                              </Text>
                              {areaLine ? (
                                <Text style={styles.cropMetaLine}>
                                  {areaLine}
                                </Text>
                              ) : null}
                              <View style={styles.cropBadge}>
                                <Text style={styles.cropBadgeText}>
                                  ● {t("common", "statusActive")}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </PressableCard>
                      );
                    })}
                  </ScrollView>
                  {activeCrops.length > 1 && (
                    <>
                      {selectedCrop > 0 && (
                        <TouchableOpacity
                          style={styles.cropScrollArrowLeft}
                          onPress={() => {
                            const next = selectedCrop - 1;
                            setSelected(next);
                            cropScrollRef.current?.scrollTo({
                              x: next * CROP_PAGE_WIDTH,
                              animated: true,
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="arrow-back"
                            size={24}
                            color="#000000"
                          />
                        </TouchableOpacity>
                      )}
                      {selectedCrop < activeCrops.length - 1 && (
                        <TouchableOpacity
                          style={styles.cropScrollArrowRight}
                          onPress={() => {
                            const next = selectedCrop + 1;
                            setSelected(next);
                            cropScrollRef.current?.scrollTo({
                              x: next * CROP_PAGE_WIDTH,
                              animated: true,
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="arrow-forward"
                            size={24}
                            color="#000000"
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Selected Crop Detail: Income, Expense, Net ── */}
        {(() => {
          const activeCrops = crops.filter((c) => c.status === "Active");
          const safeIdx = Math.min(
            selectedCrop,
            Math.max(0, activeCrops.length - 1),
          );
          return (
            activeCrops.length > 0 &&
            activeCrops[safeIdx] &&
            (() => {
              const c = activeCrops[safeIdx];
              const inc = (c as any).income ?? 0;
              const exp = (c as any).expense ?? 0;
              const net = inc - exp;
              const areaBigha = cropAreaBigha(c.area, c.areaUnit);
              const incPerBigha = areaBigha > 0 ? inc / areaBigha : 0;
              const expPerBigha = areaBigha > 0 ? exp / areaBigha : 0;
              const detailColors = getCropColors(c.cropName);
              return (
                <View style={styles.section}>
                  <LinearGradient
                    colors={detailColors}
                    style={[styles.detailCard, styles.detailCardGrad]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.detailHeader}>
                      <View style={styles.detailEmojiWrap}>
                        <Text style={styles.detailEmoji}>
                          {c.cropEmoji ?? "🌱"}
                        </Text>
                      </View>
                      <View style={styles.detailHeaderText}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <Text style={styles.detailName}>
                            {cropDisplayName(c.cropName, t)}
                            {c.subType ? (
                              <Text style={styles.detailSubType}>
                                {" - "}
                                {c.subType}
                              </Text>
                            ) : null}
                          </Text>
                          {!c.subType && (
                            <Text style={styles.detailCategory}>
                              {seasonCategoryLabel(c.season, t)}
                            </Text>
                          )}
                          {c.landType === "bhagma" &&
                            c.bhagmaPercentage != null && (
                              <View
                                style={[
                                  styles.bhagmaBadge,
                                  { backgroundColor: C.expensePale },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.bhagmaBadgeText,
                                    { color: C.expense },
                                  ]}
                                >
                                  {tParam("dashboard", "bhagmaPct", {
                                    pct: c.bhagmaPercentage ?? 0,
                                  })}
                                </Text>
                              </View>
                            )}
                        </View>
                        <Text style={styles.detailDate}>
                          {formatDisplayDate(c.createdAt)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() =>
                          router.push(`/crop/edit-crop?id=${c._id}` as any)
                        }
                      >
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color={C.green700}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.detailSummarySingleBox}>
                      <View style={styles.detailSummaryCell}>
                        <Text
                          style={[
                            styles.detailSummaryCellLabel,
                            { color: C.income },
                          ]}
                        >
                          {t("dashboard", "income")}
                        </Text>
                        <View style={styles.detailSummaryCellValueWrap}>
                          <Text
                            style={[
                              styles.detailSummaryCellValue,
                              { color: C.income },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                          >
                            {formatWholeNumber(inc)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.detailSummaryOp}>−</Text>
                      <View style={styles.detailSummaryCell}>
                        <Text
                          style={[
                            styles.detailSummaryCellLabel,
                            { color: C.expense },
                          ]}
                        >
                          {t("dashboard", "expense")}
                        </Text>
                        <View style={styles.detailSummaryCellValueWrap}>
                          <Text
                            style={[
                              styles.detailSummaryCellValue,
                              { color: C.expense },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                          >
                            {formatWholeNumber(exp)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.detailSummaryOp}>=</Text>
                      <View style={styles.detailSummaryCell}>
                        <Text
                          style={[
                            styles.detailSummaryCellLabel,
                            { color: C.textPrimary },
                          ]}
                        >
                          {t("dashboard", "profit")}
                        </Text>
                        <View style={styles.detailSummaryCellValueWrap}>
                          <Text
                            style={[
                              styles.detailSummaryCellValue,
                              { color: C.textPrimary },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                          >
                            {net >= 0 ? "" : "−"}
                            {formatWholeNumber(Math.abs(net))}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {c.landType === "bhagma" &&
                      (c as any).labourShare != null &&
                      (c as any).labourShare > 0 && (
                        <View style={styles.detailBhagmaRow}>
                          <Text style={styles.detailBhagmaLabel}>
                            {tParam("dashboard", "labourShareLabel", {
                              pct: c.bhagmaPercentage ?? 0,
                            })}
                          </Text>
                          <Text
                            style={[
                              styles.detailBhagmaValue,
                              { color: C.expense },
                            ]}
                          >
                            ₹{formatWholeNumber((c as any).labourShare)}
                          </Text>
                        </View>
                      )}
                    {areaBigha > 0 && (
                      <View style={styles.detailUnitRow}>
                        <Text style={styles.detailUnitText}>
                          <Text style={{ color: C.income, fontWeight: "700" }}>
                            {t("dashboard", "incomePerBigha")}
                          </Text>{" "}
                          {formatWholeNumber(incPerBigha)}
                          {"  ·  "}
                          <Text style={{ color: C.expense, fontWeight: "700" }}>
                            {t("dashboard", "expensePerBigha")}
                          </Text>{" "}
                          {formatWholeNumber(expPerBigha)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailActions}>
                      <PressableCard
                        onPress={() =>
                          router.push(
                            `/expense/add-expense?cropId=${c._id}` as any,
                          )
                        }
                        style={styles.detailBtnWrap}
                      >
                        <View
                          style={[
                            styles.detailActionBtn,
                            styles.detailExpenseBtnCrop,
                          ]}
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={20}
                            color="#B71C1C"
                          />
                          <Text style={styles.detailActionBtnTextExpense}>
                            ખર્ચ
                          </Text>
                        </View>
                      </PressableCard>
                      <PressableCard
                        onPress={() =>
                          router.push(
                            `/income/add-income?cropId=${c._id}` as any,
                          )
                        }
                        style={styles.detailBtnWrap}
                      >
                        <View
                          style={[
                            styles.detailActionBtn,
                            styles.detailIncomeBtnCrop,
                          ]}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color="#1B5E20"
                          />
                          <Text style={styles.detailActionBtnTextIncome}>
                            આવક
                          </Text>
                        </View>
                      </PressableCard>
                    </View>
                  </LinearGradient>
                </View>
              );
            })()
          );
        })()}

        <RecentTransactions
          t={t}
          transactions={transactions}
          loading={loadingTxns}
        />

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      <CropPickerModal
        t={t}
        tParam={tParam}
        visible={pickerVisible}
        crops={crops}
        type={pickerType}
        onSelect={handleCropSelected}
        onClose={() => setPickerVisible(false)}
        onSelectGeneralExpense={() => {
          setPickerVisible(false);
          router.push("/expense/add-expense?general=1" as any);
        }}
        onSelectGeneralIncome={() => {
          setPickerVisible(false);
          router.push("/income/add-income?general=1" as any);
        }}
      />
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Styles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  stickyInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  stickyLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  stickyName: { fontSize: 20, fontWeight: "800", color: C.textPrimary },

  headerWrapper: { overflow: "hidden", zIndex: 50 },
  header: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  decorCircle1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.green100 + "80",
    top: -40,
    right: -30,
  },
  decorCircle2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.green100 + "50",
    bottom: 8,
    left: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  farmerName: {
    fontSize: 28,
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  sheetGeneralCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#FFF4F4",
    borderWidth: 2,
    borderColor: "#FFCDD2",
  },
  sheetGeneralCardIncome: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#E8F5E9",
    borderWidth: 2,
    borderColor: "#66BB6A",
  },
  locationText: { fontSize: 17, color: C.textSecondary },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: { position: "relative", padding: 4 },
  notifDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.green100,
  },
  avatarText: { fontSize: 19, fontWeight: "800", color: C.green700 },

  weatherBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    borderWidth: 1,
    backgroundColor: "#F5FAFF",
    borderColor: "#D4E9F7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  weatherBarRain: {
    backgroundColor: "#F2F8FC",
    borderColor: "#D4E9F7",
  },
  weatherBarClear: {
    backgroundColor: "#F5FAFF",
    borderColor: "#D4E9F7",
  },
  weatherBarHot: {
    backgroundColor: "#FFFBF5",
    borderColor: "#F5E6D3",
  },
  weatherTemp: { fontSize: 20, fontWeight: "800", color: C.textPrimary },
  weatherCond: { fontSize: 16, color: C.textMuted, flex: 1 },
  weatherDivider: {
    width: 1,
    height: 20,
    backgroundColor: C.borderLight,
    marginHorizontal: 2,
  },
  weatherStat: { fontSize: 16, color: C.textMuted, fontWeight: "700" },

  scrollContent: { paddingTop: 8 },
  fyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  fyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  fyChipActive: { backgroundColor: C.green700, borderColor: C.green700 },
  fyChipText: { fontSize: 18, fontWeight: "700", color: C.textSecondary },
  fyChipTextActive: { color: "#fff" },
  section: { marginHorizontal: 16, marginBottom: 22 },
  myCropsSection: {
    marginHorizontal: 16,
    marginBottom: 22,
    backgroundColor: "#F0F7F0",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  myCropsSectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.textPrimary,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(46, 125, 50, 0.08)",
  },
  seeAll: { fontSize: 20, color: C.green700, fontWeight: "900" },

  profitCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  profitStrip: { width: 4, borderRadius: 2, marginRight: 14 },
  profitTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  profitLabel: {
    fontSize: 18,
    color: "#546E7A",
    fontWeight: "600",
  },
  profitPakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAF8",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  profitPakValue: { fontSize: 18, fontWeight: "700", color: C.textSecondary },
  profitPakLabel: { fontSize: 15, color: C.textMuted, fontWeight: "600" },
  profitAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 0,
    marginBottom: 24,
  },
  profitSign: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  netProfitAmount: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: 0,
    color: "#374151",
  },
  profitStatusLabel: {
    fontSize: 18,
    fontWeight: "500",
    marginLeft: 10,
    color: "#4B5563",
  },
  profitSubRow: { flexDirection: "row", gap: 6 },
  profitSubItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  profitSubValue: { fontSize: 20, fontWeight: "700" },
  profitSubCaption: { fontSize: 15, color: C.textMuted, fontWeight: "600" },
  profitPerBighaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  profitPerBighaItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 0,
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  profitPerBighaValue: { fontSize: 18, fontWeight: "700" },
  profitPerBighaLabel: { fontSize: 14, color: C.textMuted, fontWeight: "600" },

  bhagyaUpadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  bhagyaUpadLabel: {
    fontSize: 15,
    color: "#0369A1",
    fontWeight: "700",
    marginBottom: 2,
  },
  bhagyaUpadValue: { fontSize: 17, fontWeight: "800", color: "#0369A1" },
  tractorIncomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  tractorIncomeLabel: { fontSize: 15, color: "#C2410C", fontWeight: "700" },
  tractorIncomeValue: { fontSize: 17, fontWeight: "800", color: "#9A3412" },

  tractorPaymentRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  tractorPaymentCol: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    alignItems: "center",
  },
  tractorPaymentLabel: { fontSize: 13, color: "#9A3412", fontWeight: "600" },
  tractorPaymentValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9A3412",
    marginTop: 2,
  },

  qaRow: { flexDirection: "row", gap: 10 },
  qaRowCompact: { flexDirection: "column" },
  qaHalf: { flex: 1 },
  qaFullCompact: { flex: undefined },
  qaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  qaCardCompact: {
    minHeight: 78,
  },
  qaCardFull: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  qaCommonCard: {
    minHeight: 72,
  },
  qaCardFullAddCrop: {
    backgroundColor: "#FFF8E1",
    borderWidth: 2,
    borderColor: "#FFE082",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  qaCardFullAddCropIcon: {
    backgroundColor: "#FFE082",
  },
  qaCardFullAddCropText: {
    color: "#5D4037",
    fontSize: 22,
  },
  qaIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  qaLabel: { fontSize: 22, fontWeight: "800" },
  qaSub: { fontSize: 17, color: C.textMuted, marginTop: 2, fontWeight: "700" },

  cropCarouselWrap: { position: "relative" },
  cropCard: {
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  cropCardSel: { shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  cropCardGrad: {
    flexDirection: "row",
    padding: 20,
    minHeight: 140,
    alignItems: "center",
  },
  cropCardLeft: {
    width: 88,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cropCardRight: { flex: 1, justifyContent: "center" },
  cropCardEmoji: { fontSize: 58 },
  cropBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(46, 125, 50, 0.12)",
  },
  cropBadgeText: { fontSize: 15, fontWeight: "800", color: C.green700 },
  cropName: {
    fontSize: 21,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 2,
  },
  cropSubType: { fontSize: 14, fontWeight: "600", color: C.textMuted },
  cropCategory: {
    fontSize: 15,
    color: C.textMuted,
    fontWeight: "600",
    marginBottom: 6,
  },
  cropMetaLine: {
    fontSize: 16,
    color: C.textSecondary,
    fontWeight: "600",
    marginBottom: 3,
  },
  cropMeta: {
    fontSize: 16,
    color: C.textSecondary,
    fontWeight: "700",
  },
  cropScrollArrowLeft: {
    position: "absolute",
    left: 4,
    top: "50%",
    marginTop: -24,
    width: 32,
    height: 32,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cropScrollArrowRight: {
    position: "absolute",
    right: 4,
    top: "50%",
    marginTop: -24,
    width: 32,
    height: 32,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCropCard: {
    backgroundColor: "#F8FBF8",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.green500,
    borderStyle: "dashed",
  },
  emptyCropEmoji: { fontSize: 50, marginBottom: 12 },
  emptyCropText: {
    fontSize: 19,
    fontWeight: "800",
    color: C.textSecondary,
    marginBottom: 14,
  },
  emptyCropBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#FFE082",
  },
  emptyCropBtnText: { fontSize: 19, color: "#5D4037", fontWeight: "800" },

  detailCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  detailCardGrad: {
    borderWidth: 0,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  detailEmojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#F4FAF4",
    justifyContent: "center",
    alignItems: "center",
  },
  detailEmoji: { fontSize: 40 },
  detailHeaderText: { flex: 1 },
  detailName: {
    fontSize: 24,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 2,
  },
  detailSubType: { fontSize: 15, fontWeight: "600", color: C.textMuted },
  detailCategory: {
    fontSize: 15,
    color: C.textMuted,
    fontWeight: "600",
    marginLeft: 6,
  },
  detailMeta: {
    fontSize: 17,
    color: C.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },
  detailDate: {
    fontSize: 15,
    color: C.textMuted,
    marginTop: 6,
    fontWeight: "600",
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F4FAF4",
    justifyContent: "center",
    alignItems: "center",
  },
  bhagmaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bhagmaBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  detailSummarySingleBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAF8",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 18,
  },
  detailSummaryCell: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    flex: 1,
  },
  detailSummaryCellLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailSummaryCellValueWrap: {
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  detailSummaryCellValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  detailSummaryOp: {
    fontSize: 22,
    fontWeight: "800",
    color: C.textMuted,
  },
  detailBhagmaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFEBEE",
    borderRadius: 10,
    marginBottom: 8,
  },
  detailBhagmaLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textSecondary,
  },
  detailBhagmaValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  detailUnitRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  detailUnitText: {
    fontSize: 18,
    color: C.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },
  detailActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  detailBtnWrap: { flex: 1 },
  detailActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  detailExpenseBtnCrop: { backgroundColor: "#FFEBEE", borderColor: "#EF9A9A" },
  detailIncomeBtnCrop: { backgroundColor: "#E8F5E9", borderColor: "#81C784" },
  detailActionBtnTextExpense: {
    fontSize: 20,
    fontWeight: "800",
    color: "#B71C1C",
  },
  detailActionBtnTextIncome: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B5E20",
  },
  detailExpenseBtn: { backgroundColor: C.expense },
  detailIncomeBtn: { backgroundColor: C.green700 },
  detailActionBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  txnList: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txnItem: { flexDirection: "row", alignItems: "center", padding: 15, gap: 12 },
  txnBorder: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  txnIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  txnCropEmoji: { fontSize: 22 },
  txnInfo: { flex: 1 },
  txnLabel: { fontSize: 18, fontWeight: "800", color: C.textPrimary },
  txnMeta: {
    fontSize: 16,
    color: C.textMuted,
    marginTop: 2,
    fontWeight: "700",
  },
  txnAmount: { fontSize: 18, fontWeight: "900" },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: SCREEN_H * 0.9,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 21, fontWeight: "800", color: C.textPrimary },
  sheetSubtitle: { fontSize: 18, color: C.textMuted, marginTop: 2 },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  sheetGeneralRow: {
    backgroundColor: C.surfaceGreen,
    borderBottomWidth: 2,
    borderBottomColor: C.green100,
  },
  sheetCropEmojiBg: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCropName: { fontSize: 19, fontWeight: "800", color: C.textPrimary },
  sheetCropMeta: { fontSize: 17, color: C.textMuted, marginTop: 2 },
  bighaFont: { fontSize: 17, fontWeight: "800", color: C.textPrimary },
  sheetCropStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sheetCropStatusText: { fontSize: 15, fontWeight: "800" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  sheetEmpty: { alignItems: "center", paddingVertical: 40 },
  sheetEmptyBtnAdd: { backgroundColor: C.green700 },
  sheetEmptyBtnTextAdd: { fontSize: 17, fontWeight: "800", color: "#fff" },
  sheetEmptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 14,
  },
  sheetEmptyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },
  sheetEmptyBtnText: { fontSize: 16, fontWeight: "800" },
});

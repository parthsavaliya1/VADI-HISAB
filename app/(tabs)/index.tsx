

import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  API,
  getCrops,
  getExpenses,
  getMyProfile,
  getYearlyReport,
  type Crop,
  type Expense,
  type ExpenseCategory,
} from "@/utils/api";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

  gold: "#F9A825",
  goldPale: "#FFFDE7",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

// Default static weather (replaced by dynamic fetch when available)
const WEATHER_DEFAULT = {
  temp: "—",
  condition: "લોડ થઈ રહ્યું છે...",
  humidity: "—",
  wind: "—",
};

// Light, farmer-friendly crop card backgrounds (readable with dark text)
const CROP_COLORS: [string, string][] = [
  ["#E8F5E9", "#C8E6C9"],
  ["#E0F2F1", "#B2DFDB"],
  ["#FFF3E0", "#FFE0B2"],
  ["#E3F2FD", "#BBDEFB"],
  ["#F3E5F5", "#E1BEE7"],
];

// English crop name (from API) → Gujarati display name (matches add-crop CROPS)
const CROP_NAME_GUJARATI: Record<string, string> = {
  Cotton: "કપાસ",
  Groundnut: "મગફળી",
  Jeera: "જીરું",
  Garlic: "લસણ",
  Onion: "ડુંગળી",
  Chana: "ચણા",
  Wheat: "ઘઉં",
  Bajra: "બાજરી",
  Maize: "મકાઈ",
};
function cropDisplayName(name: string): string {
  return CROP_NAME_GUJARATI[name] ?? name;
}

/** Area unit in Gujarati (વીઘા / એકર) */
function areaUnitLabel(unit: string | undefined, t: (s: string, k: string) => string): string {
  return unit?.toLowerCase() === "acre" ? t("common", "acre") : t("common", "bigha");
}

const HEADER_MAX = 200;
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

/**
 * GET /income
 * Uses the same API axios instance from api.ts
 * → token auto-attached, interceptors active, base URL already set
 */
const getIncomes = async (page = 1, limit = 5): Promise<IncomeListResponse> => {
  const res = await API.get<IncomeListResponse>("/income", {
    params: { page, limit },
  });
  return res.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔀 Transaction helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface Transaction {
  _id: string;
  type: "income" | "expense";
  label: string;
  crop: string;
  amount: number; // positive = income, negative = expense
  date: string; // Gujarati relative label
  rawDate: string; // ISO — used for sorting
  icon: string; // Ionicons name
  category: string;
}

function formatRelativeDate(iso: string, t: (s: string, k: string) => string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return t("dashboard", "today");
  if (diff === 1) return t("dashboard", "yesterday");
  if (diff < 7) return t("dashboard", "daysAgo").replace("{n}", String(diff));
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function getCropName(
  cropId: string | { _id: string; cropName: string } | undefined,
): string {
  if (!cropId) return "—";
  if (typeof cropId === "object") return cropId.cropName;
  return "—";
}

// ── Expense helpers ───────────────────────────
function expenseAmount(e: Expense): number {
  if (e.category === "Seed") return e.seed?.totalCost ?? 0;
  if (e.category === "Fertilizer") return e.fertilizer?.totalCost ?? 0;
  if (e.category === "Pesticide") return e.pesticide?.cost ?? 0;
  if (e.category === "Labour")
    return e.labourDaily?.totalCost ?? e.labourContract?.amountGiven ?? 0;
  if (e.category === "Machinery") return e.machinery?.totalCost ?? 0;
  return 0;
}

function expenseLabel(e: Expense): string {
  const m: Record<ExpenseCategory, string> = {
    Seed: `બીજ - ${e.seed?.seedType ?? ""}`,
    Fertilizer: `ખાતર - ${e.fertilizer?.productName ?? ""}`,
    Pesticide: `દવા - ${e.pesticide?.category ?? ""}`,
    Labour: "મજૂરી",
    Machinery: `મ. - ${e.machinery?.implement ?? ""}`,
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
  };
  return m[cat] ?? "receipt-outline";
}

// ── Income helpers ────────────────────────────
function incomeAmount(i: Income): number {
  if (i.category === "Crop Sale") return i.cropSale?.totalAmount ?? 0;
  if (i.category === "Subsidy") return i.subsidy?.amount ?? 0;
  if (i.category === "Rental Income") return i.rentalIncome?.totalAmount ?? 0;
  if (i.category === "Other") return i.otherIncome?.amount ?? 0;
  return 0;
}

function incomeLabel(i: Income): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": `વેચાણ - ${i.cropSale?.marketName || "VADI"}`,
    Subsidy: `સ. - ${i.subsidy?.schemeType ?? ""}`,
    "Rental Income": `ભાડા - ${i.rentalIncome?.assetType ?? ""}`,
    Other: `અ. - ${i.otherIncome?.source ?? ""}`,
  };
  return m[i.category] ?? i.category;
}

function incomeIcon(cat: IncomeCategory): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": "cash",
    Subsidy: "ribbon-outline",
    "Rental Income": "car-outline",
    Other: "wallet-outline",
  };
  return m[cat] ?? "cash";
}

// ── Merge & sort ──────────────────────────────
function buildTransactions(
  expenses: Expense[],
  incomes: Income[],
  t: (s: string, k: string) => string,
): Transaction[] {
  const expTxns: Transaction[] = expenses.map((e) => ({
    _id: e._id,
    type: "expense" as const,
    label: expenseLabel(e),
    crop: getCropName(e.cropId as any),
    amount: -expenseAmount(e),
    date: formatRelativeDate(e.date, t),
    rawDate: e.date,
    icon: expenseIcon(e.category),
    category: e.category,
  }));

  const incTxns: Transaction[] = incomes.map((i) => ({
    _id: i._id,
    type: "income" as const,
    label: incomeLabel(i),
    crop: getCropName(i.cropId),
    amount: incomeAmount(i),
    date: formatRelativeDate(i.date, t),
    rawDate: i.date,
    icon: incomeIcon(i.category),
    category: i.category,
  }));

  return [...expTxns, ...incTxns]
    .sort(
      (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
    )
    .slice(0, 6);
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
      {Math.abs(display).toLocaleString("en-IN")}
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
  visible,
  crops,
  onSelect,
  onClose,
  type,
}: {
  t: (s: string, k: string) => string;
  visible: boolean;
  crops: Crop[];
  onSelect: (c: Crop) => void;
  onClose: () => void;
  type: "expense" | "income";
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
              {isExpense ? `💸 ${t("dashboard", "addExpense")}` : `💰 ${t("dashboard", "addIncome")}`}
            </Text>
            <Text style={styles.sheetSubtitle}>{t("dashboard", "selectCropFirst")}</Text>
          </View>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {crops.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Text style={{ fontSize: 58, marginBottom: 14 }}>🌱</Text>
            <Text style={styles.sheetEmptyText}>{t("dashboard", "noCrops")}</Text>
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
            {crops.map((crop, i) => {
              const colors = CROP_COLORS[i % CROP_COLORS.length];
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
                    <Text style={styles.sheetCropName}>{cropDisplayName(crop.cropName)}</Text>
                    <Text style={styles.sheetCropMeta}>
                      {crop.season === "Kharif"
                        ? "☔ ખરીફ"
                        : crop.season === "Rabi"
                          ? "❄️ રવી"
                          : "☀️ ઉનાળો"}
                      {" · "}
                      <Text style={styles.bighaFont}>{crop.area} </Text>
                      {areaUnitLabel(crop.areaUnit, t)}
                    </Text>
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
                        ? "સક્રિય"
                        : crop.status === "Harvested"
                          ? "લણણી"
                          : "બંધ"}
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
}: {
  t: (s: string, k: string) => string;
  onAddExpense: () => void;
  onAddIncome: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ {t("dashboard", "quickActions")}</Text>
      <View style={{ height: 14 }} />
      <View style={styles.qaRow}>
        <PressableCard onPress={onAddExpense} style={styles.qaHalf}>
          <View
            style={[
              styles.qaCard,
              { backgroundColor: C.expensePale, borderColor: "#FFCDD2" },
            ]}
          >
            <View style={[styles.qaIcon, { backgroundColor: "#FFCDD2" }]}>
              <Ionicons
                name="remove-circle-outline"
                size={26}
                color={C.expense}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.expense }]}>
                {t("dashboard", "addExpense")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.expense} />
          </View>
        </PressableCard>

        {/* ✅ Triggers income picker → /income/add-income */}
        <PressableCard onPress={onAddIncome} style={styles.qaHalf}>
          <View
            style={[
              styles.qaCard,
              { backgroundColor: C.incomePale, borderColor: C.green100 },
            ]}
          >
            <View style={[styles.qaIcon, { backgroundColor: C.green100 }]}>
              <Ionicons name="add-circle-outline" size={26} color={C.income} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.income }]}>
                {t("dashboard", "addIncome")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.income} />
          </View>
        </PressableCard>
      </View>

      <PressableCard
        onPress={() => router.push("/crop/add-crop")}
        style={{ marginTop: 10 }}
      >
        <View
          style={[
            styles.qaCardFull,
            styles.qaCardFullAddCrop,
          ]}
        >
          <View style={[styles.qaIcon, styles.qaCardFullAddCropIcon]}>
            <Ionicons name="leaf" size={26} color="#5D4037" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.qaLabel, styles.qaCardFullAddCropText]}>
              + {t("dashboard", "addNewCrop")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#5D4037" />
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
        <Text style={styles.sectionTitle}>🧾 {t("dashboard", "recentTxns")}</Text>
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => router.push("/expense" as any)}
        >
          <Text style={styles.seeAll}>{t("dashboard", "seeAll")}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.green700} />
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
                  (t.type === "income"
                    ? `/income/add-income?id=${t._id}`
                    : `/expense/add-expense?id=${t._id}`) as any,
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
                <Ionicons
                  name={t.icon as any}
                  size={20}
                  color={t.type === "income" ? C.income : C.expense}
                />
              </View>
              <View style={styles.txnInfo}>
                <Text style={styles.txnLabel}>{t.label}</Text>
                <Text style={styles.txnMeta}>
                  {t.crop} · {t.date}
                </Text>
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
                  {t.amount > 0 ? "+" : ""}₹
                  {Math.abs(t.amount).toLocaleString("en-IN")}
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
  const { t } = useLanguage();
  const { profile, setProfile } = useProfile();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [summary, setSummary] = useState<{ totalIncome: number; totalExpense: number; netProfit: number }>({ totalIncome: 0, totalExpense: 0, netProfit: 0 });
  const [transactions, setTxns] = useState<Transaction[]>([]);
  const [selectedCrop, setSelected] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"expense" | "income">("expense");
  const [weather, setWeather] = useState(WEATHER_DEFAULT);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cropScrollRef = useRef<ScrollView>(null);

  // ── Load all data via api.ts ─────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [prof, cropRes, yearlyReport, expRes, incRes] = await Promise.all([
        getMyProfile(),
        getCrops(),
        getYearlyReport(),
        getExpenses(undefined, undefined, 1, 5),
        getIncomes(1, 5),
      ]);
      setProfile(prof);
      setCrops(
        cropRes.data.map((c: Crop) => {
          const report = (yearlyReport as any).crops?.find((r: any) => r._id === c._id);
          return {
            ...c,
            income: report?.income ?? 0,
            expense: report?.expense ?? 0,
            profit: report?.profit ?? (report ? (report.income ?? 0) - (report.expense ?? 0) : 0),
          };
        }),
      );
      setSummary(yearlyReport.summary);
      setTxns(buildTransactions(expRes.data, incRes.data, t));
    } catch (err) {
      console.log("[Dashboard] loadData error:", (err as Error).message);
    } finally {
      setLoadingProfile(false);
      setLoadingTxns(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
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

  // Dynamic weather from Open-Meteo (no API key). Uses profile district when available.
  const defaultCoords: Record<string, [number, number]> = {
    Rajkot: [22.3, 70.8],
    Jamnagar: [22.47, 70.07],
    Junagadh: [21.52, 70.47],
    Amreli: [21.6, 71.22],
    Morbi: [22.82, 70.84],
    Bhavnagar: [21.76, 72.15],
    Surendranagar: [22.7, 71.64],
  };
  useEffect(() => {
    const district = profile?.district;
    const [lat, lon] = district && defaultCoords[district]
      ? defaultCoords[district]
      : [22.3, 70.8];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const c = data?.current;
        if (!c) return;
        const temp = Math.round(Number(c.temperature_2m)) ?? 0;
        const humidity = Math.round(Number(c.relative_humidity_2m)) ?? 0;
        const windKmh = Math.round(Number(c.wind_speed_10m) ?? 0);
        const code = Number(c.weather_code) ?? 0;
        const conditionMap: Record<number, string> = {
          0: "સ્પષ્ટ",
          1: "મુખ્યત્વે સ્પષ્ટ",
          2: "આંશિક વાદળ",
          3: "ઓવરકાસ્ટ",
          45: "ધુમ્મસ",
          48: "ધુમ્મસ",
          51: "બૂંદાબંદી",
          61: "હલકો વરસાદ",
          63: "વરસાદ",
          65: "ભારે વરસાદ",
          80: "વરસાદ",
          95: "તૂફાન",
        };
        setWeather({
          temp: `${temp}°C`,
          condition: conditionMap[code] ?? "આંશિક વાદળ",
          humidity: `${humidity}%`,
          wind: `${windKmh} km/h`,
        });
      })
      .catch(() => {});
  }, [profile?.district]);

  const totalIncome = summary.totalIncome;
  const totalExpense = summary.totalExpense;
  const totalProfit = summary.netProfit;

  const farmerName = profile?.name ?? "";
  const farmerVillage = profile?.village ?? "";
  const farmerLand = profile?.totalLand
    ? `${profile.totalLand.value} ${profile.totalLand.unit === "bigha" ? t("common", "bigha") : t("common", "acre")}`
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

  const paddingTop = Platform.OS === "ios" ? 50 : 36;

  // ── Navigation ─────────────────────────────────────────────────────────────────
  const openExpensePicker = () => {
    setPickerType("expense");
    setPickerVisible(true);
  };
  const openIncomePicker = () => {
    setPickerType("income");
    setPickerVisible(true);
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
            <Text style={styles.stickyName}>{farmerName || t("dashboard", "farmer")}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={C.green700}
            />
            <View style={styles.notifDot} />
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
                <Text style={styles.greetingSmall}>🌅 {t("dashboard", "greeting")}</Text>
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
                {loadingProfile ? (
                  <SkeletonLine
                    width={130}
                    height={13}
                    style={{ marginTop: 5 }}
                  />
                ) : (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-sharp"
                      size={13}
                      color={C.green500}
                    />
                    <Text style={styles.locationText}>
                      {[farmerVillage, farmerLand]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.notifBtn}>
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color={C.green700}
                  />
                  <View style={styles.notifDot} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatarCircle}
                  onPress={() => router.push("/profile")}
                  activeOpacity={0.8}
                >
                  {loadingProfile ? (
                    <SkeletonLine
                      width={22}
                      height={22}
                      style={{ borderRadius: 11 }}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{avatarChar}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.weatherBar}>
              <Ionicons name="partly-sunny-outline" size={22} color={C.gold} />
              <Text style={styles.weatherTemp}>{weather.temp}</Text>
              <Text style={styles.weatherCond}>{weather.condition}</Text>
              <View style={styles.weatherDivider} />
              <Ionicons name="water-outline" size={14} color={C.textMuted} />
              <Text style={styles.weatherStat}>{weather.humidity}</Text>
              <Ionicons name="flag-outline" size={14} color={C.textMuted} />
              <Text style={styles.weatherStat}>{weather.wind}</Text>
            </View>
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
        {/* ── Net Profit Card ── */}
        <Animated.View
          style={[
            styles.section,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <PressableCard>
            <View
              style={[
                styles.profitCard,
                { borderColor: totalProfit >= 0 ? C.green100 : "#FFCDD2" },
              ]}
            >
              <View
                style={[
                  styles.profitStrip,
                  {
                    backgroundColor: totalProfit >= 0 ? C.green500 : C.expense,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.profitLabel}>⚖️ {t("dashboard", "netProfit")}</Text>
                <View style={styles.profitAmountRow}>
                  <Text
                    style={[
                      styles.profitSign,
                      { color: totalProfit >= 0 ? C.income : C.expense },
                    ]}
                  >
                    {totalProfit >= 0 ? "+" : "-"}₹
                  </Text>
                  <AnimatedNumber value={Math.abs(totalProfit)} />
                </View>
                <View style={styles.profitSubRow}>
                  {(
                    [
                      {
                        icon: "arrow-up-circle-outline",
                        label: t("dashboard", "income"),
                        value: totalIncome,
                        color: C.income,
                        bg: C.incomePale,
                        isCount: false,
                      },
                      {
                        icon: "arrow-down-circle-outline",
                        label: t("dashboard", "expense"),
                        value: totalExpense,
                        color: C.expense,
                        bg: C.expensePale,
                        isCount: false,
                      },
                      {
                        icon: "leaf-outline",
                        label: t("dashboard", "crops"),
                        value: crops.length,
                        color: "#5D4037",
                        bg: "#FFF8E1",
                        isCount: true,
                        isCropsStyle: true,
                      },
                    ] as const
                  ).map((item, i) => (
                    <View
                      key={i}
                      style={[
                        styles.profitSubItem,
                        { backgroundColor: item.bg },
                        (item as any).isCropsStyle && styles.profitSubItemCrops,
                      ]}
                    >
                      <Ionicons name={item.icon} size={14} color={item.color} />
                      <View>
                        <Text
                          style={[styles.profitSubValue, { color: item.color }]}
                        >
                          {item.isCount
                            ? String(item.value)
                            : `₹${item.value.toLocaleString("en-IN")}`}
                        </Text>
                        <Text
                          style={[
                            styles.profitSubCaption,
                            (item as any).isCropsStyle && styles.profitSubCaptionCrops,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </PressableCard>
        </Animated.View>

        <QuickActions
          t={t}
          onAddExpense={openExpensePicker}
          onAddIncome={openIncomePicker}
        />

        {/* ── 2. 🌱 મારા પાક (only active crops in carousel) ── */}
        {(() => {
          const activeCrops = crops.filter((c) => c.status === "Active");
          return (
            <View style={styles.myCropsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.myCropsSectionTitle}>🌱 {t("dashboard", "myCrops")}</Text>
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => router.push("/crop" as any)}
                >
                  <Text style={styles.seeAll}>{t("dashboard", "seeAll")}</Text>
                  <Ionicons name="chevron-forward" size={20} color={C.green700} />
                </TouchableOpacity>
              </View>

              {activeCrops.length === 0 ? (
                <PressableCard
                  onPress={() => router.push("/crop/add-crop")}
                  style={styles.emptyCropCard}
                >
                  <Text style={styles.emptyCropEmoji}>🌱</Text>
                  <Text style={styles.emptyCropText}>{t("dashboard", "noCrops")}</Text>
                  <View style={styles.emptyCropBtn}>
                    <Ionicons name="add" size={20} color="#5D4037" />
                    <Text style={styles.emptyCropBtnText}>{t("dashboard", "addNewCrop")}</Text>
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
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / CROP_PAGE_WIDTH);
                      setSelected(Math.min(Math.max(0, idx), activeCrops.length - 1));
                    }}
                  >
                    {activeCrops.slice(0, 10).map((crop, i) => {
                      const colors = CROP_COLORS[i % CROP_COLORS.length];
                      const isSel = selectedCrop === i;
                      const cropDate = crop.createdAt
                        ? formatRelativeDate(crop.createdAt, t)
                        : "—";
                      const farmLabel = (crop as any).farmName || (crop as any).farm_name || "—";
                      return (
                        <PressableCard
                          key={crop._id}
                          onPress={() => {
                            setSelected(i);
                            cropScrollRef.current?.scrollTo({ x: i * CROP_PAGE_WIDTH, animated: true });
                          }}
                          style={[styles.cropCard, { width: CROP_CARD_WIDTH }, isSel && styles.cropCardSel]}
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
                              <Text style={styles.cropName} numberOfLines={2}>{cropDisplayName(crop.cropName)}</Text>
                              <Text style={styles.cropMetaLine}>
                                📅 {cropDate}
                              </Text>
                              <Text style={styles.cropMetaLine}>
                                🏠 {farmLabel} · {crop.area} {areaUnitLabel(crop.areaUnit, t)}
                              </Text>
                              <View
                                style={[
                                  styles.cropBadge,
                                  {
                                    backgroundColor: "rgba(76, 175, 80, 0.2)",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.cropBadgeText,
                                    { color: C.green700 },
                                  ]}
                                >
                                  ● સક્રિય
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </PressableCard>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Selected Crop Detail: Income, Expense, Net ── */}
        {(() => {
          const activeCrops = crops.filter((c) => c.status === "Active");
          const safeIdx = Math.min(selectedCrop, Math.max(0, activeCrops.length - 1));
          return activeCrops.length > 0 &&
          activeCrops[safeIdx] &&
          (() => {
            const c = activeCrops[safeIdx];
            const inc = (c as any).income ?? 0;
            const exp = (c as any).expense ?? 0;
            const net = inc - exp;
            return (
              <View style={styles.section}>
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <View style={styles.detailEmojiWrap}>
                      <Text style={styles.detailEmoji}>
                        {c.cropEmoji ?? "🌱"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{cropDisplayName(c.cropName)}</Text>
                      <Text style={styles.detailMeta}>
                        {c.season === "Kharif"
                          ? "ખરીફ"
                          : c.season === "Rabi"
                            ? "રવી"
                            : "ઉનાળો"}
                        {" · "}
                        {c.area} {areaUnitLabel(c.areaUnit, t)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() =>
                        router.push(`/crop/add-crop?id=${c._id}` as any)
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={C.green700}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.detailSummaryTitle}>આ પાકનો હિસાબ</Text>
                  <View style={styles.detailSummaryRow}>
                    <View style={[styles.detailSummaryBox, styles.detailIncomeBox]}>
                      <Text style={styles.detailSummaryLabel}>{t("dashboard", "totalIncome")}</Text>
                      <Text style={styles.detailSummaryIncome}>₹{inc.toLocaleString("en-IN")}</Text>
                    </View>
                    <Text style={styles.detailSummaryMinus}>−</Text>
                    <View style={[styles.detailSummaryBox, styles.detailExpenseBox]}>
                      <Text style={styles.detailSummaryLabel}>{t("dashboard", "totalExpense")}</Text>
                      <Text style={styles.detailSummaryExpense}>₹{exp.toLocaleString("en-IN")}</Text>
                    </View>
                  </View>
                  <View style={styles.detailNetRow}>
                    <Text style={styles.detailNetLabel}>{t("dashboard", "profit")}</Text>
                    <Text style={[styles.detailNetValue, { color: net >= 0 ? C.income : C.expense }]}>
                      {net >= 0 ? "" : "−"}₹{Math.abs(net).toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <View style={styles.detailActions}>
                    <PressableCard
                      onPress={() =>
                        router.push(`/expense/add-expense?cropId=${c._id}` as any)
                      }
                      style={styles.detailBtnWrap}
                    >
                      <View style={[styles.detailActionBtn, styles.detailExpenseBtnCrop]}>
                        <Ionicons name="remove-circle-outline" size={20} color="#B71C1C" />
                        <Text style={styles.detailActionBtnTextExpense}>
                          {t("dashboard", "addExpense")}
                        </Text>
                      </View>
                    </PressableCard>
                    <PressableCard
                      onPress={() =>
                        router.push(`/income/add-income?cropId=${c._id}` as any)
                      }
                      style={styles.detailBtnWrap}
                    >
                      <View style={[styles.detailActionBtn, styles.detailIncomeBtnCrop]}>
                        <Ionicons name="add-circle-outline" size={20} color="#1B5E20" />
                        <Text style={styles.detailActionBtnTextIncome}>
                          {t("dashboard", "addIncome")}
                        </Text>
                      </View>
                    </PressableCard>
                  </View>
                </View>
              </View>
            );
          })();
        })()}

        <RecentTransactions t={t} transactions={transactions} loading={loadingTxns} />

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      <CropPickerModal
        t={t}
        visible={pickerVisible}
        crops={crops}
        type={pickerType}
        onSelect={handleCropSelected}
        onClose={() => setPickerVisible(false)}
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
  greetingSmall: {
    fontSize: 17,
    color: C.textMuted,
    marginBottom: 4,
    fontWeight: "700",
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
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
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

  scrollContent: { paddingTop: 20 },
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
  sectionTitle: { fontSize: 21, fontWeight: "800", color: C.textPrimary },
  myCropsSectionTitle: { fontSize: 21, fontWeight: "800", color: C.green700 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { fontSize: 17, color: C.green700, fontWeight: "800" },

  profitCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  profitStrip: { width: 5, borderRadius: 4, marginRight: 16 },
  profitLabel: {
    fontSize: 17,
    color: C.textMuted,
    fontWeight: "800",
    marginBottom: 8,
  },
  profitAmountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginBottom: 16,
  },
  profitSign: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  netProfitAmount: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
    color: C.textPrimary,
  },
  profitSubRow: { flexDirection: "row", gap: 8 },
  profitSubItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  profitSubItemCrops: {
    borderWidth: 2,
    borderColor: "#FFE082",
    borderRadius: 12,
  },
  profitSubValue: { fontSize: 17, fontWeight: "800" },
  profitSubCaption: { fontSize: 14, color: C.textMuted, fontWeight: "700" },
  profitSubCaptionCrops: { color: "#5D4037" },

  qaRow: { flexDirection: "row", gap: 10 },
  qaHalf: { flex: 1 },
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
  qaCardFull: {
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
    fontSize: 18,
  },
  qaIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  qaLabel: { fontSize: 19, fontWeight: "800" },
  qaSub: { fontSize: 16, color: C.textMuted, marginTop: 2, fontWeight: "700" },

  cropCarouselWrap: { position: "relative" },
  cropCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  cropCardSel: { shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
  cropCardGrad: {
    flexDirection: "row",
    padding: 18,
    minHeight: 130,
    alignItems: "center",
  },
  cropCardLeft: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cropCardRight: { flex: 1, justifyContent: "center" },
  cropCardEmoji: { fontSize: 50 },
  cropBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginTop: 6 },
  cropBadgeText: { fontSize: 13, fontWeight: "800" },
  cropName: { fontSize: 19, fontWeight: "800", color: C.textPrimary, marginBottom: 4 },
  cropMetaLine: {
    fontSize: 15,
    color: C.textSecondary,
    fontWeight: "700",
    marginBottom: 2,
  },
  cropMeta: {
    fontSize: 15,
    color: C.textSecondary,
    fontWeight: "700",
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
  emptyCropBtnText: { fontSize: 18, color: "#5D4037", fontWeight: "800" },

  detailCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  detailEmojiWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
  },
  detailEmoji: { fontSize: 32 },
  detailName: { fontSize: 20, fontWeight: "800", color: C.textPrimary },
  detailMeta: { fontSize: 16, color: C.textMuted, marginTop: 3 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
  },
  detailSummaryTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: C.textSecondary,
    marginBottom: 12,
  },
  detailSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  detailSummaryBox: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  detailIncomeBox: { backgroundColor: C.incomePale, borderWidth: 1, borderColor: C.green100 },
  detailExpenseBox: { backgroundColor: C.expensePale, borderWidth: 1, borderColor: "#FFCDD2" },
  detailSummaryLabel: { fontSize: 14, color: C.textMuted, fontWeight: "700", marginBottom: 4 },
  detailSummaryIncome: { fontSize: 19, fontWeight: "800", color: C.income },
  detailSummaryExpense: { fontSize: 19, fontWeight: "800", color: C.expense },
  detailSummaryMinus: { fontSize: 19, fontWeight: "800", color: C.textMuted },
  detailNetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: C.green50,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.green100,
  },
  detailNetLabel: { fontSize: 17, fontWeight: "800", color: C.textPrimary },
  detailNetValue: { fontSize: 21, fontWeight: "900" },
  detailActions: { flexDirection: "row", gap: 12 },
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
  detailActionBtnTextExpense: { fontSize: 17, fontWeight: "800", color: "#B71C1C" },
  detailActionBtnTextIncome: { fontSize: 17, fontWeight: "800", color: "#1B5E20" },
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
    maxHeight: SCREEN_H * 0.75,
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
  sheetSubtitle: { fontSize: 17, color: C.textMuted, marginTop: 2 },
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
  sheetCropEmojiBg: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCropName: { fontSize: 19, fontWeight: "800", color: C.textPrimary },
  sheetCropMeta: { fontSize: 16, color: C.textMuted, marginTop: 2 },
  bighaFont: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  sheetCropStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sheetCropStatusText: { fontSize: 14, fontWeight: "800" },
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

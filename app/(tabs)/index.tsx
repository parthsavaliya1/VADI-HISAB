/**
 * FILE: app/(tabs)/index.tsx
 *
 * ✅ Uses api.ts — axios instance with token, interceptors & typed responses
 * ✅ getMyProfile, getCrops, getExpenses from api.ts
 * ✅ getIncomes added via same API axios instance
 * ✅ Light fresh green palette
 * ✅ "આવક ઉમેરો" → /income/add-income
 * ✅ Pull-to-refresh, dynamic transactions, animated counter
 */

import { useProfile } from "@/contexts/ProfileContext";
import {
  API,
  getCrops,
  getExpenses,
  getMyProfile,
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

const { height: SCREEN_H } = Dimensions.get("window");

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

  textPrimary: "#1A2E1C",
  textSecondary: "#3D5C40",
  textMuted: "#7A9B7E",

  income: "#2E7D32",
  incomePale: "#E8F5E9",
  expense: "#C62828",
  expensePale: "#FFEBEE",
  neutral: "#1565C0",
  neutralPale: "#E3F2FD",

  gold: "#F9A825",
  goldPale: "#FFFDE7",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

const WEATHER = {
  temp: "28°C",
  condition: "આંશિક વાદળ",
  humidity: "68%",
  wind: "14 km/h",
};

const CROP_COLORS: [string, string][] = [
  ["#4CAF50", "#2E7D32"],
  ["#66BB6A", "#388E3C"],
  ["#FFA726", "#E65100"],
  ["#42A5F5", "#1565C0"],
  ["#AB47BC", "#6A1B9A"],
];

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

function formatRelativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "આજે";
  if (diff === 1) return "ગઈ કાલે";
  if (diff < 7) return `${diff} દિવસ`;
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
): Transaction[] {
  const expTxns: Transaction[] = expenses.map((e) => ({
    _id: e._id,
    type: "expense" as const,
    label: expenseLabel(e),
    crop: getCropName(e.cropId as any),
    amount: -expenseAmount(e),
    date: formatRelativeDate(e.date),
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
    date: formatRelativeDate(i.date),
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
  visible,
  crops,
  onSelect,
  onClose,
  type,
}: {
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
              {isExpense ? "💸 ખર્ચ ઉમેરો" : "💰 આવક ઉમેરો"}
            </Text>
            <Text style={styles.sheetSubtitle}>પહેલા પાક પસંદ કરો</Text>
          </View>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {crops.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Text style={{ fontSize: 50, marginBottom: 12 }}>🌱</Text>
            <Text style={styles.sheetEmptyText}>કોઈ પાક નથી</Text>
            <TouchableOpacity
              style={[styles.sheetEmptyBtn, { backgroundColor: accentPale }]}
              onPress={() => {
                onClose();
                router.push("/crop/add-crop");
              }}
            >
              <Text style={[styles.sheetEmptyBtnText, { color: accentColor }]}>
                + નવો પાક ઉમેરો
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
                    <Text style={{ fontSize: 22 }}>
                      {crop.cropEmoji ?? "🌱"}
                    </Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetCropName}>{crop.cropName}</Text>
                    <Text style={styles.sheetCropMeta}>
                      {crop.season === "Kharif"
                        ? "☔ ખરીફ"
                        : crop.season === "Rabi"
                          ? "❄️ રવી"
                          : "☀️ ઉનાળો"}
                      {" · "}
                      <Text style={styles.bighaFont}>{crop.area} </Text>
                      {crop.areaUnit ?? "Bigha"}
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
  onAddExpense,
  onAddIncome,
}: {
  onAddExpense: () => void;
  onAddIncome: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ ઝડપી કામ</Text>
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
                size={22}
                color={C.expense}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.expense }]}>
                ખર્ચ ઉમેરો
              </Text>
              <Text style={styles.qaSub}>પાક પ્રમાણે</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={C.expense} />
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
              <Ionicons name="add-circle-outline" size={22} color={C.income} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaLabel, { color: C.income }]}>
                આવક ઉમેરો
              </Text>
              <Text style={styles.qaSub}>પાક પ્રમાણે</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={C.income} />
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
            { backgroundColor: C.green50, borderColor: C.green100 },
          ]}
        >
          <View style={[styles.qaIcon, { backgroundColor: C.green100 }]}>
            <Ionicons name="leaf" size={22} color={C.green700} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.qaLabel, { color: C.green700 }]}>
              નવો પાક ઉમેરો
            </Text>
            <Text style={styles.qaSub}>નામ, સીઝન, વિસ્તાર</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={C.green700} />
        </View>
      </PressableCard>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧾 Recent Transactions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RecentTransactions({
  transactions,
  loading,
}: {
  transactions: Transaction[];
  loading: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🧾 તાજા વ્યવહાર</Text>
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => router.push("/expense" as any)}
        >
          <Text style={styles.seeAll}>બધા જુઓ</Text>
          <Ionicons name="chevron-forward" size={14} color={C.green700} />
        </TouchableOpacity>
      </View>
      <View style={styles.txnList}>
        {loading ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={C.green500} size="small" />
            <Text style={{ color: C.textMuted, marginTop: 8, fontSize: 13 }}>
              લોડ થઈ રહ્યું છે...
            </Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={{ padding: 28, alignItems: "center" }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🧾</Text>
            <Text
              style={{ color: C.textMuted, fontSize: 14, fontWeight: "600" }}
            >
              કોઈ વ્યવહાર નથી
            </Text>
            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
              ખર્ચ અથવા આવક ઉમેરો
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
  const { profile, setProfile } = useProfile();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [transactions, setTxns] = useState<Transaction[]>([]);
  const [selectedCrop, setSelected] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"expense" | "income">("expense");

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ── Load all data via api.ts ─────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // Profile + crops in parallel (both use API axios instance)
      const [prof, cropRes] = await Promise.all([
        getMyProfile(), // from api.ts — GET /profile/me
        getCrops(), // from api.ts — GET /crops
      ]);
      setProfile(prof);
      setCrops(cropRes.data);

      // Transactions: last 5 expenses + last 5 incomes in parallel
      const [expRes, incRes] = await Promise.all([
        getExpenses(undefined, undefined, 1, 5), // from api.ts — GET /expenses
        getIncomes(1, 5), // local fn using API — GET /income
      ]);
      setTxns(buildTransactions(expRes.data, incRes.data));
    } catch (err) {
      // api.ts interceptors already console.log the error details
      console.log("[Dashboard] loadData error:", (err as Error).message);
    } finally {
      setLoadingProfile(false);
      setLoadingTxns(false);
      setRefreshing(false);
    }
  }, []);

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

  // ── Derived totals from crop data ─────────────────────────────────────────────
  const totalIncome = crops.reduce((s, c) => s + ((c as any).income ?? 0), 0);
  const totalExpense = crops.reduce((s, c) => s + ((c as any).expense ?? 0), 0);
  const totalProfit = totalIncome - totalExpense;

  const farmerName = profile?.name ?? "";
  const farmerVillage = profile?.village ?? "";
  const farmerLand = profile?.totalLand
    ? `${profile.totalLand.value} ${profile.totalLand.unit === "bigha" ? "વીઘા" : "એકર"}`
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
            <Text style={styles.stickyName}>{farmerName || "ડૅશબોર્ડ"}</Text>
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
                <Text style={styles.greetingSmall}>🌅 સ્વાગત છે</Text>
                {loadingProfile ? (
                  <SkeletonLine
                    width={180}
                    height={24}
                    style={{ marginVertical: 4 }}
                  />
                ) : (
                  <Text style={styles.farmerName} numberOfLines={1}>
                    {farmerName || "ખેડૂત"}
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
              <Ionicons name="partly-sunny-outline" size={20} color={C.gold} />
              <Text style={styles.weatherTemp}>{WEATHER.temp}</Text>
              <Text style={styles.weatherCond}>{WEATHER.condition}</Text>
              <View style={styles.weatherDivider} />
              <Ionicons name="water-outline" size={13} color={C.textMuted} />
              <Text style={styles.weatherStat}>{WEATHER.humidity}</Text>
              <Ionicons name="flag-outline" size={13} color={C.textMuted} />
              <Text style={styles.weatherStat}>{WEATHER.wind}</Text>
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
                <Text style={styles.profitLabel}>⚖️ કુલ ચોખ્ખો નફો</Text>
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
                        label: "આવક",
                        value: totalIncome,
                        color: C.income,
                        bg: C.incomePale,
                        isCount: false,
                      },
                      {
                        icon: "arrow-down-circle-outline",
                        label: "ખર્ચ",
                        value: totalExpense,
                        color: C.expense,
                        bg: C.expensePale,
                        isCount: false,
                      },
                      {
                        icon: "leaf-outline",
                        label: "પાક",
                        value: crops.length,
                        color: C.green700,
                        bg: C.green50,
                        isCount: true,
                      },
                    ] as const
                  ).map((item, i) => (
                    <View
                      key={i}
                      style={[
                        styles.profitSubItem,
                        { backgroundColor: item.bg },
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
                        <Text style={styles.profitSubCaption}>
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

        {/* ── 1. ⚡ ઝડપી કામ ── */}
        <QuickActions
          onAddExpense={openExpensePicker}
          onAddIncome={openIncomePicker}
        />

        {/* ── 2. 🌱 મારા પાક ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🌱 મારા પાક</Text>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/crop" as any)}
            >
              <Text style={styles.seeAll}>બધા જુઓ</Text>
              <Ionicons name="chevron-forward" size={14} color={C.green700} />
            </TouchableOpacity>
          </View>

          {crops.length === 0 ? (
            <PressableCard
              onPress={() => router.push("/crop/add-crop")}
              style={styles.emptyCropCard}
            >
              <Text style={{ fontSize: 44, marginBottom: 8 }}>🌱</Text>
              <Text style={styles.emptyCropText}>કોઈ પાક નથી</Text>
              <View style={styles.emptyCropBtn}>
                <Ionicons name="add" size={15} color={C.green700} />
                <Text style={styles.emptyCropBtnText}>નવો પાક ઉમેરો</Text>
              </View>
            </PressableCard>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {crops.slice(0, 5).map((crop, i) => {
                const colors = CROP_COLORS[i % CROP_COLORS.length];
                const progress =
                  (crop as any).progress ?? Math.min(90, 30 + i * 20);
                const isSel = selectedCrop === i;
                return (
                  <PressableCard
                    key={crop._id}
                    onPress={() => setSelected(i)}
                    style={[styles.cropCard, isSel && styles.cropCardSel]}
                  >
                    <LinearGradient
                      colors={colors}
                      style={styles.cropCardGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isSel && <View style={styles.cropRing} />}
                      <View style={styles.cropTop}>
                        <Text style={{ fontSize: 32 }}>
                          {crop.cropEmoji ?? "🌱"}
                        </Text>
                        <View
                          style={[
                            styles.cropBadge,
                            {
                              backgroundColor:
                                crop.status === "Active"
                                  ? "#E8F5E9"
                                  : "#FFF8E1",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cropBadgeText,
                              {
                                color:
                                  crop.status === "Active"
                                    ? C.income
                                    : "#795548",
                              },
                            ]}
                          >
                            {crop.status === "Active"
                              ? "● સક્રિય"
                              : crop.status === "Harvested"
                                ? "✓ લણણી"
                                : "◌ બંધ"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cropName}>{crop.cropName}</Text>
                      <Text style={styles.cropMeta}>
                        {crop.season === "Kharif"
                          ? "☀️ ખરીફ"
                          : crop.season === "Rabi"
                            ? "❄️ રવી"
                            : "🌸 ઉનાળો"}
                        {" · "}
                        {crop.area} {crop.areaUnit ?? "Bigha"}
                      </Text>
                      <View style={styles.progBg}>
                        <View
                          style={[
                            styles.progFill,
                            { width: `${progress}%` as any },
                          ]}
                        />
                      </View>
                      <Text style={styles.progLabel}>{progress}% પૂર્ણ</Text>
                    </LinearGradient>
                  </PressableCard>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Selected Crop Detail ── */}
        {crops.length > 0 &&
          crops[selectedCrop] &&
          (() => {
            const c = crops[selectedCrop];
            const inc = (c as any).income ?? 0;
            const exp = (c as any).expense ?? 0;
            const profit = inc - exp;
            return (
              <View style={styles.section}>
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <View style={styles.detailEmojiWrap}>
                      <Text style={{ fontSize: 28 }}>
                        {c.cropEmoji ?? "🌱"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{c.cropName}</Text>
                      <Text style={styles.detailMeta}>
                        {c.season === "Kharif"
                          ? "ખરીફ"
                          : c.season === "Rabi"
                            ? "રવી"
                            : "ઉનાળો"}
                        {" · "}
                        {c.area} {c.areaUnit}
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
                        size={17}
                        color={C.green700}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailStats}>
                    {[
                      {
                        icon: "💰",
                        val: inc,
                        label: "કુલ આવક",
                        color: C.income,
                        bg: C.incomePale,
                      },
                      {
                        icon: "📉",
                        val: exp,
                        label: "કુલ ખર્ચ",
                        color: C.expense,
                        bg: C.expensePale,
                      },
                      {
                        icon: profit >= 0 ? "📈" : "⚠️",
                        val: profit,
                        label: "ચોખ્ખો નફો",
                        color: profit >= 0 ? C.neutral : "#E65100",
                        bg: profit >= 0 ? C.neutralPale : "#FFF3E0",
                      },
                    ].map((s, idx) => (
                      <View
                        key={idx}
                        style={[styles.statBox, { backgroundColor: s.bg }]}
                      >
                        <Text style={{ fontSize: 18, marginBottom: 4 }}>
                          {s.icon}
                        </Text>
                        <Text style={[styles.statValue, { color: s.color }]}>
                          {profit < 0 && idx === 2 ? "-" : ""}₹
                          {Math.abs(s.val).toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.statLabel}>{s.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.detailActions}>
                    <PressableCard
                      onPress={() =>
                        router.push(
                          `/expense/add-expense?cropId=${c._id}` as any,
                        )
                      }
                      style={[
                        styles.detailBtn,
                        {
                          backgroundColor: C.expensePale,
                          borderColor: "#FFCDD2",
                        },
                      ]}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={17}
                        color={C.expense}
                      />
                      <Text
                        style={[styles.detailBtnText, { color: C.expense }]}
                      >
                        ખર્ચ ઉમેરો
                      </Text>
                    </PressableCard>
                    {/* ✅ Income route */}
                    <PressableCard
                      onPress={() =>
                        router.push(`/income/add-income?cropId=${c._id}` as any)
                      }
                      style={[
                        styles.detailBtn,
                        {
                          backgroundColor: C.incomePale,
                          borderColor: C.green100,
                        },
                      ]}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={17}
                        color={C.income}
                      />
                      <Text style={[styles.detailBtnText, { color: C.income }]}>
                        આવક ઉમેરો
                      </Text>
                    </PressableCard>
                  </View>
                </View>
              </View>
            );
          })()}

        {/* ── 3. 🧾 તાજા વ્યવહાર ── */}
        <RecentTransactions transactions={transactions} loading={loadingTxns} />

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      <CropPickerModal
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
  stickyName: { fontSize: 16, fontWeight: "800", color: C.textPrimary },

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
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 3,
    fontWeight: "500",
  },
  farmerName: {
    fontSize: 24,
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationText: { fontSize: 13, color: C.textSecondary },
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
  avatarText: { fontSize: 17, fontWeight: "800", color: C.green700 },

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
  weatherTemp: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  weatherCond: { fontSize: 11, color: C.textMuted, flex: 1 },
  weatherDivider: {
    width: 1,
    height: 16,
    backgroundColor: C.borderLight,
    marginHorizontal: 2,
  },
  weatherStat: { fontSize: 12, color: C.textMuted, fontWeight: "500" },

  scrollContent: { paddingTop: 20 },
  section: { marginHorizontal: 16, marginBottom: 22 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: C.textPrimary },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { fontSize: 13, color: C.green700, fontWeight: "700" },

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
    fontSize: 13,
    color: C.textMuted,
    fontWeight: "600",
    marginBottom: 6,
  },
  profitAmountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginBottom: 14,
  },
  profitSign: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  netProfitAmount: {
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
    color: C.textPrimary,
  },
  profitSubRow: { flexDirection: "row", gap: 8 },
  profitSubItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  profitSubValue: { fontSize: 12, fontWeight: "800" },
  profitSubCaption: { fontSize: 10, color: C.textMuted, fontWeight: "500" },

  qaRow: { flexDirection: "row", gap: 10 },
  qaHalf: { flex: 1 },
  qaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    padding: 13,
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
    gap: 12,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  qaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  qaLabel: { fontSize: 14, fontWeight: "800" },
  qaSub: { fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: "500" },

  cropCard: {
    width: 168,
    marginRight: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  cropCardSel: { shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
  cropCardGrad: { padding: 16, minHeight: 175 },
  cropRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  cropTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cropBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  cropBadgeText: { fontSize: 10, fontWeight: "700" },
  cropName: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 3 },
  cropMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
    fontWeight: "500",
  },
  progBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 2,
    marginBottom: 4,
  },
  progFill: { height: 4, backgroundColor: "#fff", borderRadius: 2 },
  progLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
  },

  emptyCropCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 30,
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  emptyCropText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 10,
  },
  emptyCropBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.green50,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyCropBtnText: { fontSize: 13, color: C.green700, fontWeight: "700" },

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
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
  },
  detailName: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  detailMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
  },
  detailStats: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statBox: {
    flex: 1,
    borderRadius: 13,
    padding: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00000006",
  },
  statValue: { fontSize: 13, fontWeight: "900", marginBottom: 2 },
  statLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  detailActions: { flexDirection: "row", gap: 10 },
  detailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  detailBtnText: { fontSize: 13, fontWeight: "800" },

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
  txnLabel: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  txnMeta: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  txnAmount: { fontSize: 14, fontWeight: "900" },

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
  sheetTitle: { fontSize: 19, fontWeight: "800", color: C.textPrimary },
  sheetSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
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
  sheetCropName: { fontSize: 15, fontWeight: "800", color: C.textPrimary },
  sheetCropMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  bighaFont: { fontSize: 12, fontWeight: "800", color: C.textPrimary },
  sheetCropStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sheetCropStatusText: { fontSize: 11, fontWeight: "700" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  sheetEmpty: { alignItems: "center", paddingVertical: 40 },
  sheetEmptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 14,
  },
  sheetEmptyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },
  sheetEmptyBtnText: { fontSize: 14, fontWeight: "800" },
});

/**
 * All transactions — income + expense, year-wise, latest to old.
 * Route: /all-transactions
 * Opened from dashboard "બધા જુઓ" at તાજા વ્યવહાર.
 */

import { useProfile } from "@/contexts/ProfileContext";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getExpenses,
  getFinancialYearOptionsExtended,
  getIncomes,
  getCrops,
  getCurrentFinancialYear,
  type Crop,
  type Expense,
  type ExpenseCategory,
  type Income,
  type IncomeCategory,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getCropImageSource } from "@/utils/cropImageSource";

const C = {
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  textPrimary: "#0A0E0B",
  textSecondary: "#1A2E1C",
  textMuted: "#2D4230",
  income: "#1B5E20",
  incomePale: "#E8F5E9",
  expense: "#B71C1C",
  expensePale: "#FFEBEE",
  borderLight: "#EAF4EA",
};

// ─── Transaction type (merged income + expense) ─────────────────────────────────
interface TxnItem {
  _id: string;
  type: "income" | "expense";
  label: string;
  cropName: string;
  cropEmoji?: string;
  amount: number;
  rawDate: string;
  displayDate: string;
  icon: string;
  category: string;
  financialYear: string;
  bucket: "crop" | "bhagya" | "tractor" | "general";
}

type TxnFilter = "crop" | "tractor" | "bhagya" | "general";

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

function expenseAmount(e: Expense): number {
  const top = (e as any).amount;
  if (typeof top === "number" && !Number.isNaN(top)) return top;
  if (e.category === "Seed") return e.seed?.totalCost ?? 0;
  if (e.category === "Fertilizer") return e.fertilizer?.totalCost ?? 0;
  if (e.category === "Pesticide") return e.pesticide?.cost ?? 0;
  if (e.category === "Labour") return e.labourDaily?.totalCost ?? e.labourContract?.amountGiven ?? 0;
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
    Other: e.other?.description ? `અન્ય ખર્ચ - ${e.other.description}` : "અન્ય ખર્ચ",
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

function incomeAmount(i: Income): number {
  const top = (i as any).amount;
  if (top != null && top !== "") {
    const n = Number(top);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (i.category === "Crop Sale") return (i.cropSale as any)?.totalAmount ?? 0;
  if (i.category === "Subsidy") return i.subsidy?.amount ?? 0;
  if (i.category === "Rental Income") return (i.rentalIncome as any)?.totalAmount ?? 0;
  if (i.category === "Other") return i.otherIncome?.amount ?? 0;
  return 0;
}

function incomeLabel(i: Income): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": `વેચાણ - ${i.cropSale?.marketName || "VADI"}`,
    Subsidy: `સહા. - ${i.subsidy?.schemeType ?? ""}`,
    // Tractor / rental income: work type + farmer name (no emoji)
    "Rental Income": (() => {
      const r = i.rentalIncome;
      if (!r) return "ભાડા";
      const work =
        RENTAL_ASSET_LABELS[r.assetType ?? ""] ??
        r.assetType ??
        "ભાડા";
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
    "Rental Income": "car-outline",
    Other: "wallet-outline",
  };
  return m[cat] ?? "cash";
}

function getCropName(cropId: string | { _id: string; cropName: string } | undefined, crops: Crop[]): string {
  if (!cropId) return "—";
  if (typeof cropId === "object") return cropId.cropName ?? "—";
  const c = crops.find((x) => x._id === cropId);
  return c?.cropName ?? "—";
}

function getCropById(cropId: string | { _id: string; cropName: string } | undefined, crops: Crop[]): Crop | undefined {
  if (!cropId) return undefined;
  if (typeof cropId === "object") return crops.find((x) => x._id === cropId._id);
  return crops.find((x) => x._id === cropId);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatINR(n: number | undefined | null): string {
  const x = Number(n);
  return formatWholeNumber(Number.isFinite(x) ? Math.abs(x) : 0);
}

// ─── Build merged list per year (latest year first, within year latest first) ─
function buildYearWiseTxns(
  expensesByYear: Record<string, Expense[]>,
  incomesByYear: Record<string, Income[]>,
  crops: Crop[],
): { year: string; txns: TxnItem[] }[] {
  const years = [...getFinancialYearOptionsExtended()].sort((a, b) => {
    const aStart = Number(a.split("-")[0] || 0);
    const bStart = Number(b.split("-")[0] || 0);
    return bStart - aStart;
  });
  const out: { year: string; txns: TxnItem[] }[] = [];

  for (const fy of years) {
    const exps = expensesByYear[fy] ?? [];
    const incs = incomesByYear[fy] ?? [];
    const list: TxnItem[] = [
      ...exps.map((e) => {
        const crop = getCropById(e.cropId as any, crops);
        const cropName = crop?.cropName ?? getCropName(e.cropId as any, crops);
        const isBhagmaCrop = crop?.landType === "bhagma";
        const labourSourceTag = (e.labourContract as any)?.sourceTag;
        const isLegacyBhagyaNoUpad =
          !e.cropId &&
          e.category === "Labour" &&
          e.expenseSource == null &&
          labourSourceTag == null &&
          (e.labourContract as any)?.advanceReason &&
          (e.labourContract as any)?.advanceReason !== "Other" &&
          !e.notes?.trim();
        let bucket: TxnItem["bucket"] = "general";

        if (e.category === "Labour") {
          if (e.expenseSource === "generalExpense" || labourSourceTag === "generalExpense") bucket = "general";
          else if (e.expenseSource === "bhagyaUpad" || labourSourceTag === "bhagyaUpad" || isBhagmaCrop || isLegacyBhagyaNoUpad) bucket = "bhagya";
          else if (e.cropId) bucket = "crop";
        } else if (e.cropId) {
          bucket = "crop";
        }

        return {
          _id: e._id,
          type: "expense" as const,
          label: expenseLabel(e),
          cropName,
          cropEmoji: crop?.cropEmoji,
          amount: -expenseAmount(e),
          rawDate: e.date,
          displayDate: formatDate(e.date),
          icon: expenseIcon(e.category),
          category: e.category,
          financialYear: fy,
          bucket,
        };
      }),
      ...incs.map((i) => {
        const rawDate = i.date ?? (i as any).createdAt ?? "";
        const cropName = getCropName(i.cropId, crops);
        let bucket: TxnItem["bucket"] = "general";
        if (i.category === "Rental Income") bucket = "tractor";
        else if (i.cropId) bucket = "crop";

        return {
          _id: i._id,
          type: "income" as const,
          label: incomeLabel(i),
          cropName,
          cropEmoji: getCropById(i.cropId, crops)?.cropEmoji,
          amount: incomeAmount(i),
          rawDate,
          displayDate: formatDate(rawDate),
          icon: incomeIcon(i.category),
          category: i.category,
          financialYear: fy,
          bucket,
        };
      }),
    ];
    list.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
    if (list.length > 0) out.push({ year: fy, txns: list });
  }
  return out;
}

// ─── Row component ───────────────────────────────────────────────────────────
function TxnRow({ item, onPress }: { item: TxnItem; onPress: () => void }) {
  const isIncome = item.type === "income";
  const accent = isIncome ? C.income : C.expense;
  const bg = isIncome ? C.incomePale : C.expensePale;

  return (
    <TouchableOpacity
      style={styles.txnCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.txnCardBar, { backgroundColor: accent }]} />
      <View style={[styles.txnIconWrap, { backgroundColor: bg }]}>
        {(() => {
          const src = getCropImageSource(item.cropName);
          return src ? (
            <Image
              source={src}
              style={styles.txnCropImage}
              resizeMode="contain"
            />
          ) : item.cropEmoji ? (
            <Text style={styles.txnCropEmoji}>{item.cropEmoji}</Text>
          ) : (
            <Ionicons name={item.icon as any} size={22} color={accent} />
          );
        })()}
      </View>
      <View style={styles.txnCardBody}>
        <Text style={styles.txnCardLabel} numberOfLines={1}>{item.label}</Text>
        <Text style={styles.txnCardMeta}>{item.cropName} · {item.displayDate}</Text>
      </View>
      <Text style={[styles.txnCardAmount, { color: accent }]}>
        {item.amount > 0 ? "+" : ""}{formatINR(item.amount)}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Year section header ──────────────────────────────────────────────────────
function YearHeader({ year }: { year: string }) {
  return (
    <LinearGradient
      colors={["#E8F5E9", "#F1F8F1"]}
      style={styles.yearHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <View style={styles.yearHeaderRow}>
        <Text style={styles.yearTitle}>{year}</Text>
        <Ionicons name="time-outline" size={18} color={C.textMuted} />
      </View>
    </LinearGradient>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AllTransactionsScreen() {
  const { profile } = useProfile();
  const { transactionsRefreshKey } = useRefresh();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [yearWise, setYearWise] = useState<{ year: string; txns: TxnItem[] }[]>([]);
  const [activeFilter, setActiveFilter] = useState<TxnFilter>("crop");
  const [yearFilter, setYearFilter] =
    useState<"previous" | "current" | "next">("current");

  // Always show three year filters: previous + current + next financial year.
  // IMPORTANT: keep `yearsToLoad` stable across renders, otherwise `fetchAll`
  // keeps getting re-created and the `useEffect` triggers repeatedly.
  const { currentYear, previousYear, nextYear, yearsToLoad } = React.useMemo(() => {
    const currentYear = getCurrentFinancialYear();
    const [startY] = currentYear.split("-").map(Number);
    const previousYear = `${startY - 1}-${String(startY % 100).padStart(2, "0")}`;
    const nextYear = `${startY + 1}-${String((startY + 2) % 100)
      .padStart(2, "0")
      .toString()}`;
    return { currentYear, previousYear, nextYear, yearsToLoad: [previousYear, currentYear, nextYear] };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const years = yearsToLoad;
      const [cropRes, ...yearResults] = await Promise.all([
        getCrops(1, 500, undefined, undefined, undefined),
        ...years.flatMap((fy) => [
          getExpenses(undefined, undefined, undefined, 1, 500, fy),
          getIncomes(1, 500, undefined, undefined, undefined, fy),
        ]),
      ]);

      const expensesByYear: Record<string, Expense[]> = {};
      const incomesByYear: Record<string, Income[]> = {};
      years.forEach((fy, i) => {
        const expRes = yearResults[i * 2] as { data?: Expense[] };
        const incRes = yearResults[i * 2 + 1] as { data?: Income[] };
        expensesByYear[fy] = expRes?.data ?? [];
        incomesByYear[fy] = incRes?.data ?? [];
      });

      const built = buildYearWiseTxns(expensesByYear, incomesByYear, cropRes.data ?? []);
      setYearWise(built);
    } catch (err) {
      console.warn("[AllTransactions]", (err as Error).message);
      setYearWise([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearsToLoad]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, transactionsRefreshKey]);

  const openDetail = (t: TxnItem) => {
    router.push(`/transaction/details?id=${t._id}&type=${t.type}` as any);
  };

  const filterChips: { key: TxnFilter; label: string }[] = [
    { key: "crop", label: "પાક આવક/ખર્ચ" },
    { key: "general", label: "વધારો નો ખર્ચ" },
    ...(profile?.tractorAvailable ? [] : []),
  ];

  const filteredYearWise = yearWise
    .filter(({ year }) => {
      if (yearFilter === "current" && currentYear) return year === currentYear;
      if (yearFilter === "previous" && previousYear) return year === previousYear;
      if (yearFilter === "next" && nextYear) return year === nextYear;
      return true;
    })
    .map(({ year, txns }) => ({
      year,
      txns: txns.filter((t) => {
        if (activeFilter === "crop") return t.bucket === "crop";
        if (activeFilter === "bhagya") return t.bucket === "bhagya";
        if (activeFilter === "general")
          return t.bucket === "general" && t.type === "expense";
        if (activeFilter === "tractor") return t.bucket === "tractor";
        return true;
      }),
    }))
    .filter(({ txns }) => txns.length > 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.headerWrap, { backgroundColor: C.bg }]}>
        <ScreenHeader
          title="🧾 બધા વ્યવહાર"
          style={{ marginBottom: 0, backgroundColor: C.bg }}
        />
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={C.green700} />
          <Text style={styles.loadText}>લોડ થઈ રહ્યું છે...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll(); }}
              colors={[C.green700]}
              tintColor={C.green700}
            />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            {filterChips.map((chip) => {
              const active = activeFilter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActiveFilter(chip.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.yearFilterRow}>
            {previousYear && (
              <TouchableOpacity
                style={[
                  styles.yearFilterChip,
                  yearFilter === "previous" && styles.yearFilterChipActive,
                ]}
                onPress={() => setYearFilter("previous")}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.yearFilterChipText,
                    yearFilter === "previous" &&
                      styles.yearFilterChipTextActive,
                  ]}
                >
                  {previousYear}
                </Text>
              </TouchableOpacity>
            )}
            {currentYear && (
              <TouchableOpacity
                style={[
                  styles.yearFilterChip,
                  yearFilter === "current" && styles.yearFilterChipActive,
                ]}
                onPress={() => setYearFilter("current")}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.yearFilterChipText,
                    yearFilter === "current" && styles.yearFilterChipTextActive,
                  ]}
                >
                  {currentYear}
                </Text>
              </TouchableOpacity>
            )}
            {nextYear && (
              <TouchableOpacity
                style={[
                  styles.yearFilterChip,
                  yearFilter === "next" && styles.yearFilterChipActive,
                ]}
                onPress={() => setYearFilter("next")}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.yearFilterChipText,
                    yearFilter === "next" && styles.yearFilterChipTextActive,
                  ]}
                >
                  {nextYear}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {filteredYearWise.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>કોઈ વ્યવહાર નથી</Text>
              <Text style={styles.emptySub}>આ ફિલ્ટર માટે કોઈ વ્યવહાર નથી</Text>
            </View>
          ) : (
            filteredYearWise.map(({ year, txns }) => {
              return (
                <View key={year} style={styles.section}>
                  <View style={styles.txnList}>
                    {txns.map((t) => (
                      <TxnRow
                        key={`${t.type}-${t._id}`}
                        item={t}
                        onPress={() => openDetail(t)}
                      />
                    ))}
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerWrap: { borderBottomWidth: 1, borderBottomColor: C.borderLight },

  loadWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadText: { fontSize: 15, color: C.textMuted },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  filterScroll: { marginBottom: 14 },
  filterRow: { flexDirection: "row", gap: 10, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  filterChipActive: {
    backgroundColor: C.green700,
    borderColor: C.green700,
  },
  filterChipText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  filterChipTextActive: { color: "#fff" },
  yearFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  yearFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  yearFilterChipActive: {
    backgroundColor: C.green50,
    borderColor: C.green700,
  },
  yearFilterChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
  },
  yearFilterChipTextActive: {
    color: C.green700,
  },

  section: { marginBottom: 24 },
  yearHeader: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  yearHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  yearTitle: { fontSize: 22, fontWeight: "800", color: C.textPrimary },

  txnList: { gap: 8 },
  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    overflow: "hidden",
  },
  txnCardBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  txnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  txnCropEmoji: { fontSize: 22 },
  txnCropImage: { width: 28, height: 28 },
  txnCardBody: { flex: 1, marginLeft: 12, minWidth: 0 },
  txnCardLabel: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  txnCardMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  txnCardAmount: { fontSize: 16, fontWeight: "800", marginRight: 4 },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  emptySub: { fontSize: 14, color: C.textMuted, marginTop: 4 },
});

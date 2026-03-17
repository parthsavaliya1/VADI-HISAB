import { ScreenHeader } from "@/components/ScreenHeader";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getCrops,
  getFinancialYearOptionsExtended,
  getIncomes,
  getCurrentFinancialYear,
  type Crop,
  type Income,
  type IncomeCategory,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Color System (match dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  green700: "#2E7D32",
  green500: "#4CAF50",
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  textPrimary: "#0A0E0B",
  textSecondary: "#1A2E1C",
  textMuted: "#2D4230",
  income: "#1B5E20",
  incomePale: "#E8F5E9",
  borderLight: "#EAF4EA",
};

const CATEGORY_CONFIG: Record<IncomeCategory, { label: string; icon: string }> = {
  "Crop Sale": { label: "પાક વેચાણ", icon: "cash-outline" },
  Subsidy: { label: "સહાય", icon: "ribbon-outline" },
  "Rental Income": { label: "ભાડા", icon: "car-outline" },
  Other: { label: "અન્ય", icon: "wallet-outline" },
};

function getIncomeAmount(i: Income): number {
  const amt = (i as any).amount;
  if (typeof amt === "number" && !Number.isNaN(amt)) return amt;
  if (i.category === "Crop Sale") return i.cropSale?.totalAmount ?? 0;
  if (i.category === "Subsidy") return i.subsidy?.amount ?? 0;
  if (i.category === "Rental Income") return i.rentalIncome?.totalAmount ?? 0;
  if (i.category === "Other") return i.otherIncome?.amount ?? 0;
  return 0;
}

const CROP_NAME_GUJ: Record<string, string> = {
  Cotton: "કપાસ", Groundnut: "મગફળી", Jeera: "જીરું", Garlic: "લસણ", Onion: "ડુંગળી",
  Chana: "ચણા", Wheat: "ઘઉં", Bajra: "બાજરી", Maize: "મકાઈ",
};
function cropDisplayName(name: string): string {
  return CROP_NAME_GUJ[name] ?? name;
}

function getCropName(
  cropId: string | { _id: string; cropName: string } | undefined,
  crops: Crop[] = [],
): string {
  if (!cropId) return "";
  if (typeof cropId === "object") return cropDisplayName(cropId.cropName ?? "");
  if (crops.length) {
    const c = crops.find((x) => x._id === cropId);
    if (c) return cropDisplayName(c.cropName ?? "");
  }
  return "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("gu-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatINR(n: number): string {
  return formatWholeNumber(n);
}

function incomeLabel(i: Income): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": i.cropSale?.marketName ? `વેચાણ - ${i.cropSale.marketName}` : "પાક વેચાણ",
    Subsidy: `સ. - ${i.subsidy?.schemeType ?? ""}`,
    // Tractor income: work category + farmer name (no emoji)
    "Rental Income": (() => {
      const r = i.rentalIncome;
      if (!r) return "ભાડા";
      const work = r.assetType ?? "ભાડા";
      const name = r.rentedToName?.trim();
      return name ? `${work} - ${name}` : `${work}`;
    })(),
    Other: i.otherIncome?.source ? `અ. - ${i.otherIncome.source}` : "અન્ય આવક",
  };
  return m[i.category] ?? i.category;
}

function getDetailLine(item: Income): string {
  switch (item.category) {
    case "Crop Sale":
      const cs = item.cropSale;
      if (!cs) return "";
      const parts: string[] = [];
      if (cs.marketName) parts.push(`બજાર: ${cs.marketName}`);
      if (cs.quantityKg != null) parts.push(`જથ્થો: ${cs.quantityKg} kg`);
      if (cs.pricePerKg != null) parts.push(`દર: ${cs.pricePerKg}/kg`);
      if (cs.buyerName) parts.push(`ખરીદદાર: ${cs.buyerName}`);
      return parts.join(" · ");
    case "Subsidy":
      const sub = item.subsidy;
      if (!sub) return "";
      return sub.referenceNumber ? `યોજના: ${sub.schemeType} · Ref: ${sub.referenceNumber}` : `યોજના: ${sub.schemeType}`;
    case "Rental Income":
      const r = item.rentalIncome;
      if (!r) return "";
      return r.rentedToName ? `${r.assetType} · ${r.rentedToName}` : `${r.assetType} · ${r.hoursOrDays} × ${r.ratePerUnit}`;
    case "Other":
      const o = item.otherIncome;
      if (!o) return "";
      return o.description ? `${o.source} · ${o.description}` : o.source;
    default:
      return "";
  }
}

function IncomeRow({ item, crops }: { item: Income; crops: Crop[] }) {
  const cfg = CATEGORY_CONFIG[item.category];
  const amount = getIncomeAmount(item);
  const cropName = getCropName(item.cropId, crops);
  const detailLine = getDetailLine(item);

  return (
    <View style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: C.income }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.catBadge}>
            <Ionicons name={cfg.icon as any} size={14} color={C.income} />
            <Text style={styles.catText}>{cfg.label}</Text>
          </View>
          <Text style={[styles.amount, { color: C.income }]}>{formatINR(amount)}</Text>
        </View>
        {cropName ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>પાક:</Text>
            <Text style={styles.detailValue}>{cropName}</Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>તારીખ:</Text>
          <Text style={styles.detailValue}>{formatDate(item.date)}</Text>
        </View>
        {detailLine ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>વિગત:</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{detailLine}</Text>
          </View>
        ) : null}
        {item.notes?.trim() ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>નોંધ:</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{item.notes.trim()}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function AllIncomeScreen() {
  const { transactionsRefreshKey } = useRefresh();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentYear = getCurrentFinancialYear();
  const [startY] = currentYear.split("-").map(Number);
  const previousYear = `${startY - 1}-${String(startY % 100).padStart(2, "0")}`;
  const nextYear = `${startY + 1}-${String((startY + 2) % 100)
    .padStart(2, "0")
    .toString()}`;
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string | undefined>(currentYear);

  const fetchAll = useCallback(async () => {
    try {
      const [incRes, cropRes] = await Promise.all([
        getIncomes(1, 300, undefined, undefined, undefined, selectedFinancialYear),
        getCrops(1, 100),
      ]);
      setIncomes(incRes.data ?? []);
      setCrops(cropRes.data ?? []);
    } catch (err) {
      console.warn("[AllIncome]", (err as Error).message);
      setIncomes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFinancialYear]);

  useEffect(() => { fetchAll(); }, [fetchAll, transactionsRefreshKey]);

  const total = incomes.reduce((s, i) => s + getIncomeAmount(i), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.headerWrap}>
        <ScreenHeader title="💰 બધી આવક" style={{ marginBottom: 0, backgroundColor: C.bg }} />
      </View>

      {/* Financial year filter — show previous + current + next year */}
      <View style={styles.yearFilterWrap}>
        <Text style={styles.yearFilterLabel}>વિત્તીય વર્ષ:</Text>
        <View style={styles.yearChips}>
          {previousYear && (
            <TouchableOpacity
              style={[styles.yearChip, selectedFinancialYear === previousYear && styles.yearChipActive]}
              onPress={() => setSelectedFinancialYear(previousYear)}
            >
              <Text style={[styles.yearChipText, selectedFinancialYear === previousYear && styles.yearChipTextActive]}>
                {previousYear}
              </Text>
            </TouchableOpacity>
          )}
          {currentYear && (
            <TouchableOpacity
              style={[styles.yearChip, selectedFinancialYear === currentYear && styles.yearChipActive]}
              onPress={() => setSelectedFinancialYear(currentYear)}
            >
              <Text style={[styles.yearChipText, selectedFinancialYear === currentYear && styles.yearChipTextActive]}>
                {currentYear}
              </Text>
            </TouchableOpacity>
          )}
          {nextYear && (
            <TouchableOpacity
              style={[styles.yearChip, selectedFinancialYear === nextYear && styles.yearChipActive]}
              onPress={() => setSelectedFinancialYear(nextYear)}
            >
              <Text style={[styles.yearChipText, selectedFinancialYear === nextYear && styles.yearChipTextActive]}>
                {nextYear}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={C.green700} />
          <Text style={styles.loadText}>લોડ થઈ રહ્યું છે...</Text>
        </View>
      ) : (
        <>
          <View style={styles.totalBar}>
            <Text style={styles.totalLabel}>કુલ આવક</Text>
            <Text style={styles.totalValue}>{formatINR(total)}</Text>
          </View>
          <FlatList
            data={incomes}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <IncomeRow item={item} crops={crops} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchAll(); }}
                colors={[C.green700]}
                tintColor={C.green700}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💰</Text>
                <Text style={styles.emptyText}>કોઈ આવક નથી</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerWrap: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  loadWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadText: { fontSize: 16, color: C.textMuted, fontWeight: "600" },
  yearFilterWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  yearFilterLabel: { fontSize: 18, fontWeight: "700", color: C.textMuted, marginBottom: 8 },
  yearChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  yearChipActive: { borderColor: C.green700, backgroundColor: C.incomePale },
  yearChipText: { fontSize: 18, fontWeight: "700", color: C.textMuted },
  yearChipTextActive: { color: C.green700, fontWeight: "800" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  totalLabel: { fontSize: 17, fontWeight: "800", color: C.textMuted },
  totalValue: { fontSize: 21, fontWeight: "900", color: C.income },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  cardBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  catText: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  amount: { fontSize: 17, fontWeight: "800" },
  detailRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 6, gap: 6 },
  detailLabel: { fontSize: 13, fontWeight: "700", color: C.textMuted, minWidth: 52 },
  detailValue: { flex: 1, fontSize: 14, color: C.textPrimary, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: "700", color: C.textMuted },
});

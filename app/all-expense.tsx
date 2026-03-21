import { ScreenHeader } from "@/components/ScreenHeader";
import { VadiLogoLoader } from "@/components/VadiLogoLoader";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getExpenses,
  getFinancialYearOptionsExtended,
  getCurrentFinancialYear,
  type Expense,
  type ExpenseCategory,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
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
  expense: "#B71C1C",
  expensePale: "#FFEBEE",
  borderLight: "#EAF4EA",
};

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  Seed: { label: "બિયારણ", icon: "seedling-outline", color: "#16A34A" },
  Fertilizer: { label: "ખાતર", icon: "flask-outline", color: "#0891B2" },
  Pesticide: { label: "જંતુનાશક", icon: "medical-outline", color: "#DC2626" },
  Labour: { label: "મજૂરી", icon: "people-outline", color: "#D97706" },
  Machinery: { label: "મશીનરી", icon: "construct-outline", color: "#7C3AED" },
  Irrigation: { label: "સિંચાઈ", icon: "water-outline", color: "#0284C7" },
  Other: { label: "અન્ય", icon: "ellipsis-horizontal-outline", color: "#64748B" },
};

function getExpenseAmount(exp: Expense): number {
  if (typeof (exp as any).amount === "number" && !Number.isNaN((exp as any).amount))
    return (exp as any).amount;
  switch (exp.category) {
    case "Seed": return exp.seed?.totalCost ?? 0;
    case "Fertilizer": return exp.fertilizer?.totalCost ?? 0;
    case "Pesticide": return exp.pesticide?.cost ?? 0;
    case "Labour": return exp.labourDaily?.totalCost ?? exp.labourContract?.amountGiven ?? 0;
    case "Machinery": return exp.machinery?.totalCost ?? 0;
    case "Irrigation": return exp.irrigation?.amount ?? 0;
    case "Other": return exp.other?.totalAmount ?? 0;
    default: return 0;
  }
}

function getCropName(cropId: string | { _id: string; cropName: string } | undefined): string {
  if (!cropId) return "—";
  if (typeof cropId === "object") return cropId.cropName ?? "—";
  return "—";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("gu-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatINR(n: number): string {
  return formatWholeNumber(n);
}

function ExpenseRow({ item }: { item: Expense }) {
  const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.Other;
  const amount = getExpenseAmount(item);
  const cropName = getCropName(item.cropId as any);

  return (
    <View style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: cfg.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.catBadge}>
            <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
            <Text style={[styles.catText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={[styles.amount, { color: C.expense }]}>{formatINR(amount)}</Text>
        </View>
        <Text style={styles.meta}>{cropName} · {formatDate(item.date)}</Text>
      </View>
    </View>
  );
}

const ALL_CATEGORIES: (ExpenseCategory | "all")[] = [
  "all",
  "Seed",
  "Fertilizer",
  "Pesticide",
  "Labour",
  "Machinery",
  "Irrigation",
  "Other",
];

export default function AllExpenseScreen() {
  const { transactionsRefreshKey } = useRefresh();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentYear = getCurrentFinancialYear();
  const [startY] = currentYear.split("-").map(Number);
  const previousYear = `${startY - 1}-${String(startY % 100).padStart(2, "0")}`;
  const nextYear = `${startY + 1}-${String((startY + 2) % 100)
    .padStart(2, "0")
    .toString()}`;
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string | undefined>(currentYear);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "all">("all");

  const fetchAll = useCallback(async () => {
    try {
      const res = await getExpenses(
        undefined,
        selectedCategory === "all" ? undefined : selectedCategory,
        undefined,
        1,
        300,
        selectedFinancialYear,
      );
      setExpenses(res.data ?? []);
    } catch (err) {
      console.warn("[AllExpense]", (err as Error).message);
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFinancialYear, selectedCategory]);

  useEffect(() => { fetchAll(); }, [fetchAll, transactionsRefreshKey]);

  const total = expenses.reduce((s, e) => s + getExpenseAmount(e), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.headerWrap}>
        <ScreenHeader title="💸 બધા ખર્ચ" style={{ marginBottom: 0, backgroundColor: C.bg }} />
      </View>

      {/* Financial year filter — show previous + current + next year */}
      <View style={styles.filterWrap}>
        <Text style={styles.filterLabel}>વિત્તીય વર્ષ:</Text>
        <View style={styles.filterChips}>
          {previousYear && (
            <TouchableOpacity
              style={[styles.filterChip, selectedFinancialYear === previousYear && styles.filterChipActive]}
              onPress={() => setSelectedFinancialYear(previousYear)}
            >
              <Text style={[styles.filterChipText, selectedFinancialYear === previousYear && styles.filterChipTextActive]}>
                {previousYear}
              </Text>
            </TouchableOpacity>
          )}
          {currentYear && (
            <TouchableOpacity
              style={[styles.filterChip, selectedFinancialYear === currentYear && styles.filterChipActive]}
              onPress={() => setSelectedFinancialYear(currentYear)}
            >
              <Text style={[styles.filterChipText, selectedFinancialYear === currentYear && styles.filterChipTextActive]}>
                {currentYear}
              </Text>
            </TouchableOpacity>
          )}
          {nextYear && (
            <TouchableOpacity
              style={[styles.filterChip, selectedFinancialYear === nextYear && styles.filterChipActive]}
              onPress={() => setSelectedFinancialYear(nextYear)}
            >
              <Text style={[styles.filterChipText, selectedFinancialYear === nextYear && styles.filterChipTextActive]}>
                {nextYear}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter */}
      <View style={styles.filterWrap}>
        <Text style={styles.filterLabel}>પ્રકાર:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {ALL_CATEGORIES.map((cat) => {
            const label = cat === "all" ? "બધા" : (CATEGORY_CONFIG as any)[cat]?.label ?? cat;
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <VadiLogoLoader
            size="lg"
            label="લોડ થઈ રહ્યું છે..."
            labelStyle={styles.loadText}
          />
        </View>
      ) : (
        <>
          <View style={styles.totalBar}>
            <Text style={styles.totalLabel}>કુલ ખર્ચ</Text>
            <Text style={styles.totalValue}>{formatINR(total)}</Text>
          </View>
          <FlatList
            data={expenses}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <ExpenseRow item={item} />}
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
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>કોઈ ખર્ચ નથી</Text>
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
  filterWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  filterLabel: { fontSize: 14, fontWeight: "700", color: C.textMuted, marginBottom: 8 },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  filterChipActive: { backgroundColor: C.green700, borderColor: C.green700 },
  filterChipText: { fontSize: 13, fontWeight: "700", color: C.textSecondary },
  filterChipTextActive: { color: "#fff" },
  loadWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadText: { fontSize: 16, color: C.textMuted, fontWeight: "600" },
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
  totalValue: { fontSize: 21, fontWeight: "900", color: C.expense },
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
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  catText: { fontSize: 14, fontWeight: "700" },
  amount: { fontSize: 17, fontWeight: "800" },
  meta: { fontSize: 14, color: C.textMuted, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: "700", color: C.textMuted },
});

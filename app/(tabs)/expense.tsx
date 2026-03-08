import {
  deleteExpense,
  getExpenses,
  type Expense,
  type ExpenseCategory,
} from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; icon: string; color: string; bg: string }
> = {
  Seed: { label: "બિયારણ", icon: "🌱", color: "#16A34A", bg: "#DCFCE7" },
  Fertilizer: { label: "ખાતર", icon: "🧪", color: "#0891B2", bg: "#E0F2FE" },
  Pesticide: { label: "જંતુનાશક", icon: "🧴", color: "#DC2626", bg: "#FEE2E2" },
  Labour: { label: "મજૂરી", icon: "👷", color: "#D97706", bg: "#FEF3C7" },
  Machinery: { label: "મશીનરી", icon: "🚜", color: "#7C3AED", bg: "#EDE9FE" },
  Irrigation: { label: "સિંચાઈ", icon: "💧", color: "#0284C7", bg: "#E0F2FE" },
  Other: { label: "અન્ય", icon: "📦", color: "#64748B", bg: "#F1F5F9" },
};

const FILTER_TABS: {
  value: ExpenseCategory | "All";
  label: string;
  icon: string;
}[] = [
  { value: "All", label: "બધા", icon: "📋" },
  { value: "Seed", label: "બિયારણ", icon: "🌱" },
  { value: "Fertilizer", label: "ખાતર", icon: "🧪" },
  { value: "Pesticide", label: "જંતુનાશક", icon: "🧴" },
  { value: "Labour", label: "મજૂરી", icon: "👷" },
  { value: "Machinery", label: "મશીનરી", icon: "🚜" },
  { value: "Irrigation", label: "સિંચાઈ", icon: "💧" },
  { value: "Other", label: "અન્ય", icon: "📦" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getExpenseAmount(exp: Expense): number {
  if (typeof (exp as any).amount === "number" && !Number.isNaN((exp as any).amount))
    return (exp as any).amount;
  switch (exp.category) {
    case "Seed":
      return exp.seed?.totalCost ?? 0;
    case "Fertilizer":
      return exp.fertilizer?.totalCost ?? 0;
    case "Pesticide":
      return exp.pesticide?.cost ?? 0;
    case "Labour":
      return exp.labourDaily?.totalCost ?? exp.labourContract?.amountGiven ?? 0;
    case "Machinery":
      return exp.machinery?.totalCost ?? 0;
    case "Irrigation":
      return exp.irrigation?.amount ?? 0;
    case "Other":
      return exp.other?.totalAmount ?? 0;
    default:
      return 0;
  }
}

function getExpenseSubtitle(exp: Expense): string {
  switch (exp.category) {
    case "Seed":
      return `${exp.seed?.seedType ?? ""} · ${exp.seed?.quantityKg ?? 0} કિ.ગ્રા.`;
    case "Fertilizer":
      return `${exp.fertilizer?.productName ?? ""} · ${exp.fertilizer?.numberOfBags ?? 0} બૅગ`;
    case "Pesticide":
      return `${exp.pesticide?.category ?? ""} · ${exp.pesticide?.dosageML ?? 0} ml`;
    case "Labour":
      if (exp.labourDaily)
        return `${exp.labourDaily.task} · ${exp.labourDaily.numberOfPeople} × ${exp.labourDaily.days} દિ.`;
      return `ઍડ્વાન્સ · ${exp.labourContract?.advanceReason ?? ""}`;
    case "Machinery":
      return `${exp.machinery?.implement ?? ""} · ${exp.machinery?.hoursOrAcres ?? 0} કલા./એ.`;
    case "Irrigation":
      return exp.notes ?? "સિંચાઈ ખર્ચ";
    case "Other":
      return exp.other?.description ?? exp.notes ?? "અન્ય ખર્ચ";
    default:
      return "";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("gu-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyTitle}>કોઈ ખર્ચ નથી</Text>
      <Text style={styles.emptyDesc}>
        {filter === "All"
          ? "હજી કોઈ ખર્ચ ઉમેરાયો નથી.\n+ બટન દ્વારા ઉમેરો."
          : `${FILTER_TABS.find((t) => t.value === filter)?.label} કેટેગરીમાં ખર્ચ નથી.`}
      </Text>
    </View>
  );
}

// ─── Expense Card ─────────────────────────────────────────────────────────────
function ExpenseCard({
  item,
  onDelete,
}: {
  item: Expense;
  onDelete: (id: string) => void;
}) {
  const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.Other;
  const amount = getExpenseAmount(item);
  const subtitle = getExpenseSubtitle(item);
  const isContract = item.category === "Labour" && !!item.labourContract;

  const confirmDelete = () => {
    Alert.alert("ખર્ચ કાઢો?", "આ ખર્ચ કાયમ માટે કાઢી નાખવામાં આવશે.", [
      { text: "રદ કરો", style: "cancel" },
      { text: "કાઢો", style: "destructive", onPress: () => onDelete(item._id) },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: cfg.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.catBadge, { backgroundColor: cfg.bg }]}>
            <Text style={styles.catBadgeIcon}>{cfg.icon}</Text>
            <Text style={[styles.catBadgeText, { color: cfg.color }]}>
              {cfg.label}
              {isContract ? " (ઍડ્વાન્સ)" : ""}
            </Text>
          </View>
          <Text style={[styles.amount, { color: cfg.color }]}>
            {formatINR(amount)}
          </Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {item.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            📝 {item.notes}
          </Text>
        ) : null}
        <View style={styles.cardBottom}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={11} color="#9CA3AF" />
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
          <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────
function SummaryBar({ expenses }: { expenses: Expense[] }) {
  const total = expenses.reduce((sum, e) => sum + getExpenseAmount(e), 0);
  const byCategory = (Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).reduce(
    (acc, cat) => {
      acc[cat] = expenses
        .filter((e) => e.category === cat)
        .reduce((s, e) => s + getExpenseAmount(e), 0);
      return acc;
    },
    {} as Record<ExpenseCategory, number>,
  );

  return (
    <LinearGradient
      colors={["#064E3B", "#065F46", "#047857"]}
      style={styles.summaryCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.summaryTop}>
        <Text style={styles.summaryLabel}>કુલ ખર્ચ</Text>
        <Text style={styles.summaryTotal}>{formatINR(total)}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryGrid}>
        {(Object.entries(byCategory) as [ExpenseCategory, number][])
          .filter(([, v]) => v > 0)
          .map(([cat, val]) => (
            <View key={cat} style={styles.summaryItem}>
              <Text style={styles.summaryItemIcon}>
                {CATEGORY_CONFIG[cat].icon}
              </Text>
              <Text style={styles.summaryItemVal}>{formatINR(val)}</Text>
              <Text style={styles.summaryItemLabel}>
                {CATEGORY_CONFIG[cat].label}
              </Text>
            </View>
          ))}
      </View>
    </LinearGradient>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExpenseList() {
  // ✅ FIX: useLocalSearchParams can return string | string[]
  // Always coerce to plain string to avoid undefined or array issues
  const params = useLocalSearchParams<{ cropId: string; cropName?: string }>();
  const cropId = Array.isArray(params.cropId)
    ? params.cropId[0]
    : params.cropId;
  const cropName = Array.isArray(params.cropName)
    ? params.cropName[0]
    : params.cropName;

  // 🐛 Debug — remove in production
  console.log("[ExpenseList] cropId:", cropId, "| cropName:", cropName);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ExpenseCategory | "All">("All");

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await getExpenses(cropId);
      setExpenses(res.data ?? []);
    } catch (err: any) {
      Alert.alert("❌ ભૂલ", err?.message ?? "ખર્ચ લોડ થઈ શક્યા નહીં.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cropId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
    } catch (err: any) {
      Alert.alert("❌ ભૂલ", err?.message ?? "કાઢી નહીં શક્યા.");
    }
  };

  const filtered =
    filter === "All" ? expenses : expenses.filter((e) => e.category === filter);

  // ✅ cropId flows from this screen's params → passed to AddExpense
  const handleAddExpense = () => {
    if (!cropId) {
      Alert.alert("⚠️ ભૂલ", "cropId મળ્યો નથી. પાછળ જઈ ફરીથી ખોલો.");
      return;
    }
    router.push({
      pathname: "/expense/add-expense",
      params: {
        cropId, // ✅ same cropId this screen received
        cropName: cropName ?? "", // optional, for header display in AddExpense
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F0FDF4" }}>
      <StatusBar barStyle="light-content" backgroundColor="#14532D" />

      <LinearGradient
        colors={["#14532D", "#166534", "#15803D"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>💰 ખર્ચ યાદી</Text>
            {cropName ? (
              <Text style={styles.headerSub}>🌱 {cropName}</Text>
            ) : null}
          </View>
          {/* ✅ + button uses handleAddExpense which passes cropId */}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddExpense}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>લોડ થઈ રહ્યું છે...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchExpenses();
              }}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              {expenses.length > 0 && <SummaryBar expenses={expenses} />}
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={FILTER_TABS}
                keyExtractor={(t) => t.value}
                style={{ marginBottom: 16 }}
                renderItem={({ item: tab }) => {
                  const active = filter === tab.value;
                  const count =
                    tab.value === "All"
                      ? expenses.length
                      : expenses.filter((e) => e.category === tab.value).length;
                  return (
                    <TouchableOpacity
                      onPress={() => setFilter(tab.value)}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.filterIcon}>{tab.icon}</Text>
                      <Text
                        style={[
                          styles.filterLabel,
                          active && styles.filterLabelActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      {count > 0 && (
                        <View
                          style={[
                            styles.filterBadge,
                            active && styles.filterBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterBadgeText,
                              active && styles.filterBadgeTextActive,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
              <Text style={styles.countLabel}>
                {filtered.length} ખર્ચ મળ્યા
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <ExpenseCard item={item} onDelete={handleDelete} />
            </View>
          )}
          ListEmptyComponent={<EmptyState filter={filter} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  decorCircle: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#ffffff0D",
    top: -50,
    right: -40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#ffffff22",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#ffffff22",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 11, color: "#A7F3D0", marginTop: 2 },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13, color: "#6B7280" },
  summaryCard: { borderRadius: 18, padding: 18, marginBottom: 16 },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 12, color: "#A7F3D0", fontWeight: "700" },
  summaryTotal: { fontSize: 22, color: "#fff", fontWeight: "900" },
  summaryDivider: { height: 1, backgroundColor: "#ffffff20", marginBottom: 12 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem: { alignItems: "center", gap: 2, minWidth: 60 },
  summaryItemIcon: { fontSize: 18 },
  summaryItemVal: { fontSize: 12, color: "#fff", fontWeight: "700" },
  summaryItemLabel: { fontSize: 10, color: "#A7F3D0" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    marginRight: 8,
  },
  filterChipActive: { borderColor: "#059669", backgroundColor: "#D1FAE5" },
  filterIcon: { fontSize: 14 },
  filterLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  filterLabelActive: { color: "#065F46" },
  filterBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: { backgroundColor: "#059669" },
  filterBadgeText: { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  filterBadgeTextActive: { color: "#fff" },
  countLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 10,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  catBadgeIcon: { fontSize: 12 },
  catBadgeText: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 16, fontWeight: "900" },
  subtitle: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  notes: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 6,
    fontStyle: "italic",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, color: "#9CA3AF" },
  deleteBtn: { padding: 4, borderRadius: 8, backgroundColor: "#FEE2E2" },
  emptyWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
});

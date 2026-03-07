import { getIncomes, type Income, type IncomeCategory } from "@/utils/api";
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
  Subsidy: { label: "સબસિડી", icon: "ribbon-outline" },
  "Rental Income": { label: "ભાડા", icon: "car-outline" },
  Other: { label: "અન્ય", icon: "wallet-outline" },
};

function getIncomeAmount(i: Income): number {
  if (i.category === "Crop Sale") return i.cropSale?.totalAmount ?? 0;
  if (i.category === "Subsidy") return i.subsidy?.amount ?? 0;
  if (i.category === "Rental Income") return i.rentalIncome?.totalAmount ?? 0;
  if (i.category === "Other") return i.otherIncome?.amount ?? 0;
  return 0;
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
  return "₹" + n.toLocaleString("en-IN");
}

function incomeLabel(i: Income): string {
  const m: Record<IncomeCategory, string> = {
    "Crop Sale": i.cropSale?.marketName ? `વેચાણ - ${i.cropSale.marketName}` : "પાક વેચાણ",
    Subsidy: `સ. - ${i.subsidy?.schemeType ?? ""}`,
    "Rental Income": `ભાડા - ${i.rentalIncome?.assetType ?? ""}`,
    Other: i.otherIncome?.source ? `અ. - ${i.otherIncome.source}` : "અન્ય આવક",
  };
  return m[i.category] ?? i.category;
}

function IncomeRow({ item }: { item: Income }) {
  const cfg = CATEGORY_CONFIG[item.category];
  const amount = getIncomeAmount(item);
  const cropName = getCropName(item.cropId);

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
        <Text style={styles.meta}>{incomeLabel(item)} · {cropName} · {formatDate(item.date)}</Text>
      </View>
    </View>
  );
}

export default function AllIncomeScreen() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await getIncomes(1, 300);
      setIncomes(res.data ?? []);
    } catch (err) {
      console.warn("[AllIncome]", (err as Error).message);
      setIncomes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const total = incomes.reduce((s, i) => s + getIncomeAmount(i), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💰 બધી આવક</Text>
        <View style={styles.backBtn} />
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
            renderItem={({ item }) => <IncomeRow item={item} />}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 21, fontWeight: "800", color: C.textPrimary },
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
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  catText: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  amount: { fontSize: 17, fontWeight: "800" },
  meta: { fontSize: 14, color: C.textMuted, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: "700", color: C.textMuted },
});

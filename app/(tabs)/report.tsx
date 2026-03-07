import {
  getYearlyReport,
  getFinancialYearOptions,
  getCurrentFinancialYear,
  type CropReportRow,
} from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Color System (match dashboard)
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
  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

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

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export default function ReportScreen() {
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [report, setReport] = useState<Awaited<ReturnType<typeof getYearlyReport>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const data = await getYearlyReport(financialYear);
      setReport(data);
    } catch (err) {
      console.warn("[Report] load error:", (err as Error).message);
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const years = getFinancialYearOptions();
  const summary = report?.summary ?? { totalIncome: 0, totalExpense: 0, netProfit: 0, totalCrops: 0, totalArea: 0 };
  const crops = (report?.crops ?? []) as CropReportRow[];

  const paddingTop = Platform.OS === "ios" ? 50 : 36;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <LinearGradient
        colors={[C.green50, C.surfaceGreen, C.bg]}
        style={[styles.header, { paddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>📊 અહેવાલ</Text>
        <Text style={styles.headerSub}>વાર્ષિક આવક-ખર્ચ સારાંશ</Text>

        <View style={styles.yearRow}>
          {years.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearChip, financialYear === y && styles.yearChipActive]}
              onPress={() => setFinancialYear(y)}
              activeOpacity={0.8}
            >
              <Text style={[styles.yearChipText, financialYear === y && styles.yearChipTextActive]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

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
              onRefresh={() => { setRefreshing(true); loadReport(); }}
              colors={[C.green700]}
              tintColor={C.green700}
            />
          }
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryBox, { backgroundColor: C.incomePale }]}>
                <Ionicons name="trending-up" size={20} color={C.income} />
                <Text style={[styles.summaryValue, { color: C.income }]}>{formatINR(summary.totalIncome)}</Text>
                <Text style={styles.summaryLabel}>કુલ આવક</Text>
              </View>
              <View style={[styles.summaryBox, { backgroundColor: C.expensePale }]}>
                <Ionicons name="trending-down" size={20} color={C.expense} />
                <Text style={[styles.summaryValue, { color: C.expense }]}>{formatINR(summary.totalExpense)}</Text>
                <Text style={styles.summaryLabel}>કુલ ખર્ચ</Text>
              </View>
            </View>
            <View style={[styles.netRow, { backgroundColor: summary.netProfit >= 0 ? C.incomePale : C.expensePale }]}>
              <Text style={styles.netLabel}>ચોખ્ખો નફો</Text>
              <Text style={[styles.netValue, { color: summary.netProfit >= 0 ? C.income : C.expense }]}>
                {formatINR(summary.netProfit)}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>🌾 પાક વાઇઝ</Text>
          {crops.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>આ વર્ષ માટે ડેટા નથી</Text>
            </View>
          ) : (
            crops.map((row) => (
              <View key={row._id} style={styles.cropRow}>
                <View style={styles.cropRowLeft}>
                  <Text style={styles.cropRowName}>{cropDisplayName(row.cropName)}</Text>
                  <Text style={styles.cropRowMeta}>
                    આવક {formatINR(row.income ?? 0)} · ખર્ચ {formatINR(row.expense ?? 0)}
                  </Text>
                </View>
                <Text style={[styles.cropRowProfit, { color: (row.profit ?? 0) >= 0 ? C.income : C.expense }]}>
                  {formatINR(row.profit ?? 0)}
                </Text>
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 21, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 16, color: C.textMuted, marginTop: 4, fontWeight: "600" },
  yearRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  yearChipActive: { backgroundColor: C.green700, borderColor: C.green700 },
  yearChipText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  yearChipTextActive: { color: "#fff" },
  loadWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadText: { fontSize: 16, color: C.textMuted, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  summaryBox: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  summaryValue: { fontSize: 18, fontWeight: "800" },
  summaryLabel: { fontSize: 13, color: C.textMuted, fontWeight: "700" },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  netLabel: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  netValue: { fontSize: 20, fontWeight: "900" },
  sectionTitle: { fontSize: 21, fontWeight: "800", color: C.textPrimary, marginBottom: 14 },
  cropRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  cropRowLeft: { flex: 1 },
  cropRowName: { fontSize: 17, fontWeight: "800", color: C.textPrimary },
  cropRowMeta: { fontSize: 14, color: C.textMuted, marginTop: 4, fontWeight: "600" },
  cropRowProfit: { fontSize: 17, fontWeight: "800", marginLeft: 12 },
  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 17, color: C.textMuted, fontWeight: "700" },
});

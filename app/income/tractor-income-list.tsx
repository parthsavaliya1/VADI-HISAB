import { ScreenHeader } from "@/components/ScreenHeader";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getCurrentFinancialYear,
  getFinancialYearOptionsExtended,
  getIncomes,
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

const C = {
  bg: "#FFF7ED",
  surface: "#FFFFFF",
  orange700: "#C2410C",
  orange500: "#EA580C",
  orange200: "#FED7AA",
  orange100: "#FFEDD5",
  orange50: "#FFF7ED",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  border: "#FED7AA",
};

function formatINR(n: number): string {
  return formatWholeNumber(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("gu-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRentalAmount(i: Income): number {
  const top = (i as any).amount;
  if (typeof top === "number" && !Number.isNaN(top)) return top;
  const r = i.rentalIncome;
  if (r?.totalAmount != null && !Number.isNaN(r.totalAmount)) {
    return r.totalAmount;
  }
  if (
    r &&
    typeof r.hoursOrDays === "number" &&
    typeof r.ratePerUnit === "number" &&
    !Number.isNaN(r.hoursOrDays) &&
    !Number.isNaN(r.ratePerUnit)
  ) {
    return r.hoursOrDays * r.ratePerUnit;
  }
  return 0;
}

function TractorIncomeRow({ item }: { item: Income }) {
  const r = item.rentalIncome;
  const work = r?.assetType ?? "Tractor";
  const farmerName = r?.rentedToName?.trim();
  const status = r?.paymentStatus ?? "Pending";
  const amount = getRentalAmount(item);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        router.push(`/transaction/details?id=${item._id}&type=income` as any)
      }
    >
      <View style={styles.cardBar} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {work}
              {farmerName ? ` - ${farmerName}` : ""}
            </Text>
            <View
              style={[
                styles.statusBadge,
                status === "Completed" ? styles.statusCompleted : styles.statusPending,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  status === "Completed" ? styles.statusDotCompleted : styles.statusDotPending,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  status === "Completed" ? styles.statusTextCompleted : styles.statusTextPending,
                ]}
              >
                {status === "Completed" ? "આપી દીધા" : "બાકી"}
              </Text>
            </View>
          </View>
          <Text style={styles.amount}>₹ {formatINR(amount)}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
            <Text style={styles.metaText}>{formatDate(item.date)}</Text>
          </View>
          {r?.hoursOrDays != null && r?.ratePerUnit != null && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={C.textMuted} />
              <Text style={styles.metaText}>
                {r.hoursOrDays} × {r.ratePerUnit}
              </Text>
            </View>
          )}
        </View>
        {item.notes?.trim() ? (
          <Text style={styles.notes} numberOfLines={2}>
            📝 {item.notes.trim()}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function TractorIncomeListScreen() {
  const { transactionsRefreshKey } = useRefresh();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(
    getCurrentFinancialYear(),
  );
  const [statusFilter, setStatusFilter] = useState<"Pending" | "Completed">("Pending");

  const fetchAll = useCallback(async () => {
    try {
      const res = await getIncomes(
        1,
        400,
        undefined,
        "Rental Income" as IncomeCategory,
        undefined,
        selectedFinancialYear,
      );
      setIncomes(res.data ?? []);
    } catch (err) {
      console.warn("[TractorIncomeList]", (err as Error).message);
      setIncomes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFinancialYear]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, transactionsRefreshKey]);

  const total = incomes.reduce((s, i) => s + getRentalAmount(i), 0);
  const pendingTotal = incomes
    .filter((i) => i.rentalIncome?.paymentStatus === "Pending")
    .reduce((s, i) => s + getRentalAmount(i), 0);
  const paidTotal = incomes
    .filter((i) => i.rentalIncome?.paymentStatus === "Completed")
    .reduce((s, i) => s + getRentalAmount(i), 0);

  const filtered = incomes.filter(
    (i) => i.rentalIncome?.paymentStatus === statusFilter,
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.headerWrap}>
        <ScreenHeader
          title="🚜 ટ્રેક્ટર આવક"
          style={{ marginBottom: 0, backgroundColor: C.bg }}
        />
      </View>

      <View style={styles.toolbar}>
        <View style={styles.yearRow}>
          <View style={styles.yearChips}>
            {getFinancialYearOptionsExtended().slice(1).map((fy) => {
              const active = selectedFinancialYear === fy;
              return (
                <TouchableOpacity
                  key={fy}
                  style={[styles.yearChip, active && styles.yearChipActive]}
                  onPress={() => setSelectedFinancialYear(fy)}
                >
                  <Text
                    style={[
                      styles.yearChipText,
                      active && styles.yearChipTextActive,
                    ]}
                  >
                    {fy}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

       
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={C.orange700} />
          <Text style={styles.loadText}>લોડ થઈ રહ્યું છે...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryBar}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>કુલ આવક</Text>
              <Text style={styles.summaryValue}>₹ {formatINR(total)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryColumnSmall}>
              <Text style={styles.summarySmallLabel}>બાકી</Text>
              <Text style={styles.summarySmallValue}>₹ {formatINR(pendingTotal)}</Text>
            </View>
            <View style={styles.summaryColumnSmall}>
              <Text style={styles.summarySmallLabel}>આપી દીધા</Text>
              <Text style={styles.summarySmallValue}>₹ {formatINR(paidTotal)}</Text>
            </View>
          </View>

           <View style={styles.statusRow}>
          {[
            { key: "Pending" as const, label: "બાકી" },
            { key: "Completed" as const, label: "આપી લીધા" },
          ].map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.statusChip, active && styles.statusChipActive]}
                onPress={() => setStatusFilter(opt.key)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    active && styles.statusChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <TractorIncomeRow item={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchAll();
                }}
                colors={[C.orange700]}
                tintColor={C.orange700}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🚜</Text>
                <Text style={styles.emptyText}>કોઈ ટ્રેક્ટર આવક નથી</Text>
                <Text style={styles.emptySub}>
                  નીચે બટનથી પ્રથમ એન્ટ્રી ઉમેરો.
                </Text>
              </View>
            }
          />
        </>
      )}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomBtn}
          activeOpacity={0.9}
          onPress={() => router.push("/income/add-tractor-income" as any)}
        >
          <Text style={styles.bottomBtnText}>ભાડું ઉમેરો</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerWrap: {
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  yearRow: { marginBottom: 8 },
  yearLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 6,
  },
  yearChips: {
    flexDirection: "row",
    gap: 8,
  },
  yearChip: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  yearChipActive: {
    backgroundColor: C.orange700,
    borderColor: C.orange700,
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textSecondary,
  },
  yearChipTextActive: {
    color: "#fff",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: "center",
  },
  statusChipActive: {
    borderColor: C.orange700,
    backgroundColor: C.orange100,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
  },
  statusChipTextActive: {
    color: C.orange700,
  },
  loadWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadText: { fontSize: 15, color: C.textMuted },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryColumn: { flex: 1.1 },
  summaryColumnSmall: { flex: 0.9 },
  summaryLabel: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: C.orange700,
    marginTop: 2,
  },
  summarySmallLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "700",
  },
  summarySmallValue: {
    fontSize: 15,
    fontWeight: "800",
    color: C.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 10,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.orange700,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  card: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  cardBar: {
    width: 4,
    backgroundColor: C.orange500,
  },
  cardBody: { flex: 1, padding: 14 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleRow: { flex: 1, marginRight: 12 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textPrimary,
  },
  amount: {
    fontSize: 17,
    fontWeight: "900",
    color: C.orange700,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusCompleted: {
    backgroundColor: "#DCFCE7",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  statusDotPending: {
    backgroundColor: "#D97706",
  },
  statusDotCompleted: {
    backgroundColor: "#16A34A",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusTextPending: {
    color: "#B45309",
  },
  statusTextCompleted: {
    color: "#166534",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "600",
  },
  notes: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 6,
  },
  empty: {
    alignItems: "center",
    paddingTop: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "800",
    color: C.textSecondary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 8,
    backgroundColor: "rgba(255,247,237,0.96)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bottomBtn: {
    borderRadius: 16,
    backgroundColor: C.orange700,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBtnText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
});


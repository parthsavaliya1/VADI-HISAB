import { ScreenHeader } from "@/components/ScreenHeader";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getCurrentFinancialYear,
  getFinancialYearOptionsExtended,
  getIncomes,
  getExpenses,
  deleteIncome,
  type Income,
  type IncomeCategory,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

function TractorIncomeRow({
  item,
  onEdit,
  onDelete,
}: {
  item: Income;
  onEdit: (item: Income) => void;
  onDelete: (item: Income) => void;
}) {
  const { t } = useTranslation();
  const r = item.rentalIncome;
  const TRACTOR_SERVICE_GU: Record<string, string> = {
    Tractor: "ટ્રેક્ટર",
    Rotavator: "રોટાવેટર",
    RAP: "રૅપ",
    Samar: "સમાર",
    "Sah Nakhya": "સહ નાખ્યા",
    Vavetar: "વાવેતર",
    "Kyara Bandhya": "ક્યારા બાંધ્યા",
    Thresher: "થ્રેશર",
    Bagu: "બાગુ",
    Fukani: "ફૂકણી",
    "Kheti Kari": "ખેતી કરી",
    "Other Equipment": "અન્ય ઉપકરણ",
  };

  const work =
    (r?.assetType && TRACTOR_SERVICE_GU[r.assetType]) ||
    r?.assetType ||
    "ટ્રેક્ટર";

  const farmerName = r?.rentedToName?.trim();
  const status = r?.paymentStatus ?? "Pending";
  const amount = getRentalAmount(item);

  const showActions = () => {
    Alert.alert("ટ્રેક્ટર આવક", "શું કરવું?", [
      { text: "રદ કરો", style: "cancel" },
      { text: "ફેરફાર કરો", onPress: () => onEdit(item) },
      {
        text: "કાઢો",
        style: "destructive",
        onPress: () => onDelete(item),
      },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={showActions}
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
                status === "Completed"
                  ? styles.statusCompleted
                  : styles.statusPending,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  status === "Completed"
                    ? styles.statusDotCompleted
                    : styles.statusDotPending,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  status === "Completed"
                    ? styles.statusTextCompleted
                    : styles.statusTextPending,
                ]}
              >
                {status === "Completed" ? "આપી દીધા" : "બાકી"}
              </Text>
            </View>
          </View>
          <Text style={styles.amount}>{formatINR(amount)}</Text>
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
  const { transactionsRefreshKey, refreshTransactions } = useRefresh();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(
    getCurrentFinancialYear(),
  );
  const [statusFilter, setStatusFilter] = useState<"Pending" | "Completed">(
    "Pending",
  );
  const [selectedFarmer, setSelectedFarmer] = useState<string>("");
  const [farmerDropdownOpen, setFarmerDropdownOpen] = useState(false);
  const [tractorExpenseTotal, setTractorExpenseTotal] = useState(0);

  const fetchAll = useCallback(async () => {
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        getIncomes(
          1,
          400,
          undefined,
          "Rental Income" as IncomeCategory,
          undefined,
          selectedFinancialYear,
        ),
        getExpenses(
          undefined,
          "Other",
          undefined,
          1,
          500,
          selectedFinancialYear,
          "tractorExpense",
        ),
      ]);
      setIncomes(incomeRes.data ?? []);
      const expenseList = expenseRes.data ?? [];
      const sum = expenseList.reduce(
        (s, e) => s + (Number(e.amount) || Number(e.other?.totalAmount) || 0),
        0
      );
      setTractorExpenseTotal(sum);
    } catch (err) {
      console.warn("[TractorIncomeList]", (err as Error).message);
      setIncomes([]);
      setTractorExpenseTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFinancialYear]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, transactionsRefreshKey]);

  const handleEditTractorAvak = useCallback((item: Income) => {
    router.push(`/income/add-tractor-income?id=${item._id}` as any);
  }, []);

  const handleDeleteTractorAvak = useCallback(
    (item: Income) => {
      Alert.alert(
        "આવક કાઢો",
        "શું તમે આ ટ્રેક્ટર આવકની એન્ટ્રી કાઢવા માંગો છો?",
        [
          { text: "રદ કરો", style: "cancel" },
          {
            text: "કાઢો",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteIncome(item._id);
                refreshTransactions();
                fetchAll();
              } catch (e) {
                Alert.alert("ભૂલ", (e as Error).message ?? "કાઢવામાં ભૂલ.");
              }
            },
          },
        ]
      );
    },
    [refreshTransactions, fetchAll]
  );

  const farmerNames = React.useMemo(() => {
    const names = new Set<string>();
    incomes.forEach((i) => {
      const n = i.rentalIncome?.rentedToName?.trim();
      if (n) names.add(n);
    });
    return ["", ...Array.from(names).sort()];
  }, [incomes]);

  const incomesByFarmer =
    selectedFarmer === ""
      ? incomes
      : incomes.filter(
          (i) => i.rentalIncome?.rentedToName?.trim() === selectedFarmer,
        );

  const total = incomesByFarmer.reduce((s, i) => s + getRentalAmount(i), 0);
  const pendingTotal = incomesByFarmer
    .filter((i) => i.rentalIncome?.paymentStatus === "Pending")
    .reduce((s, i) => s + getRentalAmount(i), 0);
  const paidTotal = incomesByFarmer
    .filter((i) => i.rentalIncome?.paymentStatus === "Completed")
    .reduce((s, i) => s + getRentalAmount(i), 0);

  const filtered = incomesByFarmer.filter(
    (i) => i.rentalIncome?.paymentStatus === statusFilter,
  );
  const nafo = total - tractorExpenseTotal;
  const showTractorSummary = !selectedFarmer;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.headerWrap}>
        <ScreenHeader
          title="🚜 ટ્રેક્ટર હિસાબ"
          style={{ marginBottom: 0, backgroundColor: C.bg }}
        />
      </View>

      <View style={styles.toolbar}>
        <View style={styles.yearRow}>
          <View style={styles.yearChips}>
            {getFinancialYearOptionsExtended()
              .slice(1)
              .map((fy) => {
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
        <View style={styles.farmerFilterRow}>
          <Text style={styles.filterLabel}>ખેડૂત પસંદ કરો</Text>
          <View style={styles.farmerDropdownWrap}>
            <TouchableOpacity
              style={styles.farmerDropdownBtn}
              onPress={() => setFarmerDropdownOpen((p) => !p)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.farmerDropdownText,
                  !selectedFarmer && styles.farmerDropdownPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedFarmer === ""
                  ? "બધા ખેડૂતો"
                  : selectedFarmer}
              </Text>
              <Ionicons
                name={farmerDropdownOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={C.textSecondary}
              />
            </TouchableOpacity>
            {farmerDropdownOpen && (
              <View style={styles.farmerDropdownList}>
                {farmerNames.map((name) => {
                  const isAll = name === "";
                  const active = selectedFarmer === name;
                  return (
                    <TouchableOpacity
                      key={isAll ? "__all__" : name}
                      style={[
                        styles.farmerDropdownItem,
                        active && styles.farmerDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedFarmer(name);
                        setFarmerDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.farmerDropdownItemText,
                          active && styles.farmerDropdownItemTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {isAll ? "બધા ખેડૂતો" : name}
                      </Text>
                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={C.orange700}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
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
          {selectedFarmer ? (
            <>
              <View style={styles.farmerSummaryLabel}>
                <Text style={styles.farmerSummaryLabelText}>
                  ખેડૂત: {selectedFarmer} નો સારાંશ
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <View style={styles.summaryBarInner}>
                  <View style={styles.summaryColumnSmall}>
                    <Text style={styles.summarySmallLabel}>બાકી</Text>
                    <Text style={styles.summarySmallValue}>
                      {formatINR(pendingTotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryDividerVertical} />
                  <View style={styles.summaryColumnSmall}>
                    <Text style={styles.summarySmallLabel}>જમા</Text>
                    <Text style={styles.summarySmallValue}>
                      {formatINR(paidTotal)}
                    </Text>
                  </View>
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
            </>
          ) : null}
          {showTractorSummary ? (
            <>
              <View style={styles.summaryBox}>
                <View style={styles.summaryBar}>
                  <View style={styles.summaryColumn}>
                    <Text style={styles.summaryLabel}>કુલ આવક</Text>
                    <Text style={styles.summaryValue}>{formatINR(total)}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryColumn}>
                    <Text style={styles.summaryLabel}>ખર્ચ</Text>
                    <Text style={styles.summaryValue}>{formatINR(tractorExpenseTotal)}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryColumn}>
                    <Text style={styles.summaryLabel}>નફો</Text>
                    <Text style={[styles.summaryValue, nafo >= 0 ? styles.summaryValueProfit : styles.summaryValueLoss]}>
                      {formatINR(nafo)}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryBarInner}>
                  <View style={styles.summaryColumnSmall}>
                    <Text style={styles.summarySmallLabel}>બાકી</Text>
                    <Text style={styles.summarySmallValue}>
                      {formatINR(pendingTotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryDividerVertical} />
                  <View style={styles.summaryColumnSmall}>
                    <Text style={styles.summarySmallLabel}>આપી દીધા</Text>
                    <Text style={styles.summarySmallValue}>
                      {formatINR(paidTotal)}
                    </Text>
                  </View>
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
            </>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TractorIncomeRow
                item={item}
                onEdit={handleEditTractorAvak}
                onDelete={handleDeleteTractorAvak}
              />
            )}
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
          style={[styles.bottomBtn, styles.bottomBtnLeft]}
          activeOpacity={0.9}
          onPress={() => router.push("/income/add-tractor-income" as any)}
        >
          <Text style={styles.bottomBtnText}>ભાડું ઉમેરો</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.bottomBtnRight]}
          activeOpacity={0.9}
          onPress={() => router.push("/income/add-tractor-expense" as any)}
        >
          <Text style={styles.bottomBtnText}>ખર્ચ</Text>
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
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 6,
  },
  farmerFilterRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  farmerDropdownWrap: {
    position: "relative",
    zIndex: 10,
  },
  farmerDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.surface,
  },
  farmerDropdownText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPrimary,
    flex: 1,
  },
  farmerDropdownPlaceholder: {
    color: C.textMuted,
  },
  farmerDropdownList: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 4,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    maxHeight: 220,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  farmerDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  farmerDropdownItemActive: {
    backgroundColor: C.orange100,
  },
  farmerDropdownItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPrimary,
    flex: 1,
  },
  farmerDropdownItemTextActive: {
    fontWeight: "800",
    color: C.orange700,
  },
  farmerSummaryLabel: {
    marginHorizontal: 16,
    marginBottom: 6,
  },
  farmerSummaryLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.orange700,
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
  summaryBox: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  summaryBarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  summaryDividerVertical: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 10,
  },
  summaryColumn: { flex: 1 },
  summaryColumnSmall: { flex: 1 },
  summaryLabel: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "900",
    color: C.orange700,
    marginTop: 2,
  },
  summaryValueProfit: { color: "#166534" },
  summaryValueLoss: { color: "#B91C1C" },
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
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 8,
    backgroundColor: "rgba(255,247,237,0.96)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bottomBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: C.orange700,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBtnLeft: {},
  bottomBtnRight: {},
  bottomBtnText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
});

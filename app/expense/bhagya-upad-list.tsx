import { ScreenHeader } from "@/components/ScreenHeader";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getCurrentFinancialYear,
  getExpenses,
  getFinancialYearOptionsExtended,
  getYearlyReport,
  type Expense,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigationState } from "@react-navigation/native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const C = {
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  blue700: "#0369A1",
  blue500: "#0284C7",
  blue100: "#DBEAFE",
  textPrimary: "#0F172A",
  textSecondary: "#1E293B",
  textMuted: "#64748B",
  border: "#E2E8F0",
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

function isDedicatedBhagyaUpad(expense: Expense): boolean {
  if (expense.cropId || expense.category !== "Labour") return false;
  if (expense.expenseSource === "bhagyaUpad") return true;
  if (expense.labourContract?.sourceTag === "bhagyaUpad") return true;

  const reason = expense.labourContract?.advanceReason;
  const hasLegacyReason =
    !!reason &&
    reason !== "Other" &&
    !expense.notes?.trim();

  return hasLegacyReason;
}

function getReasonLabel(expense: Expense): string {
  const reason = expense.labourContract?.advanceReason;
  const map: Record<string, string> = {
    Grocery: "કરિયાણું",
    Loan: "ઉધાર",
    Medical: "દવા/મેડિકલ",
    "Mobile Recharge": "મોબાઇલ રિચાર્જ",
    Festival: "તહેવાર",
    BhagmaMajuri: "ભાગમા આપેલ પાક ની મજૂરી માટે",
    Other: "અન્ય",
  };

  if (reason === "Other") {
    return expense.notes?.trim() || map.Other;
  }
  if (!reason) return "ભાગ્યા નો ઉપાડ";
  return map[reason] ?? reason;
}

function getAmount(expense: Expense): number {
  const top = (expense as any).amount;
  if (typeof top === "number" && !Number.isNaN(top)) return top;
  return expense.labourContract?.amountGiven ?? 0;
}

function BhagyaRow({ item }: { item: Expense }) {
  const reason = getReasonLabel(item);
  const amount = getAmount(item);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        router.push(
          `/transaction/details?id=${item._id}&type=expense` as any,
        )
      }
    >
      <View style={styles.card}>
        <View style={styles.cardBar} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {reason}
            </Text>
            <Text style={styles.amount}>{formatINR(amount)}</Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
              <Text style={styles.metaText}>{formatDate(item.date)}</Text>
            </View>
          </View>
          {item.notes?.trim() ? (
            <Text style={styles.notes} numberOfLines={2}>
              📝 {item.notes.trim()}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BhagyaUpadListScreen() {
  const { transactionsRefreshKey } = useRefresh();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bhagmaAavelaPaisa, setBhagmaAavelaPaisa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(
    getCurrentFinancialYear(),
  );
  const insets = useSafeAreaInsets();


const isInsideTabs = useNavigationState((state) => {
  // if parent navigator is Tabs, it will have routes like "index", "crop", etc.
  return state?.routes?.some(r =>
    ["index", "crop", "report", "live-price", "profile"].includes(r.name)
  );
});

  const fetchAll = useCallback(async () => {
    try {
      const [expRes, reportRes] = await Promise.all([
        getExpenses(
          undefined,
          "Labour",
          undefined,
          1,
          500,
          selectedFinancialYear,
        ),
        getYearlyReport(selectedFinancialYear),
      ]);
      const list = (expRes.data ?? []).filter(isDedicatedBhagyaUpad);
      setExpenses(list);
      const crops = reportRes?.crops ?? [];
      const bhagmaShare = crops.reduce(
        (sum, c) => sum + (Number((c as any).labourShare) || 0),
        0,
      );
      setBhagmaAavelaPaisa(bhagmaShare);
    } catch (err) {
      console.warn("[BhagyaUpadList]", (err as Error).message);
      setExpenses([]);
      setBhagmaAavelaPaisa(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFinancialYear]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, transactionsRefreshKey]);

  const kulUpad = expenses.reduce((s, e) => s + getAmount(e), 0);
  const vadhelaPaisa = bhagmaAavelaPaisa - kulUpad;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.headerWrap}>
        <ScreenHeader
          title="ભાગ્યા નો ઉપાડ"
          style={{ marginBottom: 0, backgroundColor: C.bg }}
        />
      </View>

      <View style={styles.toolbar}>
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

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={C.blue700} />
          <Text style={styles.loadText}>લોડ થઈ રહ્યું છે...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>ભાગ્યા નો હિસાબ</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelDark}>ભાગ્યા નો કુલ ઉપાડ</Text>
              <Text style={styles.summaryValueDark}>{formatINR(kulUpad)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelDark}>ભાગમા આવેલા પૈસા</Text>
              <Text style={styles.summaryValueDark}>{formatINR(bhagmaAavelaPaisa)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowLast]}>
              <Text
                style={[
                  styles.summaryLabelDark,
                  kulUpad > bhagmaAavelaPaisa ? styles.summaryActionGreen : styles.summaryActionRed,
                ]}
              >
                {kulUpad > bhagmaAavelaPaisa ? "ભાગ્યા પાસેથી લેવાના" : "ભાગ્યા ને દેવાના"}
              </Text>
              <Text
                style={[
                  styles.summaryValueDark,
                  kulUpad > bhagmaAavelaPaisa ? styles.summaryActionGreen : styles.summaryActionRed,
                ]}
              >
                {formatINR(Math.abs(vadhelaPaisa))}
              </Text>
            </View>
          </View>

          <FlatList
            data={expenses}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <BhagyaRow item={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchAll();
                }}
                colors={[C.blue700]}
                tintColor={C.blue700}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💸</Text>
                <Text style={styles.emptyText}>હજુ સુધી ભાગ્યા નો ઉપાડ નથી</Text>
                <Text style={styles.emptySub}>
                  નીચે બટનથી પ્રથમ એન્ટ્રી ઉમેરો.
                </Text>
              </View>
            }
          />
        </>
      )}
<View
  style={[
    styles.bottomBar,
    {
      paddingBottom: insets.bottom + (isInsideTabs ? 70 :8),
    },
  ]}
> <TouchableOpacity
          style={styles.bottomBtn}
          activeOpacity={0.9}
          onPress={() => router.push("/expense/add-bhagya-upad" as any)}
        >
          <Text style={styles.bottomBtnText}>ઉપાડ ઉમેરો</Text>
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
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  yearLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 6,
  },
  yearChips: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    backgroundColor: C.blue700,
    borderColor: C.blue700,
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textSecondary,
  },
  yearChipTextActive: {
    color: "#fff",
  },
  loadWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadText: {
    fontSize: 15,
    color: C.textMuted,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.blue700,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryRowLast: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 4,
    paddingTop: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: "700",
  },
  summaryLabelDark: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: "800",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
    color: C.blue700,
  },
  summaryValueDark: {
    fontSize: 18,
    fontWeight: "900",
    color: C.textPrimary,
  },
  summaryActionGreen: {
    color: "#059669",
  },
  summaryActionRed: {
    color: "#DC2626",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.blue700,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
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
    backgroundColor: C.blue500,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textPrimary,
  },
  amount: {
    fontSize: 17,
    fontWeight: "900",
    color: C.blue700,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "rgba(245,247,242,0.96)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bottomBtn: {
    borderRadius: 16,
    backgroundColor: C.blue700,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBtnText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
});


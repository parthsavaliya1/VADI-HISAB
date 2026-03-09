import { ExpensePieChart } from "@/components/ExpensePieChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { VighaChart } from "@/components/VighaChart";
import { useProfile } from "@/contexts/ProfileContext";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  getCompareReport,
  getExpenseAnalytics,
  getFinancialYearOptions,
  getFinancialYearOptionsExtended,
  getIncomeAnalytics,
  getCurrentFinancialYear,
  getYearlyReport,
  type CropReportRow,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const VERTICAL_CHART_HEIGHT = 140;

const { width: SCREEN_W } = Dimensions.get("window");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Cool theme (darker, teal/slate)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  green900: "#0D4F3D",
  green700: "#0F766E",
  green500: "#14B8A6",
  green400: "#2DD4BF",
  green100: "#CCFBF1",
  green50: "#F0FDFA",
  bg: "#F0F4F3",
  surface: "#FFFFFF",
  surfaceGreen: "#ECFDF8",
  textPrimary: "#0F172A",
  textSecondary: "#334155",
  textMuted: "#64748B",
  income: "#0F766E",
  incomePale: "#CCFBF1",
  expense: "#B91C1C",
  expensePale: "#FEE2E2",
  border: "#99F6E4",
  borderLight: "#E2E8F0",
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

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  Seed: "બિયારણ",
  Fertilizer: "ખાતર",
  Pesticide: "દવા",
  Labour: "મજૂરી",
  Machinery: "મશીનરી",
  Irrigation: "સિંચાઈ",
  Other: "અન્ય",
};
const EXPENSE_CATEGORY_ORDER = ["Seed", "Fertilizer", "Pesticide", "Labour", "Machinery", "Irrigation", "Other"];
const BAR_MAX_WIDTH = SCREEN_W - 32 - 100;

function formatINR(n: number): string {
  return formatWholeNumber(n);
}

function totalLandBigha(profile: { totalLand?: { value: number; unit?: string } } | null): number {
  const tl = profile?.totalLand;
  if (!tl || !tl.value || tl.value <= 0) return 0;
  return tl.unit === "acre" ? tl.value * 1.6 : tl.value;
}

export default function ReportScreen() {
  const { profile } = useProfile();
  const { transactionsRefreshKey } = useRefresh();
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [report, setReport] = useState<Awaited<ReturnType<typeof getYearlyReport>> | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getIncomeAnalytics>> | null>(null);
  const [compare, setCompare] = useState<Awaited<ReturnType<typeof getCompareReport>> | null>(null);
  const [expenseAnalytics, setExpenseAnalytics] = useState<Awaited<ReturnType<typeof getExpenseAnalytics>> | null>(null);
  const [yearlyReports, setYearlyReports] = useState<{ year: string; income: number; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const years = getFinancialYearOptionsExtended();
      const [data, analyticsRes, compareRes, expAnalytics, ...yearResults] = await Promise.all([
        getYearlyReport(financialYear),
        getIncomeAnalytics(undefined, undefined, financialYear).catch(() => null),
        getCompareReport(financialYear).catch(() => null),
        getExpenseAnalytics(financialYear).catch(() => null),
        ...years.map((fy) => getYearlyReport(fy).then((r) => ({ year: fy, summary: r?.summary })).catch(() => ({ year: "", summary: null }))),
      ]);
      setReport(data);
      setAnalytics(analyticsRes ?? null);
      setCompare(compareRes ?? null);
      setExpenseAnalytics(expAnalytics ?? null);
      setYearlyReports(
        yearResults.map((r: any) => ({
          year: r.year,
          income: r.summary?.totalIncome ?? 0,
          expense: r.summary?.totalExpense ?? 0,
        })).filter((r: any) => r.year)
      );
    } catch (err) {
      console.warn("[Report] load error:", (err as Error).message);
      setReport(null);
      setAnalytics(null);
      setCompare(null);
      setExpenseAnalytics(null);
      setYearlyReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear]);

  useEffect(() => {
    loadReport();
  }, [loadReport, transactionsRefreshKey]);

  const years = getFinancialYearOptionsExtended();
  const summary = report?.summary ?? { totalIncome: 0, totalExpense: 0, netProfit: 0, totalCrops: 0, totalArea: 0 };
  const cropIncome = summary.cropIncome ?? 0;
  const extraIncome = summary.extraIncome ?? 0;
  const cropExpense = summary.cropExpense ?? 0;
  const extraExpense = summary.extraExpense ?? 0;
  const displayExpense = summary.cropExpense ?? summary.totalExpense;
  const displayNetProfit = summary.totalIncome - displayExpense;
  const crops = (report?.crops ?? []) as CropReportRow[];
  const showRanking = analytics != null && analytics.percentileRank != null;
  const rankingTopPercent = analytics?.percentileRank != null ? Math.max(1, Math.round(100 - analytics.percentileRank)) : null;
  const compareDiff = compare ? (compare.myIncomePerBigha ?? 0) - (compare.avgIncomePerBigha ?? 0) : 0;
  const compareDiffText = `${formatINR(Math.abs(compareDiff))} ${compareDiff >= 0 ? "વધારે" : "ઓછું"}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.headerWrap, { backgroundColor: C.bg }]}>
        <ScreenHeader title="અહેવાલ" showBack={false} style={{ marginBottom: 0, paddingBottom: 8 }} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.yearRowScroll}
          style={styles.yearRowScrollView}
        >
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
        </ScrollView>
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
              onRefresh={() => { setRefreshing(true); loadReport(); }}
              colors={[C.green700]}
              tintColor={C.green700}
            />
          }
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryBox, styles.summaryBoxIncome]}>
                <Ionicons name="trending-up" size={18} color={C.income} />
                <Text style={[styles.summaryValue, { color: C.income }]}>{formatINR(summary.totalIncome)}</Text>
                <Text style={styles.summaryLabel}>કુલ આવક</Text>
              </View>
              <View style={[styles.summaryBox, styles.summaryBoxExpense]}>
                <Ionicons name="trending-down" size={18} color={C.expense} />
                <Text style={[styles.summaryValue, { color: C.expense }]}>{formatINR(displayExpense)}</Text>
                <Text style={styles.summaryLabel}>કુલ ખર્ચ</Text>
              </View>
              <View style={[styles.summaryBox, { backgroundColor: displayNetProfit >= 0 ? C.incomePale : C.expensePale }]}>
                <Ionicons name="wallet" size={18} color={displayNetProfit >= 0 ? C.income : C.expense} />
                <Text style={[styles.summaryValue, { color: displayNetProfit >= 0 ? C.income : C.expense }]}>
                  {formatINR(displayNetProfit)}
                </Text>
                <Text style={styles.summaryLabel}>ચોખ્ખો નફો</Text>
              </View>
            </View>
          </View>

          {/* Expense category pie chart — Labour 30%, Machinery 39%, etc. */}
          <ExpensePieChart byCategory={expenseAnalytics?.myByCategory ?? {}} centerTotal={displayExpense} />

          {/* 1. Expense analysis — vertical bars, તમારો vs સરેરાશ (per bigha when available) */}
          {(expenseAnalytics || (report && (report as any).summary)) && (
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>💸 ખર્ચ વિશ્લેષણ</Text>
              {(expenseAnalytics && (expenseAnalytics.myArea ?? 0) > 0) && (
                <Text style={styles.perBighaHighlight}>※ સરખામણી પ્રતિ વીઘા એકમમાં છે</Text>
              )}
              {expenseAnalytics && ((expenseAnalytics.myArea ?? 0) > 0 || expenseAnalytics.mySummary?.length) ? (
                (() => {
                  const usePerBigha = (expenseAnalytics.myArea ?? 0) > 0;
                  const myBy = usePerBigha ? (expenseAnalytics.myPerBighaByCategory || {}) : (expenseAnalytics.myByCategory || {});
                  const avgBy = usePerBigha && expenseAnalytics.sampleSize > 0 ? (expenseAnalytics.avgPerBighaByCategory || {}) : (expenseAnalytics.avgByCategory || {});
                  const hasCompare = expenseAnalytics.sampleSize > 0;
                  const categories = EXPENSE_CATEGORY_ORDER.filter((cat) => (myBy[cat] || 0) > 0 || (avgBy[cat] || 0) > 0);
                  if (categories.length === 0) {
                    return <Text style={styles.chartEmpty}>આ વર્ષ ખર્ચ ડેટા નથી</Text>;
                  }
                  const maxVal = Math.max(1, ...categories.map((cat) => Math.max(myBy[cat] || 0, avgBy[cat] || 0)));
                  const chartContentWidth = Math.max(SCREEN_W - 32 - 24, categories.length * 64);
                  const colWidth = chartContentWidth / categories.length;
                  return (
                    <View style={styles.barChartWrap}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContent}>
                        <View style={[styles.verticalChartRow, styles.verticalChartRowTall, { width: chartContentWidth }]}>
                          {categories.map((cat) => {
                            const my = myBy[cat] || 0;
                            const avg = avgBy[cat] || 0;
                            const label = EXPENSE_CATEGORY_LABELS[cat] ?? cat;
                            return (
                              <View key={cat} style={[styles.verticalBarCol, styles.verticalBarColWide, { width: colWidth }]}>
                                <View style={styles.verticalBars}>
                                  <View
                                    style={[
                                      styles.verticalBar,
                                      styles.barFillMy,
                                      { width: hasCompare ? 14 : 22, height: Math.max(2, (my / maxVal) * VERTICAL_CHART_HEIGHT) },
                                    ]}
                                  />
                                  {hasCompare && (
                                    <View
                                      style={[
                                        styles.verticalBar,
                                        styles.barFillAvg,
                                        { width: 14, height: Math.max(2, (avg / maxVal) * VERTICAL_CHART_HEIGHT) },
                                      ]}
                                    />
                                  )}
                                </View>
                                <Text style={styles.verticalBarYear} numberOfLines={2}>{label}</Text>
                                <View style={styles.verticalBarValues}>
                                  <Text style={styles.barValue} numberOfLines={1}>{formatINR(my)}</Text>
                                  {hasCompare && <Text style={styles.barValueAvg} numberOfLines={1}>{formatINR(avg)}</Text>}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                      <View style={styles.barLegend}>
                        <View style={styles.barLegendItem}>
                          <View style={[styles.barLegendDot, { backgroundColor: C.expense }]} />
                          <Text style={styles.barLegendText}>તમારી</Text>
                        </View>
                        {hasCompare && (
                          <View style={styles.barLegendItem}>
                            <View style={[styles.barLegendDot, { backgroundColor: C.textMuted }]} />
                            <Text style={styles.barLegendText}>સરેરાશ ({expenseAnalytics.sampleSize})</Text>
                          </View>
                        )}
                      </View>
                      {usePerBigha && hasCompare && (() => {
                        const higher = EXPENSE_CATEGORY_ORDER.filter(
                          (cat) => (myBy[cat] || 0) > (avgBy[cat] || 0) && (myBy[cat] || 0) > 0,
                        );
                        if (higher.length === 0) return null;
                        return (
                          <View style={styles.improvementNote}>
                            <View style={styles.improvementNoteIconWrap}>
                              <Ionicons name="bulb-outline" size={24} color={C.green700} />
                            </View>
                            <Text style={styles.improvementNoteText}>
                              સૂચન: {higher.map((cat) => EXPENSE_CATEGORY_LABELS[cat] ?? cat).join(", ")} માં તમારો ખર્ચ સરેરાશ કરતાં વધારે છે. અહીં થોડું ધ્યાન આપશો તો નફો વધી શકે.
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  );
                })()
              ) : (
                <View style={styles.barChartWrap}>
                  {expenseAnalytics?.mySummary?.length ? (
                    (() => {
                      const myBy = expenseAnalytics.myByCategory || {};
                      const categories = EXPENSE_CATEGORY_ORDER.filter((cat) => (myBy[cat] || 0) > 0);
                      if (categories.length === 0) {
                        return <Text style={styles.chartEmpty}>આ વર્ષ ખર્ચ ડેટા નથી</Text>;
                      }
                      const maxVal = Math.max(1, ...Object.values(myBy));
                      const chartContentWidth = Math.max(SCREEN_W - 32 - 24, categories.length * 64);
                      const colWidth = chartContentWidth / categories.length;
                      return (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContent}>
                          <View style={[styles.verticalChartRow, styles.verticalChartRowTall, { width: chartContentWidth }]}>
                            {categories.map((cat) => {
                              const my = myBy[cat] || 0;
                              const label = EXPENSE_CATEGORY_LABELS[cat] ?? cat;
                              return (
                                <View key={cat} style={[styles.verticalBarCol, styles.verticalBarColWide, { width: colWidth }]}>
                                  <View style={styles.verticalBars}>
                                    <View
                                      style={[
                                        styles.verticalBar,
                                        styles.barFillMy,
                                        { width: 22, height: Math.max(2, (my / maxVal) * VERTICAL_CHART_HEIGHT) },
                                      ]}
                                    />
                                  </View>
                                  <Text style={styles.verticalBarYear} numberOfLines={2}>{label}</Text>
                                  <Text style={styles.barValue}>{formatINR(my)}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </ScrollView>
                      );
                    })()
                  ) : (
                    <Text style={styles.chartEmpty}>આ વર્ષ ખર્ચ ડેટા નથી</Text>
                  )}
                  {(!expenseAnalytics?.sampleSize || expenseAnalytics.sampleSize === 0) && (
                    <Text style={styles.chartHint}>સરખામણી માટે સેટિંગ્સમાં એનાલિટિક્સ સહમતી ચાલુ કરો</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 2. Production per bigha — vertical bar compare (તમારો vs સરેરાશ), same style as expense */}
          {compare && compare.myTotalArea > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>🌾 આવક પ્રતિ વીઘા</Text>
              <Text style={styles.perBighaHighlight}>※ સરખામણી પ્રતિ વીઘા એકમમાં છે</Text>
              <View style={styles.verticalChartWrap}>
                {(() => {
                  const myVal = compare.myIncomePerBigha ?? 0;
                  const avgVal = compare.avgIncomePerBigha ?? 0;
                  const maxV = Math.max(1, myVal, avgVal);
                  return (
                    <View style={[styles.verticalChartRow, { height: VERTICAL_CHART_HEIGHT + 50, justifyContent: "center" }]}>
                      <View style={[styles.verticalBarCol, { width: 90, marginHorizontal: 12 }]}>
                        <View style={styles.verticalBars}>
                          <View
                            style={[
                              styles.verticalBar,
                              styles.verticalBarIncome,
                              { width: 32, height: Math.max(2, (myVal / maxV) * VERTICAL_CHART_HEIGHT) },
                            ]}
                          />
                        </View>
                        <Text style={styles.verticalBarYear}>તમારી</Text>
                        <Text style={[styles.rankingCompareValue, styles.compareChartValue, { color: C.income }]}>{formatINR(myVal)}</Text>
                      </View>
                      <View style={[styles.verticalBarCol, { width: 90, marginHorizontal: 12 }]}>
                        <View style={styles.verticalBars}>
                          <View
                            style={[
                              styles.verticalBar,
                              { backgroundColor: C.textMuted, width: 32, height: Math.max(2, (avgVal / maxV) * VERTICAL_CHART_HEIGHT) },
                            ]}
                          />
                        </View>
                        <Text style={styles.verticalBarYear}>સરેરાશ</Text>
                        <Text style={[styles.rankingCompareValue, styles.compareChartValue, { color: C.textMuted }]}>{formatINR(avgVal)}</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
              <View style={styles.barLegend}>
                <View style={styles.barLegendItem}>
                  <View style={[styles.barLegendDot, { backgroundColor: C.income }]} />
                  <Text style={styles.barLegendText}>તમારી</Text>
                </View>
                <View style={styles.barLegendItem}>
                  <View style={[styles.barLegendDot, { backgroundColor: C.textMuted }]} />
                  <Text style={styles.barLegendText}>સરેરાશ {compare.sampleSize > 0 ? `(${compare.sampleSize})` : ""}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Crop vs Extra breakdown */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>📋 આવક-ખર્ચ વિગત</Text>
            <View style={[styles.breakdownRow, styles.breakdownRowIncome]}>
              <Text style={styles.breakdownLabel}>પાક આવક</Text>
              <Text style={[styles.breakdownValue, { color: C.income }]}>{formatINR(cropIncome)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownRowIncome]}>
              <Text style={styles.breakdownLabel}>અન્ય આવક (ભાડા, સબસિડી વગેરે)</Text>
              <Text style={[styles.breakdownValue, { color: C.income }]}>{formatINR(extraIncome)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownRowExpense]}>
              <Text style={styles.breakdownLabel}>પાક ખર્ચ</Text>
              <Text style={[styles.breakdownValue, { color: C.expense }]}>{formatINR(cropExpense)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownRowExpense]}>
              <Text style={styles.breakdownLabel}>અન્ય ખર્ચ (ઘર, મશીન વગેરે)</Text>
              <Text style={[styles.breakdownValue, { color: C.expense }]}>{formatINR(extraExpense)}</Text>
            </View>
          </View>

          {/* વીઘા ચાર્ટ — active crops + બાકી વીઘા */}
          <VighaChart crops={crops} totalLandBigha={totalLandBigha(profile)} />

          {/* Farmer ranking */}
          {showRanking && analytics && (
            <View style={styles.rankingCard}>
              <Text style={styles.rankingTitle}>🏆 તમારો ક્રમ</Text>
              {rankingTopPercent != null && (
                <View style={styles.rankingHero}>
                  <Ionicons name="trophy" size={28} color={C.green700} />
                  <Text style={styles.rankingHeroText}>
                    આ વર્ષે તમે <Text style={styles.rankingHighlight}>ટોચના {rankingTopPercent}% </Text>ખેડૂતોમાં છો
                  </Text>
                </View>
              )}
              <View style={styles.rankingPoint}>
                <Ionicons name="checkmark-circle" size={20} color={C.green700} />
                <Text style={styles.rankingText}>
                  તમારી આવક ઘણા ખેડૂતો કરતાં સારી છે, એટલે તમારું કામ સાચી દિશામાં છે.
                </Text>
              </View>
              {compare && compare.sampleSize > 0 && (
                <View style={styles.rankingPoint}>
                  <Ionicons name="analytics" size={20} color={C.green700} />
                  <Text style={styles.rankingText}>
                    આવક પ્રતિ વીઘા સરેરાશ કરતાં {compareDiffText} છે.
                  </Text>
                </View>
              )}
              {analytics.sampleSize > 0 && <Text style={styles.rankingMeta}>{analytics.sampleSize} ખેડૂતોની સરખામણી પરથી</Text>}
            </View>
          )}

          <Text style={styles.sectionTitle}>🌾 આ વર્ષ ના પાક</Text>
          {crops.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>આ વર્ષ માટે ડેટા નથી</Text>
            </View>
          ) : (
            crops.map((row) => (
              <View key={row._id} style={styles.cropRow}>
                <View style={styles.cropRowLeft}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <Text style={styles.cropRowName}>{cropDisplayName(row.cropName)}</Text>
                    {row.landType === "bhagma" && row.bhagmaPercentage != null && (
                      <View style={[styles.bhagmaBadge, { backgroundColor: C.expensePale }]}>
                        <Text style={[styles.bhagmaBadgeText, { color: C.expense }]}>
                          ભાગમા {row.bhagmaPercentage}%
                        </Text>
                      </View>
                    )}
                  </View>
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
  headerWrap: {
    paddingHorizontal: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    overflow: "hidden",
  },
  yearRowScrollView: { marginTop: 12, marginHorizontal: -4 },
  yearRowScroll: { flexDirection: "row", gap: 8, paddingVertical: 4, paddingRight: 20 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  yearChipActive: { backgroundColor: C.green700, borderColor: C.green700 },
  yearChipText: { fontSize: 16, fontWeight: "700", color: C.textSecondary },
  yearChipTextActive: { color: "#fff" },
  loadWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadText: { fontSize: 17, color: C.textMuted, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  summaryBoxIncome: { backgroundColor: "#ECFDF3" },
  summaryBoxExpense: { backgroundColor: "#FEF2F2" },
  summaryValue: { fontSize: 18, fontWeight: "900" },
  summaryLabel: { fontSize: 14, color: C.textMuted, fontWeight: "700" },
  breakdownCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  breakdownTitle: { fontSize: 24, fontWeight: "900", color: C.textPrimary, marginBottom: 14 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginBottom: 10 },
  breakdownRowIncome: { backgroundColor: "#F0FDF4" },
  breakdownRowExpense: { backgroundColor: "#FEF2F2" },
  breakdownLabel: { fontSize: 18, color: C.textSecondary, flex: 1, fontWeight: "700" },
  breakdownValue: { fontSize: 20, fontWeight: "900", marginLeft: 8 },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  chartCardTitle: { fontSize: 25, fontWeight: "900", color: C.textPrimary, marginBottom: 8 },
  chartCardSub: { fontSize: 15, color: C.textMuted, marginBottom: 14 },
  perBighaHighlight: { fontSize: 18, color: C.green700, marginBottom: 14, fontWeight: "800" },
  chartEmpty: { fontSize: 18, color: C.textMuted, textAlign: "center", paddingVertical: 12, fontWeight: "600" },
  chartHint: { fontSize: 16, color: C.textMuted, textAlign: "center", marginTop: 8, fontWeight: "600" },
  barChartWrap: { gap: 14 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  barLabel: { fontSize: 15, fontWeight: "700", color: C.textSecondary, width: 72 },
  barGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  barPair: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  barTrack: { flex: 1, height: 22, borderRadius: 6, overflow: "hidden", backgroundColor: C.borderLight },
  barTrackMy: {},
  barTrackAvg: {},
  barFill: { height: "100%", borderRadius: 6 },
  barFillMy: { backgroundColor: C.expense },
  barFillAvg: { backgroundColor: C.textMuted },
  barValue: { fontSize: 16, fontWeight: "800", color: C.expense, minWidth: 58 },
  barValueAvg: { fontSize: 16, fontWeight: "800", color: C.textMuted, minWidth: 58 },
  barLegend: { flexDirection: "row", gap: 22, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.borderLight, justifyContent: "center" },
  barLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLegendDot: { width: 12, height: 12, borderRadius: 6 },
  barLegendText: { fontSize: 17, color: C.textMuted, fontWeight: "800", textAlign: "center" },
  improvementNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 14,
    backgroundColor: "#ECFDF5",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  improvementNoteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  improvementNoteText: { flex: 1, fontSize: 17, color: C.textSecondary, lineHeight: 25, fontWeight: "700" },
  verticalChartWrap: { marginVertical: 8 },
  chartScrollContent: { paddingHorizontal: 4 },
  verticalChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: VERTICAL_CHART_HEIGHT + 28,
  },
  verticalChartRowTall: {
    height: VERTICAL_CHART_HEIGHT + 82,
  },
  verticalBarCol: { alignItems: "center", justifyContent: "flex-end" },
  verticalBarColWide: { paddingHorizontal: 4 },
  verticalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: VERTICAL_CHART_HEIGHT,
  },
  verticalBar: {
    width: 10,
    borderRadius: 4,
    minHeight: 2,
  },
  verticalBarIncome: { backgroundColor: C.income },
  verticalBarExpense: { backgroundColor: C.expense },
  verticalBarYear: { fontSize: 15, fontWeight: "800", color: C.textMuted, marginTop: 8, textAlign: "center" },
  verticalBarValues: { flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap", justifyContent: "center" },
  rankingCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
  },
  rankingTitle: { fontSize: 25, fontWeight: "900", color: C.textPrimary, marginBottom: 14 },
  rankingHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  rankingHeroText: { flex: 1, fontSize: 20, color: C.textSecondary, fontWeight: "800", lineHeight: 28 },
  rankingPoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  rankingText: { fontSize: 18, color: C.textSecondary, flex: 1, lineHeight: 26, fontWeight: "700" },
  rankingHighlight: { fontWeight: "800", color: C.green700 },
  rankingMeta: { fontSize: 16, color: C.textMuted, marginTop: 10, fontWeight: "700" },
  rankingCompare: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight },
  rankingCompareLabel: { fontSize: 14, color: C.textMuted, marginBottom: 2 },
  rankingCompareValue: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  compareChartValue: { fontSize: 18, marginTop: 4 },
  adviceWrap: { marginTop: 10 },
  adviceText: { fontSize: 15, color: C.textSecondary, marginBottom: 4 },
  sectionTitle: { fontSize: 25, fontWeight: "900", color: C.textPrimary, marginBottom: 14 },
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
  cropRowName: { fontSize: 21, fontWeight: "900", color: C.textPrimary },
  bhagmaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bhagmaBadgeText: { fontSize: 13, fontWeight: "700" },
  cropRowMeta: { fontSize: 17, color: C.textMuted, marginTop: 5, fontWeight: "700" },
  cropRowProfit: { fontSize: 21, fontWeight: "900", marginLeft: 12 },
  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 18, color: C.textMuted, fontWeight: "700" },
});

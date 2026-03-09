import { AppTheme } from "@/constants/theme";
import { ExpensePieChart } from "@/components/ExpensePieChart";
import { ScreenHeader } from "@/components/ScreenHeader";
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

const C = AppTheme;

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
  const avgVal = compare?.avgIncomePerBigha ?? 0;
  const incomePctVsAvg = avgVal > 0 && compare ? Math.round(((compare.myIncomePerBigha ?? 0) - avgVal) / avgVal * 100) : 0;

  const expenseAnalyticsData = expenseAnalytics && (expenseAnalytics.myArea ?? 0) > 0 && expenseAnalytics.sampleSize > 0;
  const myBy = expenseAnalyticsData ? (expenseAnalytics?.myPerBighaByCategory || {}) : {};
  const avgBy = expenseAnalyticsData ? (expenseAnalytics?.avgPerBighaByCategory || {}) : {};
  const myExpenseTotal = Object.values(myBy).reduce((s, v) => s + v, 0);
  const avgExpenseTotal = Object.values(avgBy).reduce((s, v) => s + v, 0);
  const expensePctVsAvg = avgExpenseTotal > 0 ? Math.round((myExpenseTotal - avgExpenseTotal) / avgExpenseTotal * 100) : 0;
  const expenseLowerIsBetter = myExpenseTotal <= avgExpenseTotal;

  const expenseHigherCategories = expenseAnalyticsData
    ? EXPENSE_CATEGORY_ORDER.filter((cat) => (myBy[cat] || 0) > (avgBy[cat] || 0) && (myBy[cat] || 0) > 0)
    : [];

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

          {/* 1. Expense type comparison — ખર્ચ પ્રકાર તુલના */}
          {(expenseAnalytics || (report && (report as any).summary)) && (
            <View style={styles.expenseTypeCard}>
              <Text style={styles.expenseTypeTitle}>💸 ખર્ચ પ્રકાર તુલના</Text>
              {expenseAnalytics && ((expenseAnalytics.myArea ?? 0) > 0 || expenseAnalytics.mySummary?.length) ? (
                (() => {
                  const usePerBigha = (expenseAnalytics.myArea ?? 0) > 0;
                  const myBy = usePerBigha ? (expenseAnalytics.myPerBighaByCategory || {}) : (expenseAnalytics.myByCategory || {});
                  const avgBy = usePerBigha && expenseAnalytics.sampleSize > 0 ? (expenseAnalytics.avgPerBighaByCategory || {}) : (expenseAnalytics.avgByCategory || {});
                  const hasCompare = expenseAnalytics.sampleSize > 0;
                  const categories = EXPENSE_CATEGORY_ORDER.filter((cat) => (myBy[cat] || 0) > 0 || (avgBy[cat] || 0) > 0);
                  if (categories.length === 0) {
                    return <Text style={styles.expenseTypeEmpty}>આ વર્ષ ખર્ચ ડેટા નથી</Text>;
                  }
                  const maxVal = Math.max(1, ...categories.map((cat) => Math.max(myBy[cat] || 0, avgBy[cat] || 0)));
                  return (
                    <View style={styles.expenseTypeWrap}>
                      <View style={styles.expenseTypeLegend}>
                        <View style={styles.expenseTypeLegendItem}>
                          <View style={[styles.expenseTypeLegendDot, { backgroundColor: C.expense }]} />
                          <Text style={styles.expenseTypeLegendText}>તમારી</Text>
                        </View>
                        {hasCompare && (
                          <View style={styles.expenseTypeLegendItem}>
                            <View style={[styles.expenseTypeLegendDot, { backgroundColor: C.textMuted }]} />
                            <Text style={styles.expenseTypeLegendText}>સરેરાશ</Text>
                          </View>
                        )}
                      </View>
                      {categories.map((cat) => {
                        const my = myBy[cat] || 0;
                        const avg = avgBy[cat] || 0;
                        const label = EXPENSE_CATEGORY_LABELS[cat] ?? cat;
                        return (
                          <View key={cat} style={styles.expenseTypeRow}>
                            <Text style={styles.expenseTypeLabel} numberOfLines={1}>{label}</Text>
                            <View style={styles.expenseTypeBars}>
                              <View style={styles.expenseTypeBarRow}>
                                <View style={styles.expenseTypeTrack}>
                                  <View
                                    style={[
                                      styles.expenseTypeFill,
                                      { width: `${Math.min(100, (my / maxVal) * 100)}%`, backgroundColor: C.expense },
                                    ]}
                                  />
                                </View>
                                <Text style={[styles.expenseTypeVal, { color: C.expense }]}>{formatINR(my)}</Text>
                              </View>
                              {hasCompare && (
                                <View style={styles.expenseTypeBarRow}>
                                  <View style={styles.expenseTypeTrack}>
                                    <View
                                      style={[
                                        styles.expenseTypeFillAvg,
                                        { width: `${Math.min(100, (avg / maxVal) * 100)}%` },
                                      ]}
                                    />
                                  </View>
                                  <Text style={[styles.expenseTypeVal, { color: C.textMuted }]}>{formatINR(avg)}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                      {expenseHigherCategories.length > 0 && (
                        <View style={styles.expenseTypeSuggestion}>
                          <Ionicons name="bulb" size={18} color="#B45309" />
                          <Text style={styles.expenseTypeSuggestionText}>
                            <Text style={styles.expenseTypeSuggestionHighlight}>
                              {expenseHigherCategories.map((c) => EXPENSE_CATEGORY_LABELS[c] ?? c).join(", ")}
                            </Text>
                            {" "}માં ખર્ચ વધારે. અહીં ધ્યાન આપશો.
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()
              ) : (
                <View style={styles.expenseTypeWrap}>
                  {expenseAnalytics?.mySummary?.length ? (
                    (() => {
                      const myBy = expenseAnalytics.myByCategory || {};
                      const categories = EXPENSE_CATEGORY_ORDER.filter((cat) => (myBy[cat] || 0) > 0);
                      if (categories.length === 0) {
                        return <Text style={styles.expenseTypeEmpty}>આ વર્ષ ખર્ચ ડેટા નથી</Text>;
                      }
                      const maxVal = Math.max(1, ...Object.values(myBy));
                      return (
                        <>
                          {categories.map((cat) => {
                            const my = myBy[cat] || 0;
                            const label = EXPENSE_CATEGORY_LABELS[cat] ?? cat;
                            return (
                              <View key={cat} style={styles.expenseTypeRow}>
                                <Text style={styles.expenseTypeLabel} numberOfLines={1}>{label}</Text>
                                <View style={styles.expenseTypeBars}>
                                  <View style={styles.expenseTypeBarRow}>
                                    <View style={styles.expenseTypeTrack}>
                                      <View
                                        style={[
                                          styles.expenseTypeFill,
                                          { width: `${Math.min(100, (my / maxVal) * 100)}%`, backgroundColor: C.expense },
                                        ]}
                                      />
                                    </View>
                                    <Text style={[styles.expenseTypeVal, { color: C.expense }]}>{formatINR(my)}</Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </>
                      );
                    })()
                  ) : (
                    <Text style={styles.expenseTypeEmpty}>આ વર્ષ ખર્ચ ડેટા નથી</Text>
                  )}
                  {(!expenseAnalytics?.sampleSize || expenseAnalytics.sampleSize === 0) && (
                    <Text style={styles.expenseTypeHint}>સરખામણી માટે સેટિંગ્સમાં એનાલિટિક્સ સહમતી ચાલુ કરો</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 2. Expense per bigha — common design */}
          {expenseAnalyticsData && (
            <View style={styles.perBighaCard}>
              <Text style={styles.perBighaTitle}>💸 ખર્ચ પ્રતિ વીઘા</Text>

              <View style={styles.perBighaHeroRow}>
                <View style={[styles.perBighaHeroBox, styles.perBighaHeroBoxMine]}>
                  <Text style={styles.perBighaHeroLabel}>તમારી</Text>
                  <Text style={[styles.perBighaHeroValue, { color: C.expense }]}>₹{formatINR(myExpenseTotal)}</Text>
                </View>
                <View style={styles.perBighaVsBadge}>
                  <Text style={styles.perBighaVsText}>VS</Text>
                </View>
                <View style={styles.perBighaHeroBox}>
                  <Text style={[styles.perBighaHeroLabel, { color: C.textMuted }]}>સરેરાશ</Text>
                  <Text style={[styles.perBighaHeroValue, styles.perBighaHeroValueAvg]}>₹{formatINR(avgExpenseTotal)}</Text>
                </View>
              </View>

              <View style={[styles.perBighaPctBadge, expenseLowerIsBetter ? styles.perBighaPctBadgeGood : styles.perBighaPctBadgeNeutral]}>
                <Ionicons name={expenseLowerIsBetter ? "trending-down" : "trending-up"} size={18} color={expenseLowerIsBetter ? C.green700 : C.expense} />
                <Text style={[styles.perBighaPctText, { color: expenseLowerIsBetter ? C.green700 : C.expense }]}>
                  સરેરાશ કરતાં {Math.abs(expensePctVsAvg)}% {expenseLowerIsBetter ? "ઓછું ✓" : "વધારે"}
                </Text>
              </View>

              <View style={styles.perBighaRaceWrap}>
                <View style={styles.perBighaRaceRow}>
                  <Text style={styles.perBighaRaceLabel}>તમારી</Text>
                  <View style={styles.perBighaRaceTrack}>
                    <View
                      style={[
                        styles.perBighaRaceFill,
                        { width: `${Math.min(100, (myExpenseTotal / Math.max(1, myExpenseTotal, avgExpenseTotal)) * 100)}%`, backgroundColor: C.expense },
                      ]}
                    />
                  </View>
                  <Text style={[styles.perBighaRaceVal, { color: C.expense }]}>{formatINR(myExpenseTotal)}</Text>
                </View>
                <View style={styles.perBighaRaceRow}>
                  <Text style={[styles.perBighaRaceLabel, { color: C.textMuted }]}>સરેરાશ</Text>
                  <View style={styles.perBighaRaceTrack}>
                    <View
                      style={[
                        styles.perBighaRaceFillAvg,
                        { width: `${Math.min(100, (avgExpenseTotal / Math.max(1, myExpenseTotal, avgExpenseTotal)) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.perBighaRaceVal, { color: C.textMuted }]}>{formatINR(avgExpenseTotal)}</Text>
                </View>
              </View>

              {expenseLowerIsBetter && (
                <View style={styles.perBighaWinRow}>
                  <Ionicons name="checkmark-circle" size={18} color={C.textPrimary} />
                  <Text style={styles.perBighaWinText}>તમારો ખર્ચ સરેરાશ કરતાં ઓછો છે!</Text>
                </View>
              )}
            </View>
          )}

          {/* 3. Income per bigha — common design */}
          {compare && compare.myTotalArea > 0 && (() => {
            const myVal = compare.myIncomePerBigha ?? 0;
            const avg = compare.avgIncomePerBigha ?? 0;
            const maxV = Math.max(1, myVal, avg);
            const aboveAvg = myVal >= avg;
            return (
              <View style={styles.perBighaCard}>
                <Text style={styles.perBighaTitle}>🌾 આવક પ્રતિ વીઘા</Text>

                <View style={styles.perBighaHeroRow}>
                  <View style={[styles.perBighaHeroBox, styles.perBighaHeroBoxMine]}>
                    <Text style={styles.perBighaHeroLabel}>તમારી</Text>
                    <Text style={[styles.perBighaHeroValue, { color: C.green700 }]}>₹{formatINR(myVal)}</Text>
                  </View>
                  <View style={styles.perBighaVsBadge}>
                    <Text style={styles.perBighaVsText}>VS</Text>
                  </View>
                  <View style={styles.perBighaHeroBox}>
                    <Text style={[styles.perBighaHeroLabel, { color: C.textMuted }]}>સરેરાશ</Text>
                    <Text style={[styles.perBighaHeroValue, styles.perBighaHeroValueAvg]}>₹{formatINR(avg)}</Text>
                  </View>
                </View>

                {compare.sampleSize > 0 && (
                  <View style={[styles.perBighaPctBadge, aboveAvg ? styles.perBighaPctBadgeGood : styles.perBighaPctBadgeNeutral]}>
                    <Ionicons name={aboveAvg ? "trending-up" : "trending-down"} size={18} color={aboveAvg ? C.green700 : C.textMuted} />
                    <Text style={[styles.perBighaPctText, { color: aboveAvg ? C.green700 : C.textMuted }]}>
                      સરેરાશ કરતાં {Math.abs(incomePctVsAvg)}% {aboveAvg ? "વધારે" : "ઓછું"}
                    </Text>
                  </View>
                )}

                <View style={styles.perBighaRaceWrap}>
                  <View style={styles.perBighaRaceRow}>
                    <Text style={styles.perBighaRaceLabel}>તમારી</Text>
                    <View style={styles.perBighaRaceTrack}>
                      <View
                        style={[
                          styles.perBighaRaceFill,
                          { width: `${Math.min(100, (myVal / maxV) * 100)}%`, backgroundColor: C.green700 },
                        ]}
                      />
                    </View>
                    <Text style={[styles.perBighaRaceVal, { color: C.green700 }]}>{formatINR(myVal)}</Text>
                  </View>
                  <View style={styles.perBighaRaceRow}>
                    <Text style={[styles.perBighaRaceLabel, { color: C.textMuted }]}>સરેરાશ</Text>
                    <View style={styles.perBighaRaceTrack}>
                      <View
                        style={[
                          styles.perBighaRaceFillAvg,
                          { width: `${Math.min(100, (avg / maxV) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={[styles.perBighaRaceVal, { color: C.textMuted }]}>{formatINR(avg)}</Text>
                  </View>
                </View>

                {aboveAvg && compare.sampleSize > 0 && (
                  <View style={styles.perBighaWinRow}>
                    <Ionicons name="trophy" size={18} color={C.textPrimary} />
                    <Text style={styles.perBighaWinText}>તમે સરેરાશ કરતાં આગળ છો!</Text>
                  </View>
                )}
              </View>
            );
          })()}

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

          {/* તમારો ક્રમ — Farmer ranking */}
          {showRanking && analytics && (
            <View style={styles.rankingCard}>
              <View style={styles.rankingHeader}>
                <View style={styles.rankingTrophyWrap}>
                  <Ionicons name="trophy" size={32} color={C.green700} />
                </View>
                <View style={styles.rankingHeaderText}>
                  <Text style={styles.rankingTitle}>તમારો ક્રમ</Text>
                  {rankingTopPercent != null && (
                    <Text style={styles.rankingBadge}>ટોચના {rankingTopPercent}%</Text>
                  )}
                </View>
              </View>

              {rankingTopPercent != null && (
                <Text style={styles.rankingHeroText}>
                  આ વર્ષે તમે ટોચના <Text style={styles.rankingHighlight}>{rankingTopPercent}%</Text> ખેડૂતોમાં છો
                </Text>
              )}

              <View style={styles.rankingPoints}>
                <View style={styles.rankingPoint}>
                  <Ionicons name="checkmark-circle" size={22} color={C.green700} />
                  <Text style={styles.rankingText}>તમારી આવક ઘણા ખેડૂતો કરતાં સારી છે. તમારું કામ સાચી દિશામાં છે.</Text>
                </View>
                {compare && compare.sampleSize > 0 && (
                  <View style={styles.rankingPoint}>
                    <Ionicons name="analytics" size={22} color={C.green700} />
                    <Text style={styles.rankingText}>આવક પ્રતિ વીઘા સરેરાશ કરતાં {compareDiffText}.</Text>
                  </View>
                )}
              </View>

              {analytics.sampleSize > 0 && (
                <Text style={styles.rankingMeta}>{analytics.sampleSize} ખેડૂતોની સરખામણી</Text>
              )}
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
                    {row.area != null && row.area > 0 && (
                      <View style={styles.vighaBadge}>
                        <Text style={styles.vighaBadgeText}>{Math.round(row.area)} વીઘા</Text>
                      </View>
                    )}
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
  breakdownTitle: { fontSize: 20, fontWeight: "900", color: C.textPrimary, marginBottom: 14 },
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
  chartCardLight: { backgroundColor: "#FFFFFF" },
  chartCardTitle: { fontSize: 20, fontWeight: "900", color: C.textPrimary, marginBottom: 8 },
  expenseTypeCard: {
    marginBottom: 20,
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F1F3",
  },
  expenseTypeTitle: { fontSize: 20, fontWeight: "900", color: C.textPrimary, marginBottom: 14 },
  expenseTypeEmpty: { fontSize: 16, color: C.textMuted, textAlign: "center", paddingVertical: 20, fontWeight: "600" },
  expenseTypeHint: { fontSize: 14, color: C.textMuted, textAlign: "center", marginTop: 12, fontWeight: "600" },
  expenseTypeWrap: { gap: 12 },
  expenseTypeLegend: { flexDirection: "row", gap: 20, marginBottom: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F0F1F3" },
  expenseTypeLegendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  expenseTypeLegendDot: { width: 12, height: 12, borderRadius: 6 },
  expenseTypeLegendText: { fontSize: 17, fontWeight: "800", color: C.textSecondary },
  expenseTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F0F1F3",
  },
  expenseTypeLabel: { fontSize: 16, fontWeight: "800", color: C.textPrimary, width: 72 },
  expenseTypeBars: { flex: 1, gap: 6 },
  expenseTypeBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  expenseTypeBarLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, width: 28 },
  expenseTypeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EEF0F2",
    overflow: "hidden",
  },
  expenseTypeFill: { height: "100%", borderRadius: 4, minWidth: 4 },
  expenseTypeFillAvg: { height: "100%", backgroundColor: C.textMuted, borderRadius: 4, minWidth: 4 },
  expenseTypeVal: { fontSize: 13, fontWeight: "800", minWidth: 48, textAlign: "right" },
  expenseTypeSuggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEFCE8",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEF9C3",
  },
  expenseTypeSuggestionText: { flex: 1, fontSize: 16, color: C.textSecondary, lineHeight: 22, fontWeight: "600" },
  expenseTypeSuggestionHighlight: { fontWeight: "800", color: "#A16207" },
  chartCardSub: { fontSize: 15, color: C.textMuted, marginBottom: 14 },
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
  perBighaCard: {
    marginBottom: 20,
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F1F3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  perBighaTitle: { fontSize: 20, fontWeight: "900", color: C.textPrimary, marginBottom: 16 },
  perBighaHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  perBighaHeroBox: { flex: 1, alignItems: "center" },
  perBighaHeroBoxMine: { backgroundColor: "#F8F9FA", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: "#F0F1F3" },
  perBighaHeroLabel: { fontSize: 16, color: C.textSecondary, fontWeight: "700", marginBottom: 4 },
  perBighaHeroValue: { fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  perBighaHeroValueAvg: { fontSize: 22, color: C.textSecondary },
  perBighaVsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F1F3",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  perBighaVsText: { fontSize: 12, fontWeight: "900", color: C.textSecondary },
  perBighaPctBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 14,
  },
  perBighaPctBadgeGood: { backgroundColor: "#F8F9FA", borderWidth: 1, borderColor: "#F0F1F3" },
  perBighaPctBadgeNeutral: { backgroundColor: "#F8F9FA", borderWidth: 1, borderColor: "#F0F1F3" },
  perBighaPctText: { fontSize: 14, fontWeight: "800" },
  perBighaRaceWrap: { gap: 10 },
  perBighaRaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perBighaRaceLabel: { fontSize: 17, fontWeight: "700", width: 60, color: C.textPrimary },
  perBighaRaceTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EEF0F2",
    overflow: "hidden",
  },
  perBighaRaceFill: {
    height: "100%",
    borderRadius: 5,
    minWidth: 4,
  },
  perBighaRaceFillAvg: {
    height: "100%",
    backgroundColor: C.textMuted,
    borderRadius: 5,
    minWidth: 4,
  },
  perBighaRaceVal: { fontSize: 14, fontWeight: "800", minWidth: 58, textAlign: "right", color: C.textPrimary },
  perBighaWinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F3",
  },
  perBighaWinText: { fontSize: 15, fontWeight: "800", color: C.textPrimary },
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
  verticalBarIncome: { backgroundColor: C.green700 },
  verticalBarExpense: { backgroundColor: C.expense },
  verticalBarYear: { fontSize: 15, fontWeight: "800", color: C.textMuted, marginTop: 8, textAlign: "center" },
  verticalBarValues: { flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap", justifyContent: "center" },
  rankingCard: {
    backgroundColor: "#FEFCE8",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FEF9C3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  rankingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F3",
  },
  rankingTrophyWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0F1F3",
  },
  rankingHeaderText: { flex: 1 },
  rankingTitle: { fontSize: 22, fontWeight: "900", color: C.textPrimary },
  rankingBadge: {
    fontSize: 16,
    fontWeight: "800",
    color: C.green700,
    marginTop: 4,
  },
  rankingHeroText: {
    fontSize: 18,
    color: C.textSecondary,
    fontWeight: "700",
    lineHeight: 26,
    marginBottom: 16,
  },
  rankingPoints: { gap: 4 },
  rankingPoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F0F1F3",
  },
  rankingText: { flex: 1, fontSize: 16, color: C.textSecondary, lineHeight: 24, fontWeight: "600" },
  rankingHighlight: { fontWeight: "800", color: C.green700 },
  rankingMeta: { fontSize: 14, color: C.textMuted, marginTop: 12, fontWeight: "600" },
  rankingCompare: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight },
  rankingCompareLabel: { fontSize: 14, color: C.textMuted, marginBottom: 2 },
  rankingCompareValue: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  compareChartValue: { fontSize: 18, marginTop: 4 },
  adviceWrap: { marginTop: 10 },
  adviceText: { fontSize: 15, color: C.textSecondary, marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "900", color: C.textPrimary, marginBottom: 14 },
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
  vighaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#F0F1F3",
  },
  vighaBadgeText: { fontSize: 14, fontWeight: "800", color: C.textPrimary },
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

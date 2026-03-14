/**
 * Expense category pie chart — donut with leader lines to labels (name, %, value).
 * Uses shared AppTheme. Used in Report tab below income/expense summary.
 */
import React from "react";
import { AppTheme } from "@/constants/theme";
import { formatWholeNumber } from "@/utils/format";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");
const C = AppTheme;

/** Light theme colors for expense categories — soft, readable */
const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  Seed: "#5C9E6B",       // soft green
  Fertilizer: "#4A90A4", // soft teal
  Pesticide: "#B89B4E",  // soft amber
  Labour: "#D97706",     // soft orange (labour)
  Machinery: "#7C3AED",  // soft purple (tractor/machine)
  Irrigation: "#0284C7",  // soft blue (water)
  Other: "#64748B",      // soft slate
};

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

function formatINR(n: number): string {
  return formatWholeNumber(n);
}

export interface ExpensePieChartProps {
  /** Category → amount mapping from expense analytics */
  byCategory: Record<string, number>;
  /** Optional display total when business summary differs from chart sum */
  centerTotal?: number;
  /** Optional section title (default: પાક માટે ખર્ચ વિભાજન) */
  title?: string;
}

type SliceLayout = {
  key: string;
  label: string;
  value: number;
  ratio: number;
  d: string;
  color: string;
  region: "top" | "bottom";
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
  boxX: number;
  boxY: number;
  leaderPath?: string;
};

function placeBandLabels(
  items: SliceLayout[],
  bandTop: number,
  maxCols: number,
  availableWidth: number,
  labelW: number,
  labelH: number,
  rowGap: number,
  colGap: number,
  outerPad: number,
) {
  if (items.length === 0) return;

  const sorted = [...items].sort((a, b) => a.lineX2 - b.lineX2);
  for (let i = 0; i < sorted.length; i += maxCols) {
    const rowItems = sorted.slice(i, i + maxCols);
    const row = Math.floor(i / maxCols);
    const gapCount = Math.max(0, rowItems.length - 1);
    const usableWidth = availableWidth - outerPad * 2;
    const rowWidthWithoutGaps = rowItems.length * labelW;
    const maxComfortGap = colGap + 16;
    const distributedGap = gapCount > 0
      ? Math.min(maxComfortGap, Math.max(colGap, (usableWidth - rowWidthWithoutGaps) / gapCount))
      : 0;
    const rowWidth = rowWidthWithoutGaps + gapCount * distributedGap;
    const startX = Math.max(outerPad, (availableWidth - rowWidth) / 2);

    rowItems.forEach((item, idx) => {
      item.boxX = startX + idx * (labelW + distributedGap);
      item.boxY = bandTop + row * (labelH + rowGap);
    });
  }
}

export function ExpensePieChart({ byCategory, centerTotal, title }: ExpensePieChartProps) {
  const sectionTitle = title ?? "પાક માટે ખર્ચ વિભાજન";
  const sliceData = EXPENSE_CATEGORY_ORDER
    .filter((cat) => (byCategory[cat] ?? 0) > 0)
    .map((cat) => ({
      label: EXPENSE_CATEGORY_LABELS[cat] ?? cat,
      key: cat,
      value: byCategory[cat] ?? 0,
      color: EXPENSE_CATEGORY_COLORS[cat] ?? "#94A3B8",
    }));

  const total = sliceData.reduce((s, d) => s + d.value, 0);
  const hasData = total > 0 && sliceData.length > 0;

  if (!hasData) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>💸 {sectionTitle}</Text>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>આ વર્ષ ખર્ચ ડેટા નથી</Text>
        </View>
      </View>
    );
  }

  const availableWidth = Math.max(260, SCREEN_W - 84);
  const labelW = 90;
  const labelH = 58;
  const rowGap = 8;
  const colGap = 6;
  const outerPad = 18;
  const pieGap = 12;
  const size = Math.max(210, Math.min(availableWidth - outerPad * 2, 250));
  const startAngle = -Math.PI / 2;
  const maxCols = Math.max(2, Math.min(3, Math.floor((availableWidth - outerPad * 2 + colGap) / (labelW + colGap))));
  const topCount = sliceData.filter((_, i) => {
    const prevSum = sliceData.slice(0, i).reduce((s, d) => s + d.value, 0);
    const ratio = total > 0 ? sliceData[i].value / total : 0;
    const midAngle = startAngle + ((total > 0 ? prevSum / total : 0) + ratio / 2) * 2 * Math.PI;
    return Math.sin(midAngle) < 0;
  }).length;
  const bottomCount = sliceData.length - topCount;
  const topRows = topCount > 0 ? Math.ceil(topCount / maxCols) : 0;
  const bottomRows = bottomCount > 0 ? Math.ceil(bottomCount / maxCols) : 0;
  const topBandHeight = topRows > 0 ? topRows * labelH + Math.max(0, topRows - 1) * rowGap : 0;
  const bottomBandHeight = bottomRows > 0 ? bottomRows * labelH + Math.max(0, bottomRows - 1) * rowGap : 0;
  const chartWidth = availableWidth;
  const chartHeight = outerPad + topBandHeight + pieGap + size + pieGap + bottomBandHeight + outerPad;
  const cx = chartWidth / 2;
  const cy = outerPad + topBandHeight + pieGap + size / 2;
  const r = (size / 2) * 0.88;
  const r0 = r * 0.52;
  const labelRadius = r + 10;

  const slices: SliceLayout[] = sliceData.map(({ key, value, color }, i) => {
    const ratio = total > 0 ? value / total : 0;
    const prevSum = sliceData.slice(0, i).reduce((s, d) => s + d.value, 0);
    const angleStart = startAngle + (total > 0 ? prevSum / total : 0) * 2 * Math.PI;
    const angleEnd = angleStart + ratio * 2 * Math.PI;
    const midAngle = angleStart + ratio * Math.PI;
    const xo1 = cx + r * Math.cos(angleStart);
    const yo1 = cy + r * Math.sin(angleStart);
    const xo2 = cx + r * Math.cos(angleEnd);
    const yo2 = cy + r * Math.sin(angleEnd);
    const xi1 = cx + r0 * Math.cos(angleStart);
    const yi1 = cy + r0 * Math.sin(angleStart);
    const xi2 = cx + r0 * Math.cos(angleEnd);
    const yi2 = cy + r0 * Math.sin(angleEnd);
    const largeArc = ratio > 0.5 ? 1 : 0;
    const d = `M ${xo1} ${yo1} A ${r} ${r} 0 ${largeArc} 1 ${xo2} ${yo2} L ${xi2} ${yi2} A ${r0} ${r0} 0 ${largeArc} 0 ${xi1} ${yi1} Z`;
    const lineX1 = cx + r * Math.cos(midAngle);
    const lineY1 = cy + r * Math.sin(midAngle);
    const lineX2 = cx + labelRadius * Math.cos(midAngle);
    const lineY2 = cy + labelRadius * Math.sin(midAngle);
    const region = Math.sin(midAngle) < 0 ? "top" : "bottom";
    return {
      key,
      label: EXPENSE_CATEGORY_LABELS[key] ?? key,
      value,
      ratio,
      d,
      color,
      lineX1,
      lineY1,
      lineX2,
      lineY2,
      region,
      boxX: 0,
      boxY: 0,
    };
  });

  placeBandLabels(
    slices.filter((slice) => slice.region === "top"),
    outerPad,
    maxCols,
    chartWidth,
    labelW,
    labelH,
    rowGap,
    colGap,
    outerPad,
  );
  placeBandLabels(
    slices.filter((slice) => slice.region === "bottom"),
    outerPad + topBandHeight + pieGap + size + pieGap,
    maxCols,
    chartWidth,
    labelW,
    labelH,
    rowGap,
    colGap,
    outerPad,
  );

  slices.forEach((s) => {
    const boxCenterX = s.boxX + labelW / 2;
    const boxCenterY = s.boxY + labelH / 2;
    s.leaderPath = `M ${s.lineX1} ${s.lineY1} L ${s.lineX2} ${s.lineY2} L ${boxCenterX} ${boxCenterY}`;
  });

  const displayTotal = centerTotal ?? total;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>💸 {sectionTitle}</Text>

      <View style={[styles.pieWrap, { width: chartWidth, height: chartHeight }]}>
        <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {slices.map((slice) => (
            <Path
              key={slice.key}
              d={slice.d}
              fill={slice.color}
              stroke={C.surface}
              strokeWidth={2.5}
            />
          ))}
          {slices.map((slice) => (
            <Path
              key={`line-${slice.key}`}
              d={slice.leaderPath}
              fill="none"
              stroke={slice.color}
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          ))}
        </Svg>
        <View style={[styles.pieCenter, { left: 0, right: 0, top: 0, bottom: 0 }]}>
          <Text style={styles.pieCenterLabel}>કુલ ખર્ચ</Text>
          <Text style={styles.pieCenterValue}>{formatINR(displayTotal)}</Text>
        </View>
        {slices.map((slice) => (
          <View
            key={`label-${slice.key}`}
            style={[
              styles.sliceLabel,
              {
                left: slice.boxX,
                top: slice.boxY,
                width: labelW,
                minHeight: labelH,
                borderLeftColor: slice.color,
              },
            ]}
          >
            <Text style={styles.sliceLabelPct} numberOfLines={1}>
              {total > 0 ? Math.round(slice.ratio * 100) : 0}%
            </Text>
            <Text style={styles.sliceLabelCategory} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={styles.sliceLabelValue}>{formatINR(slice.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  title: { fontSize: 20, fontWeight: "900", color: C.textPrimary, marginBottom: 4 },
  pieWrap: {
    alignSelf: "center",
    marginBottom: 16,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenterLabel: { fontSize: 13, fontWeight: "700", color: C.expense, marginBottom: 2 },
  pieCenterValue: { fontSize: 20, fontWeight: "900", color: C.expense },
  sliceLabel: {
    position: "absolute",
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sliceLabelPct: { fontSize: 18, fontWeight: "900", color: C.textPrimary, lineHeight: 20 },
  sliceLabelCategory: { fontSize: 13, fontWeight: "700", color: C.textMuted, lineHeight: 16, marginTop: 1 },
  sliceLabelValue: { fontSize: 14, fontWeight: "800", color: C.textSecondary, lineHeight: 18, marginTop: 1 },
  emptyWrap: { alignItems: "center", paddingVertical: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, color: C.textMuted, fontWeight: "600" },
});

/**
 * Expense category pie chart — donut with leader lines to labels (name, %, value).
 * Light theme colors. Used in Report tab below income/expense summary.
 */
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");

const C = {
  surface: "#FFFFFF",
  green700: "#2E7D32",
  green50: "#E8F5E9",
  textPrimary: "#0A0E0B",
  textMuted: "#2D4230",
  textSecondary: "#1A2E1C",
  borderLight: "#EAF4EA",
};

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
  return n.toLocaleString("en-IN");
}

export interface ExpensePieChartProps {
  /** Category → amount mapping from expense analytics */
  byCategory: Record<string, number>;
}

export function ExpensePieChart({ byCategory }: ExpensePieChartProps) {
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
        <Text style={styles.title}>💸 ખર્ચ પ્રકાર પ્રમાણ</Text>
        <Text style={styles.subtitle}>કેટેગરી પ્રમાણે ખર્ચ વિભાજન</Text>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>આ વર્ષ ખર્ચ ડેટા નથી</Text>
        </View>
      </View>
    );
  }

  const size = Math.max(200, Math.min(SCREEN_W - 48, 260));
  const chartPadding = 20;
  const gapFromPie = 52; // keep labels well away from circle — no overlap
  const chartSize = size + 260; // extra room so label zones sit fully outside the pie
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const r = (size / 2) * 0.88;
  const r0 = r * 0.52;
  const startAngle = -Math.PI / 2;
  const labelRadius = r + gapFromPie; // leader ends at gap boundary — labels stay away from circle

  const labelW = 98;
  const labelH = 40;
  const stackGap = 22; // space between each box (separate from each other)
  const minBoxGap = 10; // min horizontal gap between boxes

  const slices = sliceData.map(({ key, value, color }, i) => {
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
    const isTop = Math.sin(midAngle) <= 0; // top half of circle
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
      isTop,
      boxX: 0,
      boxY: 0,
    };
  });

  // Zones: labels sit clearly outside the graph (separate from pie)
  const topZoneBottom = cy - r - gapFromPie;
  const topZoneTop = chartPadding;
  const bottomZoneTop = cy + r + gapFromPie;
  const bottomZoneBottom = chartSize - chartPadding - labelH;

  const topSlices = slices.filter((s) => s.isTop).sort((a, b) => a.lineX2 - b.lineX2);
  const bottomSlices = slices.filter((s) => !s.isTop).sort((a, b) => a.lineX2 - b.lineX2);

  // Place each box near its slice (x from angle), stacked with gap (separate from each other)
  const pad = chartPadding;
  const maxLeft = pad;
  const maxRight = chartSize - pad - labelW;

  topSlices.forEach((s, i) => {
    s.boxY = topZoneTop + i * (labelH + stackGap);
    // X: near the slice (radial end of leader), clamped; nudge if overlapping previous
    let boxX = s.lineX2 - labelW / 2;
    boxX = Math.max(maxLeft, Math.min(maxRight, boxX));
    if (i > 0) {
      const prev = topSlices[i - 1];
      if (Math.abs(boxX - prev.boxX) < labelW + minBoxGap) {
        boxX = prev.boxX + (boxX >= prev.boxX ? 1 : -1) * (labelW + minBoxGap);
        boxX = Math.max(maxLeft, Math.min(maxRight, boxX));
      }
    }
    s.boxX = boxX;
  });

  bottomSlices.forEach((s, i) => {
    s.boxY = bottomZoneBottom - i * (labelH + stackGap);
    let boxX = s.lineX2 - labelW / 2;
    boxX = Math.max(maxLeft, Math.min(maxRight, boxX));
    if (i > 0) {
      const prev = bottomSlices[i - 1];
      if (Math.abs(boxX - prev.boxX) < labelW + minBoxGap) {
        boxX = prev.boxX + (boxX >= prev.boxX ? 1 : -1) * (labelW + minBoxGap);
        boxX = Math.max(maxLeft, Math.min(maxRight, boxX));
      }
    }
    s.boxX = boxX;
  });

  // Leader: pie edge -> radial point -> straight to box edge (separate from graph, near section)
  slices.forEach((s) => {
    const boxCenterX = s.boxX + labelW / 2;
    const boxCenterY = s.boxY + labelH / 2;
    s.leaderPath = `M ${s.lineX1} ${s.lineY1} L ${s.lineX2} ${s.lineY2} L ${boxCenterX} ${s.lineY2} L ${boxCenterX} ${boxCenterY}`;
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>💸 ખર્ચ પ્રકાર પ્રમાણ</Text>
      <Text style={styles.subtitle}>કેટેગરી પ્રમાણે ખર્ચ વિભાજન</Text>

      <View style={[styles.pieWrap, { width: chartSize, height: chartSize }]}>
        <Svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
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
          <Text style={styles.pieCenterValue}>{formatINR(total)}</Text>
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
            <Text style={styles.sliceLabelLine1} numberOfLines={1}>
              {total > 0 ? Math.round(slice.ratio * 100) : 0}% {slice.label}
            </Text>
            <Text style={styles.sliceLabelLine2}>₹{formatINR(slice.value)}</Text>
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
  title: { fontSize: 22, fontWeight: "800", color: C.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 15, color: C.textMuted, marginBottom: 12, fontWeight: "600" },
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
  pieCenterLabel: { fontSize: 13, fontWeight: "700", color: C.textMuted, marginBottom: 2 },
  pieCenterValue: { fontSize: 20, fontWeight: "900", color: C.green700 },
  sliceLabel: {
    position: "absolute",
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sliceLabelLine1: { fontSize: 17, fontWeight: "800", color: C.textPrimary, marginBottom: 2 },
  sliceLabelLine2: { fontSize: 15, fontWeight: "700", color: C.textMuted },
  emptyWrap: { alignItems: "center", paddingVertical: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, color: C.textMuted, fontWeight: "600" },
});

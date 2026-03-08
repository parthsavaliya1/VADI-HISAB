import { type Crop } from "@/utils/api";
import { getCropColorForChart } from "@/utils/cropColors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");

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

function areaForCrop(c: Crop): number {
  const a = (c as any).area;
  if (a != null && a !== "") return Number(a) || 0;
  return 0;
}

const C = {
  surface: "#FFFFFF",
  green700: "#2E7D32",
  green50: "#E8F5E9",
  textPrimary: "#0A0E0B",
  textMuted: "#2D4230",
  textSecondary: "#1A2E1C",
  borderLight: "#EAF4EA",
  bg: "#F5F7F2",
};

/** Donut pie: active crops + remaining bigha. Use in Report tab. */
export function VighaChart({ crops, totalLandBigha = 0 }: { crops: Crop[]; totalLandBigha?: number }) {
  const activeCrops = crops.filter((c) => c.status === "Active");
  const byCrop: Record<string, number> = {};
  const byCropEnglish: Record<string, string> = {};
  activeCrops.forEach((c) => {
    const name = cropDisplayName(c.cropName);
    byCrop[name] = (byCrop[name] || 0) + areaForCrop(c);
    byCropEnglish[name] = c.cropName;
  });
  const usedBigha = Object.values(byCrop).reduce((s, v) => s + v, 0);
  const remainingBigha = totalLandBigha > 0 ? Math.max(0, totalLandBigha - usedBigha) : 0;

  const cropEntries = Object.entries(byCrop)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const sliceData: { label: string; value: number; isRemaining?: boolean; cropName?: string }[] = [
    ...cropEntries.map(([label, value]) => ({ label, value, cropName: byCropEnglish[label] })),
    ...(remainingBigha > 0 ? [{ label: "બાકી વીઘા", value: remainingBigha, isRemaining: true }] : []),
  ];
  const total = sliceData.reduce((s, d) => s + d.value, 0);
  const hasData = total > 0;
  const hasCrops = activeCrops.length > 0;
  const showPie = hasData && hasCrops;

  const size = Math.max(220, Math.min(SCREEN_W - 48, 300));
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * 0.88;
  const r0 = r * 0.52;
  const startAngle = -Math.PI / 2;
  const REMAINING_COLOR = "#E8E8E8";

  const slices = sliceData.map(({ label, value, isRemaining, cropName }, i) => {
    const ratio = total > 0 ? value / total : 0;
    const prevSum = sliceData.slice(0, i).reduce((s, d) => s + d.value, 0);
    const angleStart = startAngle + (total > 0 ? prevSum / total : 0) * 2 * Math.PI;
    const angleEnd = angleStart + ratio * 2 * Math.PI;
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
    return {
      label,
      value,
      ratio,
      d,
      color: isRemaining ? REMAINING_COLOR : getCropColorForChart(cropName ?? ""),
      isRemaining,
    };
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>વીઘા ચાર્ટ</Text>
      <Text style={styles.subtitle}>સક્રિય પાક અને બાકી વીઘા</Text>
      {!showPie ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>કોઈ સક્રિય પાક નથી</Text>
          <Text style={styles.emptyDesc}>
            ચાર્ટ દેખાવા માટે ઓછામાં ઓછો એક પાક સક્રિય કરો અથવા નવો પાક ઉમેરો.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/crop/add-crop")} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={16} color="#5D4037" />
            <Text style={styles.emptyBtnText}>નવો પાક ઉમેરો</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={[styles.pieWrap, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {slices.map((slice, i) => (
                <Path
                  key={i}
                  d={slice.d}
                  fill={slice.color}
                  stroke={C.surface}
                  strokeWidth={2.5}
                />
              ))}
            </Svg>
            <View style={styles.pieCenter}>
              <Text style={styles.pieCenterLabel}>કુલ</Text>
              <Text style={styles.pieCenterValue}>{Math.round(total)}</Text>
              <Text style={styles.pieCenterUnit}>વીઘા</Text>
            </View>
          </View>
          <View style={styles.legend}>
            {slices.map((slice, i) => (
              <View key={i} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>{slice.label}</Text>
                <Text style={styles.legendValue}>{Math.round(slice.value)}</Text>
                <Text style={styles.legendUnit}>વીઘા</Text>
                <Text style={styles.legendPct}>{total > 0 ? Math.round(slice.ratio * 100) : 0}%</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  title: { fontSize: 21, fontWeight: "800", color: C.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 15, fontWeight: "600", color: C.textMuted, marginBottom: 18 },
  pieWrap: { alignSelf: "center", marginBottom: 24, position: "relative", alignItems: "center", justifyContent: "center" },
  pieCenter: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  pieCenterLabel: { fontSize: 12, fontWeight: "700", color: C.textMuted, marginBottom: 2 },
  pieCenterValue: { fontSize: 26, fontWeight: "900", color: C.green700 },
  pieCenterUnit: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  legend: { gap: 4 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendLabel: { flex: 1, fontSize: 15, fontWeight: "800", color: C.textPrimary },
  legendValue: { fontSize: 16, fontWeight: "900", color: C.green700, minWidth: 28, textAlign: "right" },
  legendUnit: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  legendPct: { fontSize: 14, fontWeight: "800", color: C.textSecondary, minWidth: 36, textAlign: "right" },
  emptyWrap: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: C.textPrimary, marginBottom: 8, textAlign: "center" },
  emptyDesc: { fontSize: 15, color: C.textMuted, fontWeight: "600", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: "#FFF8E1", borderWidth: 2, borderColor: "#FFE082" },
  emptyBtnText: { fontSize: 17, fontWeight: "800", color: "#5D4037" },
});

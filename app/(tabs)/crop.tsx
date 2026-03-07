import { useProfile } from "@/contexts/ProfileContext";
import {
  deleteCrop,
  getCrops,
  getCurrentFinancialYear,
  getFinancialYearOptions,
  getMyProfile,
  markCropHarvested,
  updateCropStatus,
  type Crop,
  type CropStatus,
} from "@/utils/api";
import { getCropColorForChart, getCropColors } from "@/utils/cropColors";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = -80;

// ─── Color system ─────────────────────────────────────────────────────────────
// Match dashboard theme
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
  income: "#2E7D32",
  incomePale: "#E8F5E9",
  expense: "#B71C1C",
  expensePale: "#FFEBEE",
  gold: "#F9A825",
  goldPale: "#FFFDE7",
  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

// ─── Season & Status config ───────────────────────────────────────────────────
const SEASON_META: Record<string, { label: string; icon: string; color: string; pale: string }> = {
  Kharif: { label: "ખરીફ", icon: "☔", color: "#0EA5E9", pale: "#E0F2FE" },
  Rabi: { label: "રવી", icon: "❄️", color: "#6366F1", pale: "#EEF2FF" },
  Summer: { label: "ઉનાળો", icon: "☀️", color: "#F59E0B", pale: "#FEF3C7" },
};

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Active: { label: "સક્રિય", bg: C.incomePale, text: C.green700, dot: C.green500 },
  Harvested: { label: "લણણી", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Closed: { label: "બંધ", bg: C.expensePale, text: C.expense, dot: "#EF4444" },
};

const FILTER_TABS = [
  { key: "all", label: "બધા" },
  { key: "Active", label: "સક્રિય" },
  { key: "Harvested", label: "લણણી" },
  { key: "Closed", label: "બંધ" },
];

// English crop name (from API) → Gujarati display name (matches add-crop / dashboard)
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

// ─── Crop card ────────────────────────────────────────────────────────────────
function CropCard({
  item,
  index,
  onDelete,
  onStatusChange,
  onHarvest,
}: {
  item: Crop;
  index: number;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: CropStatus) => void;
  onHarvest: (id: string) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardScale, { toValue: 1, duration: 300, delay: index * 55, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, delay: index * 55, useNativeDriver: true }),
    ]).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -120));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -120, useNativeDriver: true }).start();
          setSwiped(true);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          setSwiped(false);
        }
      },
    }),
  ).current;

  const closeSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    setSwiped(false);
  };

  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOpen(next);
    Animated.spring(menuAnim, { toValue: next ? 1 : 0, useNativeDriver: true }).start();
  };

  const season = SEASON_META[item.season ?? ""] ?? { label: item.season, icon: "🌾", color: C.textMuted, pale: C.green50 };
  const status = STATUS_META[item.status ?? "Active"] ?? STATUS_META.Active;
  const [cropPale, cropColor] = getCropColors(item.cropName);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { opacity: cardOpacity, transform: [{ scale: cardScale }] },
      ]}
    >
      {/* Swipe action buttons */}
      <View style={styles.swipeActions}>
        {/* Harvest shortcut — only for Active crops */}
        {item.status === "Active" ? (
          <TouchableOpacity
            style={[styles.swipeBtn, { backgroundColor: "#B45309" }]}
            onPress={() => { closeSwipe(); onHarvest(item._id); }}
          >
            <Ionicons name="leaf" size={20} color="#fff" />
            <Text style={styles.swipeBtnText}>લણણી</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.swipeBtn, { backgroundColor: C.green700 }]}
            onPress={() => {
              closeSwipe();
              const next: CropStatus =
                item.status === "Harvested" ? "Closed" : "Active";
              onStatusChange(item._id, next);
            }}
          >
            <Ionicons name="swap-horizontal" size={20} color="#fff" />
            <Text style={styles.swipeBtnText}>સ્ટેટ</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#0284C7" }]}
          onPress={() => { closeSwipe(); router.push(`/crop/add-crop?id=${item._id}`); }}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>ફેરફાર</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: C.expense }]}
          onPress={() => { closeSwipe(); onDelete(item._id); }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>કાઢો</Text>
        </TouchableOpacity>
      </View>

      {/* Main card */}
      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top accent bar — same crop color as dashboard/chart */}
        <View style={[styles.cardAccentBar, { backgroundColor: cropColor }]} />

        <View style={styles.cardInner}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={[styles.cropEmojiWrap, { backgroundColor: cropPale }]}>
              <Text style={styles.cropEmoji}>{item.cropEmoji ?? "🌱"}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cropName}>{cropDisplayName(item.cropName)}</Text>

              {/* subType + batchLabel — NEW fields shown here */}
              {(item.subType || item.batchLabel) ? (
                <Text style={styles.cropSubInfo}>
                  {item.subType ? `🏷️ ${item.subType}` : ""}
                  {item.subType && item.batchLabel ? "  ·  " : ""}
                  {item.batchLabel ? `🔢 ${item.batchLabel}` : ""}
                </Text>
              ) : null}

              <View style={styles.tagsRow}>
                <View style={[styles.tag, { backgroundColor: cropPale }]}>
                  <Text style={[styles.tagText, { color: cropColor }]}>
                    {season.icon} {season.label}
                  </Text>
                </View>

                {/* year — NEW field */}
                {item.year ? (
                  <View style={[styles.tag, { backgroundColor: C.green50 }]}>
                    <Text style={[styles.tagText, { color: C.green700 }]}>
                      📅 {item.year}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
                  <Text style={[styles.statusText, { color: status.text }]}>
                    {status.label}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={toggleMenu} style={styles.menuTrigger}>
              <Ionicons name="ellipsis-vertical" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Dropdown menu */}
          {menuOpen && (
            <Animated.View
              style={[
                styles.dropMenu,
                { opacity: menuAnim, transform: [{ scaleY: menuAnim }] },
              ]}
            >
              {(["Active", "Harvested", "Closed"] as CropStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.dropMenuItem, item.status === s && styles.dropMenuItemActive]}
                  onPress={() => { toggleMenu(); onStatusChange(item._id, s); }}
                >
                  <View style={[styles.statusDot, { backgroundColor: STATUS_META[s].dot }]} />
                  <Text style={[styles.dropMenuText, item.status === s && { color: C.green700, fontWeight: "700" }]}>
                    {STATUS_META[s].label}
                  </Text>
                  {item.status === s && (
                    <Ionicons name="checkmark" size={14} color={C.green700} style={{ marginLeft: "auto" }} />
                  )}
                </TouchableOpacity>
              ))}

              {/* Quick harvest option in dropdown for Active crops */}
              {item.status === "Active" && (
                <>
                  <View style={styles.dropDivider} />
                  <TouchableOpacity
                    style={styles.dropMenuItem}
                    onPress={() => { toggleMenu(); onHarvest(item._id); }}
                  >
                    <Ionicons name="leaf-outline" size={14} color="#B45309" />
                    <Text style={[styles.dropMenuText, { color: "#B45309" }]}>
                      લણણી + ઉત્પાદન નોંધો
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.dropDivider} />
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => { toggleMenu(); router.push(`/crop/add-crop?id=${item._id}`); }}
              >
                <Ionicons name="create-outline" size={14} color={C.textSecondary} />
                <Text style={styles.dropMenuText}>ફેરફાર કરો</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => { toggleMenu(); onDelete(item._id); }}
              >
                <Ionicons name="trash-outline" size={14} color={C.expense} />
                <Text style={[styles.dropMenuText, { color: C.expense }]}>કાઢી નાખો</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Footer stats */}
          <View style={styles.cardFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="resize-outline" size={13} color={C.textMuted} />
              <Text style={styles.footerText}>
                {item.area} {item.areaUnit ?? "Bigha"}
              </Text>
            </View>

            {/* Sowing date — default when creating crop */}
            {item.sowingDate ? (
              <View style={styles.footerItem}>
                <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
                <Text style={styles.footerText}>
                  વાવણી: {new Date(item.sowingDate).toLocaleDateString("gu-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </View>
            ) : null}

            {/* Harvest date — shown when status is Harvested */}
            {item.status === "Harvested" && item.harvestDate ? (
              <View style={styles.footerItem}>
                <Ionicons name="leaf-outline" size={13} color="#B45309" />
                <Text style={[styles.footerText, { color: "#B45309" }]}>
                  લણણી: {new Date(item.harvestDate).toLocaleDateString("gu-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </View>
            ) : null}

            {item.notes ? (
              <View style={styles.footerItem}>
                <Ionicons name="document-text-outline" size={13} color={C.textMuted} />
                <Text style={styles.footerText} numberOfLines={1}>{item.notes}</Text>
              </View>
            ) : null}

            {index === 0 && !swiped && (
              <View style={styles.swipeHint}>
                <Ionicons name="chevron-back" size={10} color={C.green100} />
                <Text style={styles.swipeHintText}>← સ્વાઈપ કરો</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Year filter (same as add-crop) ───────────────────────────────────────────
const YEAR_OPTIONS = getFinancialYearOptions();

function YearFilter({
  selectedYear,
  onSelectYear,
}: {
  selectedYear: string;
  onSelectYear: (y: string) => void;
}) {
  return (
    <View style={styles.yearFilterWrap}>
      <Text style={styles.yearFilterLabel}>📅 વર્ષ (જૂન – જૂન)</Text>
      <View style={styles.yearRow}>
        {YEAR_OPTIONS.map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
            onPress={() => onSelectYear(y)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.yearChipText,
                selectedYear === y && styles.yearChipTextActive,
              ]}
            >
              {y}
            </Text>
            {selectedYear === y && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={C.green700}
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Stats header ─────────────────────────────────────────────────────────────
function StatsBar({
  crops,
  filteredCrops,
  selectedYear,
  onSelectYear,
  totalLandBigha,
}: {
  crops: Crop[];
  /** Crops after status filter — કુલ વીઘા is sum of these only (not all) */
  filteredCrops: Crop[];
  selectedYear: string;
  onSelectYear: (y: string) => void;
  /** User's total land in bigha (from profile) — for fill % */
  totalLandBigha: number;
}) {
  const active = crops.filter((c) => c.status === "Active").length;
  const harvested = crops.filter((c) => c.status === "Harvested").length;
  const closed = crops.filter((c) => c.status === "Closed").length;
  const areaForCrop = (c: Crop) => {
    const a = (c as any).area;
    if (a != null && a !== "") return Number(a) || 0;
    return 0;
  };
  const usedBigha = filteredCrops.reduce((sum, c) => sum + areaForCrop(c), 0);
  const totalBigha = totalLandBigha > 0 ? totalLandBigha : 0;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const paddingTop = Platform.OS === "ios" ? 50 : 36;

  return (
    <Animated.View style={{ opacity: anim }}>
      <LinearGradient
        colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
        style={[styles.statsGrad, { paddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <View style={styles.statsTitleRow}>
          <View>
            <Text style={styles.statsGreeting}>🌾 મારી પાક સૂચિ</Text>
            <Text style={styles.statsSubtitle}>
              {crops.length} પાક · {selectedYear}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.statsAddBtn}
            onPress={() => router.push("/crop/add-crop")}
          >
            <Ionicons name="add" size={20} color={C.green700} />
          </TouchableOpacity>
        </View>

        <YearFilter selectedYear={selectedYear} onSelectYear={onSelectYear} />

        <View style={styles.statsGrid}>
          {[
            { label: "સક્રિય", value: active, color: C.income, bg: C.incomePale, icon: "leaf-outline" },
            { label: "લણણી", value: harvested, color: "#B45309", bg: "#FEF3C7", icon: "checkmark-circle-outline" },
            { label: "બંધ", value: closed, color: C.expense, bg: C.expensePale, icon: "close-circle-outline" },
          ].map((s) => (
            <View key={s.label} style={[styles.statBox, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={16} color={s.color} style={{ marginBottom: 4 }} />
              <Text style={[styles.statValue, { color: s.color }]}>
                {typeof s.value === "number" && s.value % 1 !== 0 ? s.value.toFixed(1) : s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}

          {/* કુલ વીઘા — card fill is vertical (bottom to top) */}
          <View style={[styles.statBox, styles.statBoxBigha, styles.statBoxBighaOuter]}>
            {totalBigha > 0 && (
              <View
                style={[
                  styles.bighaCardFill,
                  { height: `${Math.min(100, (usedBigha / totalBigha) * 100)}%` },
                ]}
              />
            )}
            <View style={styles.statBoxBighaContent}>
              <Ionicons name="resize-outline" size={20} color={C.green700} style={{ marginBottom: 4 }} />
              <Text style={[styles.statValueBigha, { color: C.green700 }]}>
                {usedBigha % 1 !== 0 ? usedBigha.toFixed(1) : usedBigha}
              </Text>
              <Text style={styles.statLabelBigha}>કુલ વીઘા</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
function FilterTabs({
  active,
  onChange,
  counts,
}: {
  active: string;
  onChange: (k: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <View style={styles.filterRow}>
      {FILTER_TABS.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.filterTab, active === t.key && styles.filterTabActive]}
          onPress={() => onChange(t.key)}
          activeOpacity={0.75}
        >
          <Text style={[styles.filterTabText, active === t.key && styles.filterTabTextActive]}>
            {t.label}
          </Text>
          {counts[t.key] !== undefined && (
            <View style={[styles.filterBadge, active === t.key && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, active === t.key && { color: "#fff" }]}>
                {counts[t.key]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Summary vs Chart tabs ─────────────────────────────────────────────────────
const VIEW_TABS = [
  { key: "summary" as const, label: "સારાંશ", icon: "list" },
  { key: "chart" as const, label: "ચાર્ટ", icon: "bar-chart" },
];

function areaForCropChart(c: Crop): number {
  const a = (c as any).area;
  if (a != null && a !== "") return Number(a) || 0;
  return 0;
}

/** Donut pie: only active crops + remaining bigha; totalLandBigha optional for "બાકી" slice */
function ChartView({ crops, totalLandBigha = 0 }: { crops: Crop[]; totalLandBigha?: number }) {
  const activeCrops = crops.filter((c) => c.status === "Active");
  const byCrop: Record<string, number> = {};
  const byCropEnglish: Record<string, string> = {};
  activeCrops.forEach((c) => {
    const name = cropDisplayName(c.cropName);
    byCrop[name] = (byCrop[name] || 0) + areaForCropChart(c);
    byCropEnglish[name] = c.cropName;
  });
  const usedBigha = Object.values(byCrop).reduce((s, v) => s + v, 0);
  const remainingBigha = totalLandBigha > 0 ? Math.max(0, totalLandBigha - usedBigha) : 0;
  const totalForPie = totalLandBigha > 0 ? totalLandBigha : usedBigha;

  const cropEntries = Object.entries(byCrop)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const sliceData: { label: string; value: number; isRemaining?: boolean; cropName?: string }[] = [
    ...cropEntries.map(([label, value]) => ({ label, value, cropName: byCropEnglish[label] })),
    ...(remainingBigha > 0 ? [{ label: "બાકી વીઘા", value: remainingBigha, isRemaining: true }] : []),
  ];
  const total = sliceData.reduce((s, d) => s + d.value, 0);
  const hasData = total > 0;

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
    <ScrollView
      style={styles.chartScroll}
      contentContainerStyle={styles.chartScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>વીઘા ચાર્ટ</Text>
        <Text style={styles.chartSubtitle}>સક્રિય પાક અને બાકી વીઘા</Text>
        {!hasData ? (
          <Text style={styles.chartEmpty}>કોઈ સક્રિય પાક નથી</Text>
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
                <Text style={styles.pieCenterValue}>
                  {total % 1 !== 0 ? total.toFixed(1) : total}
                </Text>
                <Text style={styles.pieCenterUnit}>વીઘા</Text>
              </View>
            </View>
            <View style={styles.pieLegend}>
              {slices.map((slice, i) => (
                <View key={i} style={styles.pieLegendRow}>
                  <View style={[styles.pieLegendDot, { backgroundColor: slice.color }]} />
                  <Text style={styles.pieLegendLabel} numberOfLines={1}>
                    {slice.label}
                  </Text>
                  <Text style={styles.pieLegendValue}>
                    {slice.value % 1 !== 0 ? slice.value.toFixed(1) : slice.value}
                  </Text>
                  <Text style={styles.pieLegendUnit}>વીઘા</Text>
                  <Text style={styles.pieLegendPct}>
                    {total > 0 ? Math.round(slice.ratio * 100) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.empty, { opacity: anim, transform: [{ scale: anim }] }]}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyEmoji}>🌱</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {filter === "all"
          ? "કોઈ પાક નથી"
          : `${FILTER_TABS.find((f) => f.key === filter)?.label} પાક નથી`}
      </Text>
      <Text style={styles.emptyDesc}>
        {filter === "all"
          ? "નવો પાક ઉમેરવા + બટન દબાવો"
          : "ફિલ્ટર બદલો અથવા નવો પાક ઉમેરો"}
      </Text>
      {filter === "all" && (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push("/crop/add-crop")}
        >
          <Ionicons name="add-circle-outline" size={16} color={C.green700} />
          <Text style={styles.emptyBtnText}>નવો પાક ઉમેરો</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CropScreen() {
  const { profile, setProfile } = useProfile();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYear());
  const [viewMode, setViewMode] = useState<"summary" | "chart">("summary");

  const totalLandBigha =
    profile?.totalLand?.unit === "bigha" ? Number(profile.totalLand?.value) || 0 : 0;

  useEffect(() => {
    if (!profile) getMyProfile().then(setProfile).catch(() => {});
  }, [profile, setProfile]);

  const fetchCrops = useCallback(async () => {
    try {
      const res = await getCrops(1, 200, undefined, undefined, selectedYear);
      setCrops(res.data);
    } catch (err: any) {
      Alert.alert("ભૂલ", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
    fetchCrops();
  }, [fetchCrops]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCrops();
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    Alert.alert("ખાતરી કરો", "શું તમે આ પાક કાઢવા માંગો છો?\nબધા સંબંધિત ખર્ચ અને આવક પણ કાઢવામાં આવશે.", [
      { text: "રદ કરો", style: "cancel" },
      {
        text: "કાઢી નાખો",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCrop(id);
            setCrops((prev) => prev.filter((c) => c._id !== id));
          } catch (err: any) {
            Alert.alert("ભૂલ", err.message);
          }
        },
      },
    ]);
  };

  // ── Status change (backend sets harvest_date when status → Harvested) ────
  const handleStatusChange = async (id: string, status: CropStatus) => {
    try {
      const updated = await updateCropStatus(id, status);
      setCrops((prev) => prev.map((c) => (c._id === id ? { ...c, ...updated } : c)));
    } catch (err: any) {
      Alert.alert("ભૂલ", err.message);
    }
  };

  // ── Harvest — marks as Harvested with today's date ────────────────────────
  const handleHarvest = async (id: string) => {
    try {
      const updated = await markCropHarvested(id);
      setCrops((prev) =>
        prev.map((c) =>
          c._id === id
            ? { ...c, status: updated.status, harvestDate: updated.harvestDate }
            : c,
        ),
      );
    } catch (err: any) {
      Alert.alert("ભૂલ", err.message);
    }
  };

  const filtered =
    filter === "all" ? crops : crops.filter((c) => c.status === filter);

  const counts: Record<string, number> = {
    all: crops.length,
    Active: crops.filter((c) => c.status === "Active").length,
    Harvested: crops.filter((c) => c.status === "Harvested").length,
    Closed: crops.filter((c) => c.status === "Closed").length,
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <ActivityIndicator size="large" color={C.green700} />
        <Text style={styles.loadingText}>પાક લોડ થઈ રહ્યો છે...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <StatsBar
          crops={crops}
          filteredCrops={filtered}
          selectedYear={selectedYear}
          onSelectYear={setSelectedYear}
          totalLandBigha={totalLandBigha}
        />

        <View style={styles.viewTabRow}>
          {VIEW_TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.viewTab, viewMode === t.key && styles.viewTabActive]}
              onPress={() => setViewMode(t.key)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={t.key === "chart" ? "bar-chart" : "list"}
                size={18}
                color={viewMode === t.key ? C.green700 : C.textMuted}
              />
              <Text style={[styles.viewTabText, viewMode === t.key && styles.viewTabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      {viewMode === "chart" ? (
        <ChartView crops={crops} totalLandBigha={totalLandBigha} />
      ) : (
        <>
          <FilterTabs active={filter} onChange={setFilter} counts={counts} />
          {filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              renderItem={({ item, index }) => (
                <CropCard
                  item={item}
                  index={index}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  onHarvest={handleHarvest}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[C.green700]}
                  tintColor={C.green700}
                />
              }
            />
          )}
        </>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/crop/add-crop")}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[C.green700, C.green500]}
          style={styles.fabGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  loadingText: { marginTop: 12, fontSize: 15, color: C.textMuted, fontWeight: "700" },

  statsGrad: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  decorCircle1: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "#C8E6C980", top: -40, right: -30,
  },
  decorCircle2: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#C8E6C950", bottom: 8, left: 16,
  },
  statsTitleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
  statsGreeting: { fontSize: 21, fontWeight: "800", color: C.textPrimary },
  statsSubtitle: { fontSize: 15, color: C.textMuted, marginTop: 3, fontWeight: "700" },
  yearFilterWrap: { marginBottom: 16 },
  yearFilterLabel: { fontSize: 15, fontWeight: "700", color: C.textSecondary, marginBottom: 8 },
  yearRow: { flexDirection: "row", gap: 10 },
  yearChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  yearChipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  yearChipText: { fontSize: 16, fontWeight: "700", color: C.textMuted },
  yearChipTextActive: { color: C.green700 },
  statsAddBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.green50, borderWidth: 1.5, borderColor: C.green100,
    justifyContent: "center", alignItems: "center",
  },
  statsGrid: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1, borderRadius: 14, padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: "#00000006",
  },
  statValue: { fontSize: 20, fontWeight: "900", marginBottom: 2 },
  statLabel: { fontSize: 12, color: C.textMuted, fontWeight: "700", textAlign: "center" },
  statBoxBigha: { alignItems: "flex-start" },
  statBoxBighaOuter: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: C.borderLight,
  },
  bighaCardFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.green100,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  statBoxBighaContent: {
    position: "relative",
    zIndex: 1,
    alignItems: "center",
  },
  statValueBigha: { fontSize: 24, fontWeight: "900", marginBottom: 2 },
  statLabelBigha: { fontSize: 15, color: C.textMuted, fontWeight: "700", textAlign: "center" },

  filterRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12,
    gap: 8, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  filterTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg,
  },
  filterTabActive: { borderColor: C.green700, backgroundColor: C.green50 },
  filterTabText: { fontSize: 14, fontWeight: "700", color: C.textMuted },
  filterTabTextActive: { color: C.green700 },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: C.borderLight, justifyContent: "center",
    alignItems: "center", paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: C.green700 },
  filterBadgeText: { fontSize: 11, fontWeight: "700", color: C.textMuted },

  viewTabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  viewTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  viewTabActive: { borderColor: C.green700, backgroundColor: C.green50 },
  viewTabText: { fontSize: 15, fontWeight: "700", color: C.textMuted },
  viewTabTextActive: { color: C.green700 },

  chartScroll: { flex: 1, backgroundColor: C.bg },
  chartScrollContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textMuted,
    marginBottom: 18,
  },
  pieWrap: {
    alignSelf: "center",
    marginBottom: 24,
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
  pieCenterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 2,
  },
  pieCenterValue: {
    fontSize: 26,
    fontWeight: "900",
    color: C.green700,
  },
  pieCenterUnit: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
  },
  pieLegend: { gap: 4 },
  pieLegendRow: {
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
  pieLegendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  pieLegendLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: C.textPrimary,
  },
  pieLegendValue: {
    fontSize: 16,
    fontWeight: "900",
    color: C.green700,
    minWidth: 28,
    textAlign: "right",
  },
  pieLegendUnit: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
  },
  pieLegendPct: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textSecondary,
    minWidth: 36,
    textAlign: "right",
  },
  chartEmpty: { fontSize: 15, color: C.textMuted, fontWeight: "700", marginVertical: 16 },

  listContent: { padding: 14, paddingBottom: 110 },

  cardWrapper: { marginBottom: 12 },
  swipeActions: {
    position: "absolute", right: 0, top: 0, bottom: 0,
    flexDirection: "row", borderRadius: 18, overflow: "hidden",
  },
  swipeBtn: { width: 40, justifyContent: "center", alignItems: "center", gap: 3 },
  swipeBtnText: { fontSize: 8, color: "#fff", fontWeight: "700" },

  card: {
    backgroundColor: C.surface, borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: C.borderLight,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardAccentBar: { height: 4 },
  cardInner: { padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  cropEmojiWrap: { width: 50, height: 50, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  cropEmoji: { fontSize: 26 },
  cropName: { fontSize: 19, fontWeight: "800", color: C.textPrimary, marginBottom: 3 },
  cropSubInfo: { fontSize: 15, color: C.textSecondary, fontWeight: "700", marginBottom: 5 },
  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 13, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: "700" },

  menuTrigger: { padding: 4, marginLeft: 4 },
  dropMenu: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderLight,
    marginTop: 8, marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 6, overflow: "hidden",
  },
  dropMenuItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  dropMenuItemActive: { backgroundColor: C.green50 },
  dropMenuText: { fontSize: 15, color: C.textSecondary, fontWeight: "700" },
  dropDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 10 },

  cardFooter: {
    flexDirection: "row", gap: 14, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.borderLight,
    marginTop: 4, alignItems: "center",
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  footerText: { fontSize: 14, color: C.textMuted, fontWeight: "700" },

  // Yield efficiency badge — shown on harvested crops
  yieldBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  yieldBadgeText: { fontSize: 11, fontWeight: "700" },

  swipeHint: { flexDirection: "row", alignItems: "center", marginLeft: "auto" },
  swipeHintText: { fontSize: 12, color: C.green100, fontWeight: "700" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.green50, justifyContent: "center", alignItems: "center",
    marginBottom: 16, borderWidth: 2, borderColor: C.green100,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: C.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 15, color: C.textMuted, textAlign: "center", marginBottom: 20, fontWeight: "700" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF8E1", borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 2, borderColor: "#FFE082",
  },
  emptyBtnText: { fontSize: 17, fontWeight: "800", color: "#5D4037" },

  fab: {
    position: "absolute", bottom: 28, right: 20, borderRadius: 20, overflow: "hidden",
    shadowColor: C.green700, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  fabGrad: { width: 58, height: 58, justifyContent: "center", alignItems: "center" },
});
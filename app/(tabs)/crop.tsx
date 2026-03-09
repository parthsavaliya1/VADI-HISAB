import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  deleteCrop,
  getCrops,
  getCurrentFinancialYear,
  getFinancialYearOptions,
  getMyProfile,
  markCropHarvested,
  updateCropStatus,
  getIncomes,
  getExpenseSummary,
  type Crop,
  type CropStatus,
  type Income,
  type ExpenseCategory,
  getYearlyReport,
  type CropReportRow,
} from "@/utils/api";
import { HEADER_PADDING_TOP } from "@/constants/theme";
import { getCropColors } from "@/utils/cropColors";
import Toast from "react-native-toast-message";
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
  Pressable,
  RefreshControl,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

// ─── Season & Status config (labels from translations in component) ───────────
const SEASON_ICONS: Record<string, string> = {
  Kharif: "☔",
  Rabi: "❄️",
  Summer: "☀️",
};
const SEASON_COLORS: Record<string, { color: string; pale: string }> = {
  Kharif: { color: "#0EA5E9", pale: "#E0F2FE" },
  Rabi: { color: "#6366F1", pale: "#EEF2FF" },
  Summer: { color: "#F59E0B", pale: "#FEF3C7" },
};

const ACTIVE_COLOR = "#0D9488";
const ACTIVE_PALE = "#CCFBF1";
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  Active: { bg: ACTIVE_PALE, text: ACTIVE_COLOR, dot: ACTIVE_COLOR },
  Harvested: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Closed: { bg: C.expensePale, text: C.expense, dot: "#EF4444" },
};

const EXPENSE_CATEGORY_LABELS: Partial<Record<ExpenseCategory, string>> = {
  Seed: "બિયારણ",
  Fertilizer: "ખાતર",
  Pesticide: "દવા",
  Labour: "મજૂરી",
  Machinery: "મશીનરી",
};
const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  "Seed",
  "Fertilizer",
  "Pesticide",
  "Labour",
  "Machinery",
];

function getFilterTabs(t: (s: string, k: string) => string) {
  return [
    { key: "all", label: t("common", "all") },
    { key: "Active", label: t("common", "statusActive") },
    { key: "Harvested", label: t("common", "statusHarvested") },
    { key: "Closed", label: t("common", "statusClosed") },
  ];
}

function cropDisplayName(name: string, t: (s: string, k: string) => string): string {
  return t("cropNames", name) || name;
}

// ─── Crop card ────────────────────────────────────────────────────────────────
function CropCard({
  item,
  index,
  t,
  tParam,
  onDelete,
  onStatusChange,
  onHarvest,
  onOpenDetails,
}: {
  item: Crop;
  index: number;
  t: (s: string, k: string) => string;
  tParam: (s: string, k: string, p: Record<string, string | number>) => string;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: CropStatus) => void;
  onHarvest: (id: string) => void;
  onOpenDetails: (crop: Crop) => void;
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

  const seasonKey = item.season ?? "";
  const seasonLabel = seasonKey === "Kharif" ? t("common", "kharif") : seasonKey === "Rabi" ? t("common", "rabi") : seasonKey === "Summer" ? t("common", "summer") : (item.season ?? "");
  const seasonIcon = SEASON_ICONS[seasonKey] ?? "🌾";
  const statusStyle = STATUS_STYLE[item.status ?? "Active"] ?? STATUS_STYLE.Active;
  const statusLabel = item.status === "Active" ? t("common", "statusActive") : item.status === "Harvested" ? t("common", "statusHarvested") : t("common", "statusClosed");
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
            <Text style={styles.swipeBtnText}>{t("crop", "harvest")}</Text>
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
            <Text style={styles.swipeBtnText}>{t("crop", "statusShort")}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#0284C7" }]}
          onPress={() => { closeSwipe(); router.push(`/crop/edit-crop?id=${item._id}` as any); }}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>{t("crop", "edit")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: C.expense }]}
          onPress={() => { closeSwipe(); onDelete(item._id); }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>{t("crop", "delete")}</Text>
        </TouchableOpacity>
      </View>

      {/* Main card */}
      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top accent bar — same crop color as dashboard/chart */}
        <View style={[styles.cardAccentBar, { backgroundColor: cropColor }]} />

        <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenDetails(item)}>
          <View style={styles.cardInner}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={[styles.cropEmojiWrap, { backgroundColor: cropPale }]}>
              <Text style={styles.cropEmoji}>{item.cropEmoji ?? "🌱"}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cropName}>{cropDisplayName(item.cropName, t)}</Text>

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
                    {seasonIcon} {seasonLabel}
                  </Text>
                </View>

                {/* year — NEW field */}
                {item.year ? (
                  <View style={[styles.tag, { backgroundColor: C.green50 }]}>
                    <Text style={[styles.tagText, { color: C.green700 }]}>
                      {item.year}
                    </Text>
                  </View>
                ) : null}

                {item.landType === "bhagma" && item.bhagmaPercentage != null && (
                  <View style={[styles.bhagmaBadge, { backgroundColor: C.expensePale }]}>
                    <Text style={[styles.bhagmaBadgeText, { color: C.expense }]}>
                      {tParam("dashboard", "bhagmaPct", { pct: item.bhagmaPercentage ?? 0 })}
                    </Text>
                  </View>
                )}
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>
                    {statusLabel}
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
                  <View style={[styles.statusDot, { backgroundColor: STATUS_STYLE[s].dot }]} />
                  <Text style={[styles.dropMenuText, item.status === s && { color: C.green700, fontWeight: "700" }]}>
                    {s === "Active" ? t("common", "statusActive") : s === "Harvested" ? t("common", "statusHarvested") : t("common", "statusClosed")}
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
                      {t("crop", "harvestAndYield")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.dropDivider} />
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => { toggleMenu(); router.push(`/crop/edit-crop?id=${item._id}` as any); }}
              >
                <Ionicons name="create-outline" size={14} color={C.textSecondary} />
                <Text style={styles.dropMenuText}>{t("crop", "editCrop")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => { toggleMenu(); onDelete(item._id); }}
              >
                <Ionicons name="trash-outline" size={14} color={C.expense} />
                <Text style={[styles.dropMenuText, { color: C.expense }]}>{t("crop", "deleteCrop")}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Footer stats */}
          <View style={styles.cardFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="resize-outline" size={13} color={C.textMuted} />
              <Text style={styles.footerText}>
                {typeof item.area === "number" || item.area != null ? Math.round(Number(item.area)) : "—"} {item.areaUnit ?? "Bigha"}
              </Text>
            </View>

            {/* Sowing date — default when creating crop */}
            {item.sowingDate ? (
              <View style={styles.footerItem}>
                <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
                <Text style={styles.footerText}>
                  {t("crop", "sowingLabel")}: {new Date(item.sowingDate).toLocaleDateString("gu-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </View>
            ) : null}

            {/* Harvest date — shown when status is Harvested */}
            {item.status === "Harvested" && item.harvestDate ? (
              <View style={styles.footerItem}>
                <Ionicons name="leaf-outline" size={13} color="#B45309" />
                <Text style={[styles.footerText, { color: "#B45309" }]}>
                  {t("crop", "harvestDateLabel")}: {new Date(item.harvestDate).toLocaleDateString("gu-IN", { day: "numeric", month: "short", year: "numeric" })}
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
                <Text style={styles.swipeHintText}>← {t("crop", "swipeHint")}</Text>
              </View>
            )}
          </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Year filter (same as add-crop) ───────────────────────────────────────────
const YEAR_OPTIONS = getFinancialYearOptions();

function YearFilter({
  selectedYear,
  onSelectYear,
  t,
}: {
  selectedYear: string;
  onSelectYear: (y: string) => void;
  t: (s: string, k: string) => string;
}) {
  return (
    <View style={styles.yearFilterWrap}>
      <Text style={styles.yearFilterLabel}>{t("crop", "yearFilterLabel")}</Text>
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

// ─── Stats header (status filters + total bigha) ───────────────────────────────
function StatsBar({
  crops,
  filteredCrops,
  selectedYear,
  onSelectYear,
  totalLandBigha,
  activeFilter,
  onFilterChange,
  t,
  tParam,
}: {
  crops: Crop[];
  filteredCrops: Crop[];
  selectedYear: string;
  onSelectYear: (y: string) => void;
  totalLandBigha: number;
  activeFilter: string;
  onFilterChange: (k: string) => void;
  t: (s: string, k: string) => string;
  tParam: (s: string, k: string, p: Record<string, string | number>) => string;
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

  const paddingTop = HEADER_PADDING_TOP;

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

        <View style={styles.statsHeaderRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={styles.statsTitleRow}>
            <View>
              <Text style={styles.statsGreeting}>🌾 {t("crop", "myCropListTitle")}</Text>
              <Text style={styles.statsSubtitle}>
                {tParam("crop", "cropsCount", { count: crops.length, year: selectedYear })}
              </Text>
            </View>
          </View>
        </View>

        <YearFilter selectedYear={selectedYear} onSelectYear={onSelectYear} t={t} />

        <View style={styles.statsGrid}>
          {[
            { key: "Active", labelKey: "statusActive", value: active, color: ACTIVE_COLOR, bg: ACTIVE_PALE, icon: "leaf-outline" as const },
            { key: "Harvested", labelKey: "statusHarvested", value: harvested, color: "#B45309", bg: "#FEF3C7", icon: "checkmark-circle-outline" as const },
            { key: "Closed", labelKey: "statusClosed", value: closed, color: C.expense, bg: C.expensePale, icon: "close-circle-outline" as const },
          ].map((s) => {
            const isActive = activeFilter === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.statBox,
                  { backgroundColor: s.bg },
                  isActive && styles.statBoxFilterActive,
                ]}
                onPress={() => onFilterChange(s.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={s.icon} size={20} color={s.color} style={{ marginBottom: 4 }} />
                <Text style={[styles.statValue, { color: s.color }]}>
                  {typeof s.value === "number" && s.value % 1 !== 0 ? s.value.toFixed(1) : s.value}
                </Text>
                <Text style={styles.statLabel}>{t("common", s.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}

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
                {Math.round(usedBigha)}
              </Text>
              <Text style={styles.statLabelBigha}>{t("crop", "totalBigha")}</Text>
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
  t,
}: {
  active: string;
  onChange: (k: string) => void;
  counts: Record<string, number>;
  t: (s: string, k: string) => string;
}) {
  const tabs = getFilterTabs(t);
  return (
    <View style={styles.filterRow}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.filterTab, active === tab.key && styles.filterTabActive]}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.75}
        >
          <Text style={[styles.filterTabText, active === tab.key && styles.filterTabTextActive]}>
            {tab.label}
          </Text>
          {counts[tab.key] !== undefined && (
            <View style={[styles.filterBadge, active === tab.key && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, active === tab.key && { color: "#fff" }]}>
                {counts[tab.key]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ filter, t, tParam }: { filter: string; t: (s: string, k: string) => string; tParam: (s: string, k: string, p: Record<string, string | number>) => string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
  }, []);
  const tabs = getFilterTabs(t);
  const filterLabel = tabs.find((f) => f.key === filter)?.label ?? filter;
  return (
    <Animated.View style={[styles.empty, { opacity: anim, transform: [{ scale: anim }] }]}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyEmoji}>🌱</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {filter === "Active"
          ? t("crop", "noActiveCrops")
          : tParam("crop", "noCropsInFilter", { filter: filterLabel })}
      </Text>
      <Text style={styles.emptyDesc}>
        {filter === "Active"
          ? t("crop", "addCropBelow")
          : t("crop", "filterOrAdd")}
      </Text>
      {filter === "Active" && (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push("/crop/add-crop")}
        >
          <Ionicons name="add-circle-outline" size={16} color={C.green700} />
          <Text style={styles.emptyBtnText}>{t("crop", "addNewCropBtn")}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CropScreen() {
  const { t, tParam } = useLanguage();
  const { profile, setProfile } = useProfile();
  const { transactionsRefreshKey } = useRefresh();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("Active");
  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYear());
  const [summaryCrop, setSummaryCrop] = useState<Crop | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryIncomes, setSummaryIncomes] = useState<Income[]>([]);
  const [summaryByCategory, setSummaryByCategory] =
    useState<Partial<Record<ExpenseCategory, number>>>({});
  const [summaryRow, setSummaryRow] = useState<CropReportRow | null>(null);

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
      Alert.alert(t("common", "error"), err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear, t]);

  useEffect(() => {
    setLoading(true);
    fetchCrops();
  }, [fetchCrops, transactionsRefreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCrops();
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    Alert.alert(t("crop", "confirmDelete"), t("crop", "confirmDeleteMsg"), [
      { text: t("crop", "cancel"), style: "cancel" },
      {
        text: t("crop", "deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCrop(id);
            setCrops((prev) => prev.filter((c) => c._id !== id));
            Toast.show({ type: "success", text1: "સફળ!", text2: "પાક કાઢી નાખ્યો." });
          } catch (err: any) {
            Alert.alert(t("common", "error"), err.message);
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
      Alert.alert(t("common", "error"), err.message);
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
      Alert.alert(t("common", "error"), err.message);
    }
  };

  const filtered = crops.filter((c) => c.status === filter);

  const counts: Record<string, number> = {
    Active: crops.filter((c) => c.status === "Active").length,
    Harvested: crops.filter((c) => c.status === "Harvested").length,
    Closed: crops.filter((c) => c.status === "Closed").length,
  };

  const openSummary = async (crop: Crop) => {
    setSummaryCrop(crop);
    setSummaryLoading(true);
    try {
      const [iRes, expSummary, yearly] = await Promise.all([
        getIncomes(1, 200, crop._id, undefined, undefined, selectedYear),
        getExpenseSummary(undefined, crop._id, selectedYear),
        getYearlyReport(selectedYear),
      ]);
      setSummaryIncomes(iRes.data ?? []);
      const byCat: Partial<Record<ExpenseCategory, number>> = {};
      (expSummary.summary ?? []).forEach((item) => {
        const cat = item._id as ExpenseCategory;
        byCat[cat] = item.total;
      });
      setSummaryByCategory(byCat);
      const rows = (yearly?.crops ?? []) as CropReportRow[];
      const row = rows.find((r) => r._id === crop._id) ?? null;
      setSummaryRow(row);
    } catch (err) {
      console.warn("[CropSummary] load error:", (err as Error).message);
      setSummaryIncomes([]);
      setSummaryByCategory({});
      setSummaryRow(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const closeSummary = () => {
    setSummaryCrop(null);
    setSummaryIncomes([]);
    setSummaryByCategory({});
    setSummaryRow(null);
  };

  const fallbackIncome = summaryIncomes.reduce(
    (sum: number, i: Income) => sum + (i.amount || 0),
    0,
  );
  const fallbackExpense = (Object.values(summaryByCategory) as number[]).reduce(
    (sum, v) => sum + (v || 0),
    0,
  );
  const totalIncome = summaryRow?.income ?? fallbackIncome;
  const totalExpense = summaryRow?.expense ?? fallbackExpense;
  const netProfit = summaryRow?.profit ?? totalIncome - totalExpense;
  const byCategory = summaryByCategory;

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <ActivityIndicator size="large" color={C.green700} />
        <Text style={styles.loadingText}>{t("crop", "loadingCrops")}</Text>
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
          activeFilter={filter}
          onFilterChange={setFilter}
          t={t}
          tParam={tParam}
        />

      {filtered.length === 0 ? (
            <EmptyState filter={filter} t={t} tParam={tParam} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              renderItem={({ item, index }) => (
                <CropCard
                  item={item}
                  index={index}
                  t={t}
                  tParam={tParam}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  onHarvest={handleHarvest}
                  onOpenDetails={openSummary}
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

      {/* Center summary popup */}
      <Modal
        visible={!!summaryCrop}
        transparent
        animationType="fade"
        onRequestClose={closeSummary}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeSummary}>
          <Pressable style={styles.modalCard}>
            {summaryCrop && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {summaryCrop.cropEmoji ?? "🌱"} {summaryCrop.cropName}
                    </Text>
                    <Text style={styles.modalArea}>
                      {Math.round(summaryCrop.area)} {summaryCrop.areaUnit ?? "વીઘા"}
                    </Text>
                  </View>
                  <View style={styles.modalHeaderRight}>
                    <Text style={styles.modalDate}>
                      {new Date(
                        summaryCrop.sowingDate ?? summaryCrop.createdAt,
                      ).toLocaleDateString("gu-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    <TouchableOpacity onPress={closeSummary} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>કેટેગરી પ્રમાણે ખર્ચ</Text>
                {summaryLoading ? (
                  <View style={styles.modalLoadingRow}>
                    <ActivityIndicator size="small" color={C.green700} />
                    <Text style={styles.modalLoadingText}>લોડ થઈ રહ્યું છે...</Text>
                  </View>
                ) : (
                  <>
                    {EXPENSE_CATEGORY_ORDER.map((cat) => (
                      <View key={cat} style={styles.modalCatRow}>
                        <Text style={styles.modalCatLabel}>
                          {EXPENSE_CATEGORY_LABELS[cat] ?? cat}
                        </Text>
                        <Text style={styles.modalCatValue}>
                          ₹ {Math.round(byCategory[cat] || 0).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    ))}

                    {/* Total expense & income summary */}
                    <Text style={styles.modalTotalLine}>
                      કુલ ખર્ચ:{" "}
                      <Text style={styles.modalTotalAmount}>
                        ₹ {totalExpense.toLocaleString("en-IN")}
                      </Text>
                    </Text>
                    <Text style={styles.modalTotalLine}>
                      કુલ આવક:{" "}
                      <Text style={styles.modalTotalAmount}>
                        ₹ {totalIncome.toLocaleString("en-IN")}
                      </Text>
                    </Text>
                    {summaryCrop.landType === "bhagma" &&
                      summaryCrop.bhagmaPercentage != null && (
                        <>
                          <Text style={styles.modalTotalLine}>
                            ભાગ્યાદારને આપવાનો ભાગ (
                            {summaryCrop.bhagmaPercentage}%):{" "}
                            <Text style={styles.modalTotalAmount}>
                              ₹{" "}
                              {Math.round(
                                (totalIncome * summaryCrop.bhagmaPercentage) / 100,
                              ).toLocaleString("en-IN")}
                            </Text>
                          </Text>
                          <Text style={styles.modalTotalLine}>
                            તમારી આવક (ભાગ પછી):{" "}
                            <Text style={styles.modalTotalAmount}>
                              ₹{" "}
                              {Math.round(
                                totalIncome *
                                  (1 - summaryCrop.bhagmaPercentage / 100),
                              ).toLocaleString("en-IN")}
                            </Text>
                          </Text>
                        </>
                      )}
                    <Text style={styles.modalTotalLine}>
                      ચોખ્ખો નફો:{" "}
                      <Text
                        style={[
                          styles.modalTotalAmount,
                          { color: netProfit >= 0 ? C.income : C.expense },
                        ]}
                      >
                        ₹ {netProfit.toLocaleString("en-IN")}
                      </Text>
                    </Text>
                  </>
                )}

                <TouchableOpacity style={styles.modalBigClose} onPress={closeSummary}>
                  <Text style={styles.modalBigCloseText}>બંધ કરો</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

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
  statsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statsTitleRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statsGreeting: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  statsSubtitle: { fontSize: 16, color: C.textMuted, marginTop: 3, fontWeight: "700" },
  yearFilterWrap: { marginBottom: 16 },
  yearFilterLabel: { fontSize: 19, fontWeight: "700", color: C.textSecondary, marginBottom: 8 },
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
  yearChipText: { fontSize: 20, fontWeight: "700", color: C.textMuted },
  yearChipTextActive: { color: C.green700 },
  statsGrid: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1, borderRadius: 14, padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: "#00000006",
  },
  statBoxFilterActive: {
    borderWidth: 2,
    borderColor: C.green700,
  },
  statValue: { fontSize: 25, fontWeight: "900", marginBottom: 2 },
  statLabel: { fontSize: 16, color: C.textMuted, fontWeight: "700", textAlign: "center" },
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
  statValueBigha: { fontSize: 25, fontWeight: "900", marginBottom: 2 },
  statLabelBigha: { fontSize: 16, color: C.textMuted, fontWeight: "700", textAlign: "center" },

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
  filterTabText: { fontSize: 16, fontWeight: "700", color: C.textMuted },
  filterTabTextActive: { color: C.green700 },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: C.borderLight, justifyContent: "center",
    alignItems: "center", paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: C.green700 },
  filterBadgeText: { fontSize: 13, fontWeight: "700", color: C.textMuted },

  listContent: { padding: 14, paddingBottom: 24 },

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
  cropName: { fontSize: 20, fontWeight: "800", color: C.textPrimary, marginBottom: 3 },
  cropSubInfo: { fontSize: 16, color: C.textSecondary, fontWeight: "700", marginBottom: 5 },
  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 17, fontWeight: "700" },
  bhagmaBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  bhagmaBadgeText: { fontSize: 14, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 15, fontWeight: "700" },

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
  dropMenuText: { fontSize: 16, color: C.textSecondary, fontWeight: "700" },
  dropDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 10 },

  cardFooter: {
    flexDirection: "row", gap: 14, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.borderLight,
    marginTop: 4, alignItems: "center",
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  footerText: { fontSize: 15, color: C.textMuted, fontWeight: "700" },

  // Yield efficiency badge — shown on harvested crops
  yieldBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  yieldBadgeText: { fontSize: 13, fontWeight: "700" },

  swipeHint: { flexDirection: "row", alignItems: "center", marginLeft: "auto" },
  swipeHintText: { fontSize: 14, color: C.green100, fontWeight: "700" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.green50, justifyContent: "center", alignItems: "center",
    marginBottom: 16, borderWidth: 2, borderColor: C.green100,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 16, color: C.textMuted, textAlign: "center", marginBottom: 20, fontWeight: "700" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF8E1", borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 2, borderColor: "#FFE082",
  },
  emptyBtnText: { fontSize: 18, fontWeight: "800", color: "#5D4037" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 18,
    backgroundColor: C.surface,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: C.textPrimary,
  },
  modalArea: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
    color: C.textSecondary,
  },
  modalDate: {
    fontSize: 15,
    fontWeight: "800",
    color: C.textSecondary,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalSub: {
    fontSize: 15,
    color: C.textSecondary,
    marginTop: 2,
  },
  modalSubSmall: {
    fontSize: 14,
    color: C.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  modalSummaryRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  modalPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  modalPillValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  modalPillLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  modalNetBox: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  modalNetValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalNetLabel: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.textSecondary,
    marginTop: 10,
    marginBottom: 4,
  },
  modalCatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  modalCatLabel: {
    fontSize: 15,
    color: C.textSecondary,
  },
  modalCatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: C.expense,
  },
  modalEmptyText: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  modalLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  modalLoadingText: {
    fontSize: 12,
    color: C.textMuted,
  },
  modalTotalLine: {
    marginTop: 8,
    fontSize: 16,
    color: C.textSecondary,
  },
  modalTotalAmount: {
    fontSize: 19,
    fontWeight: "800",
    color: C.textPrimary,
  },
  modalBigClose: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: C.green700,
    alignItems: "center",
    paddingVertical: 10,
  },
  modalBigCloseText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },

});
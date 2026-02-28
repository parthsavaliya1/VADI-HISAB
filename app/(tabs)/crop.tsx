import {
  Crop,
  CropStatus,
  deleteCrop,
  getCrops,
  updateCropStatus,
} from "@/utils/api";
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
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = -80;

// ─── Color system — matches dashboard exactly ─────────────────────────────────
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

  textPrimary: "#1A2E1C",
  textSecondary: "#3D5C40",
  textMuted: "#7A9B7E",

  income: "#2E7D32",
  incomePale: "#E8F5E9",
  expense: "#C62828",
  expensePale: "#FFEBEE",

  gold: "#F9A825",
  goldLight: "#FBBF24",
  goldPale: "#FFFDE7",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

// ─── Season & Status config ───────────────────────────────────────────────────
const SEASON_META: Record<
  string,
  { label: string; icon: string; color: string; pale: string }
> = {
  Kharif: { label: "ખરીફ", icon: "☔", color: "#0EA5E9", pale: "#E0F2FE" },
  Rabi: { label: "રવી", icon: "❄️", color: "#6366F1", pale: "#EEF2FF" },
  Summer: { label: "ઉનાળો", icon: "☀️", color: "#F59E0B", pale: "#FEF3C7" },
};

const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  Active: {
    label: "સક્રિય",
    bg: C.incomePale,
    text: C.green700,
    dot: C.green500,
  },
  Harvested: { label: "લણણી", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Closed: { label: "બંધ", bg: C.expensePale, text: C.expense, dot: "#EF4444" },
};

const FILTER_TABS = [
  { key: "all", label: "બધા" },
  { key: "Active", label: "સક્રિય" },
  { key: "Harvested", label: "લણણી" },
  { key: "Closed", label: "બંધ" },
];

// ─── Crop card ────────────────────────────────────────────────────────────────
function CropCard({
  item,
  index,
  onDelete,
  onStatusChange,
}: {
  item: Crop;
  index: number;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: CropStatus) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 300,
        delay: index * 55,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        delay: index * 55,
        useNativeDriver: true,
      }),
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
          Animated.spring(translateX, {
            toValue: -120,
            useNativeDriver: true,
          }).start();
          setSwiped(true);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
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
    Animated.spring(menuAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
    }).start();
  };

  const season = SEASON_META[item.season] ?? {
    label: item.season,
    icon: "🌾",
    color: C.textMuted,
    pale: C.green50,
  };
  const status = STATUS_META[item.status ?? "Active"] ?? STATUS_META.Active;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { opacity: cardOpacity, transform: [{ scale: cardScale }] },
      ]}
    >
      {/* Swipe action buttons */}
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: C.green700 }]}
          onPress={() => {
            closeSwipe();
            const next: CropStatus =
              item.status === "Active"
                ? "Harvested"
                : item.status === "Harvested"
                  ? "Closed"
                  : "Active";
            onStatusChange(item._id, next);
          }}
        >
          <Ionicons name="swap-horizontal" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>સ્ટેટ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#0284C7" }]}
          onPress={() => {
            closeSwipe();
            router.push(`/crop/add-crop?id=${item._id}`);
          }}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>ફેરફાર</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: C.expense }]}
          onPress={() => {
            closeSwipe();
            onDelete(item._id);
          }}
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
        {/* Top accent bar — season colour */}
        <View
          style={[styles.cardAccentBar, { backgroundColor: season.color }]}
        />

        <View style={styles.cardInner}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View
              style={[styles.cropEmojiWrap, { backgroundColor: season.pale }]}
            >
              <Text style={styles.cropEmoji}>{item.cropEmoji ?? "🌱"}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cropName}>{item.cropName}</Text>

              {/* subType + batchLabel */}
              {(item as any).subType || (item as any).batchLabel ? (
                <Text style={styles.cropSubInfo}>
                  {(item as any).subType ? `🏷️ ${(item as any).subType}` : ""}
                  {(item as any).subType && (item as any).batchLabel
                    ? "  ·  "
                    : ""}
                  {(item as any).batchLabel
                    ? `🔢 ${(item as any).batchLabel}`
                    : ""}
                </Text>
              ) : null}

              <View style={styles.tagsRow}>
                <View style={[styles.tag, { backgroundColor: season.pale }]}>
                  <Text style={[styles.tagText, { color: season.color }]}>
                    {season.icon} {season.label}
                  </Text>
                </View>
                {(item as any).year ? (
                  <View style={[styles.tag, { backgroundColor: C.green50 }]}>
                    <Text style={[styles.tagText, { color: C.green700 }]}>
                      📅 {(item as any).year}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[styles.statusBadge, { backgroundColor: status.bg }]}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: status.dot }]}
                  />
                  <Text style={[styles.statusText, { color: status.text }]}>
                    {status.label}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={toggleMenu} style={styles.menuTrigger}>
              <Ionicons
                name="ellipsis-vertical"
                size={18}
                color={C.textMuted}
              />
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
                  style={[
                    styles.dropMenuItem,
                    item.status === s && styles.dropMenuItemActive,
                  ]}
                  onPress={() => {
                    toggleMenu();
                    onStatusChange(item._id, s);
                  }}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_META[s].dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.dropMenuText,
                      item.status === s && {
                        color: C.green700,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {STATUS_META[s].label}
                  </Text>
                  {item.status === s && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={C.green700}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </TouchableOpacity>
              ))}
              <View style={styles.dropDivider} />
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => {
                  toggleMenu();
                  router.push(`/crop/add-crop?id=${item._id}`);
                }}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={C.textSecondary}
                />
                <Text style={styles.dropMenuText}>ફેરફાર કરો</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => {
                  toggleMenu();
                  onDelete(item._id);
                }}
              >
                <Ionicons name="trash-outline" size={14} color={C.expense} />
                <Text style={[styles.dropMenuText, { color: C.expense }]}>
                  કાઢી નાખો
                </Text>
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
            {item.notes ? (
              <View style={styles.footerItem}>
                <Ionicons
                  name="document-text-outline"
                  size={13}
                  color={C.textMuted}
                />
                <Text style={styles.footerText} numberOfLines={1}>
                  {item.notes}
                </Text>
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

// ─── Stats header — light green, matches dashboard ────────────────────────────
function StatsBar({ crops }: { crops: Crop[] }) {
  const active = crops.filter((c) => c.status === "Active").length;
  const harvested = crops.filter((c) => c.status === "Harvested").length;
  const closed = crops.filter((c) => c.status === "Closed").length;
  const totalArea = crops.reduce((s, c) => s + (c.area ?? 0), 0);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
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
              {crops.length} પાક નોંધાયેલ છે
            </Text>
          </View>
          <TouchableOpacity
            style={styles.statsAddBtn}
            onPress={() => router.push("/crop/add-crop")}
          >
            <Ionicons name="add" size={20} color={C.green700} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {[
            {
              label: "સક્રિય",
              value: active,
              color: C.income,
              bg: C.incomePale,
              icon: "leaf-outline",
            },
            {
              label: "લણણી",
              value: harvested,
              color: "#B45309",
              bg: "#FEF3C7",
              icon: "checkmark-circle-outline",
            },
            {
              label: "બંધ",
              value: closed,
              color: C.expense,
              bg: C.expensePale,
              icon: "close-circle-outline",
            },
            {
              label: "કુલ વીઘા",
              value: totalArea,
              color: C.green700,
              bg: C.green50,
              icon: "resize-outline",
            },
          ].map((s) => (
            <View
              key={s.label}
              style={[styles.statBox, { backgroundColor: s.bg }]}
            >
              <Ionicons
                name={s.icon as any}
                size={16}
                color={s.color}
                style={{ marginBottom: 4 }}
              />
              <Text style={[styles.statValue, { color: s.color }]}>
                {s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
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
          <Text
            style={[
              styles.filterTabText,
              active === t.key && styles.filterTabTextActive,
            ]}
          >
            {t.label}
          </Text>
          {counts[t.key] !== undefined && (
            <View
              style={[
                styles.filterBadge,
                active === t.key && styles.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  active === t.key && { color: "#fff" },
                ]}
              >
                {counts[t.key]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[styles.empty, { opacity: anim, transform: [{ scale: anim }] }]}
    >
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
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchCrops = async () => {
    try {
      const res = await getCrops();
      setCrops(res.data);
    } catch (err: any) {
      Alert.alert("ભૂલ", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCrops();
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert("ખાતરી કરો", "શું તમે આ પાક કાઢવા માંગો છો?", [
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

  const handleStatusChange = async (id: string, status: CropStatus) => {
    try {
      await updateCropStatus(id, status);
      setCrops((prev) =>
        prev.map((c) => (c._id === id ? { ...c, status } : c)),
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

      <StatsBar crops={crops} />
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

  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.bg,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textMuted },

  // Stats header
  statsGrad: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  decorCircle1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#C8E6C980",
    top: -40,
    right: -30,
  },
  decorCircle2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#C8E6C950",
    bottom: 8,
    left: 16,
  },
  statsTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statsGreeting: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  statsSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 3 },
  statsAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.green100,
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00000006",
  },
  statValue: { fontSize: 20, fontWeight: "900", marginBottom: 2 },
  statLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },

  // Filter tabs
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  filterTabActive: { borderColor: C.green700, backgroundColor: C.green50 },
  filterTabText: { fontSize: 12, fontWeight: "600", color: C.textMuted },
  filterTabTextActive: { color: C.green700 },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.borderLight,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: C.green700 },
  filterBadgeText: { fontSize: 10, fontWeight: "700", color: C.textMuted },

  // List
  listContent: { padding: 14, paddingBottom: 110 },

  // Card wrapper
  cardWrapper: { marginBottom: 12 },

  // Swipe actions
  swipeActions: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
  },
  swipeBtn: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  swipeBtnText: { fontSize: 8, color: "#fff", fontWeight: "700" },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAccentBar: { height: 4 },
  cardInner: { padding: 14 },

  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  cropEmojiWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  cropEmoji: { fontSize: 26 },
  cropName: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 3,
  },
  cropSubInfo: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "600",
    marginBottom: 5,
  },
  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: "600" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },

  menuTrigger: { padding: 4, marginLeft: 4 },
  dropMenu: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  dropMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropMenuItemActive: { backgroundColor: C.green50 },
  dropMenuText: { fontSize: 13, color: C.textSecondary },
  dropDivider: {
    height: 1,
    backgroundColor: C.borderLight,
    marginHorizontal: 10,
  },

  cardFooter: {
    flexDirection: "row",
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    marginTop: 4,
    alignItems: "center",
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  footerText: { fontSize: 12, color: C.textMuted },
  swipeHint: { flexDirection: "row", alignItems: "center", marginLeft: "auto" },
  swipeHintText: { fontSize: 10, color: C.green100 },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: C.green100,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.green50,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  emptyBtnText: { fontSize: 14, fontWeight: "800", color: C.green700 },

  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: C.green700,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGrad: {
    width: 58,
    height: 58,
    justifyContent: "center",
    alignItems: "center",
  },
});

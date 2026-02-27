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
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = -80;

// ─── Season & Status config ───────────────────────────────────────────────────
const SEASON_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  Kharif: { label: "ખરીફ", icon: "☔", color: "#0EA5E9" },
  Rabi: { label: "રવી", icon: "❄️", color: "#6366F1" },
  Summer: { label: "ઉનાળો", icon: "☀️", color: "#F59E0B" },
};

const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  Active: { label: "સક્રિય", bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Harvested: { label: "લણણી", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Closed: { label: "બંધ", bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

const FILTER_TABS = [
  { key: "all", label: "બધા" },
  { key: "Active", label: "સક્રિય" },
  { key: "Harvested", label: "લણણી" },
  { key: "Closed", label: "બંધ" },
];

// ─── Animated crop card with swipe-to-reveal actions ─────────────────────────
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

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
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
    color: "#6B7280",
  };
  const status = STATUS_META[item.status ?? "Active"] ?? STATUS_META.Active;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { opacity: cardOpacity, transform: [{ scale: cardScale }] },
      ]}
    >
      {/* ── Swipe action background ── */}
      <View style={styles.swipeActions}>
        {/* Change status */}
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#059669" }]}
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

        {/* Edit */}
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

        {/* Delete */}
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#DC2626" }]}
          onPress={() => {
            closeSwipe();
            onDelete(item._id);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>કાઢો</Text>
        </TouchableOpacity>
      </View>

      {/* ── Main card ── */}
      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Season accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: season.color }]} />

        <View style={styles.cardInner}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={styles.cropEmojiWrap}>
              <Text style={styles.cropEmoji}>{item.cropEmoji ?? "🌱"}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cropName}>{item.cropName}</Text>
              <View style={styles.tagsRow}>
                {/* Season tag */}
                <View
                  style={[styles.tag, { backgroundColor: season.color + "22" }]}
                >
                  <Text style={styles.tagText}>
                    {season.icon} {season.label}
                  </Text>
                </View>
                {/* Status badge */}
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

            {/* Menu trigger */}
            <TouchableOpacity onPress={toggleMenu} style={styles.menuTrigger}>
              <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Dropdown menu */}
          {menuOpen && (
            <Animated.View
              style={[
                styles.dropMenu,
                {
                  opacity: menuAnim,
                  transform: [{ scaleY: menuAnim }],
                },
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
                        color: "#059669",
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
                      color="#059669"
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
                <Ionicons name="create-outline" size={14} color="#374151" />
                <Text style={styles.dropMenuText}>ફેરફાર કરો</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dropMenuItem}
                onPress={() => {
                  toggleMenu();
                  onDelete(item._id);
                }}
              >
                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                <Text style={[styles.dropMenuText, { color: "#DC2626" }]}>
                  કાઢી નાખો
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="resize-outline" size={13} color="#9CA3AF" />
              <Text style={styles.statText}>
                {item.area} {item.areaUnit ?? "Bigha"}
              </Text>
            </View>
            {item.notes ? (
              <View style={styles.statItem}>
                <Ionicons
                  name="document-text-outline"
                  size={13}
                  color="#9CA3AF"
                />
                <Text style={styles.statText} numberOfLines={1}>
                  {item.notes}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Swipe hint (only on first render if not swiped) */}
          {index === 0 && !swiped && (
            <View style={styles.swipeHint}>
              <Ionicons name="chevron-back" size={10} color="#9CA3AF" />
              <Text style={styles.swipeHintText}>
                ← ક્રિયાઓ માટે સ્વાઈપ કરો
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Stats header card ────────────────────────────────────────────────────────
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

  return (
    <Animated.View style={[styles.statsBar, { opacity: anim }]}>
      <LinearGradient
        colors={["#14532D", "#166534", "#15803D"]}
        style={styles.statsGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.statsDecor} />
        <Text style={styles.statsTitle}>🌾 મારી પાક સૂચિ</Text>
        <View style={styles.statsGrid}>
          {[
            { label: "સક્રિય", value: active, color: "#10B981" },
            { label: "લણણી", value: harvested, color: "#F59E0B" },
            { label: "બંધ", value: closed, color: "#EF4444" },
            { label: "કુલ વિઘા", value: totalArea, color: "#A7F3D0" },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
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
      <Text style={styles.emptyEmoji}>🌱</Text>
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
          <Text style={styles.emptyBtnText}>+ નવો પાક ઉમેરો</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
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

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Status change ──────────────────────────────────────────────────────────
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

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered =
    filter === "all" ? crops : crops.filter((c) => c.status === filter);

  const counts: Record<string, number> = {
    all: crops.length,
    Active: crops.filter((c) => c.status === "Active").length,
    Harvested: crops.filter((c) => c.status === "Harvested").length,
    Closed: crops.filter((c) => c.status === "Closed").length,
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0FDF4" />
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>પાક લોડ થઈ રહ્યો છે...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#14532D" />

      {/* Stats header */}
      <StatsBar crops={crops} />

      {/* Filter tabs */}
      <FilterTabs active={filter} onChange={setFilter} counts={counts} />

      {/* List */}
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
              colors={["#059669"]}
              tintColor="#059669"
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
          colors={["#065F46", "#059669"]}
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
  screen: { flex: 1, backgroundColor: "#F0FDF4" },

  // Loader
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280" },

  // Stats bar
  statsBar: { marginHorizontal: 0 },
  statsGrad: {
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  statsDecor: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#ffffff0A",
    top: -60,
    right: -60,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 16,
  },
  statsGrid: { flexDirection: "row", gap: 0 },
  statBox: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#ffffff20",
  },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, color: "#A7F3D0", marginTop: 2 },

  // Filter tabs
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  filterTabActive: { borderColor: "#059669", backgroundColor: "#D1FAE5" },
  filterTabText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  filterTabTextActive: { color: "#065F46" },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: "#059669" },
  filterBadgeText: { fontSize: 10, fontWeight: "700", color: "#6B7280" },

  // List
  listContent: { padding: 14, paddingBottom: 100 },

  // Card wrapper (contains swipe bg + card)
  cardWrapper: { marginBottom: 12 },

  // Swipe action buttons (behind card)
  swipeActions: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    borderRadius: 16,
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
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardAccent: { height: 4 },
  cardInner: { padding: 14 },

  // Card top row
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  cropEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
  },
  cropEmoji: { fontSize: 26 },
  cropName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 6,
  },

  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: { fontSize: 11, fontWeight: "600", color: "#374151" },

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

  // Menu
  menuTrigger: { padding: 4, marginLeft: 4 },
  dropMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    transformOrigin: "top",
    overflow: "hidden",
  },
  dropMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropMenuItemActive: { backgroundColor: "#F0FDF4" },
  dropMenuText: { fontSize: 13, color: "#374151" },
  dropDivider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 10 },

  // Stats row inside card
  statsRow: {
    flexDirection: "row",
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    marginTop: 4,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#6B7280", flex: 1 },

  // Swipe hint
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  swipeHintText: { fontSize: 10, color: "#D1D5DB" },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },

  // FAB
  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
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

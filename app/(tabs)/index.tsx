import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const { width } = Dimensions.get("window");

// ─── Mock Data ────────────────────────────────────────────────────────────────
const FARMER = {
  name: "પ્રમોદ પટેલ",
  village: "આણંદ ગામ",
  totalLand: "12 વીઘા",
};

const WEATHER = {
  temp: "28°C",
  condition: "આંશિક વાદળ",
  humidity: "68%",
  wind: "14 km/h",
  icon: "partly-sunny",
};

const CROPS = [
  {
    id: 1,
    name: "મગફળી",
    season: "ખરીફ",
    area: "5 વીઘા",
    status: "સક્રિય",
    profit: 12400,
    expense: 18200,
    income: 30600,
    icon: "🥜",
    color: ["#F59E0B", "#D97706"],
    progress: 68,
  },
  {
    id: 2,
    name: "ઘઉં",
    season: "રવી",
    area: "4 વીઘા",
    status: "સક્રિય",
    profit: 8900,
    expense: 11000,
    income: 19900,
    icon: "🌾",
    color: ["#10B981", "#059669"],
    progress: 45,
  },
  {
    id: 3,
    name: "કઠોળ",
    season: "ઉનાળો",
    area: "3 વીઘા",
    status: "લણણી",
    profit: -2100,
    expense: 9800,
    income: 7700,
    icon: "🫘",
    color: ["#6366F1", "#4F46E5"],
    progress: 90,
  },
];

const RECENT_TRANSACTIONS = [
  { id: 1, type: "expense", label: "ખાતર - ડીએपी", crop: "મગફળી", amount: -3200, date: "આજે", icon: "leaf" },
  { id: 2, type: "income", label: "વેચાણ - VADI", crop: "ઘઉં", amount: +12500, date: "ગઈ કાલે", icon: "cash" },
  { id: 3, type: "expense", label: "મજૂરી", crop: "કઠોળ", amount: -1800, date: "2 દિવસ", icon: "people" },
  { id: 4, type: "income", label: "વેચાણ - બજાર", crop: "મગફળી", amount: +8400, date: "3 દિવસ", icon: "storefront" },
];

const QUICK_ACTIONS = [
  { label: "ખર્ચ ઉમેરો", icon: "remove-circle", color: "#EF4444", bg: "#FEE2E2" },
  { label: "આવક ઉમેરો", icon: "add-circle", color: "#10B981", bg: "#D1FAE5" },
  { label: "પાક ઉમેરો", icon: "leaf", color: "#F59E0B", bg: "#FEF3C7" },
  { label: "અહેવાલ", icon: "bar-chart", color: "#6366F1", bg: "#EDE9FE" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    anim.addListener(({ value: v }) => setDisplay(Math.floor(v)));
    return () => anim.removeAllListeners();
  }, [value]);

  return (
    <Text style={styles.netProfitAmount}>
      {prefix}
      {Math.abs(display).toLocaleString("en-IN")}
      {suffix}
    </Text>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedCrop, setSelectedCrop] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const totalProfit = CROPS.reduce((sum, c) => sum + c.profit, 0);
  const totalIncome = CROPS.reduce((sum, c) => sum + c.income, 0);
  const totalExpense = CROPS.reduce((sum, c) => sum + c.expense, 0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [220, 80],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A5C2A" />

      {/* ── Header ── */}
      <Animated.View style={[styles.headerWrapper, { height: headerHeight }]}>
        <LinearGradient colors={["#1A5C2A", "#2D8B45", "#3DAA56"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {/* Decorative circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greetingSmall}>🌅 સુ-સ્વાગત</Text>
              <Text style={styles.farmerName}>{FARMER.name}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={12} color="#A7F3D0" />
                <Text style={styles.locationText}>{FARMER.village} · {FARMER.totalLand}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.notifBtn}>
                <Ionicons name="notifications" size={20} color="#fff" />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>પ</Text>
              </View>
            </View>
          </View>

          {/* Weather bar */}
          <View style={styles.weatherBar}>
            <View style={styles.weatherLeft}>
              <Ionicons name="partly-sunny" size={24} color="#FCD34D" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.weatherTemp}>{WEATHER.temp}</Text>
                <Text style={styles.weatherCond}>{WEATHER.condition}</Text>
              </View>
            </View>
            <View style={styles.weatherStats}>
              <View style={styles.weatherStat}>
                <Ionicons name="water" size={12} color="#93C5FD" />
                <Text style={styles.weatherStatText}>{WEATHER.humidity}</Text>
              </View>
              <View style={styles.weatherStat}>
                <Ionicons name="flag" size={12} color="#93C5FD" />
                <Text style={styles.weatherStatText}>{WEATHER.wind}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* ── Net Profit Card ── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={totalProfit >= 0 ? ["#065F46", "#059669", "#10B981"] : ["#7F1D1D", "#DC2626", "#EF4444"]}
            style={styles.profitCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.decorCirclePCard} />
            <Text style={styles.profitLabel}>⚖️ કુલ ચોખ્ખો નફો</Text>
            <View style={styles.profitAmountRow}>
              <Text style={styles.profitRupee}>{totalProfit >= 0 ? "+" : "-"}₹</Text>
              <AnimatedNumber value={totalProfit} />
            </View>
            <View style={styles.profitSubRow}>
              <View style={styles.profitSubItem}>
                <Ionicons name="arrow-up-circle" size={14} color="#A7F3D0" />
                <Text style={styles.profitSubLabel}>આવક: ₹{totalIncome.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.profitDivider} />
              <View style={styles.profitSubItem}>
                <Ionicons name="arrow-down-circle" size={14} color="#FCA5A5" />
                <Text style={styles.profitSubLabel}>ખર્ચ: ₹{totalExpense.toLocaleString("en-IN")}</Text>
              </View>
            </View>
            <Text style={styles.profitCropCount}>{CROPS.length} પાક ·  {FARMER.totalLand}</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ ઝડપી કામ</Text>
          <View style={styles.quickActionsRow}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity key={i} style={[styles.quickActionBtn, { backgroundColor: action.bg }]} activeOpacity={0.75}>
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + "22" }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Active Crops ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🌱 મારા પાક</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>બધા જુઓ →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cropsScroll}>
            {CROPS.map((crop, i) => (
              <TouchableOpacity
                key={crop.id}
                style={[styles.cropCard, selectedCrop === i && styles.cropCardSelected]}
                onPress={() => setSelectedCrop(i)}
                activeOpacity={0.85}
              >
                <LinearGradient colors={crop.color as [string, string]} style={styles.cropCardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View style={styles.cropCardTop}>
                    <Text style={styles.cropEmoji}>{crop.icon}</Text>
                    <View style={[styles.cropStatusBadge, { backgroundColor: crop.status === "સક્રિય" ? "#D1FAE5" : "#FEF3C7" }]}>
                      <Text style={[styles.cropStatusText, { color: crop.status === "સક્રિય" ? "#065F46" : "#92400E" }]}>{crop.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.cropName}>{crop.name}</Text>
                  <Text style={styles.cropMeta}>{crop.season} · {crop.area}</Text>

                  {/* Progress bar */}
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${crop.progress}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{crop.progress}% પૂર્ણ</Text>

                  <View style={styles.cropProfitRow}>
                    <Text style={[styles.cropProfit, { color: crop.profit >= 0 ? "#A7F3D0" : "#FCA5A5" }]}>
                      {crop.profit >= 0 ? "▲" : "▼"} ₹{Math.abs(crop.profit).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Selected Crop Detail ── */}
        <View style={styles.section}>
          {(() => {
            const c = CROPS[selectedCrop];
            return (
              <View style={styles.cropDetailCard}>
                <View style={styles.cropDetailHeader}>
                  <Text style={styles.cropDetailEmoji}>{c.icon}</Text>
                  <View>
                    <Text style={styles.cropDetailName}>{c.name} – વિગત</Text>
                    <Text style={styles.cropDetailMeta}>{c.season} · {c.area}</Text>
                  </View>
                </View>
                <View style={styles.cropDetailStats}>
                  <View style={[styles.cropStatBox, { backgroundColor: "#D1FAE5" }]}>
                    <Text style={styles.cropStatIcon}>💰</Text>
                    <Text style={[styles.cropStatValue, { color: "#065F46" }]}>₹{c.income.toLocaleString("en-IN")}</Text>
                    <Text style={styles.cropStatLabel}>કુલ આવક</Text>
                  </View>
                  <View style={[styles.cropStatBox, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={styles.cropStatIcon}>📉</Text>
                    <Text style={[styles.cropStatValue, { color: "#7F1D1D" }]}>₹{c.expense.toLocaleString("en-IN")}</Text>
                    <Text style={styles.cropStatLabel}>કુલ ખર્ચ</Text>
                  </View>
                  <View style={[styles.cropStatBox, { backgroundColor: c.profit >= 0 ? "#DBEAFE" : "#FEF3C7" }]}>
                    <Text style={styles.cropStatIcon}>{c.profit >= 0 ? "📈" : "⚠️"}</Text>
                    <Text style={[styles.cropStatValue, { color: c.profit >= 0 ? "#1E40AF" : "#92400E" }]}>
                      {c.profit >= 0 ? "+" : ""}₹{c.profit.toLocaleString("en-IN")}
                    </Text>
                    <Text style={styles.cropStatLabel}>ચોખ્ખો નફો</Text>
                  </View>
                </View>
                <View style={styles.cropDetailActions}>
                  <TouchableOpacity style={[styles.cropDetailBtn, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="remove-circle-outline" size={16} color="#EF4444" />
                    <Text style={[styles.cropDetailBtnText, { color: "#EF4444" }]}>ખર્ચ ઉમેરો</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cropDetailBtn, { backgroundColor: "#D1FAE5" }]}>
                    <Ionicons name="add-circle-outline" size={16} color="#10B981" />
                    <Text style={[styles.cropDetailBtnText, { color: "#10B981" }]}>આવક ઉમેરો</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cropDetailBtn, { backgroundColor: "#EDE9FE" }]}>
                    <Ionicons name="document-text-outline" size={16} color="#6366F1" />
                    <Text style={[styles.cropDetailBtnText, { color: "#6366F1" }]}>સારાંશ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </View>

        {/* ── Recent Transactions ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🧾 તાજા વ્યવહાર</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>બધા જુઓ →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transactionList}>
            {RECENT_TRANSACTIONS.map((t, i) => (
              <View key={t.id} style={[styles.transactionItem, i < RECENT_TRANSACTIONS.length - 1 && styles.transactionBorder]}>
                <View style={[styles.transactionIcon, { backgroundColor: t.type === "income" ? "#D1FAE5" : "#FEE2E2" }]}>
                  <Ionicons name={t.icon as any} size={18} color={t.type === "income" ? "#059669" : "#EF4444"} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionLabel}>{t.label}</Text>
                  <Text style={styles.transactionCrop}>{t.crop} · {t.date}</Text>
                </View>
                <Text style={[styles.transactionAmount, { color: t.type === "income" ? "#059669" : "#EF4444" }]}>
                  {t.amount > 0 ? "+" : ""}₹{Math.abs(t.amount).toLocaleString("en-IN")}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0FDF4" },

  // Header
  headerWrapper: { overflow: "hidden" },
  header: { flex: 1, paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, position: "relative" },
  decorCircle1: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#ffffff12", top: -40, right: -40 },
  decorCircle2: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "#ffffff08", top: 60, right: 60 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", zIndex: 1 },
  greetingSmall: { fontSize: 12, color: "#A7F3D0", marginBottom: 2, fontFamily: "System" },
  farmerName: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 3, gap: 3 },
  locationText: { fontSize: 11, color: "#A7F3D0" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: { position: "relative", padding: 4 },
  notifDot: { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FCD34D", borderWidth: 1, borderColor: "#1A5C2A" },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#A7F3D0", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#065F46" },
  weatherBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, backgroundColor: "#ffffff18", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  weatherLeft: { flexDirection: "row", alignItems: "center" },
  weatherTemp: { fontSize: 16, fontWeight: "700", color: "#fff" },
  weatherCond: { fontSize: 10, color: "#A7F3D0" },
  weatherStats: { flexDirection: "row", gap: 14 },
  weatherStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  weatherStatText: { fontSize: 11, color: "#93C5FD" },

  // Scroll
  scrollContent: { paddingTop: 16 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  seeAll: { fontSize: 13, color: "#059669", fontWeight: "600" },

  // Profit Card
  profitCard: { borderRadius: 20, padding: 20, overflow: "hidden", position: "relative" },
  decorCirclePCard: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "#ffffff10", top: -30, right: -30 },
  profitLabel: { fontSize: 13, color: "#A7F3D0", marginBottom: 6 },
  profitAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  profitRupee: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 4 },
  netProfitAmount: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  profitSubRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 12 },
  profitSubItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  profitSubLabel: { fontSize: 12, color: "#D1FAE5" },
  profitDivider: { width: 1, height: 14, backgroundColor: "#ffffff30" },
  profitCropCount: { marginTop: 8, fontSize: 11, color: "#6EE7B7", opacity: 0.8 },

  // Quick Actions
  quickActionsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  quickActionBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", gap: 6 },
  quickActionIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  quickActionLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },

  // Crops
  cropsScroll: { paddingBottom: 8 },
  cropCard: { width: 160, marginRight: 12, borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
  cropCardSelected: { shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  cropCardGradient: { padding: 14 },
  cropCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cropEmoji: { fontSize: 28 },
  cropStatusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  cropStatusText: { fontSize: 9, fontWeight: "700" },
  cropName: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 2 },
  cropMeta: { fontSize: 10, color: "#ffffff99", marginBottom: 10 },
  progressBg: { height: 4, backgroundColor: "#ffffff30", borderRadius: 2, marginBottom: 4 },
  progressFill: { height: 4, backgroundColor: "#fff", borderRadius: 2 },
  progressLabel: { fontSize: 9, color: "#ffffff80", marginBottom: 8 },
  cropProfitRow: { flexDirection: "row" },
  cropProfit: { fontSize: 13, fontWeight: "700" },

  // Crop Detail
  cropDetailCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cropDetailHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cropDetailEmoji: { fontSize: 32 },
  cropDetailName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  cropDetailMeta: { fontSize: 11, color: "#6B7280" },
  cropDetailStats: { flexDirection: "row", gap: 8, marginBottom: 14 },
  cropStatBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  cropStatIcon: { fontSize: 16, marginBottom: 4 },
  cropStatValue: { fontSize: 13, fontWeight: "800" },
  cropStatLabel: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  cropDetailActions: { flexDirection: "row", gap: 8 },
  cropDetailBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9, borderRadius: 10 },
  cropDetailBtnText: { fontSize: 11, fontWeight: "700" },

  // Transactions
  transactionList: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  transactionItem: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  transactionBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  transactionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  transactionInfo: { flex: 1 },
  transactionLabel: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  transactionCrop: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  transactionAmount: { fontSize: 14, fontWeight: "800" },
});
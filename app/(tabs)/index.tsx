/**
 * FILE: app/(tabs)/index.tsx
 *
 * REDESIGN CHANGES:
 * ✅ Color palette changed from heavy green → warm amber/earth tones with green accents
 * ✅ Larger font sizes throughout for better readability
 * ✅ Header no longer gets "cut" — uses a fixed sticky header with fade transition
 * ✅ Improved card layouts with better spacing
 * ✅ Interactive touch feedback (ripple / scale animations)
 * ✅ Cleaner section dividers and visual hierarchy
 */

import { useProfile } from "@/contexts/ProfileContext";
import { getCrops, getMyProfile, type Crop } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

// ─── Color System ─────────────────────────────────────────────────────────────
const COLORS = {
  // Primary: Deep warm amber-brown (earthy, trustworthy)
  primary: "#8B4513",
  primaryLight: "#A0522D",
  primaryMid: "#C4743A",
  primaryPale: "#F5DEB3",

  // Accent: Muted sage green (farming, nature — but not overwhelming)
  accent: "#5A8A5F",
  accentLight: "#7AAD7F",
  accentPale: "#E8F5E9",

  // Gold/Harvest accent
  gold: "#D4A017",
  goldLight: "#F0C842",
  goldPale: "#FFF8E1",

  // Background
  bg: "#FBF7F0", // Warm cream
  surface: "#FFFFFF",
  surfaceWarm: "#FFF9F2",

  // Text
  textPrimary: "#2C1810",
  textSecondary: "#6B4C3B",
  textMuted: "#A08070",
  textOnDark: "#FFFFFF",
  textOnDarkSub: "#F5DEB3",

  // Status
  income: "#2E7D32",
  incomePale: "#E8F5E9",
  expense: "#C62828",
  expensePale: "#FFEBEE",
  neutral: "#1565C0",
  neutralPale: "#E3F2FD",

  // Borders
  border: "#E8D5C0",
  borderLight: "#F0E8DC",
};

// ─── Weather ─────────────────────────────────────────────────────────────────
const WEATHER = {
  temp: "28°C",
  condition: "આંશિક વાદળ",
  humidity: "68%",
  wind: "14 km/h",
};

// ─── Quick Actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    label: "ખર્ચ ઉમેરો",
    icon: "remove-circle",
    color: COLORS.expense,
    bg: COLORS.expensePale,
    route: "/expense/add-expense",
  },
  {
    label: "આવક ઉમેરો",
    icon: "add-circle",
    color: COLORS.income,
    bg: COLORS.incomePale,
    route: "/expense/add-expense?type=income",
  },
  {
    label: "પાક ઉમેરો",
    icon: "leaf",
    color: COLORS.accent,
    bg: COLORS.accentPale,
    route: "/crop/add-crop",
  },
  {
    label: "અહેવાલ",
    icon: "bar-chart",
    color: COLORS.primary,
    bg: COLORS.primaryPale,
    route: "/report",
  },
];

// ─── Mock Transactions ─────────────────────────────────────────────────────────
const RECENT_TRANSACTIONS = [
  {
    id: 1,
    type: "expense",
    label: "ખાતર - ડીએपी",
    crop: "મગફળી",
    amount: -3200,
    date: "આજે",
    icon: "leaf",
  },
  {
    id: 2,
    type: "income",
    label: "વેચાણ - VADI",
    crop: "ઘઉં",
    amount: +12500,
    date: "ગઈ કાલે",
    icon: "cash",
  },
  {
    id: 3,
    type: "expense",
    label: "મજૂરી",
    crop: "કઠોળ",
    amount: -1800,
    date: "2 દિવસ",
    icon: "people",
  },
  {
    id: 4,
    type: "income",
    label: "વેચાણ - બજાર",
    crop: "મગફળી",
    amount: +8400,
    date: "3 દિવસ",
    icon: "storefront",
  },
];

const CROP_COLORS: [string, string][] = [
  [COLORS.primaryMid, COLORS.primary],
  [COLORS.accent, "#3D6B42"],
  [COLORS.gold, "#B8860B"],
  ["#1976D2", "#0D47A1"],
  ["#7B1FA2", "#4A148C"],
];

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 1400,
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.floor(v)));
    return () => anim.removeListener(id);
  }, [value]);

  return (
    <Text style={styles.netProfitAmount}>
      {Math.abs(display).toLocaleString("en-IN")}
    </Text>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonLine({
  width: w,
  height: h = 14,
  style,
}: {
  width: number | string;
  height?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        {
          width: w as any,
          height: h,
          borderRadius: h / 2,
          backgroundColor: "#ffffff50",
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

// ─── Interactive Button with press animation ──────────────────────────────────
function PressableCard({ onPress, style, children }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── HEADER HEIGHT CONSTANTS ──────────────────────────────────────────────────
const HEADER_MAX = 220;
const HEADER_MIN = 80;
const STICKY_THRESHOLD = HEADER_MAX - HEADER_MIN;

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState(0);
  const { profile, setProfile } = useProfile();

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    (async () => {
      try {
        const [prof, cropRes] = await Promise.all([getMyProfile(), getCrops()]);
        setProfile(prof);
        setCrops(cropRes.data);
      } catch {
        // silent fallback
      } finally {
        setLoadingProfile(false);
      }
    })();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const farmerName = profile?.name ?? "";
  const farmerVillage = profile?.village ?? "";
  const farmerLand = profile?.totalLand
    ? `${profile.totalLand.value} ${profile.totalLand.unit === "bigha" ? "વીઘા" : "એકર"}`
    : "";
  const avatarChar = farmerName.trim().charAt(0) || "🌾";

  const totalIncome = (crops as any[]).reduce((s, c) => s + (c.income ?? 0), 0);
  const totalExpense = (crops as any[]).reduce(
    (s, c) => s + (c.expense ?? 0),
    0,
  );
  const totalProfit = totalIncome - totalExpense;

  // Header animation values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, STICKY_THRESHOLD],
    outputRange: [HEADER_MAX, HEADER_MIN],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, STICKY_THRESHOLD * 0.4, STICKY_THRESHOLD],
    outputRange: [1, 0.6, 0],
    extrapolate: "clamp",
  });

  const stickyOpacity = scrollY.interpolate({
    inputRange: [STICKY_THRESHOLD * 0.6, STICKY_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const paddingTop = Platform.OS === "ios" ? 50 : 36;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── Fixed Sticky Mini Header (shows when scrolled) ── */}
      <Animated.View
        style={[styles.stickyHeader, { opacity: stickyOpacity, paddingTop }]}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          style={styles.stickyGradient}
        >
          <View style={styles.stickyContent}>
            <Text style={styles.stickyTitle}>{farmerName || "ડૅશબોર્ડ"}</Text>
            <View style={styles.stickyRight}>
              <TouchableOpacity style={styles.notifBtn}>
                <Ionicons
                  name="notifications"
                  size={22}
                  color={COLORS.textOnDark}
                />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.avatarCircle}
                onPress={() => router.push("/profile")}
              >
                <Text style={styles.avatarText}>{avatarChar}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Collapsible Full Header ── */}
      <Animated.View style={[styles.headerWrapper, { height: headerHeight }]}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight, COLORS.primaryMid]}
          style={[styles.header, { paddingTop }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative background shapes */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.decorDot} />

          <Animated.View style={{ opacity: headerOpacity }}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greetingSmall}>🌅 સ્વાગત છે</Text>
                {loadingProfile ? (
                  <SkeletonLine
                    width={180}
                    height={26}
                    style={{ marginVertical: 4 }}
                  />
                ) : (
                  <Text style={styles.farmerName} numberOfLines={1}>
                    {farmerName || "ખેડૂત"}
                  </Text>
                )}
                {loadingProfile ? (
                  <SkeletonLine
                    width={130}
                    height={14}
                    style={{ marginTop: 5 }}
                  />
                ) : (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-sharp"
                      size={13}
                      color={COLORS.textOnDarkSub}
                    />
                    <Text style={styles.locationText}>
                      {[farmerVillage, farmerLand]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.notifBtn}>
                  <Ionicons
                    name="notifications"
                    size={22}
                    color={COLORS.textOnDark}
                  />
                  <View style={styles.notifDot} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatarCircle}
                  onPress={() => router.push("/profile")}
                  activeOpacity={0.8}
                >
                  {loadingProfile ? (
                    <SkeletonLine
                      width={22}
                      height={22}
                      style={{ borderRadius: 11 }}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{avatarChar}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Weather Bar */}
            <View style={styles.weatherBar}>
              <View style={styles.weatherLeft}>
                <Ionicons
                  name="partly-sunny"
                  size={26}
                  color={COLORS.goldLight}
                />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.weatherTemp}>{WEATHER.temp}</Text>
                  <Text style={styles.weatherCond}>{WEATHER.condition}</Text>
                </View>
              </View>
              <View style={styles.weatherStats}>
                <View style={styles.weatherStat}>
                  <Ionicons name="water" size={13} color="#93C5FD" />
                  <Text style={styles.weatherStatText}>{WEATHER.humidity}</Text>
                </View>
                <View style={styles.weatherStat}>
                  <Ionicons name="flag" size={13} color="#93C5FD" />
                  <Text style={styles.weatherStatText}>{WEATHER.wind}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* ── Scrollable Content ── */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Net Profit Card ── */}
        <Animated.View
          style={[
            styles.section,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <PressableCard>
            <LinearGradient
              colors={
                totalProfit >= 0
                  ? [COLORS.accent, "#3D6B42", "#2E5533"]
                  : [COLORS.expense, "#B71C1C", "#7F0000"]
              }
              style={styles.profitCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.profitCardDecor} />
              <View style={styles.profitCardDecor2} />

              <Text style={styles.profitLabel}>⚖️ કુલ ચોખ્ખો નફો</Text>

              <View style={styles.profitAmountRow}>
                <Text style={styles.profitRupee}>
                  {totalProfit >= 0 ? "+" : "-"}₹
                </Text>
                <AnimatedNumber value={totalProfit} />
              </View>

              <View style={styles.profitSubRow}>
                <View style={styles.profitSubItem}>
                  <View style={styles.profitSubIconBg}>
                    <Ionicons
                      name="arrow-up-circle"
                      size={16}
                      color={COLORS.incomePale}
                    />
                  </View>
                  <View>
                    <Text style={styles.profitSubCaption}>આવક</Text>
                    <Text style={styles.profitSubValue}>
                      ₹{totalIncome.toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
                <View style={styles.profitDivider} />
                <View style={styles.profitSubItem}>
                  <View style={styles.profitSubIconBg}>
                    <Ionicons
                      name="arrow-down-circle"
                      size={16}
                      color="#FFCDD2"
                    />
                  </View>
                  <View>
                    <Text style={styles.profitSubCaption}>ખર્ચ</Text>
                    <Text style={styles.profitSubValue}>
                      ₹{totalExpense.toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
                <View style={styles.profitDivider} />
                <View style={styles.profitSubItem}>
                  <View style={styles.profitSubIconBg}>
                    <Ionicons name="leaf" size={16} color={COLORS.goldLight} />
                  </View>
                  <View>
                    <Text style={styles.profitSubCaption}>પાક</Text>
                    <Text style={styles.profitSubValue}>
                      {crops.length} નંગ
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </PressableCard>
        </Animated.View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ ઝડપી કામ</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <PressableCard
                key={i}
                onPress={() => action.route && router.push(action.route as any)}
                style={[styles.quickActionBtn, { backgroundColor: action.bg }]}
              >
                <View
                  style={[
                    styles.quickActionIconBg,
                    { backgroundColor: action.color + "20" },
                  ]}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={26}
                    color={action.color}
                  />
                </View>
                <Text
                  style={[styles.quickActionLabel, { color: action.color }]}
                >
                  {action.label}
                </Text>
              </PressableCard>
            ))}
          </View>
        </View>

        {/* ── Active Crops ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🌱 મારા પાક</Text>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/crop")}
            >
              <Text style={styles.seeAll}>બધા જુઓ</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.accent}
              />
            </TouchableOpacity>
          </View>

          {crops.length === 0 ? (
            <PressableCard
              onPress={() => router.push("/crop/add-crop")}
              style={styles.emptyCropCard}
            >
              <Text style={styles.emptyCropEmoji}>🌱</Text>
              <Text style={styles.emptyCropText}>કોઈ પાક નથી</Text>
              <View style={styles.emptyCropAddBtn}>
                <Ionicons name="add" size={16} color={COLORS.accent} />
                <Text style={styles.emptyCropSub}>નવો પાક ઉમેરો</Text>
              </View>
            </PressableCard>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {crops.slice(0, 5).map((crop, i) => {
                const colors = CROP_COLORS[i % CROP_COLORS.length];
                const progress =
                  (crop as any).progress ?? Math.min(90, 30 + i * 20);
                const isSelected = selectedCrop === i;
                return (
                  <PressableCard
                    key={crop._id}
                    onPress={() => setSelectedCrop(i)}
                    style={[
                      styles.cropCard,
                      isSelected && styles.cropCardSelected,
                    ]}
                  >
                    <LinearGradient
                      colors={colors}
                      style={styles.cropCardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isSelected && <View style={styles.cropSelectedRing} />}
                      <View style={styles.cropCardTop}>
                        <Text style={styles.cropEmoji}>
                          {crop.cropEmoji ?? "🌱"}
                        </Text>
                        <View
                          style={[
                            styles.cropStatusBadge,
                            {
                              backgroundColor:
                                crop.status === "Active"
                                  ? "#E8F5E9"
                                  : "#FFF8E1",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cropStatusText,
                              {
                                color:
                                  crop.status === "Active"
                                    ? COLORS.income
                                    : "#795548",
                              },
                            ]}
                          >
                            {crop.status === "Active"
                              ? "● સક્રિય"
                              : crop.status === "Harvested"
                                ? "✓ લણણી"
                                : "◌ બંધ"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.cropName}>{crop.cropName}</Text>
                      <Text style={styles.cropMeta}>
                        {crop.season === "Kharif"
                          ? "☀️ ખરીફ"
                          : crop.season === "Rabi"
                            ? "❄️ રવી"
                            : "🌸 ઉનાળો"}
                        {" · "}
                        {crop.area} {crop.areaUnit ?? "Bigha"}
                      </Text>

                      <View style={styles.progressBg}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${progress}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressLabel}>
                        {progress}% પૂર્ણ
                      </Text>
                    </LinearGradient>
                  </PressableCard>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Selected Crop Detail ── */}
        {crops.length > 0 &&
          crops[selectedCrop] &&
          (() => {
            const c = crops[selectedCrop];
            const income = (c as any).income ?? 0;
            const expense = (c as any).expense ?? 0;
            const profit = income - expense;
            return (
              <View style={styles.section}>
                <View style={styles.cropDetailCard}>
                  {/* Header */}
                  <View style={styles.cropDetailHeader}>
                    <View style={styles.cropDetailEmojiWrap}>
                      <Text style={styles.cropDetailEmoji}>
                        {c.cropEmoji ?? "🌱"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cropDetailName}>{c.cropName}</Text>
                      <Text style={styles.cropDetailMeta}>
                        {c.season === "Kharif"
                          ? "ખરીફ"
                          : c.season === "Rabi"
                            ? "રવી"
                            : "ઉનાળો"}{" "}
                        · {c.area} {c.areaUnit}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editIconBtn}
                      onPress={() =>
                        router.push(`/crop/add-crop?id=${c._id}` as any)
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={COLORS.primaryMid}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Stats */}
                  <View style={styles.cropDetailStats}>
                    {[
                      {
                        icon: "💰",
                        val: income,
                        label: "કુલ આવક",
                        color: COLORS.income,
                        bg: COLORS.incomePale,
                      },
                      {
                        icon: "📉",
                        val: expense,
                        label: "કુલ ખર્ચ",
                        color: COLORS.expense,
                        bg: COLORS.expensePale,
                      },
                      {
                        icon: profit >= 0 ? "📈" : "⚠️",
                        val: profit,
                        label: "ચોખ્ખો નફો",
                        color: profit >= 0 ? COLORS.neutral : "#E65100",
                        bg: profit >= 0 ? COLORS.neutralPale : "#FFF3E0",
                      },
                    ].map((stat, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.cropStatBox,
                          { backgroundColor: stat.bg },
                        ]}
                      >
                        <Text style={styles.cropStatIcon}>{stat.icon}</Text>
                        <Text
                          style={[styles.cropStatValue, { color: stat.color }]}
                        >
                          {profit < 0 && idx === 2 ? "-" : ""}₹
                          {Math.abs(stat.val).toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.cropStatLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.cropDetailActions}>
                    <PressableCard
                      onPress={() =>
                        router.push(
                          `/expense/add-expense?cropId=${c._id}` as any,
                        )
                      }
                      style={[
                        styles.cropDetailBtn,
                        { backgroundColor: COLORS.expensePale },
                      ]}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={18}
                        color={COLORS.expense}
                      />
                      <Text
                        style={[
                          styles.cropDetailBtnText,
                          { color: COLORS.expense },
                        ]}
                      >
                        ખર્ચ ઉમેરો
                      </Text>
                    </PressableCard>

                    <PressableCard
                      onPress={() =>
                        router.push(
                          `/expense/add-expense?type=income&cropId=${c._id}` as any,
                        )
                      }
                      style={[
                        styles.cropDetailBtn,
                        { backgroundColor: COLORS.incomePale },
                      ]}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color={COLORS.income}
                      />
                      <Text
                        style={[
                          styles.cropDetailBtnText,
                          { color: COLORS.income },
                        ]}
                      >
                        આવક ઉમેરો
                      </Text>
                    </PressableCard>
                  </View>
                </View>
              </View>
            );
          })()}

        {/* ── Recent Transactions ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🧾 તાજા વ્યવહાર</Text>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/expense" as any)}
            >
              <Text style={styles.seeAll}>બધા જુઓ</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.accent}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.transactionList}>
            {RECENT_TRANSACTIONS.map((t, i) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.transactionItem,
                  i < RECENT_TRANSACTIONS.length - 1 &&
                    styles.transactionBorder,
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.transactionIcon,
                    {
                      backgroundColor:
                        t.type === "income"
                          ? COLORS.incomePale
                          : COLORS.expensePale,
                    },
                  ]}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={20}
                    color={t.type === "income" ? COLORS.income : COLORS.expense}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionLabel}>{t.label}</Text>
                  <Text style={styles.transactionCrop}>
                    {t.crop} · {t.date}
                  </Text>
                </View>
                <View style={styles.transactionAmountWrap}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      {
                        color:
                          t.type === "income" ? COLORS.income : COLORS.expense,
                      },
                    ]}
                  >
                    {t.amount > 0 ? "+" : ""}₹
                    {Math.abs(t.amount).toLocaleString("en-IN")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={COLORS.textMuted}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // ── Sticky mini header ──
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyGradient: { paddingBottom: 12, paddingHorizontal: 20 },
  stickyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textOnDark,
    flex: 1,
  },
  stickyRight: { flexDirection: "row", alignItems: "center", gap: 10 },

  // ── Collapsible header ──
  headerWrapper: { overflow: "hidden", zIndex: 50 },
  header: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
    position: "relative",
  },
  decorCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#ffffff10",
    top: -60,
    right: -50,
  },
  decorCircle2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ffffff08",
    top: 40,
    right: 70,
  },
  decorDot: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.goldLight + "20",
    bottom: 20,
    left: 30,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 1,
  },
  greetingSmall: {
    fontSize: 13,
    color: COLORS.textOnDarkSub,
    marginBottom: 2,
    fontWeight: "500",
  },
  farmerName: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.textOnDark,
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationText: { fontSize: 13, color: COLORS.textOnDarkSub },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
  },
  notifBtn: { position: "relative", padding: 4 },
  notifDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.goldLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.goldPale,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: COLORS.goldLight,
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: COLORS.primary },

  weatherBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    backgroundColor: "#00000025",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#ffffff15",
  },
  weatherLeft: { flexDirection: "row", alignItems: "center" },
  weatherTemp: { fontSize: 18, fontWeight: "700", color: COLORS.textOnDark },
  weatherCond: { fontSize: 11, color: COLORS.textOnDarkSub, marginTop: 1 },
  weatherStats: { flexDirection: "row", gap: 16 },
  weatherStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  weatherStatText: { fontSize: 12, color: "#93C5FD", fontWeight: "500" },

  // ── Scroll content ──
  scrollContent: { paddingTop: 20 },
  section: { marginHorizontal: 16, marginBottom: 22 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { fontSize: 14, color: COLORS.accent, fontWeight: "700" },

  // ── Profit card ──
  profitCard: {
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    position: "relative",
  },
  profitCardDecor: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#ffffff10",
    top: -40,
    right: -40,
  },
  profitCardDecor2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ffffff08",
    bottom: 10,
    left: 20,
  },
  profitLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 8,
    fontWeight: "600",
  },
  profitAmountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginBottom: 18,
  },
  profitRupee: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textOnDark,
    marginBottom: 6,
  },
  netProfitAmount: {
    fontSize: 44,
    fontWeight: "900",
    color: COLORS.textOnDark,
    letterSpacing: -2,
  },

  profitSubRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00000020",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  profitSubItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profitSubIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#ffffff15",
    justifyContent: "center",
    alignItems: "center",
  },
  profitSubCaption: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },
  profitSubValue: {
    fontSize: 14,
    color: COLORS.textOnDark,
    fontWeight: "700",
    marginTop: 1,
  },
  profitDivider: { width: 1, height: 32, backgroundColor: "#ffffff25" },

  // ── Quick actions ──
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickActionBtn: {
    width: (width - 32 - 30) / 4,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#00000010",
  },
  quickActionIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 14,
  },

  // ── Crop cards ──
  cropCard: {
    width: 170,
    marginRight: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  cropCardSelected: { shadowOpacity: 0.3, shadowRadius: 14, elevation: 10 },
  cropCardGradient: { padding: 16, minHeight: 180 },
  cropSelectedRing: {
    position: "absolute",
    inset: 0,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: COLORS.goldLight,
  },
  cropCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cropEmoji: { fontSize: 32 },
  cropStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cropStatusText: { fontSize: 10, fontWeight: "700" },
  cropName: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textOnDark,
    marginBottom: 3,
  },
  cropMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 12,
    fontWeight: "500",
  },
  progressBg: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    marginBottom: 5,
  },
  progressFill: {
    height: 5,
    backgroundColor: COLORS.textOnDark,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },

  // ── Empty crop ──
  emptyCropCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyCropEmoji: { fontSize: 48, marginBottom: 10 },
  emptyCropText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  emptyCropAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentPale,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyCropSub: { fontSize: 14, color: COLORS.accent, fontWeight: "700" },

  // ── Crop detail ──
  cropDetailCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cropDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cropDetailEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primaryPale,
    justifyContent: "center",
    alignItems: "center",
  },
  cropDetailEmoji: { fontSize: 28 },
  cropDetailName: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  cropDetailMeta: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  editIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primaryPale,
    justifyContent: "center",
    alignItems: "center",
  },

  cropDetailStats: { flexDirection: "row", gap: 8, marginBottom: 16 },
  cropStatBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00000008",
  },
  cropStatIcon: { fontSize: 18, marginBottom: 5 },
  cropStatValue: { fontSize: 14, fontWeight: "900", marginBottom: 3 },
  cropStatLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },

  cropDetailActions: { flexDirection: "row", gap: 10 },
  cropDetailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00000008",
  },
  cropDetailBtnText: { fontSize: 13, fontWeight: "800" },

  // ── Transactions ──
  transactionList: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  transactionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  transactionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionInfo: { flex: 1 },
  transactionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  transactionCrop: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  transactionAmountWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  transactionAmount: { fontSize: 15, fontWeight: "900" },
});

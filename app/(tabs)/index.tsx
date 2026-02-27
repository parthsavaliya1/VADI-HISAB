/**
 * FILE: app/(tabs)/index.tsx
 *
 * ✅ New style system from the other app (warm earthy tones, refined cards)
 * ✅ ઝડપી કામ section REMOVED
 * ✅ New "ખર્ચ ઉમેરો" section — same layout as Selected Crop Detail
 *    → Tap → Crop picker bottom sheet → select crop → goes to add-expense
 * ✅ Dynamic profile (name, village, land) from getMyProfile()
 * ✅ Sticky mini header on scroll
 * ✅ PressableCard spring animations
 */

import { useProfile } from "@/contexts/ProfileContext";
import { getCrops, getMyProfile, type Crop } from "@/utils/api";
// ⚠️ Change to "@/services/api" if that is your import path

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height: SCREEN_H } = Dimensions.get("window");

// ─── Color System (from your other app) ──────────────────────────────────────
const C = {
  primary: "#8B4513",
  primaryLight: "#A0522D",
  primaryMid: "#C4743A",
  primaryPale: "#F5DEB3",

  accent: "#5A8A5F",
  accentLight: "#7AAD7F",
  accentPale: "#E8F5E9",

  gold: "#D4A017",
  goldLight: "#F0C842",
  goldPale: "#FFF8E1",

  bg: "#FBF7F0",
  surface: "#FFFFFF",
  surfaceWarm: "#FFF9F2",

  textPrimary: "#2C1810",
  textSecondary: "#6B4C3B",
  textMuted: "#A08070",
  textOnDark: "#FFFFFF",
  textOnDarkSub: "#F5DEB3",

  income: "#2E7D32",
  incomePale: "#E8F5E9",
  expense: "#C62828",
  expensePale: "#FFEBEE",
  neutral: "#1565C0",
  neutralPale: "#E3F2FD",

  border: "#E8D5C0",
  borderLight: "#F0E8DC",
};

// ─── Static data ──────────────────────────────────────────────────────────────
const WEATHER = {
  temp: "28°C",
  condition: "આંશિક વાદળ",
  humidity: "68%",
  wind: "14 km/h",
};

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
  [C.primaryMid, C.primary],
  [C.accent, "#3D6B42"],
  [C.gold, "#B8860B"],
  ["#1976D2", "#0D47A1"],
  ["#7B1FA2", "#4A148C"],
];

const HEADER_MAX = 220;
const HEADER_MIN = 80;
const STICKY_THRESHOLD = HEADER_MAX - HEADER_MIN;

// ─── Animated counter ─────────────────────────────────────────────────────────
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

// ─── Skeleton loader ──────────────────────────────────────────────────────────
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

// ─── Spring-press card ────────────────────────────────────────────────────────
function PressableCard({ onPress, style, children }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
    }).start();
  const onOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();
  // Extract flex from style so the TouchableOpacity container also stretches
  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style)
    : (style ?? {});
  const { flex, width, alignSelf, ...restStyle } = flatStyle;
  const containerStyle: any = {};
  if (flex !== undefined) containerStyle.flex = flex;
  if (width !== undefined) containerStyle.width = width;
  if (alignSelf !== undefined) containerStyle.alignSelf = alignSelf;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      style={Object.keys(containerStyle).length ? containerStyle : undefined}
    >
      <Animated.View style={[restStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Crop Picker Bottom Sheet ─────────────────────────────────────────────────
function CropPickerModal({
  visible,
  crops,
  onSelect,
  onClose,
  type,
}: {
  visible: boolean;
  crops: Crop[];
  onSelect: (crop: Crop) => void;
  onClose: () => void;
  type: "expense" | "income";
}) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [visible]);

  const isExpense = type === "expense";
  const accentColor = isExpense ? C.expense : C.income;
  const accentPale = isExpense ? C.expensePale : C.incomePale;
  const icon = isExpense ? "remove-circle" : "add-circle";
  const title = isExpense ? "💸 ખર્ચ ઉમેરો" : "💰 આવક ઉમેરો";
  const subtitle = "પહેલા પાક પસંદ કરો";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle bar */}
        <View style={styles.sheetHandle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Text style={styles.sheetSubtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Crop list */}
        {crops.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Text style={styles.sheetEmptyEmoji}>🌱</Text>
            <Text style={styles.sheetEmptyText}>કોઈ પાક નથી</Text>
            <TouchableOpacity
              style={[styles.sheetEmptyBtn, { backgroundColor: accentPale }]}
              onPress={() => {
                onClose();
                router.push("/crop/add-crop");
              }}
            >
              <Text style={[styles.sheetEmptyBtnText, { color: accentColor }]}>
                + નવો પાક ઉમેરો
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {crops.map((crop, i) => {
              const colors = CROP_COLORS[i % CROP_COLORS.length];
              return (
                <TouchableOpacity
                  key={crop._id}
                  style={styles.sheetCropRow}
                  onPress={() => onSelect(crop)}
                  activeOpacity={0.75}
                >
                  {/* Emoji badge with gradient */}
                  <LinearGradient
                    colors={colors}
                    style={styles.sheetCropEmojiBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={{ fontSize: 22 }}>
                      {crop.cropEmoji ?? "🌱"}
                    </Text>
                  </LinearGradient>

                  {/* Crop info */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetCropName}>{crop.cropName}</Text>
                    <Text style={styles.sheetCropMeta}>
                      {crop.season === "Kharif"
                        ? "☔ ખરીફ"
                        : crop.season === "Rabi"
                          ? "❄️ રવી"
                          : "☀️ ઉનાળો"}
                      {" · "}
                      <Text style={styles.bighaFont}>{crop.area} </Text>
                      {crop.areaUnit ?? "Bigha"}
                    </Text>
                  </View>

                  {/* Status badge */}
                  <View
                    style={[
                      styles.sheetCropStatus,
                      {
                        backgroundColor:
                          crop.status === "Active" ? C.incomePale : C.goldPale,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDotSmall,
                        {
                          backgroundColor:
                            crop.status === "Active" ? C.income : C.gold,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.sheetCropStatusText,
                        {
                          color: crop.status === "Active" ? C.income : C.gold,
                        },
                      ]}
                    >
                      {crop.status === "Active"
                        ? "સક્રિય"
                        : crop.status === "Harvested"
                          ? "લણણી"
                          : "બંધ"}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={accentColor}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Expense Quick Card (mirrors crop detail card style) ──────────────────────
function ExpenseSection({
  crops,
  onAddExpense,
  onAddIncome,
}: {
  crops: Crop[];
  onAddExpense: () => void;
  onAddIncome: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>
        ⚡ ઝડપી કામ
      </Text>

      {/* Top row: Expense + Income side by side */}
      <View style={styles.qaTopRow}>
        {/* ── ખર્ચ ઉમેરો ── */}
        <PressableCard onPress={onAddExpense} style={styles.qaHalfCard}>
          <LinearGradient
            colors={[C.expense, "#E53935"]}
            style={styles.qaHalfGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.qaHalfDecor} />
            <View style={styles.qaFullLeft}>
              <View style={styles.qaHalfIconWrap}>
                <Ionicons name="remove-circle-outline" size={26} color="#fff" />
              </View>
              <View>
                <Text style={styles.qaHalfLabel}>ખર્ચ</Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="rgba(255,255,255,0.7)"
            />
          </LinearGradient>
        </PressableCard>

        {/* ── આવક ઉમેરો ── */}
        <PressableCard onPress={onAddIncome} style={styles.qaHalfCard}>
          <LinearGradient
            colors={[C.income, "#2E7D32"]}
            style={styles.qaHalfGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.qaHalfDecor} />
            <View style={styles.qaFullLeft}>
              <View style={styles.qaHalfIconWrap}>
                <Ionicons name="add-circle-outline" size={26} color="#fff" />
              </View>
              <View>
                <Text style={styles.qaHalfLabel}>આવક</Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="rgba(255,255,255,0.7)"
            />
          </LinearGradient>
        </PressableCard>
      </View>

      {/* Bottom row: Full-width Crop button */}
      <PressableCard
        onPress={() => router.push("/crop/add-crop")}
        style={styles.qaFullCard}
      >
        <LinearGradient
          colors={[C.primaryMid, C.primary]}
          style={styles.qaFullGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.qaFullDecor} />
          <View style={styles.qaFullLeft}>
            <View style={styles.qaFullIconWrap}>
              <Ionicons name="leaf" size={26} color="#fff" />
            </View>
            <View>
              <Text style={styles.qaFullLabel}>નવો પાક ઉમેરો</Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.7)"
          />
        </LinearGradient>
      </PressableCard>
    </View>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState(0);
  const { profile, setProfile } = useProfile();

  // Crop picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"expense" | "income">("expense");

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

  // Derived profile fields
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

  // Header scroll animations
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

  // Crop picker callbacks
  const openExpensePicker = () => {
    setPickerType("expense");
    setPickerVisible(true);
  };
  const openIncomePicker = () => {
    setPickerType("income");
    setPickerVisible(true);
  };

  const handleCropSelected = (crop: Crop) => {
    setPickerVisible(false);
    const route =
      pickerType === "expense"
        ? `/expense/add-expense?cropId=${crop._id}`
        : `/expense/add-expense?type=income&cropId=${crop._id}`;
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* ── Sticky mini header (appears on scroll) ── */}
      <Animated.View
        style={[styles.stickyHeader, { opacity: stickyOpacity, paddingTop }]}
      >
        <LinearGradient
          colors={[C.primary, C.primaryLight]}
          style={styles.stickyGradient}
        >
          <View style={styles.stickyContent}>
            <Text style={styles.stickyTitle}>{farmerName || "ડૅશબોર્ડ"}</Text>
            <View style={styles.stickyRight}>
              <TouchableOpacity style={styles.notifBtn}>
                <Ionicons name="notifications" size={22} color={C.textOnDark} />
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

      {/* ── Collapsible full header ── */}
      <Animated.View style={[styles.headerWrapper, { height: headerHeight }]}>
        <LinearGradient
          colors={[C.primary, C.primaryLight, C.primaryMid]}
          style={[styles.header, { paddingTop }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
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
                      color={C.textOnDarkSub}
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
                    color={C.textOnDark}
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

            {/* Weather bar */}
            <View style={styles.weatherBar}>
              <View style={styles.weatherLeft}>
                <Ionicons name="partly-sunny" size={26} color={C.goldLight} />
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

      {/* ── Scrollable content ── */}
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
                  ? [C.accent, "#3D6B42", "#2E5533"]
                  : [C.expense, "#B71C1C", "#7F0000"]
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
                {[
                  {
                    icon: "arrow-up-circle",
                    label: "આવક",
                    value: totalIncome,
                    iconColor: C.incomePale,
                  },
                  {
                    icon: "arrow-down-circle",
                    label: "ખર્ચ",
                    value: totalExpense,
                    iconColor: "#FFCDD2",
                  },
                  {
                    icon: "leaf",
                    label: "પાક",
                    value: crops.length,
                    iconColor: C.goldLight,
                    isCount: true,
                  },
                ].map((item, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <View style={styles.profitDivider} />}
                    <View style={styles.profitSubItem}>
                      <View style={styles.profitSubIconBg}>
                        <Ionicons
                          name={item.icon as any}
                          size={16}
                          color={item.iconColor}
                        />
                      </View>
                      <View>
                        <Text style={styles.profitSubCaption}>
                          {item.label}
                        </Text>
                        <Text style={styles.profitSubValue}>
                          {item.isCount
                            ? `${item.value} નંગ`
                            : `₹${item.value.toLocaleString("en-IN")}`}
                        </Text>
                      </View>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </LinearGradient>
          </PressableCard>
        </Animated.View>

        {/* ── Expense Section (new — with crop picker) ── */}
        <ExpenseSection
          crops={crops}
          onAddExpense={openExpensePicker}
          onAddIncome={openIncomePicker}
        />

        {/* ── My Crops ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🌱 મારા પાક</Text>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/crop" as any)}
            >
              <Text style={styles.seeAll}>બધા જુઓ</Text>
              <Ionicons name="chevron-forward" size={14} color={C.accent} />
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
                <Ionicons name="add" size={16} color={C.accent} />
                <Text style={styles.emptyCropSub}>નવો પાક ઉમેરો</Text>
              </View>
            </PressableCard>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {crops.slice(0, 5).map((crop, i) => {
                const colors = CROP_COLORS[i % CROP_COLORS.length];
                const progress =
                  (crop as any).progress ?? Math.min(90, 30 + i * 20);
                const isSel = selectedCrop === i;
                return (
                  <PressableCard
                    key={crop._id}
                    onPress={() => setSelectedCrop(i)}
                    style={[styles.cropCard, isSel && styles.cropCardSelected]}
                  >
                    <LinearGradient
                      colors={colors}
                      style={styles.cropCardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isSel && <View style={styles.cropSelectedRing} />}
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
                                    ? C.income
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
                            { width: `${progress}%` as any },
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
                      <Text style={{ fontSize: 28 }}>
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
                            : "ઉનાળો"}
                        {" · "}
                        {c.area} {c.areaUnit}
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
                        color={C.primaryMid}
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
                        color: C.income,
                        bg: C.incomePale,
                      },
                      {
                        icon: "📉",
                        val: expense,
                        label: "કુલ ખર્ચ",
                        color: C.expense,
                        bg: C.expensePale,
                      },
                      {
                        icon: profit >= 0 ? "📈" : "⚠️",
                        val: profit,
                        label: "ચોખ્ખો નફો",
                        color: profit >= 0 ? C.neutral : "#E65100",
                        bg: profit >= 0 ? C.neutralPale : "#FFF3E0",
                      },
                    ].map((s, idx) => (
                      <View
                        key={idx}
                        style={[styles.cropStatBox, { backgroundColor: s.bg }]}
                      >
                        <Text style={styles.cropStatIcon}>{s.icon}</Text>
                        <Text
                          style={[styles.cropStatValue, { color: s.color }]}
                        >
                          {profit < 0 && idx === 2 ? "-" : ""}₹
                          {Math.abs(s.val).toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.cropStatLabel}>{s.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={styles.cropDetailActions}>
                    <PressableCard
                      onPress={() =>
                        router.push(
                          `/expense/add-expense?cropId=${c._id}` as any,
                        )
                      }
                      style={[
                        styles.cropDetailBtn,
                        { backgroundColor: C.expensePale },
                      ]}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={18}
                        color={C.expense}
                      />
                      <Text
                        style={[styles.cropDetailBtnText, { color: C.expense }]}
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
                        { backgroundColor: C.incomePale },
                      ]}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color={C.income}
                      />
                      <Text
                        style={[styles.cropDetailBtnText, { color: C.income }]}
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
              <Ionicons name="chevron-forward" size={14} color={C.accent} />
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
                        t.type === "income" ? C.incomePale : C.expensePale,
                    },
                  ]}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={20}
                    color={t.type === "income" ? C.income : C.expense}
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
                        color: t.type === "income" ? C.income : C.expense,
                      },
                    ]}
                  >
                    {t.amount > 0 ? "+" : ""}₹
                    {Math.abs(t.amount).toLocaleString("en-IN")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={C.textMuted}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {/* ── Crop Picker Bottom Sheet Modal ── */}
      <CropPickerModal
        visible={pickerVisible}
        crops={crops}
        type={pickerType}
        onSelect={handleCropSelected}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Sticky header
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
    color: C.textOnDark,
    flex: 1,
  },
  stickyRight: { flexDirection: "row", alignItems: "center", gap: 10 },

  // Collapsible header
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
    backgroundColor: C.goldLight + "20",
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
    color: C.textOnDarkSub,
    marginBottom: 2,
    fontWeight: "500",
  },
  farmerName: {
    fontSize: 26,
    fontWeight: "800",
    color: C.textOnDark,
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationText: { fontSize: 13, color: C.textOnDarkSub },
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
    backgroundColor: C.goldLight,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.goldPale,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: C.goldLight,
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: C.primary },
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
  weatherTemp: { fontSize: 18, fontWeight: "700", color: C.textOnDark },
  weatherCond: { fontSize: 11, color: C.textOnDarkSub, marginTop: 1 },
  weatherStats: { flexDirection: "row", gap: 16 },
  weatherStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  weatherStatText: { fontSize: 12, color: "#93C5FD", fontWeight: "500" },

  // Content
  scrollContent: { paddingTop: 20 },
  section: { marginHorizontal: 16, marginBottom: 22 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.textPrimary },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { fontSize: 14, color: C.accent, fontWeight: "700" },

  // Profit card
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
    color: C.textOnDark,
    marginBottom: 6,
  },
  netProfitAmount: {
    fontSize: 44,
    fontWeight: "900",
    color: C.textOnDark,
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
    color: C.textOnDark,
    fontWeight: "700",
    marginTop: 1,
  },
  profitDivider: { width: 1, height: 32, backgroundColor: "#ffffff25" },

  // Crops
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: C.goldLight,
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
    color: C.textOnDark,
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
  progressFill: { height: 5, backgroundColor: C.textOnDark, borderRadius: 3 },
  progressLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },

  // Empty crop
  emptyCropCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  emptyCropEmoji: { fontSize: 48, marginBottom: 10 },
  emptyCropText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 8,
  },
  emptyCropAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.accentPale,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyCropSub: { fontSize: 14, color: C.accent, fontWeight: "700" },

  // Crop detail
  cropDetailCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 18,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  cropDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  cropDetailEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.primaryPale,
    justifyContent: "center",
    alignItems: "center",
  },
  cropDetailName: { fontSize: 17, fontWeight: "800", color: C.textPrimary },
  cropDetailMeta: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  editIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.primaryPale,
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
    color: C.textMuted,
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

  // Expense section card
  expenseCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 18,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  expenseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  expenseCardEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.goldPale,
    justifyContent: "center",
    alignItems: "center",
  },
  expenseCardTitle: { fontSize: 17, fontWeight: "800", color: C.textPrimary },
  expenseCardSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  expenseStatsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  expenseStatBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00000008",
  },
  expenseStatIcon: { fontSize: 18, marginBottom: 5 },
  expenseStatValue: { fontSize: 14, fontWeight: "900", marginBottom: 3 },
  expenseStatLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  expenseActions: { flexDirection: "row", gap: 10 },
  expenseActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00000008",
  },
  expenseActionText: { fontSize: 14, fontWeight: "800" },

  // Transactions
  transactionList: {
    backgroundColor: C.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderLight,
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
  transactionBorder: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  transactionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionInfo: { flex: 1 },
  transactionLabel: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  transactionCrop: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  transactionAmountWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  transactionAmount: { fontSize: 15, fontWeight: "900" },

  // Crop picker modal
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_H * 0.75,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary },
  sheetSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 3 },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },

  // Sheet crop rows
  sheetCropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  sheetCropEmojiBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCropName: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  sheetCropMeta: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 3,
    fontWeight: "500",
  },
  bighaFont: {
    fontSize: 12,
    color: C.textPrimary,
    marginTop: 3,
    fontWeight: "800",
  },
  sheetCropStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sheetCropStatusText: { fontSize: 11, fontWeight: "700" },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },

  // Sheet empty state
  sheetEmpty: { alignItems: "center", paddingVertical: 40 },
  sheetEmptyEmoji: { fontSize: 52, marginBottom: 14 },
  sheetEmptyText: {
    fontSize: 17,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 16,
  },
  sheetEmptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sheetEmptyBtnText: { fontSize: 14, fontWeight: "800" },

  // Quick actions redesigned
  qaTopRow: { flexDirection: "row", gap: 12, marginBottom: 12 },

  qaHalfCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  qaHalfGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: "relative",
  },
  qaHalfDecor: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ffffff18",
    top: -30,
    right: -20,
  },
  qaHalfIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  qaHalfLabel: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 2,
  },
  qaHalfSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },

  qaFullCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  qaFullGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: "relative",
  },
  qaFullDecor: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ffffff12",
    top: -40,
    right: 40,
  },
  qaFullLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  qaFullIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  qaFullLabel: { fontSize: 20, fontWeight: "800", color: "#fff" },
  qaFullSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    fontWeight: "500",
  },
});

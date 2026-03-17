/**
 * FILE: app/(auth)/login.tsx
 *
 * Design aligned with main app (index.tsx) — light green palette, consistent cards & inputs.
 * Logo: gradient circle, decorative rings, scale/rotate animations.
 */

import translations from "@/translations.json";
import { getFriendlyErrorMessage, sendOtp } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");
const LANG = "gu" as const;
const t = translations[LANG].login;

// ─── Main app palette (matches index.tsx) ───────────────────────────────────────
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
  gold: "#F9A825",
  goldPale: "#FFFDE7",
  white: "#FFFFFF",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

export default function Login() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  // ── useNativeDriver: true — transform only ────────────────────────────────
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(50)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(70)).current;
  const inputScale = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnShine = useRef(new Animated.Value(-width)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(0)).current;
  const wheatAnims = useRef(
    Array(5)
      .fill(0)
      .map(() => new Animated.Value(0)),
  ).current;
  const digitAnims = useRef(
    Array(10)
      .fill(0)
      .map(() => new Animated.Value(1)),
  ).current;

  const insets = useSafeAreaInsets();

  // ── useNativeDriver: false — style props (color/border) ───────────────────
  const borderAnim = useRef(new Animated.Value(0)).current; // isolated, no conflict

  const isValid = phone.length === 10;

  useEffect(() => {
    // Entrance — all native driver
    Animated.stagger(130, [
      Animated.parallel([
        Animated.timing(heroFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(heroSlide, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.back(1.3)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 750,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Wheat sway — native driver
    wheatAnims.forEach((a, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(a, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: -1,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, []);

  useEffect(() => {
    if (isValid) {
      // Checkmark pop — native driver
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 4,
          tension: 220,
          useNativeDriver: true,
        }),
        Animated.spring(checkRotate, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
      // Shine sweep — native driver
      btnShine.setValue(-width);
      Animated.timing(btnShine, {
        toValue: width * 2,
        duration: 750,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(checkScale, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      checkRotate.setValue(0);
    }
  }, [isValid]);

  const onFocusInput = () => {
    setFocused(true);
    // Scale (native) — called independently, NOT in parallel with border
    Animated.spring(inputScale, {
      toValue: 1.015,
      friction: 8,
      useNativeDriver: true,
    }).start();
    // Border (non-native) — separate call, no conflict
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const onBlurInput = () => {
    setFocused(false);
    // Scale (native)
    Animated.spring(inputScale, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
    // Border (non-native)
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleChangeText = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 10);
    const prev = phone.length;
    setPhone(digits);
    if (digits.length > prev && digits.length <= 10) {
      const i = digits.length - 1;
      Animated.sequence([
        Animated.timing(digitAnims[i], {
          toValue: 1.6,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(digitAnims[i], {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
      if (digits.length === 10) Keyboard.dismiss();
    }
  };

  const onPressInBtn = () =>
    Animated.spring(btnScale, {
      toValue: 0.94,
      friction: 10,
      useNativeDriver: true,
    }).start();
  const onPressOutBtn = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();

  // Trial bypass: use this number to skip real OTP and go to profile (OTP screen will accept 123456)
  const TRIAL_PHONE = "9999999999";

  const handleSendOtp = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      if (phone === TRIAL_PHONE) {
        router.push({
          pathname: "/(auth)/otp",
          params: { phone, sessionId: "trial" },
        });
        setLoading(false);
        return;
      }
      const data = await sendOtp(phone);
      router.push({
        pathname: "/(auth)/otp",
        params: { phone, sessionId: data.sessionId },
      });
    } catch (err: any) {
      Alert.alert(t.errTitle, getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.green700],
  });
  const checkSpin = checkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-45deg", "0deg"],
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={["#FAFDFA", "#F5F9F5", "#FAFDFA"]}
          style={styles.container}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <StatusBar barStyle="dark-content" backgroundColor="#FAFDFA" />
          <View style={styles.circle1} pointerEvents="none" />
          <View style={styles.circle2} pointerEvents="none" />
          <View style={styles.circle3} pointerEvents="none" />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.kav}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <ScrollView
  style={styles.scrollView}
  contentContainerStyle={[
    styles.scrollContent,
    { paddingBottom: 24 + insets.bottom },
  ]}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>
              <View style={styles.inner}>
                {/* ── Side decorations (left & right) ── */}
                <View style={styles.sideDecoLeft} pointerEvents="none">
                  <View style={styles.sideDecoCircle} />
                  <View style={[styles.sideDecoCircle, styles.sideDecoCircleSmall]} />
                  <View style={[styles.sideDecoCircle, styles.sideDecoCircleDot]} />
                </View>
                <View style={styles.sideDecoRight} pointerEvents="none">
                  <View style={styles.sideDecoCircle} />
                  <View style={[styles.sideDecoCircle, styles.sideDecoCircleSmall, styles.sideDecoRightIndent]} />
                  <View style={[styles.sideDecoCircle, styles.sideDecoCircleDot, styles.sideDecoRightIndentDot]} />
                </View>

                {/* ── Logo Section ── */}
                <Animated.View
                  style={[
                    styles.logoContainer,
                    {
                      opacity: heroFade,
                      transform: [{ translateY: heroSlide }],
                    },
                  ]}
                >
                  <Image
                    source={require("../../assets/vadi-logo.png")}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </Animated.View>

                <Animated.View
                  style={[
                    styles.taglineContainer,
                    { opacity: heroFade, transform: [{ translateY: heroSlide }] },
                  ]}
                >
                  <Text style={styles.brandText}>🌾 {t.tagline} 🌾</Text>
                </Animated.View>

          {/* ── Card ── */}
          <Animated.View
            style={[
              styles.card,
              { opacity: cardFade, transform: [{ translateY: cardSlide }] },
            ]}
          >
            <LinearGradient
              colors={[C.green700, C.green500, C.green400]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardBar}
            />

            <Text style={styles.cardTitle}>મોબાઈલ નંબર દાખલ કરો</Text>

            {/* Scale wrapper — native driver ✅ */}
            <Animated.View style={{ transform: [{ scale: inputScale }] }}>
              {/* Border wrapper — non-native driver ✅  (separate Animated.View) */}
              <Animated.View
                style={[
                  styles.inputWrapper,
                  styles.inputContainer,
                  { borderColor },
                  phone && styles.inputActive,
                ]}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="call" size={18} color="#4CAF50" />
                </View>
                <View style={styles.inputContent}>
                  <View style={styles.inputRow}>
                    <Text style={styles.prefixTxt}>+91</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t.placeholder}
                      placeholderTextColor={C.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                      value={phone}
                      onChangeText={handleChangeText}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                      selectionColor={C.green700}
                    />
                  </View>
                </View>
                {isValid && (
                  <Animated.View
                    style={[
                      styles.checkCircle,
                      {
                        transform: [
                          { scale: checkScale },
                          { rotate: checkSpin },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </Animated.View>
                )}
              </Animated.View>
            </Animated.View>

            {/* Progress dots */}
            <View style={styles.dotsRow}>
              {Array(10)
                .fill(0)
                .map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dot,
                      i < phone.length ? styles.dotOn : styles.dotOff,
                      { transform: [{ scale: digitAnims[i] }] },
                    ]}
                  />
                ))}
            </View>
            <Text style={styles.dotHint}>{phone.length}/10 અંક</Text>

            {/* Button */}
            <Animated.View
              style={{ transform: [{ scale: btnScale }], marginBottom: 14 }}
            >
              <Pressable
                onPressIn={onPressInBtn}
                onPressOut={onPressOutBtn}
                onPress={handleSendOtp}
                disabled={!isValid || loading}
                style={styles.btn}
              >
                <LinearGradient
                  colors={
                    isValid
                      ? [C.green700, C.green500, C.green400]
                      : [C.green100, C.green50]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnGrad}
                >
                  {isValid && (
                    <Animated.View
                      style={[
                        styles.shine,
                        { transform: [{ translateX: btnShine }] },
                      ]}
                    />
                  )}
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.btnRow}>
                      <Text
                        style={[styles.btnTxt, !isValid && styles.btnTxtOff]}
                      >
                        {t.sendOtpBtn}
                      </Text>
                      <Text
                        style={[styles.btnArrow, !isValid && styles.btnTxtOff]}
                      >
                        →
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View style={styles.hintRow}>
              <Text style={styles.hintTxt}>🔒 {t.hint}</Text>
            </View>
          </Animated.View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Animated.View
  style={[
    styles.bottomTagWrap,
    {
      opacity: heroFade,
      bottom: insets.bottom + 12, // ✅ ADD THIS LINE
    },
  ]}
>            <Text style={styles.brandTextBottom}>🌾 ખેતી · હિસાબ · સમૃદ્ધ 🌾</Text>
          </Animated.View>
        </LinearGradient>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAFDFA" },
  container: { flex: 1 },
  kav: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
  },

  // Logo (minimal space below)
  logoContainer: {
    alignItems: "center",
    marginBottom: 0,
  },
  logoImage: {
    width: 300,
    height: 300,
    backgroundColor: "transparent",
  },
  taglineContainer: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  brandText: {
    fontSize: 18,
    fontWeight: "700",
    color: C.green900,
    letterSpacing: 0.6,
  },
  sideDecoLeft: {
    position: "absolute",
    left: 0,
    top: height * 0.12,
    width: 60,
    alignItems: "flex-start",
    gap: 8,
  },
  sideDecoRight: {
    position: "absolute",
    right: 0,
    top: height * 0.12,
    width: 60,
    alignItems: "flex-end",
    gap: 8,
  },
  sideDecoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(46,125,50,0.12)",
  },
  sideDecoCircleSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 12,
    backgroundColor: "rgba(46,125,50,0.18)",
  },
  sideDecoCircleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 20,
    backgroundColor: "rgba(46,125,50,0.2)",
  },
  sideDecoRightIndent: { marginLeft: 0, marginRight: 12 },
  sideDecoRightIndentDot: { marginLeft: 0, marginRight: 20 },
  bottomTagWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  brandTextBottom: {
    fontSize: 18,
    fontWeight: "700",
    color: C.green900,
    letterSpacing: 0.6,
    textAlign: "center",
  },

  titleContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  appName: {
    fontSize: 34,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 8,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tagline: { fontSize: 17, color: C.textSecondary },
  emoji: { fontSize: 16 },
  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(200,230,201,0.25)",
    top: -80,
    right: -70,
  },
  circle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(200,230,201,0.15)",
    bottom: 40,
    left: -50,
  },
  circle3: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(232,245,233,0.5)",
    top: height * 0.42,
    left: 24,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingTop: 0,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 0,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: C.borderLight,
    shadowColor: "#1A2E1C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBar: { height: 5, marginHorizontal: -24, marginBottom: 22 },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: C.textPrimary,
    marginBottom: 16,
  },
  cardSub: {
    fontSize: 15,
    color: C.textSecondary,
    marginBottom: 18,
    fontWeight: "500",
  },

  inputWrapper: { width: "100%", marginBottom: 14 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  inputActive: {
    borderColor: "#4CAF50",
    backgroundColor: C.surfaceGreen,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContent: { flex: 1, gap: 2 },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
    prefixTxt: {
    fontSize: 19,

    fontWeight: "600",
    color: C.textPrimary,
    letterSpacing: 1.5,

  },
  input: {
    flex: 1,
    fontSize: 19,
    color: C.textPrimary,
    paddingLeft: 6, // ✅ ADD THIS
    paddingVertical: 0,
    fontWeight: "600",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },

  dotsRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  dot: { flex: 1, height: 5, borderRadius: 3 },
  dotOn: { backgroundColor: C.green700 },
  dotOff: { backgroundColor: C.green100 },
  dotHint: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "right",
    marginBottom: 20,
    fontWeight: "600",
  },

  btn: { borderRadius: 18, overflow: "hidden" },
  btnGrad: {
    paddingVertical: 19,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: "#ffffff22",
    transform: [{ skewX: "-20deg" }],
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnTxt: {
    color: C.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  btnArrow: { color: C.goldPale, fontSize: 24, fontWeight: "900" },
  btnTxtOff: { color: C.textMuted },

  hintRow: { alignItems: "center" },
  hintTxt: { color: C.textMuted, fontSize: 13, fontWeight: "500" },
});

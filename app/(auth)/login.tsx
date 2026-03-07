/**
 * FILE: app/(auth)/login.tsx
 *
 * Design aligned with main app (index.tsx) — light green palette, consistent cards & inputs.
 */

import translations from "@/translations.json";
import { sendOtp } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
  Image,
} from "react-native";

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

  const handleSendOtp = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const data = await sendOtp(phone);
      router.push({
        pathname: "/(auth)/otp",
        params: { phone, sessionId: data.sessionId },
      });
    } catch (err: any) {
      Alert.alert(t.errTitle, err.message);
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
    <LinearGradient
      colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.inner}>
          {/* ── Hero ── */}
          <Animated.View
            style={[
              styles.heroBlock,
              { opacity: heroFade, transform: [{ translateY: heroSlide }] },
            ]}
          >
            <View style={styles.logoCircle}>
              <Image
                source={require("../../assets/vadi-logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>{t.appName}</Text>
            <Text style={styles.tagline}>{t.tagline}</Text>
            <View style={styles.wheatRow}>
              {["🌾", "🌱", "🌾", "🌱", "🌾"].map((e, i) => (
                <Animated.Text
                  key={i}
                  style={[
                    styles.wheatEmoji,
                    {
                      transform: [
                        {
                          rotate: wheatAnims[i].interpolate({
                            inputRange: [-1, 0, 1],
                            outputRange: ["-14deg", "0deg", "14deg"],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {e}
                </Animated.Text>
              ))}
            </View>
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

            <Text style={styles.cardTitle}>{t.label}</Text>
            <Text style={styles.cardSub}>
              તમારો ૧૦ અંકનો મોબાઈલ નંબર દાખલ કરો
            </Text>

            {/* Scale wrapper — native driver ✅ */}
            <Animated.View style={{ transform: [{ scale: inputScale }] }}>
              {/* Border wrapper — non-native driver ✅  (separate Animated.View) */}
              <Animated.View style={[styles.inputWrapper, { borderColor }]}>
                <View style={styles.prefix}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={styles.prefixTxt}>+91</Text>
                  <View style={styles.prefixDiv} />
                </View>
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
                <Animated.Text
                  style={[
                    styles.check,
                    {
                      transform: [{ scale: checkScale }, { rotate: checkSpin }],
                    },
                  ]}
                >
                  ✓
                </Animated.Text>
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

          <Animated.Text style={[styles.bottomTag, { opacity: heroFade }]}>
            🌾 ખેડૂત · ઉત્પાદક · સમૃદ્ધ 🌾
          </Animated.Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.green100 + "80",
    top: -80,
    right: -70,
  },
  circle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: C.green100 + "50",
    bottom: 40,
    left: -50,
  },
  circle3: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.green50 + "CC",
    top: height * 0.42,
    left: 24,
  },

  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  heroBlock: { alignItems: "center", marginBottom: 26 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: { width: 64, height: 64 },
  appName: {
    fontSize: 34,
    fontWeight: "900",
    color: C.textPrimary,
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 5,
    fontWeight: "500",
  },
  wheatRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  wheatEmoji: { fontSize: 22 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 0,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardBar: { height: 5, marginHorizontal: -22, marginBottom: 22 },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.textPrimary,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 18,
    fontWeight: "500",
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: C.surfaceGreen,
    marginBottom: 14,
  },
  prefix: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 7,
  },
  flag: { fontSize: 20 },
  prefixTxt: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  prefixDiv: {
    width: 1.5,
    height: 24,
    backgroundColor: C.border,
    marginLeft: 10,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: C.textPrimary,
    paddingVertical: 16,
    paddingRight: 8,
    letterSpacing: 3,
  },
  check: { fontSize: 22, color: C.income, paddingRight: 16, fontWeight: "900" },

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
    fontSize: 12,
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
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  btnArrow: { color: C.goldPale, fontSize: 22, fontWeight: "900" },
  btnTxtOff: { color: C.textMuted },

  hintRow: { alignItems: "center" },
  hintTxt: { color: C.textMuted, fontSize: 12, fontWeight: "500" },
  bottomTag: {
    textAlign: "center",
    color: C.textMuted,
    fontSize: 12,
    marginTop: 20,
    letterSpacing: 1,
  },
});

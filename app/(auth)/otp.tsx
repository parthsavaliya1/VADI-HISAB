/**
 * FILE: app/(auth)/otp.tsx
 *
 * FIXES:
 * ✅ Native driver conflicts resolved:
 *    - boxBorderAnim (color) → useNativeDriver: false, isolated
 *    - boxScale (transform)  → useNativeDriver: true, isolated
 *    - timerBarFill color    → useNativeDriver: false
 *    - NEVER mixed in same Animated.parallel
 * ✅ Light sky-blue + mint palette matching login
 */

import translations from "@/translations.json";
import { sendOtp, verifyOtp } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const OTP_LENGTH = 6;
const LANG = "gu" as const;
const t = translations[LANG].otp;

// ─── Same Light Palette ───────────────────────────────────────────────────────
const C = {
  grad1: "#1565A0",
  grad2: "#1976D2",
  grad3: "#2196F3",
  grad4: "#64B5F6",
  accent: "#F9A825",
  accentLight: "#FFD54F",
  mint: "#00897B",
  mintPale: "#E0F2F1",
  white: "#FFFFFF",
  inputBg: "#F0F8FF",
  textDark: "#0D1B2A",
  textMid: "#1A4A7A",
  textMuted: "#7AADD4",
  borderIdle: "#BDD9F0",
  borderFilled: "#1565A0",
  borderError: "#C62828",
  bgFilled: "#E8F4FF",
  bgError: "#FFEBEE",
  error: "#C62828",
  errorPale: "#FFEBEE",
};

export default function OTP() {
  const { phone, sessionId: initSessionId } = useLocalSearchParams<{
    phone: string;
    sessionId: string;
  }>();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [sessionId, setSessionId] = useState(initSessionId ?? "");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Native driver: true (transforms only) ────────────────────────────────
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(50)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(70)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnShine = useRef(new Animated.Value(-300)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(
    Array(OTP_LENGTH)
      .fill(0)
      .map(() => new Animated.Value(1)),
  ).current;
  const confetti = useRef(
    Array(8)
      .fill(0)
      .map(() => ({
        y: new Animated.Value(0),
        x: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
      })),
  ).current;

  // ── Native driver: false (color/border — ISOLATED, never mixed) ────────────
  // One value per box for border/bg color
  const boxFill = useRef(
    Array(OTP_LENGTH)
      .fill(0)
      .map(() => new Animated.Value(0)),
  ).current;
  // 0=idle, 1=filled, -1=error
  const timerAnim = useRef(new Animated.Value(1)).current; // width % — non-native

  useEffect(() => {
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
    ]).start(() => setTimeout(() => inputRefs.current[0]?.focus(), 100));

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 8,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Timer bar — non-native (width prop)
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: 30000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, []);

  useEffect(() => {
    if (resendTimer === 0) {
      setCanResend(true);
      return;
    }
    const id = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const isComplete = otp.every((d) => d !== "");

  useEffect(() => {
    if (isComplete) {
      btnShine.setValue(-300);
      Animated.timing(btnShine, {
        toValue: 600,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [isComplete]);

  // ── Box interactions ───────────────────────────────────────────────────────
  const animateBoxFill = (i: number, val: number) => {
    // ONLY non-native (color) — isolated call
    Animated.timing(boxFill[i], {
      toValue: val,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const animateBoxScale = (i: number) => {
    // ONLY native (scale) — isolated call
    Animated.sequence([
      Animated.timing(boxScale[i], {
        toValue: 1.2,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(boxScale[i], {
        toValue: 1,
        friction: 4,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleChange = (text: string, i: number) => {
    setError("");
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit) {
      animateBoxScale(i); // native
      animateBoxFill(i, 1); // non-native
      if (i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
    } else {
      animateBoxFill(i, 0); // non-native
    }
  };

  const handleKey = (key: string, i: number) => {
    if (key === "Backspace") {
      const next = [...otp];
      if (otp[i] === "" && i > 0) {
        next[i - 1] = "";
        setOtp(next);
        animateBoxFill(i - 1, 0);
        inputRefs.current[i - 1]?.focus();
      } else {
        next[i] = "";
        setOtp(next);
        animateBoxFill(i, 0);
      }
    }
  };

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: -14,
        duration: 65,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 14,
        duration: 65,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 65,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 65,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 65,
        useNativeDriver: true,
      }),
    ]).start();
    // Flash boxes red — non-native, isolated
    boxFill.forEach((a) => {
      Animated.sequence([
        Animated.timing(a, {
          toValue: -1,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(a, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    });
  };

  const launchConfetti = () => {
    confetti.forEach((conf, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const r = 70 + Math.random() * 50;
      // All transform — native
      Animated.parallel([
        Animated.timing(conf.opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(conf.scale, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(conf.x, {
          toValue: Math.cos(angle) * r,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(conf.y, {
          toValue: Math.sin(angle) * r - 30,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() =>
        Animated.timing(conf.opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(),
      );
    });
  };

  const resend = async () => {
    setLoading(true);
    try {
      const data = await sendOtp(phone);
      setSessionId(data.sessionId);
      setResendTimer(30);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(""));
      boxFill.forEach((a) => a.setValue(0));
      timerAnim.setValue(1);
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert(t.errTitle, err.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!isComplete) return;
    setVerifying(true);
    setError("");
    try {
      const data = await verifyOtp(phone, otp.join(""), sessionId);
      setSuccess(true);
      launchConfetti();
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => {
        if (!data.consentGiven) router.replace("/(auth)/consent");
        else if (!data.isProfileCompleted)
          router.replace("/(auth)/profile-setup");
        else router.replace("/(tabs)");
      }, 1400);
    } catch (err: any) {
      setError(t.errInvalid);
      setOtp(Array(OTP_LENGTH).fill(""));
      boxFill.forEach((a) => a.setValue(0));
      inputRefs.current[0]?.focus();
      shake();
    } finally {
      setVerifying(false);
    }
  };

  const timerWidth = timerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [C.error, C.accent, C.grad2],
  });
  const subtitle = t.subtitle.replace("{phone}", phone ?? "");
  const resendWait = t.resendWait.replace("{seconds}", String(resendTimer));

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={[C.grad1, C.grad2, C.grad3, C.grad4]}
        locations={[0, 0.3, 0.65, 1]}
        style={styles.container}
      >
        <View style={styles.circle1} />
        <View style={styles.circle2} />

        {/* ── Success Overlay ── */}
        {success && (
          <Animated.View
            style={[styles.successOverlay, { opacity: successOpacity }]}
          >
            {confetti.map((conf, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.confetti,
                  {
                    opacity: conf.opacity,
                    transform: [
                      { translateX: conf.x },
                      { translateY: conf.y },
                      { scale: conf.scale },
                    ],
                  },
                ]}
              >
                {["🌾", "✨", "🌱", "⭐", "💙", "🎉", "🌻", "🏆"][i]}
              </Animated.Text>
            ))}
            <Animated.View
              style={[
                styles.successBadge,
                { transform: [{ scale: successScale }] },
              ]}
            >
              <LinearGradient
                colors={[C.grad1, C.grad3]}
                style={styles.successGrad}
              >
                <Text style={styles.successEmoji}>✅</Text>
                <Text style={styles.successTxt}>{t.successMsg}</Text>
                <Text style={styles.successSub}>ખાતામાં પ્રવેશ...</Text>
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.inner}>
            {/* Back */}
            <Animated.View style={{ opacity: heroFade }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backTxt}>{t.changeNum}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Hero */}
            <Animated.View
              style={[
                styles.heroBlock,
                { opacity: heroFade, transform: [{ translateY: heroSlide }] },
              ]}
            >
              <Animated.Text
                style={[
                  styles.lockEmoji,
                  { transform: [{ translateY: floatAnim }] },
                ]}
              >
                🔐
              </Animated.Text>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <View style={styles.phonePill}>
                <Text style={styles.phonePillTxt}>📱 +91 {phone}</Text>
              </View>
            </Animated.View>

            {/* Card */}
            <Animated.View
              style={[
                styles.card,
                { opacity: cardFade, transform: [{ translateY: cardSlide }] },
              ]}
            >
              <LinearGradient
                colors={[C.grad1, C.grad3, C.accentLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBar}
              />
              <Text style={styles.cardTitle}>OTP દાખલ કરો</Text>

              {/* OTP Boxes */}
              <Animated.View
                style={[
                  styles.otpRow,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {Array(OTP_LENGTH)
                  .fill(0)
                  .map((_, i) => {
                    // Border & bg — non-native interpolations from boxFill[i]
                    const borderColor = boxFill[i].interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [
                        C.borderError,
                        C.borderIdle,
                        C.borderFilled,
                      ],
                    });
                    const bgColor = boxFill[i].interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [C.bgError, C.inputBg, C.bgFilled],
                    });
                    return (
                      // Scale wrapper (native) — separate from color wrapper (non-native)
                      <Animated.View
                        key={i}
                        style={[
                          styles.boxScaleWrap,
                          { transform: [{ scale: boxScale[i] }] },
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.otpBox,
                            { borderColor, backgroundColor: bgColor },
                          ]}
                        >
                          <TextInput
                            ref={(r) => (inputRefs.current[i] = r)}
                            style={[
                              styles.otpInput,
                              otp[i] ? styles.otpInputFilled : null,
                            ]}
                            keyboardType="numeric"
                            maxLength={1}
                            value={otp[i]}
                            onChangeText={(txt) => handleChange(txt, i)}
                            onKeyPress={({ nativeEvent }) =>
                              handleKey(nativeEvent.key, i)
                            }
                            selectionColor={C.grad1}
                            caretHidden
                          />
                        </Animated.View>
                      </Animated.View>
                    );
                  })}
              </Animated.View>

              {error ? (
                <Text style={styles.errorTxt}>⚠️ {error}</Text>
              ) : (
                <View style={{ height: 16 }} />
              )}

              {/* Timer */}
              <View style={styles.timerRow}>
                <View style={styles.timerBg}>
                  <Animated.View
                    style={[
                      styles.timerFill,
                      {
                        width: timerWidth as any,
                        backgroundColor: timerColor as any,
                      },
                    ]}
                  />
                </View>
                {!canResend && (
                  <Text style={styles.timerLbl}>⏳ {resendTimer}s</Text>
                )}
              </View>

              {/* Verify Button */}
              <Animated.View
                style={{ transform: [{ scale: btnScale }], marginBottom: 16 }}
              >
                <Pressable
                  onPressIn={() =>
                    Animated.spring(btnScale, {
                      toValue: 0.94,
                      friction: 10,
                      useNativeDriver: true,
                    }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(btnScale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start()
                  }
                  onPress={verify}
                  disabled={!isComplete || verifying || success}
                  style={styles.verifyBtn}
                >
                  <LinearGradient
                    colors={
                      isComplete
                        ? [C.grad1, C.grad2, C.grad3]
                        : ["#A8C8E0", "#BDD8EC"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.verifyGrad}
                  >
                    {isComplete && (
                      <Animated.View
                        style={[
                          styles.shine,
                          { transform: [{ translateX: btnShine }] },
                        ]}
                      />
                    )}
                    {verifying ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <View style={styles.btnRow}>
                        <Text
                          style={[
                            styles.verifyTxt,
                            !isComplete && styles.verifyTxtOff,
                          ]}
                        >
                          {t.verify}
                        </Text>
                        <Text
                          style={[
                            styles.verifyCheck,
                            !isComplete && styles.verifyTxtOff,
                          ]}
                        >
                          ✓
                        </Text>
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Divider */}
              <View style={styles.divRow}>
                <View style={styles.divLine} />
                <Text style={styles.divLbl}>{t.or}</Text>
                <View style={styles.divLine} />
              </View>

              {/* Resend */}
              {canResend ? (
                <TouchableOpacity
                  onPress={resend}
                  disabled={loading}
                  style={styles.resendBtn}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color={C.grad2} size="small" />
                  ) : (
                    <View style={styles.resendRow}>
                      <Text style={styles.resendIcon}>🔄</Text>
                      <Text style={styles.resendTxt}>{t.resend}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={styles.resendWait}>{resendWait}</Text>
              )}

              <Text style={styles.secureLbl}>🔒 {t.secure}</Text>
            </Animated.View>

            {/* Progress dots */}
            <Animated.View style={[styles.dotsRow, { opacity: heroFade }]}>
              {otp.map((d, i) => (
                <View
                  key={i}
                  style={[styles.dot, d ? styles.dotOn : styles.dotOff]}
                />
              ))}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#ffffff09",
    top: -90,
    right: -70,
  },
  circle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#ffffff07",
    bottom: 60,
    left: -50,
  },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,30,60,0.7)",
    zIndex: 99,
    justifyContent: "center",
    alignItems: "center",
  },
  successBadge: { borderRadius: 28, overflow: "hidden", elevation: 30 },
  successGrad: { padding: 40, alignItems: "center", minWidth: 220 },
  successEmoji: { fontSize: 60, marginBottom: 12 },
  successTxt: { fontSize: 22, fontWeight: "900", color: C.white },
  successSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 6 },
  confetti: { position: "absolute", fontSize: 22 },

  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingBottom: 20,
    paddingTop: 50,
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#ffffff18",
    marginBottom: 10,
  },
  backArrow: { fontSize: 18, color: C.white, fontWeight: "700" },
  backTxt: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" },

  heroBlock: { alignItems: "center", marginBottom: 22 },
  lockEmoji: { fontSize: 70, marginBottom: 10 },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: C.white,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    marginTop: 6,
    textAlign: "center",
  },
  phonePill: {
    marginTop: 10,
    backgroundColor: "#ffffff22",
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff30",
  },
  phonePillTxt: { color: C.white, fontSize: 14, fontWeight: "700" },

  card: {
    backgroundColor: C.white,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 0,
    elevation: 20,
    overflow: "hidden",
    shadowColor: "#0D1B2A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  cardBar: { height: 5, marginHorizontal: -22, marginBottom: 20 },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.textDark,
    marginBottom: 18,
  },

  otpRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  boxScaleWrap: { flex: 1 },
  otpBox: {
    borderWidth: 2.5,
    borderRadius: 16,
    aspectRatio: 0.82,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  otpInput: {
    fontSize: 26,
    fontWeight: "900",
    color: C.textDark,
    textAlign: "center",
    width: "100%",
    height: "100%",
  },
  otpInputFilled: { color: C.grad1 },

  errorTxt: {
    color: C.error,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "700",
    marginTop: 4,
  },

  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
    marginTop: 4,
  },
  timerBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#D0E8F8",
    borderRadius: 3,
    overflow: "hidden",
  },
  timerFill: { height: "100%", borderRadius: 3 },
  timerLbl: { fontSize: 13, color: C.textMid, fontWeight: "700", minWidth: 36 },

  verifyBtn: { borderRadius: 18, overflow: "hidden" },
  verifyGrad: {
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
  verifyTxt: {
    color: C.white,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  verifyCheck: { color: C.accentLight, fontSize: 22, fontWeight: "900" },
  verifyTxtOff: { color: "#88B8D8" },

  divRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  divLine: { flex: 1, height: 1, backgroundColor: "#D8EDF8" },
  divLbl: { color: C.textMuted, fontSize: 12 },

  resendBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: 14,
    backgroundColor: "#EEF6FF",
  },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resendIcon: { fontSize: 16 },
  resendTxt: { color: C.grad2, fontSize: 16, fontWeight: "800" },
  resendWait: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  secureLbl: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },

  dotsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOff: { backgroundColor: "rgba(255,255,255,0.3)" },
  dotOn: { backgroundColor: C.white },
});

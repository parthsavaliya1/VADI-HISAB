/**
 * FILE: app/(auth)/otp.tsx
 *
 * FIXES:
 * ✅ Native driver conflicts resolved
 * ✅ UI aligned with reference: clean layout, centered title, styled input/button
 */

import translations from "@/translations.json";
import { getFriendlyErrorMessage, sendOtp, verifyOtp } from "@/utils/api";
import { registerAndSyncPushToken } from "@/utils/pushNotifications";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const OTP_LENGTH = 6;
const LANG = "gu" as const;
const t = translations[LANG].otp;

// ─── Dashboard-matching palette ───────────────────────────────────────────────
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
  accent: "#F9A825",
  accentLight: "#FFFDE7",
  white: "#FFFFFF",
  inputBg: "#F1F8F1",
  borderIdle: "#EAF4EA",
  borderFilled: "#2E7D32",
  borderError: "#C62828",
  bgFilled: "#E8F5E9",
  bgError: "#FFEBEE",
  error: "#C62828",
  errorPale: "#FFEBEE",
};

export default function OTP() {
  const { phone, sessionId: initSessionId } = useLocalSearchParams<{
    phone: string;
    sessionId: string;
  }>();
  const { width } = Dimensions.get("window");
  const isWideScreen = width >= 900;
  const insets = useSafeAreaInsets();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [sessionId, setSessionId] = useState(initSessionId ?? "");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(300);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenOtpRef = useRef<TextInput>(null);

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
      duration: 300000,      easing: Easing.linear,
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
    boxScale[i].setValue(1.1);
    Animated.spring(boxScale[i], {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleChange = (text: string, i: number) => {
    setError("");
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
      if (otp[i] === digit) return; // 🔥 prevents extra re-renders

    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit) {
      animateBoxScale(i);
      animateBoxFill(i, 1);
      if (i < OTP_LENGTH - 1) {
        inputRefs.current[i + 1]?.focus();
      } else {
        Keyboard.dismiss();
      }
    } else {
      animateBoxFill(i, 0);
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

  const resend = async () => {
    setLoading(true);
    try {
      const data = await sendOtp(phone);
      setSessionId(data.sessionId);
      setResendTimer(300);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(""));
      boxFill.forEach((a) => a.setValue(0));
      timerAnim.setValue(1);
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: 300000, // 5 minutes        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert(t.errTitle, getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Trial bypass: use phone 9999999999 and OTP 123456 to go to profile-setup (no real API call)
  const TRIAL_PHONE = "9999999999";
  const TRIAL_OTP = "123456";

  const verify = async () => {
    if (!isComplete) return;
    setVerifying(true);
    setError("");
    try {
      const otpStr = otp.join("");
      const isTrial =
        phone === TRIAL_PHONE && sessionId === "trial" && otpStr === TRIAL_OTP;

      if (isTrial) {
        setSuccess(true);
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
          router.replace("/(auth)/profile-setup");
        }, 1400);
        setVerifying(false);
        return;
      }

      const data = await verifyOtp(phone, otpStr, sessionId);
      console.log("verify: data", data);
      await registerAndSyncPushToken();
      setSuccess(true);
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
        if (!data.isProfileCompleted) router.replace("/(auth)/profile-setup");
        else if (!data.consentGiven) router.replace("/(auth)/consent");
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
    outputRange: [C.error, C.accent, C.green700],
  });
  const subtitle = t.subtitle.replace("{phone}", phone ?? "");
  const resendWait = t.resendWait.replace("{seconds}", String(resendTimer));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={["#F6F7F2", "#E8F5E9", "#F5F7F2"]}
          style={styles.container}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.circle1} />
        <View style={styles.circle2} />

        {/* ── Success Overlay (minimal) ── */}
        {success && (
          <Animated.View
            style={[styles.successOverlay, { opacity: successOpacity }]}
          >
            <Animated.View
              style={[
                styles.successBadge,
                { transform: [{ scale: successScale }] },
              ]}
            >
              <Text style={styles.successTxt}>{t.successMsg}</Text>
            </Animated.View>
          </Animated.View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              { justifyContent: isWideScreen ? "center" : "flex-start" },
              // On wide screens we keep scroll disabled, so we must avoid
              // adding too much extra height at the bottom.
              { paddingBottom: (isWideScreen ? 24 : 44) + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isWideScreen}
          >
          <View style={[styles.inner, isWideScreen ? styles.innerWide : null]}>
            {/* Hero */}
            <Animated.View
              style={[
                styles.heroBlock,
                isWideScreen ? styles.heroBlockWide : null,
                { opacity: heroFade, transform: [{ translateY: heroSlide }] },
              ]}
            >
              <Animated.Text
                style={[
                  styles.lockEmoji,
                  isWideScreen ? styles.lockEmojiWide : null,
                  { transform: [{ translateY: floatAnim }] },
                ]}
              >
                🔐
              </Animated.Text>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={[styles.subtitle, isWideScreen ? styles.subtitleWide : null]}>
                {subtitle}
              </Text>
            </Animated.View>

            {/* Card */}
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
              <Text style={[styles.cardTitle, isWideScreen ? styles.cardTitleWide : null]}>
                OTP દાખલ કરો
              </Text>

              {/* Hidden input for SMS OTP autofill (iOS oneTimeCode / Android sms-otp) */}
              <TextInput
                style={styles.hiddenOtpInput}
                ref={hiddenOtpRef}
                defaultValue=""
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
                  if (digits.length >= OTP_LENGTH) {
                    const arr = digits.split("").slice(0, OTP_LENGTH);
                    setOtp(arr);
                    setError("");
                    arr.forEach((_, idx) => animateBoxFill(idx, 1));
                    Keyboard.dismiss();
                  }
                }}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                caretHidden
              />

              {/* OTP Boxes */}
              <Animated.View
                style={[
                  styles.otpRow,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {otp.map((_, i) => {
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
ref={(r) => {
  inputRefs.current[i] = r;
}}                            style={[
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
                            selectionColor={C.green700}
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
              <View style={[styles.timerRow, isWideScreen ? styles.timerRowWide : null]}>
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
                style={{
                  transform: [{ scale: btnScale }],
                  marginBottom: isWideScreen ? 12 : 16,
                }}
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
                        ? [C.green700, C.green500, C.green400]
                        : [C.green100, C.green50]
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
              <View style={[styles.divRow, isWideScreen ? styles.divRowWide : null]}>
                <View style={styles.divLine} />
                <Text style={styles.divLbl}>{t.or}</Text>
                <View style={styles.divLine} />
              </View>

              {/* Resend */}
              {canResend ? (
                <TouchableOpacity
                  onPress={resend}
                  disabled={loading}
                  style={[styles.resendBtn, isWideScreen ? styles.resendBtnWide : null]}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color={C.green700} size="small" />
                  ) : (
                    <Text style={styles.resendTxt}>{t.resend}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={[styles.resendWait, isWideScreen ? styles.resendWaitWide : null]}>
                  {resendWait}
                </Text>
              )}

              <Text style={[styles.secureLbl, isWideScreen ? styles.secureLblWide : null]}>
                🔒 {t.secure}
              </Text>

              {/* Change number link (reference style) */}
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.changeNumWrap, isWideScreen ? styles.changeNumWrapWide : null]}
                activeOpacity={0.7}
              >
                <Text style={styles.changeNumLink}>{t.changeNum}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Progress dots */}
            <Animated.View
              style={[
                styles.dotsRow,
                isWideScreen ? styles.dotsRowWide : null,
                { opacity: heroFade },
              ]}
            >
              {otp.map((d, i) => (
                <View
                  key={i}
                  style={[styles.dot, d ? styles.dotOn : styles.dotOff]}
                />
              ))}
            </Animated.View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </LinearGradient>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F2" },
  container: { flex: 1, backgroundColor: C.bg },
  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.green100 + "80",
    top: -90,
    right: -70,
  },
  circle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: C.green100 + "50",
    bottom: 60,
    left: -50,
  },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 99,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 80,
  },
  successBadge: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.borderIdle,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  successTxt: {
    fontSize: 16,
    fontWeight: "700",
    color: C.green700,
  },

  scrollContent: { flexGrow: 1, justifyContent: "flex-start", paddingVertical: 24 },
  inner: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 44,
  },
  // Wide screens: shrink vertical spacing so content fits without scrolling.
  innerWide: {
    paddingTop: 34,
    paddingBottom: 10,
  },
  hiddenOtpInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
  },

  changeNumWrap: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 8,
  },
  changeNumWrapWide: {
    marginTop: 12,
  },
  changeNumLink: {
    textAlign: "center",
    color: "#2E7D32",
    fontSize: 15,
    fontWeight: "600",
  },

  heroBlock: { alignItems: "center", marginBottom: 22 },
  heroBlockWide: { marginBottom: 16 },
  lockEmoji: { fontSize: 52, marginBottom: 6 },
  lockEmojiWide: { fontSize: 46, marginBottom: 4 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1B5E20",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "#4E7C50",
    marginTop: 8,
    marginBottom: 18,
    fontSize: 15,
  },
  subtitleWide: { marginBottom: 16 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 0,
    elevation: 8,
    overflow: "hidden",
    shadowColor: "#1A2E1C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: C.borderIdle,
  },
  cardBar: { height: 5, marginHorizontal: -22, marginBottom: 20 },
  cardTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: C.textPrimary,
    marginBottom: 18,
  },
  cardTitleWide: { marginBottom: 14 },

  otpRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  boxScaleWrap: { flex: 1 },
  otpBox: {
    borderWidth: 2,
    borderRadius: 16,
    aspectRatio: 0.9,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: C.surface,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: "center",
  
    fontSize: 22,
  
    // ✅ KEY FIXES
    lineHeight: 26,          // slightly bigger than fontSize
    textAlignVertical: "center", // Android fix
    paddingVertical: 0,      // remove extra padding
  
    includeFontPadding: false, // 🔥 Android important
  },
  otpInputFilled: { color: C.green700 },

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
  timerRowWide: { marginBottom: 14 },
  timerBg: {
    flex: 1,
    height: 6,
    backgroundColor: C.green100,
    borderRadius: 3,
    overflow: "hidden",
  },
  timerFill: { height: "100%", borderRadius: 3 },
  timerLbl: { fontSize: 13, color: C.textSecondary, fontWeight: "700", minWidth: 36 },

  verifyBtn: { borderRadius: 16, overflow: "hidden" },
  verifyGrad: {
    paddingVertical: 16,
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
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  verifyCheck: { color: C.white, fontSize: 26, fontWeight: "900" },
  verifyTxtOff: { color: C.textMuted },

  divRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  divRowWide: { marginBottom: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: C.green100 },
  divLbl: { color: C.textMuted, fontSize: 12 },

  resendBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: 14,
    backgroundColor: C.surfaceGreen,
  },
  resendBtnWide: { marginBottom: 2 },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resendTxt: { color: C.green700, fontSize: 16, fontWeight: "800" },
  resendWait: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  resendWaitWide: { marginBottom: 2 },
  secureLbl: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },
  secureLblWide: { marginTop: 8 },

  dotsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
  },
  dotsRowWide: { marginTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOff: { backgroundColor: C.green100 },
  dotOn: { backgroundColor: C.green700 },
});

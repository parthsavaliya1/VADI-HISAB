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

import translations from "@/translations.json";
import { sendOtp, verifyOtp } from "@/utils/api";

const OTP_LENGTH = 6;

// ✅ Hardcoded to Gujarati. To switch language, change "gu" → "en"
const LANG = "gu" as const;
const t = translations[LANG].otp;

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
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(50)).current;
    const cardFade = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(60)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const successScale = useRef(new Animated.Value(0)).current;
    const successOpacity = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const btnScale = useRef(new Animated.Value(1)).current;
    const boxAnims = useRef(Array(OTP_LENGTH).fill(0).map(() => new Animated.Value(1))).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideUp, { toValue: 0, duration: 700, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
            Animated.timing(cardFade, { toValue: 1, duration: 600, delay: 250, useNativeDriver: true }),
            Animated.timing(cardSlide, { toValue: 0, duration: 700, delay: 250, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        ]).start(() => setTimeout(() => inputRefs.current[0]?.focus(), 100));

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -6, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 6, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        if (resendTimer === 0) { setCanResend(true); return; }
        const interval = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) { clearInterval(interval); setCanResend(true); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const shake = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: -12, duration: 70, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 12, duration: 70, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 70, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 70, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
        ]).start();
    };

    const popBox = (i: number) => {
        Animated.sequence([
            Animated.timing(boxAnims[i], { toValue: 1.18, duration: 80, useNativeDriver: true }),
            Animated.spring(boxAnims[i], { toValue: 1, useNativeDriver: true }),
        ]).start();
    };

    const handleChange = (text: string, i: number) => {
        setError("");
        const digit = text.replace(/[^0-9]/g, "").slice(-1);
        const next = [...otp]; next[i] = digit; setOtp(next);
        if (digit) { popBox(i); if (i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus(); }
    };

    const handleKey = (key: string, i: number) => {
        if (key === "Backspace") {
            const next = [...otp];
            if (otp[i] === "" && i > 0) { next[i - 1] = ""; setOtp(next); inputRefs.current[i - 1]?.focus(); }
            else { next[i] = ""; setOtp(next); }
        }
    };

    const isComplete = otp.every(d => d !== "");

    const resend = async () => {
        setLoading(true);
        try {
            const data = await sendOtp(phone);
            setSessionId(data.sessionId);
            setResendTimer(30);
            setCanResend(false);
            setOtp(Array(OTP_LENGTH).fill(""));
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
            Animated.parallel([
                Animated.spring(successScale, { toValue: 1, useNativeDriver: true }),
                Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();

            setTimeout(() => {
                if (!data.consentGiven) router.replace("/(auth)/consent");
                else if (!data.isProfileCompleted) router.replace("/(auth)/profile-setup");
                else router.replace("/(tabs)");
            }, 1200);

        } catch (err: any) {
            setError(t.errInvalid);
            setOtp(Array(OTP_LENGTH).fill(""));
            inputRefs.current[0]?.focus();
            shake();
        } finally {
            setVerifying(false);
        }
    };

    // Build subtitle with phone injected
    const subtitle = t.subtitle.replace("{phone}", phone ?? "");
    const resendWait = t.resendWait.replace("{seconds}", String(resendTimer));

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <LinearGradient colors={["#0D3B1E", "#1B5E20", "#2E7D32", "#43A047"]} locations={[0, 0.3, 0.65, 1]} style={styles.container}>
                <View style={styles.circle1} />
                <View style={styles.circle2} />

                {/* Success Overlay */}
                {success && (
                    <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]}>
                        <Animated.View style={[styles.successBadge, { transform: [{ scale: successScale }] }]}>
                            <Text style={styles.successEmoji}>✅</Text>
                            <Text style={styles.successText}>{t.successMsg}</Text>
                        </Animated.View>
                    </Animated.View>
                )}

                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                    <View style={styles.inner}>
                        {/* Back */}
                        <Animated.View style={{ opacity: fadeIn }}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                                <Text style={styles.backText}>{t.changeNum}</Text>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Hero */}
                        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], alignItems: "center", marginBottom: 28 }}>
                            <Animated.Text style={[styles.lockEmoji, { transform: [{ translateY: floatAnim }] }]}>🔐</Animated.Text>
                            <Text style={styles.title}>{t.title}</Text>
                            <Text style={styles.subtitle}>{subtitle}</Text>
                        </Animated.View>

                        {/* Card */}
                        <Animated.View style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>

                            {/* OTP Boxes */}
                            <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
                                {Array(OTP_LENGTH).fill(0).map((_, i) => (
                                    <Animated.View key={i} style={[styles.boxWrap, { transform: [{ scale: boxAnims[i] }] }]}>
                                        <TextInput
                                            ref={r => (inputRefs.current[i] = r)}
                                            style={[
                                                styles.otpBox,
                                                otp[i] ? styles.otpBoxFilled : styles.otpBoxEmpty,
                                                error ? styles.otpBoxError : null,
                                            ]}
                                            keyboardType="numeric"
                                            maxLength={1}
                                            value={otp[i]}
                                            onChangeText={txt => handleChange(txt, i)}
                                            onKeyPress={({ nativeEvent }) => handleKey(nativeEvent.key, i)}
                                            selectionColor="#2E7D32"
                                            caretHidden
                                        />
                                        {otp[i] ? <View style={styles.boxDot} /> : null}
                                    </Animated.View>
                                ))}
                            </Animated.View>

                            {/* Error */}
                            {error
                                ? <Text style={styles.errorText}>⚠️ {error}</Text>
                                : <View style={{ height: 20 }} />
                            }

                            {/* Timer Bar */}
                            {!canResend && (
                                <View style={styles.timerBarBg}>
                                    <View style={[styles.timerBarFill, { width: `${(resendTimer / 30) * 100}%` as any }]} />
                                </View>
                            )}

                            {/* Verify Button */}
                            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                                <Pressable
                                    style={[styles.verifyBtn, !isComplete && styles.verifyBtnDisabled]}
                                    onPressIn={() => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start()}
                                    onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start()}
                                    onPress={verify}
                                    disabled={!isComplete || verifying || success}
                                >
                                    <LinearGradient
                                        colors={isComplete ? ["#1B5E20", "#2E7D32", "#388E3C"] : ["#C8E6C9", "#C8E6C9"]}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={styles.verifyBtnGradient}
                                    >
                                        {verifying
                                            ? <ActivityIndicator color="white" />
                                            : <Text style={[styles.verifyBtnText, !isComplete && styles.verifyBtnTextOff]}>
                                                {t.verify} ✓
                                            </Text>
                                        }
                                    </LinearGradient>
                                </Pressable>
                            </Animated.View>

                            {/* Divider */}
                            <View style={styles.divRow}>
                                <View style={styles.divLine} />
                                <Text style={styles.divLabel}>{t.or}</Text>
                                <View style={styles.divLine} />
                            </View>

                            {/* Resend */}
                            {canResend
                                ? <TouchableOpacity onPress={resend} disabled={loading} style={styles.resendBtn}>
                                    {loading
                                        ? <ActivityIndicator color="#2E7D32" size="small" />
                                        : <Text style={styles.resendText}>{t.resend}</Text>
                                    }
                                </TouchableOpacity>
                                : <Text style={styles.resendWait}>{resendWait}</Text>
                            }

                            <Text style={styles.secureLabel}>🔒 {t.secure}</Text>
                        </Animated.View>

                        {/* Progress dots */}
                        <Animated.View style={[styles.dotsRow, { opacity: fadeIn }]}>
                            {otp.map((d, i) => (
                                <View key={i} style={[styles.dot, d ? styles.dotOn : styles.dotOff]} />
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
    circle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,255,255,0.04)", top: -100, right: -80 },
    circle2: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", bottom: 80, left: -60 },
    successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 99, justifyContent: "center", alignItems: "center" },
    successBadge: { backgroundColor: "white", borderRadius: 24, padding: 36, alignItems: "center", elevation: 20 },
    successEmoji: { fontSize: 60, marginBottom: 12 },
    successText: { fontSize: 22, fontWeight: "800", color: "#2E7D32" },
    inner: { flex: 1, justifyContent: "center", paddingHorizontal: 22, paddingBottom: 20, paddingTop: 50 },
    backBtn: { alignSelf: "flex-start", paddingVertical: 8, marginBottom: 12 },
    backText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
    lockEmoji: { fontSize: 68, marginBottom: 10 },
    title: { fontSize: 28, fontWeight: "900", color: "white", letterSpacing: 0.4 },
    subtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 6, textAlign: "center" },
    card: { backgroundColor: "white", borderRadius: 28, padding: 24, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
    otpRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 8 },
    boxWrap: { flex: 1, alignItems: "center" },
    otpBox: { width: "100%", aspectRatio: 0.85, borderRadius: 14, borderWidth: 2.5, textAlign: "center", fontSize: 22, fontWeight: "800", color: "#1B5E20" },
    otpBoxEmpty: { borderColor: "#E0E0E0", backgroundColor: "#FAFAFA" },
    otpBoxFilled: { borderColor: "#2E7D32", backgroundColor: "#E8F5E9" },
    otpBoxError: { borderColor: "#D32F2F", backgroundColor: "#FFEBEE" },
    boxDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#2E7D32", marginTop: 4 },
    errorText: { color: "#D32F2F", fontSize: 13, textAlign: "center", marginBottom: 12, fontWeight: "600" },
    timerBarBg: { height: 4, backgroundColor: "#E8F5E9", borderRadius: 2, marginBottom: 16, overflow: "hidden" },
    timerBarFill: { height: "100%", backgroundColor: "#2E7D32", borderRadius: 2 },
    verifyBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 18 },
    verifyBtnDisabled: {},
    verifyBtnGradient: { paddingVertical: 17, alignItems: "center" },
    verifyBtnText: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: 0.4 },
    verifyBtnTextOff: { color: "#81C784" },
    divRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
    divLine: { flex: 1, height: 1, backgroundColor: "#EEEEEE" },
    divLabel: { color: "#BDBDBD", fontSize: 12 },
    resendBtn: { alignItems: "center", paddingVertical: 10, marginBottom: 4 },
    resendText: { color: "#2E7D32", fontSize: 15, fontWeight: "700" },
    resendWait: { color: "#9E9E9E", fontSize: 13, textAlign: "center", marginBottom: 4 },
    secureLabel: { color: "#BDBDBD", fontSize: 11, textAlign: "center", marginTop: 12 },
    dotsRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 22 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotOff: { backgroundColor: "rgba(255,255,255,0.3)" },
    dotOn: { backgroundColor: "white" },
});
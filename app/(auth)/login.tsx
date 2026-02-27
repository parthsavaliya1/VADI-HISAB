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
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const { height } = Dimensions.get("window");

// ✅ Hardcoded to Gujarati. To switch language, change "gu" → "en"
const LANG = "gu" as const;
const t = translations[LANG].login;

export default function Login() {
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);

    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(40)).current;
    const cardSlide = useRef(new Animated.Value(60)).current;
    const cardFade = useRef(new Animated.Value(0)).current;
    const inputScale = useRef(new Animated.Value(1)).current;
    const btnScale = useRef(new Animated.Value(1)).current;

    const isValid = phone.length === 10;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideUp, { toValue: 0, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
            Animated.timing(cardSlide, { toValue: 0, duration: 800, delay: 200, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
            Animated.timing(cardFade, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const onFocusInput = () => {
        setFocused(true);
        Animated.spring(inputScale, { toValue: 1.02, useNativeDriver: true }).start();
    };
    const onBlurInput = () => {
        setFocused(false);
        Animated.spring(inputScale, { toValue: 1, useNativeDriver: true }).start();
    };
    const onPressInBtn = () => Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true }).start();
    const onPressOutBtn = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

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

    return (
        <LinearGradient colors={["#0D3B1E", "#1B5E20", "#2E7D32", "#43A047"]} locations={[0, 0.3, 0.65, 1]} style={styles.container}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
                <View style={styles.inner}>

                    {/* Hero */}
                    <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], alignItems: "center", marginBottom: 32 }}>
                        <Animated.Text style={[styles.tractorEmoji, { transform: [{ translateY: floatAnim }] }]}>
                            🚜
                        </Animated.Text>
                        <Text style={styles.appName}>{t.appName}</Text>
                        <Text style={styles.tagline}>{t.tagline}</Text>
                        <View style={styles.wheatRow}>
                            {["🌾", "🌱", "🌾", "🌱", "🌾"].map((e, i) => (
                                <Text key={i} style={styles.wheatEmoji}>{e}</Text>
                            ))}
                        </View>
                    </Animated.View>

                    {/* Card */}
                    <Animated.View style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
                        <Text style={styles.cardTitle}>{t.label}</Text>

                        {/* Phone Input */}
                        <Animated.View style={[
                            styles.inputWrapper,
                            { transform: [{ scale: inputScale }], borderColor: focused ? "#2E7D32" : (isValid ? "#81C784" : "#E0E0E0") },
                        ]}>
                            <View style={styles.prefix}>
                                <Text style={styles.flag}>🇮🇳</Text>
                                <Text style={styles.prefixText}>+91</Text>
                                <View style={styles.prefixDivider} />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder={t.placeholder}
                                placeholderTextColor="#BDBDBD"
                                keyboardType="numeric"
                                maxLength={10}
                                value={phone}
                                onChangeText={setPhone}
                                onFocus={onFocusInput}
                                onBlur={onBlurInput}
                                selectionColor="#2E7D32"
                            />
                            {isValid && <Text style={styles.checkMark}>✓</Text>}
                        </Animated.View>

                        {/* Progress dots */}
                        <View style={styles.progressRow}>
                            {Array(10).fill(0).map((_, i) => (
                                <View key={i} style={[styles.progressDot, i < phone.length ? styles.progressDotFilled : styles.progressDotEmpty]} />
                            ))}
                        </View>

                        {/* Send OTP Button */}
                        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                            <Pressable
                                style={[styles.sendBtn, !isValid && styles.sendBtnDisabled]}
                                onPressIn={onPressInBtn}
                                onPressOut={onPressOutBtn}
                                onPress={handleSendOtp}
                                disabled={!isValid || loading}
                            >
                                <LinearGradient
                                    colors={isValid ? ["#1B5E20", "#2E7D32", "#388E3C"] : ["#C8E6C9", "#C8E6C9"]}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.sendBtnGradient}
                                >
                                    {loading
                                        ? <ActivityIndicator color="white" />
                                        : <Text style={[styles.sendBtnText, !isValid && styles.sendBtnTextDisabled]}>
                                            {t.sendOtpBtn} →
                                        </Text>
                                    }
                                </LinearGradient>
                            </Pressable>
                        </Animated.View>

                        <Text style={styles.hint}>🔒 {t.hint}</Text>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    kav: { flex: 1 },
    inner: { flex: 1, justifyContent: "center", paddingHorizontal: 22, paddingBottom: 20 },
    circle1: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(255,255,255,0.04)", top: -80, right: -80 },
    circle2: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", bottom: 60, left: -60 },
    circle3: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.04)", top: height * 0.35, left: 20 },
    tractorEmoji: { fontSize: 72, marginBottom: 10 },
    appName: { fontSize: 32, fontWeight: "900", color: "white", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
    tagline: { fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4, letterSpacing: 0.5 },
    wheatRow: { flexDirection: "row", marginTop: 14, gap: 6 },
    wheatEmoji: { fontSize: 18 },
    card: { backgroundColor: "white", borderRadius: 28, padding: 26, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: "#1B5E20", marginBottom: 16, letterSpacing: 0.3 },
    inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 16, overflow: "hidden", marginBottom: 12, backgroundColor: "#FAFAFA" },
    prefix: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 14, gap: 6 },
    flag: { fontSize: 18 },
    prefixText: { fontSize: 15, fontWeight: "700", color: "#424242" },
    prefixDivider: { width: 1, height: 22, backgroundColor: "#E0E0E0", marginLeft: 8 },
    input: { flex: 1, fontSize: 18, fontWeight: "600", color: "#212121", paddingVertical: 14, paddingRight: 12, letterSpacing: 2 },
    checkMark: { fontSize: 20, color: "#2E7D32", paddingRight: 14, fontWeight: "900" },
    progressRow: { flexDirection: "row", gap: 5, marginBottom: 22, justifyContent: "center" },
    progressDot: { width: 22, height: 4, borderRadius: 2 },
    progressDotFilled: { backgroundColor: "#2E7D32" },
    progressDotEmpty: { backgroundColor: "#E8F5E9" },
    sendBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
    sendBtnDisabled: { opacity: 0.7 },
    sendBtnGradient: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
    sendBtnText: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
    sendBtnTextDisabled: { color: "#81C784" },
    hint: { textAlign: "center", color: "#9E9E9E", fontSize: 12 },
});
import translations from "@/translations.json";
import { saveConsent } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";

// ✅ Hardcoded to Gujarati. To switch language, change "gu" → "en"
const LANG = "gu" as const;
const t = translations[LANG].consent;

export default function Consent() {
    const [selected, setSelected] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(60)).current;
    const cardFade = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(80)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const btnScale = useRef(new Animated.Value(1)).current;
    const yesScale = useRef(new Animated.Value(1)).current;
    const noScale = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const feat1 = useRef(new Animated.Value(0)).current;
    const feat2 = useRef(new Animated.Value(0)).current;
    const feat3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideUp, { toValue: 0, duration: 750, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
            Animated.timing(cardFade, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
            Animated.timing(cardSlide, { toValue: 0, duration: 700, delay: 200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
        ]).start();

        Animated.stagger(150, [
            Animated.timing(feat1, { toValue: 1, duration: 400, delay: 500, useNativeDriver: true }),
            Animated.timing(feat2, { toValue: 1, duration: 400, delay: 500, useNativeDriver: true }),
            Animated.timing(feat3, { toValue: 1, duration: 400, delay: 500, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -7, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 7, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        if (selected !== null) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                ])
            ).start();
        }
    }, [selected]);

    const selectYes = () => {
        Animated.sequence([
            Animated.spring(yesScale, { toValue: 0.96, useNativeDriver: true }),
            Animated.spring(yesScale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        setSelected(true);
    };

    const selectNo = () => {
        Animated.sequence([
            Animated.spring(noScale, { toValue: 0.96, useNativeDriver: true }),
            Animated.spring(noScale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        setSelected(false);
    };

    const proceed = async () => {
        if (selected === null) return;
        setLoading(true);
        try {
            await saveConsent(selected);
            router.replace("/(auth)/profile-setup");
        } catch (err: any) {
            Alert.alert(t.errTitle, err.message);
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { anim: feat1, icon: "📊", title: t.f1title, desc: t.f1desc },
        { anim: feat2, icon: "🌿", title: t.f2title, desc: t.f2desc },
        { anim: feat3, icon: "🔒", title: t.f3title, desc: t.f3desc },
    ];

    return (
        <LinearGradient colors={["#0D3B1E", "#1B5E20", "#2E7D32", "#43A047"]} locations={[0, 0.3, 0.65, 1]} style={styles.container}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            <View style={styles.inner}>
                {/* Hero */}
                <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], alignItems: "center", marginBottom: 24 }}>
                    <Animated.Text style={[styles.heroEmoji, { transform: [{ translateY: floatAnim }] }]}>🏘️</Animated.Text>
                    <Text style={styles.heading}>{t.heading}</Text>
                    <Text style={styles.question}>{t.question}</Text>
                </Animated.View>

                {/* Card */}
                <Animated.View style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
                    <Text style={styles.whyLabel}>{t.whatIs}</Text>

                    {features.map((f, idx) => (
                        <Animated.View
                            key={idx}
                            style={[
                                styles.featureRow,
                                {
                                    opacity: f.anim,
                                    transform: [{ translateX: f.anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
                                },
                            ]}
                        >
                            <View style={styles.featureIcon}>
                                <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{f.title}</Text>
                                <Text style={styles.featureDesc}>{f.desc}</Text>
                            </View>
                        </Animated.View>
                    ))}

                    <View style={styles.divider} />

                    {/* Yes / No */}
                    <View style={styles.choiceRow}>
                        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: yesScale }] }]}>
                            <Pressable
                                onPress={selectYes}
                                style={[styles.choiceBtn, selected === true && styles.choiceBtnYesSelected]}
                                android_ripple={{ color: "#C8E6C9" }}
                            >
                                <Text style={styles.choiceBtnEmoji}>✅</Text>
                                <Text style={[styles.choiceBtnText, selected === true && styles.choiceBtnTextSelected]}>
                                    {t.yes}
                                </Text>
                                {selected === true && (
                                    <View style={styles.choiceCheck}>
                                        <Text style={{ color: "white", fontWeight: "900", fontSize: 10 }}>✓</Text>
                                    </View>
                                )}
                            </Pressable>
                        </Animated.View>

                        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: noScale }] }]}>
                            <Pressable
                                onPress={selectNo}
                                style={[styles.choiceBtn, selected === false && styles.choiceBtnNoSelected]}
                                android_ripple={{ color: "#FFCDD2" }}
                            >
                                <Text style={styles.choiceBtnEmoji}>🚫</Text>
                                <Text style={[styles.choiceBtnText, selected === false && styles.choiceBtnTextSelectedNo]}>
                                    {t.no}
                                </Text>
                                {selected === false && (
                                    <View style={[styles.choiceCheck, { backgroundColor: "#D32F2F" }]}>
                                        <Text style={{ color: "white", fontWeight: "900", fontSize: 10 }}>✓</Text>
                                    </View>
                                )}
                            </Pressable>
                        </Animated.View>
                    </View>

                    {selected !== null && (
                        <Animated.Text style={[styles.hintText, { color: selected ? "#2E7D32" : "#D32F2F" }]}>
                            {selected ? t.yesHint : t.noHint}
                        </Animated.Text>
                    )}

                    {/* Proceed Button */}
                    <Animated.View style={{ transform: [{ scale: selected !== null ? pulseAnim : btnScale }], marginTop: 16 }}>
                        <Pressable
                            style={[styles.proceedBtn, selected === null && styles.proceedBtnDisabled]}
                            onPressIn={() => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start()}
                            onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start()}
                            onPress={proceed}
                            disabled={selected === null || loading}
                        >
                            <LinearGradient
                                colors={selected !== null ? ["#1B5E20", "#2E7D32", "#43A047"] : ["#E0E0E0", "#E0E0E0"]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.proceedGradient}
                            >
                                {loading
                                    ? <ActivityIndicator color="white" />
                                    : <Text style={[styles.proceedText, selected === null && styles.proceedTextOff]}>{t.proceed}</Text>
                                }
                            </LinearGradient>
                        </Pressable>
                    </Animated.View>
                </Animated.View>

                {/* Step dots */}
                <Animated.View style={[styles.stepsRow, { opacity: fadeIn }]}>
                    {[1, 2, 3, 4].map(s => (
                        <View
                            key={s}
                            style={[
                                styles.stepDot,
                                s === 2 ? styles.stepDotActive : s < 2 ? styles.stepDotDone : styles.stepDotPending,
                            ]}
                        />
                    ))}
                </Animated.View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: "center", paddingHorizontal: 22, paddingBottom: 20, paddingTop: Platform.OS === "ios" ? 60 : 40 },
    circle1: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(255,255,255,0.04)", top: -80, right: -80 },
    circle2: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.05)", bottom: 100, left: -50 },
    circle3: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.06)", top: 200, left: 30 },
    heroEmoji: { fontSize: 70, marginBottom: 10 },
    heading: { fontSize: 24, fontWeight: "900", color: "white", letterSpacing: 0.3 },
    question: { fontSize: 14, color: "rgba(255,255,255,0.78)", marginTop: 8, textAlign: "center", lineHeight: 22 },
    card: { backgroundColor: "white", borderRadius: 28, padding: 22, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20 },
    whyLabel: { fontSize: 12, fontWeight: "700", color: "#9E9E9E", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
    featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 14 },
    featureIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
    featureText: { flex: 1 },
    featureTitle: { fontSize: 14, fontWeight: "700", color: "#212121" },
    featureDesc: { fontSize: 12, color: "#757575", marginTop: 2 },
    divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 16 },
    choiceRow: { flexDirection: "row", gap: 12 },
    choiceBtn: { borderWidth: 2, borderColor: "#E0E0E0", borderRadius: 16, paddingVertical: 16, alignItems: "center", backgroundColor: "#FAFAFA", position: "relative" },
    choiceBtnYesSelected: { borderColor: "#2E7D32", backgroundColor: "#E8F5E9" },
    choiceBtnNoSelected: { borderColor: "#D32F2F", backgroundColor: "#FFEBEE" },
    choiceBtnEmoji: { fontSize: 26, marginBottom: 4 },
    choiceBtnText: { fontSize: 15, fontWeight: "700", color: "#757575" },
    choiceBtnTextSelected: { color: "#2E7D32" },
    choiceBtnTextSelectedNo: { color: "#D32F2F" },
    choiceCheck: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: "#2E7D32", justifyContent: "center", alignItems: "center" },
    hintText: { fontSize: 12, textAlign: "center", marginTop: 10, fontWeight: "500" },
    proceedBtn: { borderRadius: 16, overflow: "hidden" },
    proceedBtnDisabled: {},
    proceedGradient: { paddingVertical: 17, alignItems: "center" },
    proceedText: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: 0.4 },
    proceedTextOff: { color: "#BDBDBD" },
    stepsRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 22 },
    stepDot: { height: 6, borderRadius: 3 },
    stepDotActive: { width: 24, backgroundColor: "white" },
    stepDotDone: { width: 10, backgroundColor: "rgba(255,255,255,0.8)" },
    stepDotPending: { width: 10, backgroundColor: "rgba(255,255,255,0.3)" },
});
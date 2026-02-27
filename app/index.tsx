import { TokenStore } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, StatusBar, StyleSheet, Text, View } from "react-native";

const { width, height } = Dimensions.get("window");

export default function Index() {
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const taglineOpacity = useRef(new Animated.Value(0)).current;
    const loaderOpacity = useRef(new Animated.Value(0)).current;
    const loaderWidth = useRef(new Animated.Value(0)).current;
    const leafFloat = useRef(new Animated.Value(0)).current;



    useEffect(() => {
        // ── Animations (unchanged) ─────────────────────────────────────────────
        Animated.sequence([
            Animated.parallel([
                Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            ]),
            Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(loaderOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(leafFloat, { toValue: -10, duration: 1800, useNativeDriver: true }),
                Animated.timing(leafFloat, { toValue: 10, duration: 1800, useNativeDriver: true }),
            ])
        ).start();

        setTimeout(() => {
            Animated.timing(loaderWidth, { toValue: width * 0.55, duration: 1800, useNativeDriver: false }).start();
        }, 800);

        // ── ✅ Real auth check ─────────────────────────────────────────────────
        // Waits for splash animation (3200ms) then checks AsyncStorage for token.
        // Token persists across app close/restart — user stays logged in until
        // they explicitly tap "લૉગ આઉટ" which calls TokenStore.clear()
        const timer = setTimeout(async () => {
            const token = await TokenStore.get();
            if (token) {
                router.replace("/(tabs)");       // ✅ token found → stay logged in
            } else {
                router.replace("/(auth)/login"); // no token → go to login
            }
        }, 3200);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0D3B1E" />

            <LinearGradient
                colors={["#0D3B1E", "#1A5C2A", "#2D8B45", "#3DAA56"]}
                style={styles.bg}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
            />

            <View style={styles.bgCircle1} />
            <View style={styles.bgCircle2} />
            <View style={styles.bgCircle3} />

            <Animated.Text style={[styles.floatLeaf, styles.leaf1, { transform: [{ translateY: leafFloat }] }]}>🌿</Animated.Text>
            <Animated.Text style={[styles.floatLeaf, styles.leaf2, { transform: [{ translateY: leafFloat }] }]}>🌾</Animated.Text>
            <Animated.Text style={[styles.floatLeaf, styles.leaf3, { transform: [{ translateY: leafFloat }] }]}>🍃</Animated.Text>

            <View style={styles.center}>
                <Animated.View style={[styles.logoWrapper, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
                    <LinearGradient
                        colors={["#A7F3D0", "#34D399", "#10B981"]}
                        style={styles.logoCircle}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.logoEmoji}>🌾</Text>
                    </LinearGradient>
                    <View style={styles.glowRing} />
                </Animated.View>

                <Animated.View style={{ opacity: textOpacity, alignItems: "center", marginTop: 24 }}>
                    <Text style={styles.appName}>VADI</Text>
                    <Text style={styles.appNameSub}>હિસાબ</Text>
                </Animated.View>

                <Animated.View style={{ opacity: taglineOpacity, alignItems: "center", marginTop: 10 }}>
                    <Text style={styles.tagline}>ખેડૂતોનો સ્માર્ટ હિસાબ</Text>
                    <View style={styles.taglineDivider} />
                    <Text style={styles.taglineSub}>નફો જાણો · ઉગો · ફળો</Text>
                </Animated.View>

                <Animated.View style={[styles.pillsRow, { opacity: taglineOpacity }]}>
                    {["📊 નફો ટ્રેક", "🌱 પાક નોંધ", "📋 અહેવાલ"].map((p, i) => (
                        <View key={i} style={styles.pill}>
                            <Text style={styles.pillText}>{p}</Text>
                        </View>
                    ))}
                </Animated.View>
            </View>

            <Animated.View style={[styles.loaderContainer, { opacity: loaderOpacity }]}>
                <View style={styles.loaderTrack}>
                    <Animated.View style={[styles.loaderFill, { width: loaderWidth }]} />
                </View>
                <Text style={styles.loaderText}>લોડ થઈ રહ્યું છે...</Text>
            </Animated.View>

            <View style={styles.bottomBrand}>
                <Text style={styles.bottomBrandText}>Powered by</Text>
                <Text style={styles.bottomBrandName}>VADI · Agri Solutions</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0D3B1E" },
    bg: { ...StyleSheet.absoluteFillObject },
    bgCircle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#ffffff08", top: -80, right: -80 },
    bgCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#ffffff06", bottom: 120, left: -60 },
    bgCircle3: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "#A7F3D015", top: height * 0.35, right: 30 },
    floatLeaf: { position: "absolute", fontSize: 28 },
    leaf1: { top: height * 0.15, left: 30 },
    leaf2: { top: height * 0.25, right: 40 },
    leaf3: { top: height * 0.65, left: 50 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
    logoWrapper: { alignItems: "center", justifyContent: "center", position: "relative" },
    logoCircle: { width: 110, height: 110, borderRadius: 34, justifyContent: "center", alignItems: "center", shadowColor: "#10B981", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16 },
    logoEmoji: { fontSize: 52 },
    glowRing: { position: "absolute", width: 130, height: 130, borderRadius: 40, borderWidth: 1.5, borderColor: "#34D39940" },
    appName: { fontSize: 52, fontWeight: "900", color: "#fff", letterSpacing: 6, lineHeight: 54 },
    appNameSub: { fontSize: 28, fontWeight: "300", color: "#A7F3D0", letterSpacing: 8, marginTop: -6 },
    tagline: { fontSize: 15, color: "#D1FAE5", fontWeight: "600", letterSpacing: 0.5, textAlign: "center" },
    taglineDivider: { width: 40, height: 1.5, backgroundColor: "#34D39960", marginVertical: 8 },
    taglineSub: { fontSize: 12, color: "#6EE7B780", letterSpacing: 1.5, textAlign: "center" },
    pillsRow: { flexDirection: "row", gap: 8, marginTop: 28, flexWrap: "wrap", justifyContent: "center" },
    pill: { backgroundColor: "#ffffff15", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: "#ffffff20" },
    pillText: { fontSize: 12, color: "#A7F3D0", fontWeight: "600" },
    loaderContainer: { alignItems: "center", paddingBottom: 24 },
    loaderTrack: { width: width * 0.55, height: 3, backgroundColor: "#ffffff20", borderRadius: 4, overflow: "hidden", marginBottom: 10 },
    loaderFill: { height: 3, backgroundColor: "#34D399", borderRadius: 4 },
    loaderText: { fontSize: 11, color: "#6EE7B780", letterSpacing: 1 },
    bottomBrand: { alignItems: "center", paddingBottom: 36 },
    bottomBrandText: { fontSize: 10, color: "#ffffff40" },
    bottomBrandName: { fontSize: 12, color: "#6EE7B7", fontWeight: "600", marginTop: 2, letterSpacing: 0.5 },
});
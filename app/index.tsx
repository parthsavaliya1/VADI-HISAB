import { TokenStore } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

// ─── Dashboard-matching palette ─────────────────────────────────────────────
const C = {
  green900: "#1B5E20",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  bg: "#F5F7F2",
  textPrimary: "#1A2E1C",
  textMuted: "#7A9B7E",
};

export default function Index() {
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderWidth = useRef(new Animated.Value(0)).current;
  const leafFloat = useRef(new Animated.Value(0)).current;

  

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(leafFloat, {
          toValue: -10,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(leafFloat, {
          toValue: 10,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    setTimeout(() => {
      Animated.timing(loaderWidth, {
        toValue: width * 0.55,
        duration: 1800,
        useNativeDriver: false,
      }).start();
    }, 800);

    const timer = setTimeout(async () => {
      const token = await TokenStore.get();
      if (token) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <LinearGradient
        colors={[C.green50, "#EEF6EE", C.bg]}
        style={styles.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      <Animated.Text
        style={[styles.floatLeaf, styles.leaf1, { transform: [{ translateY: leafFloat }] }]}
      >
        🌿
      </Animated.Text>
      <Animated.Text
        style={[styles.floatLeaf, styles.leaf2, { transform: [{ translateY: leafFloat }] }]}
      >
        🌾
      </Animated.Text>
      <Animated.Text
        style={[styles.floatLeaf, styles.leaf3, { transform: [{ translateY: leafFloat }] }]}
      >
        🍃
      </Animated.Text>

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoWrapper,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/vadi-logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View
          style={{ opacity: taglineOpacity, alignItems: "center", marginTop: 24 }}
        >
          <Text style={styles.tagline}>ખર્ચા ઘટાડો આવક વધારો</Text>
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
        <Text style={styles.bottomBrandName}>Agri Solutions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  bg: { ...StyleSheet.absoluteFillObject },
  bgCircle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.green100 + "80",
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: C.green100 + "50",
    bottom: 120,
    left: -60,
  },
  bgCircle3: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.green50 + "CC",
    top: height * 0.35,
    right: 30,
  },
  floatLeaf: { position: "absolute", fontSize: 28 },
  leaf1: { top: height * 0.15, left: 30 },
  leaf2: { top: height * 0.25, right: 40 },
  leaf3: { top: height * 0.65, left: 50 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 260,
    height: 120,
    resizeMode: "contain",
  },
  tagline: {
    fontSize: 17,
    color: C.textPrimary,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  taglineDivider: {
    width: 40,
    height: 1.5,
    backgroundColor: C.green500 + "80",
    marginVertical: 8,
  },
  taglineSub: {
    fontSize: 12,
    color: C.textMuted,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 28,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    backgroundColor: C.green50,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.green100,
  },
  pillText: { fontSize: 12, color: C.green700, fontWeight: "600" },
  loaderContainer: { alignItems: "center", paddingBottom: 24 },
  loaderTrack: {
    width: width * 0.55,
    height: 3,
    backgroundColor: C.green100,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
  },
  loaderFill: { height: 3, backgroundColor: C.green500, borderRadius: 4 },
  loaderText: { fontSize: 11, color: C.textMuted, letterSpacing: 1 },
  bottomBrand: { alignItems: "center", paddingBottom: 36 },
  bottomBrandText: { fontSize: 10, color: C.textMuted },
  bottomBrandName: {
    fontSize: 12,
    color: C.green700,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.5,
  },
});

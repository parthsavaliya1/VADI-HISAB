import { AppTheme } from "@/constants/theme";
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
const C = AppTheme;

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
      ]),
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

      {/* Soft floating farm icons (very light, behind logo) */}
      <Animated.Text
        style={[
          styles.floatIcon,
          styles.floatIconLeft,
          { transform: [{ translateY: leafFloat }] },
        ]}
      >
        🌿
      </Animated.Text>
      <Animated.Text
        style={[
          styles.floatIcon,
          styles.floatIconRight,
          { transform: [{ translateY: leafFloat }] },
        ]}
      >
        🌾
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
      </View>

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
  floatIcon: {
    position: "absolute",
    fontSize: 26,
    opacity: 0.25,
  },
  floatIconLeft: {
    top: height * 0.2,
    left: 26,
  },
  floatIconRight: {
    top: height * 0.65,
    right: 30,
  },
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
    width: 320,
    height: 320,
    resizeMode: "contain",
  },
  bottomBrand: { alignItems: "center", paddingBottom: 36 },
  bottomBrandText: { fontSize: 12, color: C.textMuted },
  bottomBrandName: {
    fontSize: 14,
    color: C.green700,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.5,
  },
});

import { AppTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Show back button and call router.back() on press. Omit for tab/root screens. */
  showBack?: boolean;
  /** Optional right-side element (e.g. edit button) */
  rightElement?: React.ReactNode;
  /** Optional custom back handler */
  onBack?: () => void;
  /** Style for the header container (e.g. paddingTop for status bar) */
  style?: ViewStyle;
  /** If true, back arrow and text use light color (e.g. on dark header) */
  light?: boolean;
}

const paddingTop = Platform.OS === "ios" ? 52 : 40;

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  rightElement,
  onBack,
  style,
  light = false,
}: ScreenHeaderProps) {
  const handleBack = onBack ?? (() => router.back());
  const color = light ? "#fff" : AppTheme.textPrimary;
  const subColor = light ? "rgba(255,255,255,0.85)" : AppTheme.textMuted;

  return (
    <View style={[styles.wrap, { paddingTop }, style]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            style={[styles.backBtn, light && styles.backBtnLight]}
            onPress={handleBack}
            android_ripple={{ color: "rgba(0,0,0,0.1)" }}
          >
            <Ionicons name="arrow-back" size={24} color={color} />
          </Pressable>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
        <View style={styles.titles}>
          <Text style={[styles.title, { color }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightElement ?? <View style={styles.backBtnPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: AppTheme.green50,
    borderWidth: 1,
    borderColor: AppTheme.green100,
  },
  backBtnLight: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  backBtnPlaceholder: { width: 40, height: 40, marginRight: 12 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 14, fontWeight: "600", marginTop: 2 },
});

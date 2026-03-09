import { AppTheme, FontSizes, HEADER_PADDING_TOP } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

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
    <View style={[styles.wrap, { paddingTop: HEADER_PADDING_TOP }, style]}>
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
          <View style={styles.noBackSpacer} />
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
    marginRight: 18,
    backgroundColor: AppTheme.green50,
    borderWidth: 1,
    borderColor: AppTheme.green100,
  },
  backBtnLight: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  backBtnPlaceholder: { width: 40, height: 40, marginRight: 18 },
  noBackSpacer: { width: 0, height: 40, marginRight: 0 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: FontSizes.title, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { fontSize: FontSizes.sm, fontWeight: "600", marginTop: 2 },
});

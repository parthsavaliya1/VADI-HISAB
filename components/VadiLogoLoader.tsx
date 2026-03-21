import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { AppTheme } from "@/constants/theme";

const LOGO = require("@/assets/vadi-logo.png");

export type VadiLogoSizePreset = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<VadiLogoSizePreset, number> = {
  xs: 22,
  sm: 32,
  md: 56,
  lg: 72,
};

export function resolveVadiLogoSize(size: VadiLogoSizePreset | number = "md"): number {
  return typeof size === "number" ? size : SIZE_MAP[size];
}

export type VadiLogoMarkProps = {
  size?: VadiLogoSizePreset | number;
  /** Renders logo in white (for use on solid / gradient buttons). */
  inverted?: boolean;
  style?: StyleProp<ImageStyle>;
};

/**
 * Spinner for buttons and compact actions — use while loading instead of the logo.
 * Full-screen / block loading should use {@link VadiLogoLoader} (logo on screen).
 */
export function VadiButtonLoadingIndicator({
  inverted,
  size = "small",
}: {
  /** White on solid / gradient buttons; brand green on light surfaces. */
  inverted?: boolean;
  size?: "small" | "large";
}) {
  return (
    <ActivityIndicator
      size={size}
      color={inverted ? "#FFFFFF" : AppTheme.green700}
    />
  );
}

/** Logo only — inline in buttons, dropdowns, or custom rows. */
export function VadiLogoMark({ size = "md", inverted, style }: VadiLogoMarkProps) {
  const dim = resolveVadiLogoSize(size);
  return (
    <Image
      source={LOGO}
      style={[
        { width: dim, height: dim },
        inverted && { tintColor: "#FFFFFF" },
        style,
      ]}
      resizeMode="contain"
    />
  );
}

export type VadiLogoLoaderProps = {
  size?: VadiLogoSizePreset | number;
  label?: string;
  inverted?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Logo and label in one row (e.g. inline section loading). */
  horizontal?: boolean;
};

/** Centered logo with optional caption — replaces full-screen / block spinners. */
export function VadiLogoLoader({
  size = "md",
  label,
  inverted,
  containerStyle,
  imageStyle,
  labelStyle,
  horizontal,
}: VadiLogoLoaderProps) {
  const dim = resolveVadiLogoSize(size);
  const img = (
    <Image
      source={LOGO}
      style={[
        { width: dim, height: dim },
        inverted && { tintColor: "#FFFFFF" },
        imageStyle,
      ]}
      resizeMode="contain"
    />
  );

  if (!label) {
    return (
      <View style={[horizontal ? styles.row : styles.col, containerStyle]}>
        {img}
      </View>
    );
  }

  if (horizontal) {
    return (
      <View style={[styles.row, containerStyle]}>
        {img}
        <Text style={[styles.labelInline, { color: AppTheme.textMuted }, labelStyle]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.col, containerStyle]}>
      {img}
      <Text style={[styles.label, { color: AppTheme.textMuted }, labelStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: { marginTop: 8, fontSize: 17, fontWeight: "600" },
  labelInline: { fontSize: 15, fontWeight: "700" },
});

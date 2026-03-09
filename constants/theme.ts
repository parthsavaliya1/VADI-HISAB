import { Platform } from "react-native";

/**
 * Shared app theme — unified palette used across all screens.
 */
export const AppTheme = {
  green900: "#1B5E20",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green400: "#66BB6A",
  green100: "#C8E6C9",
  green50: "#E8F5E9",

  bg: "#F5F7F2",
  surface: "#FFFFFF",
  surfaceGreen: "#F1F8F1",

  textPrimary: "#0A0E0B",
  textSecondary: "#1A2E1C",
  textMuted: "#2D4230",

  income: "#1B5E20",
  incomePale: "#E8F5E9",
  expense: "#B71C1C",
  expensePale: "#FFEBEE",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
} as const;

/** Consistent font sizes across the app */
export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 22,
  "3xl": 24,
  title: 26,
} as const;

/** Consistent top padding for headers with back button across all screens */
export const HEADER_PADDING_TOP = Platform.OS === "ios" ? 58 : 48;

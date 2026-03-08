/**
 * Custom Toast config — full width, larger font.
 */
import React from "react";
import { Dimensions } from "react-native";
import { BaseToast } from "react-native-toast-message";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TOAST_MARGIN = 12; // Minimal margin for near full-width
const TOAST_WIDTH = SCREEN_WIDTH - TOAST_MARGIN * 2;

const baseConfig = {
  style: {
    width: TOAST_WIDTH,
    minHeight: 72,
    borderRadius: 10,
  },
  contentContainerStyle: {
    paddingHorizontal: 20,
    flex: 1,
  },
  text1Style: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    color: "#000",
  },
  text2Style: {
    fontSize: 15,
    color: "#444",
  },
};

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      {...baseConfig}
      style={[baseConfig.style, { borderLeftColor: "#2E7D32", borderLeftWidth: 5 }]}
    />
  ),
  error: (props: any) => (
    <BaseToast
      {...props}
      {...baseConfig}
      style={[baseConfig.style, { borderLeftColor: "#C62828", borderLeftWidth: 5 }]}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      {...baseConfig}
      style={[baseConfig.style, { borderLeftColor: "#1565C0", borderLeftWidth: 5 }]}
    />
  ),
};

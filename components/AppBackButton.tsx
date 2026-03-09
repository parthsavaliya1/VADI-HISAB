import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";

export function AppBackButton({
  onPress,
  iconColor = "#1A2E1C",
  backgroundColor = "#FFFFFF",
  borderColor = "#EAF4EA",
  style,
}: {
  onPress: () => void;
  iconColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor, borderColor },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name="arrow-back" size={24} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});

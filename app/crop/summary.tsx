/**
 * Route: /crop/summary
 * Crop summary is shown in a modal on the Crop tab. This route redirects there.
 */
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function CropSummaryScreen() {
  useEffect(() => {
    router.replace("/(tabs)/crop");
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#2E7D32" />
    </View>
  );
}

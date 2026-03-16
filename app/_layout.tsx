import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ProfileProvider } from "../contexts/ProfileContext";
import { RefreshProvider } from "../contexts/RefreshContext";
import { toastConfig } from "../utils/toastConfig";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
    <LanguageProvider>
      <ProfileProvider>
        <RefreshProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <Toast config={toastConfig} />
        </RefreshProvider>
      </ProfileProvider>
    </LanguageProvider>
    </SafeAreaProvider>

  );
}

import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ProfileProvider } from "../contexts/ProfileContext";
import { RefreshProvider } from "../contexts/RefreshContext";
import { toastConfig } from "../utils/toastConfig";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <RefreshProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <Toast config={toastConfig} />
        </RefreshProvider>
      </ProfileProvider>
    </LanguageProvider>
  );
}

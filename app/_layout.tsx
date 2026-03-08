import { Stack } from "expo-router";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ProfileProvider } from "../contexts/ProfileContext";
import { RefreshProvider } from "../contexts/RefreshContext";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <RefreshProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </RefreshProvider>
      </ProfileProvider>
    </LanguageProvider>
  );
}

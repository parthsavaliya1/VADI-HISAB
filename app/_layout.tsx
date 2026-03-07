import { Stack } from "expo-router";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ProfileProvider } from "../contexts/ProfileContext";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ProfileProvider>
    </LanguageProvider>
  );
}

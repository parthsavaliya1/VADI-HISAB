import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import Toast from "react-native-toast-message";
import { useEffect } from "react";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ProfileProvider } from "../contexts/ProfileContext";
import { RefreshProvider } from "../contexts/RefreshContext";
import { TokenStore } from "../utils/api";
import { registerAndSyncPushToken } from "../utils/pushNotifications";
import { toastConfig } from "../utils/toastConfig";
import { SafeAreaProvider } from "react-native-safe-area-context";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    let responseSubscription: { remove: () => void } | null = null;

    const routeFromNotification = (data: Record<string, unknown> | undefined) => {
      const target = String(data?.screen || "").trim();
      if (target === "live-price") {
        router.push("/(tabs)/live-price");
        return;
      }
      if (target === "crop") {
        router.push("/(tabs)/crop");
        return;
      }
      if (target === "report") {
        router.push("/(tabs)/report");
        return;
      }
      router.push("/(tabs)");
    };

    const registerIfLoggedIn = async () => {
      const token = await TokenStore.get();
      if (!token) return;
      await registerAndSyncPushToken();
    };

    const setupNotificationTapHandlers = async () => {
      const initialResponse = await Notifications.getLastNotificationResponseAsync();
      if (initialResponse?.notification?.request?.content?.data) {
        routeFromNotification(
          initialResponse.notification.request.content.data as Record<string, unknown>
        );
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          routeFromNotification(
            response.notification.request.content.data as Record<string, unknown>
          );
        }
      );
    };

    registerIfLoggedIn();
    setupNotificationTapHandlers();

    return () => {
      if (responseSubscription) responseSubscription.remove();
    };
  }, []);

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

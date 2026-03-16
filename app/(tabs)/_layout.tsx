import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_ICON_SIZE = 26;
const TAB_LABEL_FONT_SIZE = 13;

export default function TabLayout() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2e7d32",
        tabBarStyle: {
          minHeight: 66 + insets.bottom, // 👈 dynamic
          paddingTop: 8,
          paddingBottom: insets.bottom + 8, // 👈 dynamic
        },
        tabBarLabelStyle: { fontSize: TAB_LABEL_FONT_SIZE, fontWeight: "700" },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs", "home"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="crop"
        options={{
          title: t("tabs", "crop"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="leaf" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="report"
        options={{
          title: t("tabs", "report"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="live-price"
        options={{
          title: "બજાર ભાવ",
          tabBarIcon: ({ color }) => (
            <Ionicons name="pricetag" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="expense"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs", "profile"),
          href: null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

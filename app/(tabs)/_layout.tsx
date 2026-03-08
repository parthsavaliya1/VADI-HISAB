import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const TAB_ICON_SIZE = 32;
const TAB_LABEL_FONT_SIZE = 16;

export default function TabLayout() {
  const { t } = useLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2e7d32",
        tabBarStyle: {
          minHeight: 76,
          paddingTop: 10,
          paddingBottom: 10,
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
        name="expense"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs", "profile"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

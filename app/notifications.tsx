import { AppTheme, HEADER_PADDING_TOP } from "@/constants/theme";
import { AppBackButton } from "@/components/AppBackButton";
import { VadiLogoLoader } from "@/components/VadiLogoLoader";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/utils/api";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const C = {
  ...AppTheme,
  green500: AppTheme.green500,
  gold: "#F9A825",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getNotifications(1, 100);
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (!isRefresh) {
        Alert.alert("Error", (e as Error).message || "Failed to load notifications.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const handlePressNotification = useCallback(
    async (item: AppNotification) => {
      try {
        if (!item.isRead) {
          await markNotificationRead(item._id);
          setNotifications((current) =>
            current.map((notification) =>
              notification._id === item._id
                ? { ...notification, isRead: true, readAt: new Date().toISOString() }
                : notification
            )
          );
        }

        if (item.referenceType === "Income" && item.referenceId) {
          router.push(`/transaction/details?id=${item.referenceId}&type=income`);
        }
      } catch (e) {
        Alert.alert("Error", (e as Error).message || "Failed to open notification.");
      }
    },
    [router]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt ?? new Date().toISOString(),
        }))
      );
    } catch (e) {
      Alert.alert("Error", (e as Error).message || "Failed to mark notifications.");
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.header, { paddingTop: HEADER_PADDING_TOP }]}>
        <AppBackButton onPress={() => router.back()} iconColor={C.green700} backgroundColor={C.surface} borderColor={C.green100} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.markAllBtn, (!unreadCount || markingAll) && styles.markAllBtnDisabled]}
          onPress={handleMarkAllRead}
          disabled={!unreadCount || markingAll}
        >
          <Text style={styles.markAllBtnText}>
            {markingAll ? "..." : "Read all"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <VadiLogoLoader size="lg" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} />
          }
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={34} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                ટ્રેક્ટર ના પૈસા બાકી છે ની જાણ અહીં દેખાશે.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={[styles.card, !item.isRead && styles.unreadCard]}
                onPress={() => handlePressNotification(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={styles.titleRow}>
                    {!item.isRead ? <View style={styles.unreadDot} /> : null}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardDate}>{formatDateTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.cardMessage}>{item.message}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: C.textMuted },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },
  markAllBtnDisabled: { opacity: 0.5 },
  markAllBtnText: { color: C.green700, fontWeight: "700" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  emptyCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
    color: C.textPrimary,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 16,
  },
  unreadCard: {
    borderColor: C.green100,
    backgroundColor: "#FAFFFA",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.gold,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: C.textPrimary,
  },
  cardDate: {
    fontSize: 12,
    color: C.textMuted,
  },
  cardMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSecondary,
  },
});

/**
 * Live APMC / Mandi crop prices — tab screen (between Report and Profile).
 * Requires backend DATA_GOV_IN_API_KEY to be set.
 */
import { HEADER_PADDING_TOP } from "@/constants/theme";
import { getApmcPrices, getApmcCommodities, type ApmcPriceRecord } from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  bg: "#F0FDF4",
  surface: "#FFFFFF",
  green700: "#15803D",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  border: "#BBF7D0",
};

function getPrice(r: ApmcPriceRecord): number {
  const v = r.modal_price ?? r.max_price ?? r.min_price;
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

function getLabel(r: ApmcPriceRecord): string {
  const market = r.market ?? (r as any).Market ?? "";
  const commodity = r.commodity ?? (r as any).Commodity ?? "";
  const state = r.state ?? (r as any).State ?? "";
  return [commodity, market, state].filter(Boolean).join(" · ") || "—";
}

export default function LivePriceTabScreen() {
  const [prices, setPrices] = useState<ApmcPriceRecord[]>([]);
  const [commodities, setCommodities] = useState<string[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<string | "">("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [commodityRes, priceRes] = await Promise.all([
        getApmcCommodities(),
        getApmcPrices({
          commodity: selectedCommodity || undefined,
          limit: 80,
        }),
      ]);
      setCommodities(commodityRes.data ?? []);
      setPrices(priceRes.data ?? []);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "ભાવ લોડ ન થઈ શક્યા";
      setError(msg);
      setPrices([]);
      if (!isRefresh) Alert.alert("જીવંત ભાવ", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCommodity]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={[styles.header, { paddingTop: HEADER_PADDING_TOP }]}>
        <Text style={styles.title}>જીવંત ભાવ (APMC મંડી)</Text>
        <Text style={styles.subtitle}>સરકારી ડેટા — data.gov.in</Text>
      </View>

      {commodities.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipScrollContent}
        >
          <TouchableOpacity
            style={[styles.chip, !selectedCommodity && styles.chipActive]}
            onPress={() => setSelectedCommodity("")}
          >
            <Text style={[styles.chipText, !selectedCommodity && styles.chipTextActive]}>બધા</Text>
          </TouchableOpacity>
          {commodities.map((c) => {
            const active = selectedCommodity === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedCommodity(c)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.green700} />
          <Text style={styles.loadText}>ભાવ લોડ થઈ રહ્યા છે...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPrices()}>
            <Text style={styles.retryBtnText}>ફરી ચાલુ કરો</Text>
          </TouchableOpacity>
        </View>
      ) : prices.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>આ સમયે ભાવ ઉપલબ્ધ નથી</Text>
          <Text style={styles.emptySub}>બેકેન્ડ પર DATA_GOV_IN_API_KEY સેટ કરો</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchPrices(true)} colors={[C.green700]} />
          }
        >
          {prices.map((r, i) => (
            <View key={`${getLabel(r)}-${i}`} style={styles.card}>
              <Text style={styles.cardLabel} numberOfLines={2}>{getLabel(r)}</Text>
              <Text style={styles.cardPrice}>{formatWholeNumber(getPrice(r))}</Text>
              <Text style={styles.cardUnit}>₹/ક્વિંટલ</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 22, fontWeight: "800", color: C.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 12, color: C.textMuted, marginTop: 4 },
  chipScroll: { maxHeight: 48, marginVertical: 8 },
  chipScrollContent: { paddingHorizontal: 16, gap: 8, flexDirection: "row", alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  chipActive: { backgroundColor: C.green700, borderColor: C.green700 },
  chipText: { fontSize: 14, fontWeight: "700", color: C.textSecondary },
  chipTextActive: { color: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadText: { marginTop: 12, fontSize: 15, color: C.textMuted },
  errorText: { fontSize: 15, color: C.textSecondary, textAlign: "center" },
  retryBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: C.green700, borderRadius: 12 },
  retryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  emptyText: { fontSize: 17, fontWeight: "700", color: C.textSecondary },
  emptySub: { marginTop: 8, fontSize: 13, color: C.textMuted },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardLabel: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  cardPrice: { fontSize: 20, fontWeight: "900", color: C.green700, marginTop: 4 },
  cardUnit: { fontSize: 12, color: C.textMuted, marginTop: 2 },
});

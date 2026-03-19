import { useLanguage } from "@/contexts/LanguageContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  deleteCrop,
  getCropById,
  getCurrentFinancialYear,
  getExpenseSummary,
  getIncomes,
  getYearlyReport,
  updateCropStatus,
  type Crop,
  type CropReportRow,
  type CropStatus,
  type ExpenseCategory,
  type Income,
} from "@/utils/api";
import { AppTheme } from "@/constants/theme";
import { getCropColors } from "@/utils/cropColors";
import { getCropImageSource } from "@/utils/cropImageSource";
import { formatWholeNumber } from "@/utils/format";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const C = { ...AppTheme, gold: "#F9A825", goldPale: "#FFFDE7" };

const ACTIVE_COLOR = "#0D9488";
const ACTIVE_PALE = "#CCFBF1";

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  Active: { bg: ACTIVE_PALE, text: ACTIVE_COLOR, dot: ACTIVE_COLOR },
  Harvested: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Closed: { bg: C.expensePale, text: C.expense, dot: "#EF4444" },
};

const EXPENSE_CATEGORY_LABELS: Partial<Record<ExpenseCategory, string>> = {
  Seed: "બિયારણ",
  Fertilizer: "ખાતર",
  Pesticide: "દવા",
  Labour: "મજૂરી",
  Machinery: "મશીનરી",
};

const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  "Seed",
  "Fertilizer",
  "Pesticide",
  "Labour",
  "Machinery",
];

// Backend sometimes sends crop names with different casing/spaces.
// This helps always show the translated Gujarati crop name.
const CROP_NAME_KEYS = [
  "Groundnut",
  "Cotton",
  "Chana",
  "Jeera",
  "Wheat",
  "Garlic",
  "Onion",
  "Dhana",
  "Tal",
  "Maize",
  "Kalonji",
  "Moong",
  "Urad",
  "Moth",
  "Vatana",
  "Val",
  "Soybean",
  "Castor",
  "Tuver",
  "Methi",
  "Bajra",
  "Marchi",
];

function cropDisplayName(name: string, t: (s: string, k: string) => string): string {
  const raw = (name ?? "").trim();
  if (!raw) return raw;

  // Direct lookup first (exact key match)
  const direct = t("cropNames", raw);
  if (direct && direct !== raw) return direct;

  // Case-insensitive lookup for known keys
  const normalized = raw.toLowerCase();
  const matchKey = CROP_NAME_KEYS.find((k) => k.toLowerCase() === normalized);
  if (matchKey) return t("cropNames", matchKey) || matchKey;

  // Fallback to raw text
  return direct || raw;
}

export default function CropMahitiScreen() {
  const { t } = useLanguage();
  const { refreshTransactions } = useRefresh();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 12;
  const scrollPad = 100 + bottomPad;

  const params = useLocalSearchParams<{ id?: string; year?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const paramYear = Array.isArray(params.year) ? params.year[0] : params.year;

  const selectedYear = paramYear ?? getCurrentFinancialYear();

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [draftCrop, setDraftCrop] = useState<Crop | null>(null);

  const [summaryIncomes, setSummaryIncomes] = useState<Income[]>([]);
  const [summaryByCategory, setSummaryByCategory] =
    useState<Partial<Record<ExpenseCategory, number>>>({});
  const [summaryRow, setSummaryRow] = useState<CropReportRow | null>(null);

  const cropColorInfo = useMemo(() => {
    const cropName = draftCrop?.cropName ?? "";
    return getCropColors(cropName);
  }, [draftCrop?.cropName]);

  const byCategory = summaryByCategory;

  const fallbackIncome = useMemo(
    () => summaryIncomes.reduce((sum: number, i: Income) => sum + (i.amount || 0), 0),
    [summaryIncomes],
  );

  const fallbackExpense = useMemo(() => {
    const values = Object.values(summaryByCategory) as number[];
    return values.reduce((sum: number, v) => sum + (v || 0), 0);
  }, [summaryByCategory]);

  const totalIncome = summaryRow?.income ?? fallbackIncome;
  const totalExpense = summaryRow?.expense ?? fallbackExpense;
  const netProfit = summaryRow?.profit ?? totalIncome - totalExpense;

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setSummaryLoading(false);
      Alert.alert("Crop not found", "Invalid crop id.");
      return;
    }

    setLoading(true);
    setSummaryLoading(true);
    try {
      const [crop, incomesRes, expSummary, yearly] = await Promise.all([
        getCropById(id),
        getIncomes(1, 200, id, undefined, undefined, selectedYear),
        getExpenseSummary(undefined, id, selectedYear),
        getYearlyReport(selectedYear),
      ]);

      setDraftCrop(crop);
      setSummaryIncomes(incomesRes.data ?? []);

      const byCat: Partial<Record<ExpenseCategory, number>> = {};
      (expSummary.summary ?? []).forEach((item) => {
        const cat = item._id as ExpenseCategory;
        byCat[cat] = item.total;
      });
      setSummaryByCategory(byCat);

      const rows = (yearly?.crops ?? []) as CropReportRow[];
      const row = rows.find((r) => r._id === crop._id) ?? null;
      setSummaryRow(row);
    } catch (err: any) {
      console.warn("[CropMahiti] load error:", err?.message ?? err);
      Alert.alert(t("common", "error"), err?.message ?? "Failed to load crop details.");
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [id, selectedYear, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusSave = useCallback(async () => {
    if (!draftCrop) return;
    try {
      await updateCropStatus(
        draftCrop._id,
        (draftCrop.status ?? "Active") as CropStatus,
      );
      refreshTransactions();
      Toast.show({ type: "success", text1: "સફળ!", text2: "સ્થિતિ અપડેટ થઈ." });
      router.back();
    } catch (err: any) {
      Alert.alert(t("common", "error"), err.message ?? "Failed to update status.");
    }
  }, [draftCrop, refreshTransactions, t]);

  const handleDelete = useCallback(() => {
    if (!draftCrop) return;
    Alert.alert(t("crop", "confirmDelete"), t("crop", "confirmDeleteMsg"), [
      { text: t("crop", "cancel"), style: "cancel" },
      {
        text: t("crop", "deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCrop(draftCrop._id);
            refreshTransactions();
            Toast.show({ type: "success", text1: "સફળ!", text2: "પાક કાઢી નાખ્યો." });
            router.back();
          } catch (err: any) {
            Alert.alert(t("common", "error"), err.message);
          }
        },
      },
    ]);
  }, [draftCrop, refreshTransactions, t]);

  const handleEdit = useCallback(() => {
    if (!draftCrop) return;
    router.push(`/crop/edit-crop?id=${draftCrop._id}` as any);
  }, [draftCrop]);

  const statusChips: CropStatus[] = ["Active", "Harvested", "Closed"];

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.green700} />
          <Text style={styles.loadingText}>{t("crop", "loadingCrops")}</Text>
        </View>
      </View>
    );
  }

  const crop = draftCrop;
  if (!crop) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>Invalid crop.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [cropPale, cropColor] = cropColorInfo;

  const displayDate = new Date(crop.sowingDate ?? crop.createdAt).toLocaleDateString("gu-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <LinearGradient colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]} style={styles.topGrad} />

      <ScreenHeader
        title="પાક મહિતી"
        subtitle={cropDisplayName(crop.cropName, t)}
        rightElement={
          <View style={styles.headerRightRow}>
            <TouchableOpacity onPress={handleEdit} style={styles.headerIconBtn} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={20} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={20} color={C.expense} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: scrollPad }}
      >
        <View style={styles.summaryCard}>
          <View style={[styles.summaryAccentBar, { backgroundColor: cropColor }]} />

          <View style={styles.summaryHeader}>
            <View style={[styles.cropEmojiWrap, { backgroundColor: cropPale }]}>
              {(() => {
                const src = getCropImageSource(crop.cropName);
                return src ? (
                  <Image source={src} style={styles.cropImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.cropEmojiText}>{crop.cropEmoji ?? "🌱"}</Text>
                );
              })()}
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {cropDisplayName(crop.cropName, t)}
                {crop.subType ? <Text style={styles.summarySubInline}> - {crop.subType}</Text> : null}
              </Text>
              <Text style={styles.summaryArea}>{Math.round(crop.area)} વીઘા</Text>
              <Text style={styles.summaryDate}>{displayDate}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>કેટેગરી પ્રમાણે ખર્ચ</Text>

        {summaryLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={C.green700} />
            <Text style={styles.loadingRowText}>લોડ થઈ રહ્યું છે...</Text>
          </View>
        ) : (
          <>
            {EXPENSE_CATEGORY_ORDER.map((cat) => (
              <View key={cat} style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</Text>
                <Text style={styles.categoryValue}>
                  ₹ {Math.round(byCategory[cat] || 0).toLocaleString("en-IN")}
                </Text>
              </View>
            ))}

            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>કુલ ખર્ચ:</Text>
                <Text style={styles.totalValueExpense}>₹ {formatWholeNumber(totalExpense)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>કુલ આવક:</Text>
                <Text style={styles.totalValueIncome}>₹ {formatWholeNumber(totalIncome)}</Text>
              </View>

              {crop.landType === "bhagma" && crop.bhagmaPercentage != null && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      ભાગ્યાદારને આપવાનો ભાગ ({crop.bhagmaPercentage}%):
                    </Text>
                    <Text style={styles.totalValueIncome}>
                      ₹{" "}
                      {Math.round((totalIncome * crop.bhagmaPercentage) / 100).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>તમારી આવક (ભાગ પછી):</Text>
                    <Text style={styles.totalValueIncome}>
                      ₹{" "}
                      {Math.round(totalIncome * (1 - crop.bhagmaPercentage / 100)).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>ચોખ્ખો નફો:</Text>
                <Text
                  style={[
                    styles.totalValueNet,
                    { color: netProfit >= 0 ? C.income : C.expense },
                  ]}
                >
                  ₹ {formatWholeNumber(netProfit)}
                </Text>
              </View>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusCardLabel}>વિકલ્પ પસંદ કરો</Text>
              <View style={styles.divider} />

              <View style={styles.statusChipRow}>
                {statusChips.map((s, idx) => {
                  const sStyle = STATUS_STYLE[s] ?? STATUS_STYLE.Active;
                  const selected = (crop.status ?? "Active") === s;
                  const isFirst = idx === 0;
                  const isLast = idx === statusChips.length - 1;
                  return (
                    <TouchableOpacity
                      key={s}
                      activeOpacity={0.9}
                      onPress={() => {
                        setDraftCrop((prev) => (prev ? { ...prev, status: s } : prev));
                      }}
                      style={[
                        styles.statusChip,
                        isFirst && styles.statusChipFirst,
                        isLast && styles.statusChipLast,
                        selected && { borderColor: sStyle.dot, backgroundColor: sStyle.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          selected && { color: sStyle.text },
                        ]}
                      >
                        {s === "Active"
                          ? t("common", "statusActive")
                          : s === "Harvested"
                            ? t("common", "statusHarvested")
                            : t("common", "statusClosed")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        <TouchableOpacity
          style={[styles.bigBtn, styles.bigBtnSecondary]}
          onPress={() => router.back()}
          activeOpacity={0.9}
        >
          <Text style={styles.bigBtnTextSecondary}>બંધ કરો</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bigBtn, styles.bigBtnPrimary]}
          onPress={handleStatusSave}
          activeOpacity={0.9}
        >
          <Text style={styles.bigBtnTextPrimary}>સેવ કરો</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topGrad: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: C.textMuted, fontWeight: "700" },
  errorText: { fontSize: 16, color: C.textMuted, fontWeight: "700" },
  errorBtn: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: C.green50,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  errorBtnText: { fontSize: 15, fontWeight: "800", color: C.textSecondary },

  headerRightRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },

  summaryCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: "#00000005",
    overflow: "hidden",
    marginTop: 4,
  },
  summaryAccentBar: { height: 6, width: "100%" },
  summaryHeader: { padding: 18, flexDirection: "row", alignItems: "center" },

  cropEmojiWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  cropImage: { width: 34, height: 34 },
  cropEmojiText: { fontSize: 26 },

  summaryTitle: { fontSize: 22, fontWeight: "900", color: C.textPrimary },
  summarySubInline: { fontSize: 18, fontWeight: "900", color: C.textSecondary },
  summaryArea: { marginTop: 6, fontSize: 18, fontWeight: "800", color: C.textSecondary },
  summaryDate: { marginTop: 6, fontSize: 14, fontWeight: "700", color: C.textMuted },

  sectionTitle: {
    paddingHorizontal: 20,
    marginTop: 18,
    fontSize: 21,
    fontWeight: "900",
    color: C.textSecondary,
  },

  loadingRow: { paddingHorizontal: 20, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  loadingRowText: { fontSize: 15, color: C.textMuted, fontWeight: "700" },

  categoryRow: { paddingHorizontal: 20, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryLabel: { fontSize: 18, color: C.textSecondary, fontWeight: "700" },
  categoryValue: { fontSize: 18, fontWeight: "900", color: C.expense },

  totalsBox: {
    marginTop: 14,
    marginHorizontal: 20,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },

  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 },
  totalLabel: { flex: 1, fontSize: 15, fontWeight: "800", color: C.textSecondary },
  totalValueExpense: { fontSize: 18, fontWeight: "900", color: C.expense, textAlign: "right" },
  totalValueIncome: { fontSize: 18, fontWeight: "900", color: C.income, textAlign: "right" },
  totalValueNet: { fontSize: 20, fontWeight: "900", textAlign: "right" },

  statusCard: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },
  statusCardLabel: { fontSize: 16, fontWeight: "800", color: ACTIVE_COLOR },
  divider: { marginTop: 8, marginBottom: 10, height: 1, backgroundColor: C.borderLight },
  statusChipRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  statusChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    backgroundColor: C.surface,
    alignItems: "center",
  },
  statusChipFirst: { marginRight: 4 },
  statusChipLast: { marginLeft: 4 },
  statusChipText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    backgroundColor: "rgba(245,247,242,0.96)",
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    zIndex: 20,
    elevation: 20,
    paddingTop: 8,
  },
  bigBtn: { flex: 1, borderRadius: 16, alignItems: "center", paddingVertical: 14 },
  bigBtnSecondary: { backgroundColor: "#E5E7EB" },
  bigBtnPrimary: { backgroundColor: C.green700 },
  bigBtnTextSecondary: { fontSize: 16, fontWeight: "800", color: "#111827" },
  bigBtnTextPrimary: { fontSize: 16, fontWeight: "800", color: "#fff" },
});


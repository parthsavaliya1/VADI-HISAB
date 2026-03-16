/**
 * Edit crop — single-page form. No step wizard.
 * Route: /crop/edit-crop?id=xxx
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import {
  getCropById,
  getCurrentFinancialYear,
  getFinancialYearOptions,
  getCrops,
  getMyProfile,
  updateCrop,
  type CropPayload,
  type CropSeason,
  type ProfileFarm,
} from "@/utils/api";
import { ScreenHeader } from "@/components/ScreenHeader";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const C = {
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  textPrimary: "#1A2E1C",
  textSecondary: "#3D5C40",
  textMuted: "#7A9B7E",
  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

const CROP_SUBTYPES: Record<string, string[]> = {
  Groundnut: ["BT-32", "BT-37", "BT-38", "BT-39", "BT-45", "BT-128", "જિવિસ", "રોહિણી", "મિનક્ષી", "ગિર્ણાર", "રેન્બો"],
  Cotton: ["2 BT", "ભક્તિ", "ATM", "જાદુ"],
  Chana: ["દેશી", "3", "કાબુલી", "સફેદ"],
  Jeera: ["માંગલમ 4", "માંગલમ 5", "નિસાન 444", "જીરાલી", "કૈલાશ 4"],
  Wheat: ["452", "496", "લોક 1"],
  Garlic: ["દેશી", "MP", "ચાઇનીઝ"],
  Onion: ["પીળી પત્તી", "લાલ", "સફેદ", "દ્રોણા", "કલસ કિંગ", "પંચ ગંગા"],
  Dhana: ["2", "4", "JAS 4", "ધાણી"],
  Tal: ["કાળો", "સફેદ"],
  Maize: ["સાદી", "અમેરિકન"],
  Kalonji: ["સ્થાનિક"],
  Moong: ["સ્થાનિક"],
  Urad: ["સ્થાનિક"],
  Moth: ["સ્થાનિક"],
  Vatana: ["લીલા", "સફેદ"],
  Val: ["સ્થાનિક"],
  Soybean: ["સ્થાનિક"],
  Castor: ["સ્થાનિક"],
  Tuver: ["સ્થાનિક"],
  Methi: ["સ્થાનિક"],
  Bajra: ["સ્થાનિક"],
  Marchi: ["લાંબી", "દેશી", "તીખી", "કાશ્મીરી"],
};
// Emojis chosen to best match each crop (research-based; no dedicated cotton/chickpea in Unicode)
const CROP_EMOJIS: Record<string, string> = {
  Groundnut: "🥜",
  Cotton: "💮",
  Chana: "🫘",
  Jeera: "🌿",
  Wheat: "🌾",
  Garlic: "🧄",
  Onion: "🧅",
  Dhana: "🌿",
  Tal: "🌱",
  Maize: "🌽",
  Kalonji: "🌿",
  Moong: "🫘",
  Urad: "🫘",
  Moth: "🫘",
  Vatana: "🫛",
  Val: "🫘",
  Soybean: "🫘",
  Castor: "🌱",
  Tuver: "🫘",
  Methi: "🌿",
  Bajra: "🌾",
  Marchi: "🌶️",
};
const CROP_VALUES = [
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

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

export default function EditCropScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, tParam } = useLanguage();
  const { profile, setProfile } = useProfile();
  const keyboardHeight = useKeyboardHeight();
  const keyboardHeightRef = useRef(keyboardHeight);
  useEffect(() => {
    keyboardHeightRef.current = keyboardHeight;
  }, [keyboardHeight]);

  const scrollRef = useRef<ScrollView | null>(null);
  const makeOnFocus = useCallback(
    (fieldRef: React.RefObject<View | null>) => () => {
      if (!fieldRef.current || !scrollRef.current) return;
      setTimeout(() => {
        fieldRef.current?.measureLayout(
          // @ts-ignore measure relative to ScrollView content
          scrollRef.current,
          (_left: number, top: number, _width: number, _height: number) => {
            const kbH = keyboardHeightRef.current || 300;
            const windowH = Dimensions.get("window").height;
            const visibleH = windowH - kbH - 80;
            const targetY = Math.max(0, top - visibleH * 0.4);
            scrollRef.current?.scrollTo({ y: targetY, animated: true });
          },
          () => {
            scrollRef.current?.scrollToEnd({ animated: true });
          },
        );
      }, 280);
    },
    [],
  );

  const customCropRef = useRef<View | null>(null);
  const subTypeRef = useRef<View | null>(null);
  const areaRef = useRef<View | null>(null);

  const SEASONS: { value: CropSeason; label: string; icon: string }[] = [
    { value: "Chomasu", label: t("common", "kharif"), icon: "☔" },
    { value: "Siyalo", label: t("common", "rabi"), icon: "❄️" },
    { value: "Unalo", label: t("common", "summer"), icon: "☀️" },
  ];
  const CROPS = CROP_VALUES.map((value) => ({
    value,
    label: t("cropNames", value),
    emoji: CROP_EMOJIS[value] ?? "🌱",
    subtypes: CROP_SUBTYPES[value] ?? [],
  }));
  const BHAGMA_SHARE_OPTIONS: { value: string; label: string }[] = [
    { value: "50", label: t("editCrop", "bhagmaShare50") },
    { value: "33.33", label: t("editCrop", "bhagmaShare33") },
    { value: "25", label: t("editCrop", "bhagmaShare25") },
  ];

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(getCurrentFinancialYear());
  const [season, setSeason] = useState<CropSeason | "">("");
  const [cropValue, setCropValue] = useState("");
  const [customCrop, setCustomCrop] = useState("");
  const [cropEmoji, setCropEmoji] = useState("🌱");
  const [subType, setSubType] = useState("");
  const [selectedFarm, setSelectedFarm] = useState<ProfileFarm | null>(null);
  const [area, setArea] = useState("");

  const [bhagmaOption, setBhagmaOption] = useState<"ha" | "na">("na");
  const [bhagmaPercentage, setBhagmaPercentage] = useState<string>("");

  const [usedAreaByFarm, setUsedAreaByFarm] = useState<Record<string, number>>({});

  const baseYears = getFinancialYearOptions();
  const [startY] = getCurrentFinancialYear().split("-").map(Number);
  const prevYear = `${startY - 1}-${String(startY % 100).padStart(2, "0")}`;
  const yearOptions = [prevYear, ...baseYears];

  useEffect(() => {
    if (!id) {
      setError("Invalid crop");
      setLoading(false);
      return;
    }
    getCropById(id)
      .then((c) => {
        const cr = c as any;
        const name = cr.cropName ?? "";
        const matchedCrop = CROPS.find((co) => co.value === name);
        setYear(cr.year ?? getCurrentFinancialYear());
        setSeason((cr.season as CropSeason) || "");
        setCropValue(matchedCrop ? name : "");
        setCustomCrop(matchedCrop ? "" : name);
        setCropEmoji(matchedCrop ? matchedCrop.emoji : (cr.cropEmoji ?? "🌱"));
        setSubType(cr.subType ?? "");
        setArea(String(cr.area ?? ""));
        setBhagmaOption(cr.landType === "bhagma" ? "ha" : "na");
        setBhagmaPercentage((() => {
          const pct = cr.bhagmaPercentage;
          if (pct == null) return "";
          const n = Number(pct);
          if (Math.abs(n - 25) < 2) return "25";
          if (Math.abs(n - 33.33) < 2 || Math.abs(n - 33) < 2) return "33.33";
          if (Math.abs(n - 50) < 2) return "50";
          return String(pct);
        })());
        if (cr.farmName) setSelectedFarm({ name: cr.farmName, area: 0, category: "owned" });
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => {});
  }, [setProfile]);

  const fetchUsedAreaByFarm = useCallback(async () => {
    if (!year) return;
    try {
      const res = await getCrops(1, 200, undefined, "Active", year);
      const byFarm: Record<string, number> = {};
      (res.data || []).forEach((c) => {
        const cid = (c as any)._id;
        if (id && cid === id) return;
        const name = (c as any).farmName ?? "";
        if (!name) return;
        const a = Number((c as any).area) || 0;
        byFarm[name] = (byFarm[name] || 0) + a;
      });
      setUsedAreaByFarm(byFarm);
    } catch {
      setUsedAreaByFarm({});
    }
  }, [year, id]);

  useEffect(() => {
    fetchUsedAreaByFarm();
  }, [fetchUsedAreaByFarm]);

  const farms = profile?.farms ?? [];
  const selectedFarmName = selectedFarm?.name;
  const usedForSelected = selectedFarmName ? usedAreaByFarm[selectedFarmName] ?? 0 : 0;
  const farmArea = farms.find((f) => f.name === selectedFarmName)?.area ?? 0;
  const maxBigha = farmArea > 0 ? Math.max(0, farmArea - usedForSelected) : null;

  const finalCropName = customCrop.trim() || cropValue.trim();
  const validate = (): string | null => {
    if (!season) return t("editCrop", "errSelectSeason");
    if (!finalCropName) return t("editCrop", "errSelectCrop");
    const areaNum = Number(area);
    if (!area || isNaN(areaNum) || areaNum <= 0) return t("editCrop", "errValidArea");
    if (farms.length > 0 && !selectedFarm) return t("editCrop", "errSelectFarm");
    if (maxBigha != null && areaNum > maxBigha) return tParam("editCrop", "errMaxBigha", { max: String(Math.round(maxBigha)) });
    if (bhagmaOption === "ha" && !["25", "33.33", "50"].includes(bhagmaPercentage.trim())) return t("editCrop", "errSelectBhagma");
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert(`⚠️ ${t("editCrop", "errTitle")}`, err);
      return;
    }
    if (!id) return;
    const payload: CropPayload = {
      season: season as CropSeason,
      cropName: finalCropName,
      cropEmoji: cropEmoji,
      area: Number(area),
      areaUnit: "Bigha",
      status: "Active",
      subType: subType.trim() || undefined,
      year,
      farmName: selectedFarm?.name,
      landType: bhagmaOption === "ha" ? "bhagma" : "ghare",
      bhagmaPercentage: bhagmaOption === "ha" && bhagmaPercentage.trim() ? Number(bhagmaPercentage) : undefined,
    };
    try {
      setSaving(true);
      await updateCrop(id, payload);
      Toast.show({
        type: "success",
        text1: t("editCrop", "successTitle"),
        text2: t("editCrop", "successMsg"),
      });
      router.back();
    } catch (e: any) {
      Alert.alert(t("editCrop", "errTitle"), e?.message ?? t("editCrop", "errTitle"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>{t("editCrop", "loading")}</Text>
      </View>
    );
  }
  if (error || !id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? t("editCrop", "noData")}</Text>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("editCrop", "back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : insets.bottom}
    >
      <View style={[styles.headerWrap, { backgroundColor: C.bg }]}>
        <ScreenHeader title={`✏️ ${t("editCrop", "title")}`} style={{ marginBottom: 0, backgroundColor: C.bg }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              (keyboardHeight > 0 ? keyboardHeight + 40 : 24) + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card} ref={customCropRef}>
          <SectionLabel text={t("editCrop", "yearLabel")} />
          <View style={styles.yearRow}>
            {yearOptions.map((fy) => (
              <TouchableOpacity
                key={fy}
                style={[styles.yearPill, year === fy && styles.yearPillActive]}
                onPress={() => setYear(fy)}
              >
                <Text style={[styles.yearPillText, year === fy && styles.yearPillTextActive]}>{fy}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionLabel text={`🌦️ ${t("editCrop", "seasonLabel")}`} />
          <View style={styles.chipRow}>
            {SEASONS.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.chip, season === s.value && styles.chipActive]}
                onPress={() => setSeason(s.value)}
              >
                <Text style={styles.chipEmoji}>{s.icon}</Text>
                <Text style={[styles.chipText, season === s.value && styles.chipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionLabel text={`🌱 ${t("editCrop", "cropLabel")}`} />
          <View style={styles.cropGrid}>
            {CROPS.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.cropPill, cropValue === c.value && !customCrop && styles.cropPillActive]}
                onPress={() => {
                  setCropValue(c.value);
                  setCropEmoji(c.emoji);
                  setCustomCrop("");
                }}
              >
                <Text style={styles.cropPillEmoji}>{c.emoji}</Text>
                <Text style={[styles.cropPillText, cropValue === c.value && !customCrop && styles.cropPillTextActive]} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.orDivider}>— {t("editCrop", "customCropPlaceholder")} —</Text>
          <TextInput
            style={[styles.input, customCrop.length > 0 && styles.inputActive]}
            value={customCrop}
            onChangeText={(v) => {
              setCustomCrop(v);
              if (v.trim()) setCropValue("");
            }}
            placeholder={t("editCrop", "cropNamePlaceholder")}
            placeholderTextColor={C.textMuted}
            onFocus={makeOnFocus(customCropRef)}
          />
        </View>

        <View style={styles.card} ref={subTypeRef}>
          <SectionLabel text={`🏷️ ${t("editCrop", "subtypeLabel")}`} />
          {(cropValue || customCrop.trim()) ? (() => {
            const selectedCrop = CROPS.find((c) => c.value === cropValue);
            const subtypes = selectedCrop?.subtypes ?? [];
            return (
              <>
                {subtypes.length > 0 && (
                  <View style={styles.subtypeGrid}>
                    {subtypes.map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[styles.subtypeChip, subType === st && styles.subtypeChipActive]}
                        onPress={() => setSubType(st)}
                      >
                        <Text style={[styles.subtypeChipText, subType === st && styles.subtypeChipTextActive]} numberOfLines={1}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.orDivider}>{t("editCrop", "orCustomType")}</Text>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={subType}
                  onChangeText={setSubType}
                  placeholder={t("editCrop", "typePlaceholder")}
                  placeholderTextColor={C.textMuted}
                  onFocus={makeOnFocus(subTypeRef)}
                />
              </>
            );
          })() : (
            <Text style={styles.hint}>{t("editCrop", "selectCropFirst")}</Text>
          )}
        </View>

        {farms.length > 0 && (
          <View style={styles.card}>
            <SectionLabel text={`🌾 ${t("editCrop", "farmSelectLabel")}`} />
            <View style={styles.chipRow}>
              {farms.map((farm, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.farmChip, selectedFarm?.name === farm.name && styles.farmChipActive]}
                  onPress={() => setSelectedFarm(farm)}
                >
                  <Text style={[styles.farmChipText, selectedFarm?.name === farm.name && styles.farmChipTextActive]}>
                    {farm.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card} ref={areaRef}>
          <SectionLabel text={`📐 ${t("editCrop", "areaLabelRequired")}`} />
          <View style={styles.areaRow}>
            <TextInput
              style={styles.areaInput}
              value={area}
              onChangeText={setArea}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              onFocus={makeOnFocus(areaRef)}
            />
            <View style={styles.areaUnit}>
              <Text style={styles.areaUnitText}>{t("editCrop", "bighaUnit")}</Text>
            </View>
          </View>
          {maxBigha != null && (
            <Text style={styles.hint}>{tParam("editCrop", "maxBighaHint", { max: String(Math.round(maxBigha)) })}</Text>
          )}
          <View style={styles.presetRow}>
            {["1", "2", "5", "10", "15", "25"].map((n) => {
              const num = Number(n);
              const allowed = maxBigha == null || num <= maxBigha;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.presetChip, area === n && styles.presetChipActive, !allowed && styles.presetChipDisabled]}
                  onPress={() => allowed && setArea(n)}
                  disabled={!allowed}
                >
                  <Text style={[styles.presetChipText, area === n && styles.presetChipTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <SectionLabel text={`🤝 ${t("editCrop", "bhagmaLabel")}`} />
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.presetChip, bhagmaOption === "na" && styles.presetChipActive]}
              onPress={() => { setBhagmaOption("na"); setBhagmaPercentage(""); }}
            >
              <Text style={[styles.presetChipText, bhagmaOption === "na" && styles.presetChipTextActive]}>{t("editCrop", "bhagmaNo")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetChip, bhagmaOption === "ha" && styles.presetChipActive]}
              onPress={() => setBhagmaOption("ha")}
            >
              <Text style={[styles.presetChipText, bhagmaOption === "ha" && styles.presetChipTextActive]}>{t("editCrop", "bhagmaYes")}</Text>
            </TouchableOpacity>
          </View>
          {bhagmaOption === "ha" && (
            <View style={[styles.chipRow, { marginTop: 14 }]}>
              {BHAGMA_SHARE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.presetChip, bhagmaPercentage === opt.value && styles.presetChipActive]}
                  onPress={() => setBhagmaPercentage(opt.value)}
                >
                  <Text style={[styles.presetChipText, bhagmaPercentage === opt.value && styles.presetChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={[C.green700, C.green500]}
            style={styles.saveBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? t("editCrop", "savingBtn") : t("editCrop", "saveBtn")}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.bg,
    padding: 24,
  },
  loadingText: { fontSize: 16, color: C.textMuted },
  errorText: { fontSize: 16, color: "#B71C1C", textAlign: "center" },
  backBtnStandalone: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: C.green50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.green100,
  },
  backBtnText: { fontSize: 16, fontWeight: "700", color: C.green700 },

  headerWrap: { borderBottomWidth: 1, borderBottomColor: C.borderLight },

  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, paddingBottom: 24 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 12,
  },
  yearRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  yearPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  yearPillActive: { backgroundColor: C.green100, borderColor: C.green700 },
  yearPillText: { fontSize: 18, fontWeight: "700", color: C.textSecondary },
  yearPillTextActive: { color: C.green700 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  chipActive: { backgroundColor: C.green100, borderColor: C.green700 },
  chipEmoji: { fontSize: 18 },
  chipText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  chipTextActive: { color: C.green700 },

  cropGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cropPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  cropPillActive: { backgroundColor: C.green100, borderColor: C.green700 },
  cropPillEmoji: { fontSize: 18 },
  cropPillText: { fontSize: 14, fontWeight: "700", color: C.textSecondary, maxWidth: 70 },
  cropPillTextActive: { color: C.green700 },

  subtypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subtypeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  subtypeChipActive: { backgroundColor: C.green100, borderColor: C.green700 },
  subtypeChipText: { fontSize: 14, fontWeight: "700", color: C.textSecondary },
  subtypeChipTextActive: { color: C.green700 },
  orDivider: { fontSize: 13, color: C.textMuted, marginTop: 14, marginBottom: 4, textAlign: "center" },

  farmChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  farmChipActive: { backgroundColor: C.green100, borderColor: C.green700 },
  farmChipText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  farmChipTextActive: { color: C.green700 },

  input: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.textPrimary,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  inputActive: { borderColor: C.green700, backgroundColor: C.green50 },
  notesInput: { minHeight: 80, paddingTop: 12 },
  areaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  areaInput: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 20,
    fontWeight: "800",
    color: C.textPrimary,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  areaUnit: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.green50, borderRadius: 10 },
  areaUnitText: { fontSize: 16, fontWeight: "800", color: C.green700 },
  hint: { fontSize: 13, color: C.textMuted, marginTop: 8 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  presetChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  presetChipActive: { backgroundColor: C.green100, borderColor: C.green700 },
  presetChipDisabled: { opacity: 0.5 },
  presetChipText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  presetChipTextActive: { color: C.green700 },

  saveBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden" },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: 18, fontWeight: "800", color: "#fff" },
});

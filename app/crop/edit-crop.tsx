/**
 * Edit crop — single-page form. No step wizard.
 * Route: /crop/edit-crop?id=xxx
 */

import { useProfile } from "@/contexts/ProfileContext";
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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

const paddingTop = Platform.OS === "ios" ? 52 : 40;

const SEASONS: { value: CropSeason; label: string; icon: string }[] = [
  { value: "Kharif", label: "ખરીફ", icon: "☔" },
  { value: "Rabi", label: "રવી", icon: "❄️" },
  { value: "Summer", label: "ઉનાળો", icon: "☀️" },
];

const CROPS: { value: string; label: string; emoji: string; subtypes: string[] }[] = [
  { value: "Cotton", label: "કપાસ", emoji: "☁️", subtypes: ["Bt-Cotton", "Shankar-6", "RCH-2", "MRC-7017"] },
  { value: "Groundnut", label: "મગફળી", emoji: "🥜", subtypes: ["GG-20", "GJG-22", "TG-37A", "J-11"] },
  { value: "Jeera", label: "જીરું", emoji: "🌿", subtypes: ["GJ Jeera-2", "RZ-19", "RZ-209", "GCU-1"] },
  { value: "Garlic", label: "લસણ", emoji: "🧄", subtypes: ["Desi", "Chinese", "Red", "White", "GG-4"] },
  { value: "Onion", label: "ડુંગળી", emoji: "🧅", subtypes: ["Pusa Red", "Agrifound Dark Red", "Local"] },
  { value: "Chana", label: "ચણા", emoji: "🌰", subtypes: ["GG-1", "GG-2", "Desi", "Kabuli"] },
  { value: "Wheat", label: "ઘઉં", emoji: "🌾", subtypes: ["GW-496", "GW-322", "GW-496", "Lok-1"] },
  { value: "Bajra", label: "બાજરી", emoji: "🌾", subtypes: ["GHB-558", "GHB-719", "GHB-744"] },
  { value: "Maize", label: "મકાઈ", emoji: "🌽", subtypes: ["TATA-900M", "DKC-9144", "Pioneer-30V92"] },
];

const BHAGMA_SHARE_OPTIONS: { value: string; label: string }[] = [
  { value: "50", label: "બીજા ભાગે" },
  { value: "33.33", label: "ત્રિજા ભાગે" },
  { value: "25", label: "ચોથા ભાગે" },
];

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

export default function EditCropScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { profile, setProfile } = useProfile();

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
  const [notes, setNotes] = useState("");

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
        setNotes(cr.notes ?? "");
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
        if (cr.farmName) setSelectedFarm({ name: cr.farmName, area: 0, category: "own" });
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
    if (!season) return "કૃપા કરીને સિઝન પસંદ કરો.";
    if (!finalCropName) return "કૃપા કરીને પાક પસંદ કરો અથવા ટાઈપ કરો.";
    const areaNum = Number(area);
    if (!area || isNaN(areaNum) || areaNum <= 0) return "માન્ય વિસ્તાર (વીઘા) દાખલ કરો.";
    if (farms.length > 0 && !selectedFarm) return "કૃપા કરીને વાડી પસંદ કરો.";
    if (maxBigha != null && areaNum > maxBigha) return `આ વાડી પર મહત્તમ ${maxBigha} વીઘા દાખલ કરી શકો.`;
    if (bhagmaOption === "ha" && !["25", "33.33", "50"].includes(bhagmaPercentage.trim())) return "કૃપા કરીને ભાગમા (બીજા / ત્રિજા / ચોથા ભાગે) પસંદ કરો.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("⚠️ ભૂલ", err);
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
      notes: notes.trim() || undefined,
      subType: subType.trim() || undefined,
      year,
      farmName: selectedFarm?.name,
      landType: bhagmaOption === "ha" ? "bhagma" : "ghare",
      bhagmaPercentage: bhagmaOption === "ha" && bhagmaPercentage.trim() ? Number(bhagmaPercentage) : undefined,
    };
    try {
      setSaving(true);
      await updateCrop(id, payload);
      Alert.alert("✅ સફળ!", "પાકની વિગત સાચવાઈ.", [
        { text: "ઠીક છે", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("ભૂલ", e?.message ?? "સાચવવામાં ભૂલ.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>લોડ થઈ રહ્યું છે...</Text>
      </View>
    );
  }
  if (error || !id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "ડેટા મળ્યો નથી"}</Text>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>પાછા જાઓ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <LinearGradient
        colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
        style={[styles.header, { paddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.green700} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>✏️ પાક ફેરફાર</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <SectionLabel text="📅 વર્ષ (જૂન–જૂન)" />
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
          <SectionLabel text="🌦️ સિઝન" />
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
          <SectionLabel text="🌱 પાક" />
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
          <Text style={styles.orDivider}>— અથવા, બીજો પાક ટાઈપ કરો —</Text>
          <TextInput
            style={[styles.input, customCrop.length > 0 && styles.inputActive]}
            value={customCrop}
            onChangeText={(v) => {
              setCustomCrop(v);
              if (v.trim()) setCropValue("");
            }}
            placeholder="પાકનું નામ ટાઈપ કરો..."
            placeholderTextColor={C.textMuted}
          />
        </View>

        <View style={styles.card}>
          <SectionLabel text="🏷️ પ્રકાર/જાત (વૈકલ્પિક)" />
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
                <Text style={styles.orDivider}>— અથવા કસ્ટમ પ્રકાર —</Text>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={subType}
                  onChangeText={setSubType}
                  placeholder="ટાઈપ કરો..."
                  placeholderTextColor={C.textMuted}
                />
              </>
            );
          })() : (
            <Text style={styles.hint}>પહેલા પાક પસંદ કરો</Text>
          )}
        </View>

        {farms.length > 0 && (
          <View style={styles.card}>
            <SectionLabel text="🌾 વાડી પસંદ કરો" />
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

        <View style={styles.card}>
          <SectionLabel text="📐 વિસ્તાર (વીઘા) *" />
          <View style={styles.areaRow}>
            <TextInput
              style={styles.areaInput}
              value={area}
              onChangeText={setArea}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
            <View style={styles.areaUnit}>
              <Text style={styles.areaUnitText}>વીઘા</Text>
            </View>
          </View>
          {maxBigha != null && (
            <Text style={styles.hint}>મહત્તમ {maxBigha} વીઘા (અન્ય સક્રિય પાક સિવાય)</Text>
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
          <SectionLabel text="🤝 ભાગમા આપ્યું છે?" />
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.presetChip, bhagmaOption === "na" && styles.presetChipActive]}
              onPress={() => { setBhagmaOption("na"); setBhagmaPercentage(""); }}
            >
              <Text style={[styles.presetChipText, bhagmaOption === "na" && styles.presetChipTextActive]}>ના</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetChip, bhagmaOption === "ha" && styles.presetChipActive]}
              onPress={() => setBhagmaOption("ha")}
            >
              <Text style={[styles.presetChipText, bhagmaOption === "ha" && styles.presetChipTextActive]}>હા</Text>
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

        <View style={styles.card}>
          <SectionLabel text="📝 નોંધ (વૈકલ્પિક)" />
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="બિયારણ જાત, ખેતર નંબર..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
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
            <Text style={styles.saveBtnText}>{saving ? "સાચવી રહ્યા છીએ..." : "ફેરફાર સાચવો"}</Text>
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

  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary },

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
  yearPillText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
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

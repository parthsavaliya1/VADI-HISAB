import { HEADER_PADDING_TOP } from "@/constants/theme";
import { AppBackButton } from "@/components/AppBackButton";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useProfile } from "@/contexts/ProfileContext";
import {
  createCrop,
  getCurrentFinancialYear,
  getFinancialYearOptions,
  getCropById,
  getCrops,
  getMyProfile,
  updateProfile,
  updateCrop,
  type CropPayload,
  type CropSeason,
  type ProfileFarm,
} from "@/utils/api";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green900: "#1B5E20",
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
  expense: "#C62828",
  expensePale: "#FFEBEE",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SEASONS: {
  value: CropSeason;
  label: string;
  sublabel: string;
  icon: string;
  colors: [string, string];
  selectedColors: [string, string]; // darker when selected
  inactiveBg: [string, string];
}[] = [
  {
    value: "Kharif",
    label: "ખરીફ",
    sublabel: "જૂન – ઓક્ટોબર",
    icon: "☔",
    colors: ["#0EA5E9", "#0369A1"],
    selectedColors: ["#0284C7", "#075985"],
    inactiveBg: ["#E0F2FE", "#BAE6FD"],
  },
  {
    value: "Rabi",
    label: "રવી",
    sublabel: "નવેમ્બર – માર્ચ",
    icon: "❄️",
    colors: ["#6366F1", "#4338CA"],
    selectedColors: ["#4F46E5", "#3730A3"],
    inactiveBg: ["#E0E7FF", "#C7D2FE"],
  },
  {
    value: "Summer",
    label: "ઉનાળો",
    sublabel: "એપ્રિલ – જૂન",
    icon: "☀️",
    colors: ["#F59E0B", "#B45309"],
    selectedColors: ["#D97706", "#92400E"],
    inactiveBg: ["#FEF3C7", "#FDE68A"],
  },
];

const CROPS: {
  value: string;
  label: string;
  emoji: string;
  subtypes: string[];
}[] = [
  {
    value: "Cotton",
    label: "કપાસ",
    emoji: "💮",
    subtypes: ["Bt-Cotton", "Shankar-6", "RCH-2", "MRC-7017"],
  },
  {
    value: "Groundnut",
    label: "મગફળી",
    emoji: "🥜",
    subtypes: ["GG-20", "GJG-22", "TG-37A", "J-11"],
  },
  {
    value: "Jeera",
    label: "જીરું",
    emoji: "🌿",
    subtypes: ["GJ Jeera-2", "RZ-19", "RZ-209", "GCU-1"],
  },
  {
    value: "Garlic",
    label: "લસણ",
    emoji: "🧄",
    subtypes: ["Desi", "Chinese", "Red", "White", "GG-4"],
  },
  {
    value: "Onion",
    label: "ડુંગળી",
    emoji: "🧅",
    subtypes: ["Pusa Red", "Agrifound Dark Red", "Local"],
  },
  {
    value: "Chana",
    label: "ચણા",
    emoji: "🫘",
    subtypes: ["GG-1", "GG-2", "Desi", "Kabuli"],
  },
  {
    value: "Wheat",
    label: "ઘઉં",
    emoji: "🌾",
    subtypes: ["GW-496", "GW-322", "GW-496", "Lok-1"],
  },
  {
    value: "Bajra",
    label: "બાજરી",
    emoji: "🌾",
    subtypes: ["GHB-558", "GHB-719", "GHB-744"],
  },
  {
    value: "Maize",
    label: "મકાઈ",
    emoji: "🌽",
    subtypes: ["TATA-900M", "DKC-9144", "Pioneer-30V92"],
  },
];

const STEPS = [
  { label: "સિઝન", icon: "☔" },
  { label: "પાક", icon: "🌱" }, // crop + subtype same step
  { label: "વિસ્તાર", icon: "📐" }, // farm + bigha + bhagma
  { label: "પુષ્ટિ", icon: "✅" },
];

const YEAR_OPTIONS = getFinancialYearOptions();

// Bhagma share options when user selects હા — label shown in UI, value stored as percentage
const BHAGMA_SHARE_OPTIONS: { value: string; label: string; pct: number }[] = [
  { value: "50", label: "બીજા ભાગે", pct: 50 },
  { value: "33.33", label: "ત્રિજા ભાગે", pct: 33.33 },
  { value: "25", label: "ચોથા ભાગે", pct: 25 },
];

// ─── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  season: CropSeason | "";
  cropValue: string;
  cropLabel: string;
  cropEmoji: string;
  customCrop: string;
  subType: string;
  customSubType: string;
  year: string;
  area: string;
  bhagmaOption: "" | "ha" | "na";
  bhagmaPercentage: string;
  notes: string;
}

const EMPTY: FormState = {
  season: "",
  cropValue: "",
  cropLabel: "",
  cropEmoji: "🌱",
  customCrop: "",
  subType: "",
  customSubType: "",
  year: getCurrentFinancialYear(),
  area: "",
  bhagmaOption: "na",
  bhagmaPercentage: "",
  notes: "",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: ((step + 1) / total) * 100,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);
  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < step && styles.dotDone,
            i === step && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

function Chip({
  label,
  emoji,
  selected,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
        {label}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={C.green700}
          style={{ marginLeft: 3 }}
        />
      )}
    </TouchableOpacity>
  );
}

// Large crop card for step 1 — 3 per row, icon + label, highlight only when selected
function CropCard({
  label,
  emoji,
  selected,
  onPress,
}: {
  label: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.cropCard, selected && styles.cropCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.cropCardEmoji}>{emoji}</Text>
      <Text
        style={[styles.cropCardLabel, selected && styles.cropCardLabelActive]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {selected && (
        <View style={styles.cropCardCheck}>
          <Ionicons name="checkmark-circle" size={22} color={C.green700} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// Large subtype card for step 2 — icon left, label right, highlight only
function SubTypeCard({
  label,
  cropEmoji,
  selected,
  onPress,
}: {
  label: string;
  cropEmoji: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.subTypeCard, selected && styles.subTypeCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.subTypeIconWrap}>
        <Text style={styles.subTypeEmoji}>{cropEmoji}</Text>
      </View>
      <Text
        style={[styles.subTypeLabel, selected && styles.subTypeLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={C.green700}
          style={{ marginLeft: "auto" }}
        />
      )}
    </TouchableOpacity>
  );
}

function SummaryRow({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddCrop() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ?? null;
  const isEdit = !!editId;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<ProfileFarm | null>(null);
  const [usedAreaByFarm, setUsedAreaByFarm] = useState<Record<string, number>>({});
  const [leaseModalVisible, setLeaseModalVisible] = useState(false);
  const [leaseFarmName, setLeaseFarmName] = useState("");
  const [leaseFarmBigha, setLeaseFarmBigha] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [editCropFarmName, setEditCropFarmName] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { profile, setProfile } = useProfile();

  // Load existing crop when editing
  useEffect(() => {
    if (!isEdit || !editId) return;
    setLoadingEdit(true);
    getCropById(editId)
      .then((c) => {
        const cr = c as any;
        const name = cr.cropName ?? "";
        const matchedCrop = CROPS.find((co) => co.value === name);
        setForm({
          season: (cr.season as CropSeason) || "",
          cropValue: matchedCrop ? name : "",
          cropLabel: matchedCrop ? matchedCrop.label : "",
          cropEmoji: matchedCrop ? matchedCrop.emoji : (cr.cropEmoji ?? "🌱"),
          customCrop: matchedCrop ? "" : name,
          subType: cr.subType ?? "",
          customSubType: "",
          year: cr.year ?? getCurrentFinancialYear(),
          area: String(cr.area ?? ""),
          bhagmaOption: cr.landType === "bhagma" ? "ha" : "na",
          bhagmaPercentage: (() => {
            const pct = cr.bhagmaPercentage;
            if (pct == null) return "";
            const n = Number(pct);
            if (Math.abs(n - 25) < 2) return "25";
            if (Math.abs(n - 33.33) < 2 || Math.abs(n - 33) < 2) return "33.33";
            if (Math.abs(n - 50) < 2) return "50";
            return String(pct);
          })(),
          notes: cr.notes ?? "",
        });
        if (cr.farmName) setEditCropFarmName(cr.farmName);
      })
      .catch(() => {})
      .finally(() => setLoadingEdit(false));
  }, [editId, isEdit]);

  // Load profile when reaching area step or when editing (to match farm)
  useEffect(() => {
    if ((step === 2 || isEdit) && !profile) {
      getMyProfile().then(setProfile).catch(() => {});
    }
  }, [step, isEdit, profile, setProfile]);

  // When profile loads in edit mode, set selectedFarm from saved crop's farmName
  useEffect(() => {
    if (!isEdit || !editCropFarmName || !profile?.farms?.length) return;
    const farm = profile.farms.find((f) => f.name === editCropFarmName);
    if (farm) setSelectedFarm(farm);
  }, [isEdit, editCropFarmName, profile?.farms]);

  // Fetch active crops for current year to compute used area per farm (exclude current crop when editing)
  const fetchUsedAreaByFarm = useCallback(async () => {
    try {
      const res = await getCrops(1, 200, undefined, "Active", form.year);
      const byFarm: Record<string, number> = {};
      (res.data || []).forEach((c) => {
        const cid = (c as any)._id;
        if (isEdit && editId && cid === editId) return;
        const name = (c as any).farmName ?? "";
        if (!name) return;
        const area = Number((c as any).area) || 0;
        byFarm[name] = (byFarm[name] || 0) + area;
      });
      setUsedAreaByFarm(byFarm);
    } catch {
      setUsedAreaByFarm({});
    }
  }, [form.year, isEdit, editId]);

  useEffect(() => {
    if (step === 2 && form.year) fetchUsedAreaByFarm();
  }, [step, form.year, fetchUsedAreaByFarm]);

  const set = (key: keyof FormState, val: any) =>
    setForm((p) => ({ ...p, [key]: val }));

  const animateStep = (targetStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setStep(targetStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const validate = (): string | null => {
    if (step === 0 && !form.season) return "કૃપા કરીને સિઝન પસંદ કરો.";
    if (step === 1 && !form.cropValue && !form.customCrop.trim())
      return "કૃપા કરીને પાક પસંદ કરો.";
    const hasSubtypes = (CROPS.find((c) => c.value === form.cropValue)?.subtypes ?? []).length > 0;
    if (step === 1 && hasSubtypes && !form.subType && !form.customSubType.trim())
      return "કૃપા કરીને પાકનો પ્રકાર પસંદ કરો અથવા ટાઈપ કરો.";
    if (
      step === 2 &&
      (!form.area.trim() || isNaN(Number(form.area)) || Number(form.area) <= 0)
    )
      return "કૃપા કરીને માન્ય વીઘા સંખ્યા દાખલ કરો.";
    if (step === 2 && profile?.farms?.length && !selectedFarm)
      return "કૃપા કરીને વાડી પસંદ કરો.";
    if (
      step === 2 &&
      selectedFarm &&
      maxBighaForSelectedFarm !== null &&
      Number(form.area) > maxBighaForSelectedFarm
    )
      return `આ વાડી પર ઉપલબ્ધ વિસ્તાર ${Math.round(maxBighaForSelectedFarm)} વીઘા છે. ${Math.round(Number(form.area))} વીઘા દાખલ કર્યા છે.`;
    if (step === 2 && !form.bhagmaOption) return "કૃપા કરીને ભાગમા અપ્યું તે પસંદ કરો.";
    if (step === 2 && form.bhagmaOption === "ha") {
      const valid = ["25", "33.33", "50"].includes(form.bhagmaPercentage.trim());
      if (!valid)
        return "કૃપા કરીને ભાગમા (બીજા / ત્રિજા / ચોથા ભાગે) પસંદ કરો.";
    }
    return null;
  };

  const handleNext = () => {
    if (step === 2) {
      const areaNum = Number(form.area);
      if (
        selectedFarm &&
        maxBighaForSelectedFarm !== null &&
        areaNum > maxBighaForSelectedFarm
      ) {
        Alert.alert(
          "વિસ્તાર વધારે છે",
          `ઉપલબ્ધ વિસ્તાર ${maxBighaForSelectedFarm} વીઘા છે. શું આ ભાડા અથવા કોન્ટ્રાક્ટ વાડી છે?`,
          [
            { text: "ના", style: "cancel" },
            {
              text: "હા",
              onPress: () => {
                setLeaseFarmBigha(form.area);
                setLeaseModalVisible(true);
              },
            },
          ],
        );
        return;
      }
    }
    const err = validate();
    if (err) {
      Alert.alert("⚠️ ભૂલ", err);
      return;
    }
    animateStep(step + 1);
  };

  const handleBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    animateStep(step - 1);
  };

  const finalCropValue = form.customCrop.trim() || form.cropValue;
  const finalCropLabel = form.customCrop.trim()
    ? form.customCrop.trim()
    : form.cropLabel || form.cropValue;
  const finalCropEmoji = form.customCrop.trim() ? "🌱" : form.cropEmoji;
  const finalSubType = form.customSubType.trim() || form.subType;

  // Subtypes for currently selected crop
  const currentCropSubtypes =
    CROPS.find((c) => c.value === form.cropValue)?.subtypes ?? [];

  // For selected farm: max bigha = farm area - already used by active crops on same farm
  const maxBighaForSelectedFarm = selectedFarm
    ? Math.max(0, selectedFarm.area - (usedAreaByFarm[selectedFarm.name] ?? 0))
    : null;

  const handleLeaseAdd = async () => {
    const name = leaseFarmName.trim();
    const bigha = parseFloat(leaseFarmBigha);
    if (!name || !Number.isFinite(bigha) || bigha <= 0) {
      Alert.alert("ભૂલ", "વાડીનું નામ અને વીઘા ભરો.");
      return;
    }
    const currentFarms = profile?.farms ?? [];
    const updated = await updateProfile({
      farms: [...currentFarms, { name, area: bigha, category: "lease" }],
    });
    setProfile(updated.profile);
    setSelectedFarm({ name, area: bigha, category: "lease" });
    setForm((p) => ({ ...p, area: String(bigha) }));
    setLeaseModalVisible(false);
    setLeaseFarmName("");
    setLeaseFarmBigha("");
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("⚠️ ભૂલ", err);
      return;
    }

    const payload: CropPayload = {
      season: form.season as CropSeason,
      cropName: finalCropValue,
      cropEmoji: finalCropEmoji,
      area: Number(form.area),
      areaUnit: "Bigha",
      status: "Active",
      notes: form.notes.trim() || undefined,
      subType: finalSubType || undefined,
      year: form.year,
      farmName: selectedFarm?.name,
      landType: form.bhagmaOption === "ha" ? "bhagma" : "ghare",
      bhagmaPercentage:
        form.bhagmaOption === "ha" && form.bhagmaPercentage.trim()
          ? Number(form.bhagmaPercentage) // 25, 33.33, or 50
          : undefined,
    };

    try {
      setSaving(true);
      if (isEdit && editId) {
        const crop = await updateCrop(editId, payload);
        Toast.show({
          type: "success",
          text1: "સફળ!",
          text2: `${(crop as any).cropEmoji} ${finalCropLabel}${finalSubType ? ` (${finalSubType})` : ""} સાચવાયો!`,
        });
        router.replace("/(tabs)");
      } else {
        const crop = await createCrop(payload);
        Toast.show({
          type: "success",
          text1: "સફળ!",
          text2: `${(crop as any).cropEmoji} ${finalCropLabel}${finalSubType ? ` (${finalSubType})` : ""} ઉમેરાયો!`,
        });
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      Alert.alert(
        "❌ ભૂલ",
        error?.message ?? "કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.",
        [{ text: "ઠીક છે" }],
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header (light green) ── */}
      <LinearGradient
        colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.headerRow}>
          <AppBackButton onPress={handleBack} iconColor={C.green700} backgroundColor={C.surface} borderColor={C.green100} />
            <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {isEdit ? "✏️ પાક ફેરફાર" : "🌱 નવો પાક ઉમેરો"}
            </Text>
            <Text style={styles.headerSub}>
              પગલું {step + 1} / {STEPS.length} · {STEPS[step].label}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <StepDots step={step} total={STEPS.length} />
        <ProgressBar step={step} total={STEPS.length} />
      </LinearGradient>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* ══ STEP 0 — Season + Year (seasonal screen) ══ */}
          {step === 0 && (
            <LinearGradient
              colors={["#F0F9FF", "#E0F2FE", "#F5F3FF", "#FEFCE8"]}
              style={styles.seasonStepWrapper}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.seasonStepInner}>
                <Text style={styles.stepTitle}>સિઝન અને વર્ષ પસંદ કરો</Text>
                <Text style={styles.stepDesc}>પાક ક્યા વર્ષ અને સિઝનનો છે? (જૂન થી જૂન)</Text>

                {/* Financial year selector — 2025-26 = June 2025 to May 2026 */}
                <Text style={styles.fieldLabel}>વર્ષ (જૂન – જૂન)</Text>
                <View style={styles.yearRow}>
                  {YEAR_OPTIONS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearChip,
                        form.year === y && styles.yearChipActive,
                      ]}
                      onPress={() => set("year", y)}
                    >
                      <Text
                        style={[
                          styles.yearChipText,
                          form.year === y && styles.yearChipTextActive,
                        ]}
                      >
                        {y}
                      </Text>
                      {form.year === y && (
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={C.green700}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Season selector — icon left, label right; selected = zoom + darker */}
                <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
                  🌦️ સિઝન
                </Text>
                <View style={styles.seasonGrid}>
                  {SEASONS.map((s) => {
                    const active = form.season === s.value;
                    return (
                      <TouchableOpacity
                        key={s.value}
                        style={[
                          styles.seasonCard,
                          active && styles.seasonCardActive,
                          { transform: [{ scale: active ? 1.04 : 1 }] },
                        ]}
                        onPress={() => set("season", s.value)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={active ? s.selectedColors : s.inactiveBg}
                          style={styles.seasonGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.seasonRow}>
                            <View style={styles.seasonIconWrap}>
                              <Text style={styles.seasonIcon}>{s.icon}</Text>
                            </View>
                            <View style={styles.seasonTextWrap}>
                              <Text
                                style={[
                                  styles.seasonLabel,
                                  active && styles.seasonLabelActive,
                                ]}
                              >
                                {s.label}
                              </Text>
                              <Text
                                style={[
                                  styles.seasonSub,
                                  active && styles.seasonSubActive,
                                ]}
                              >
                                {s.sublabel}
                              </Text>
                            </View>
                            {active && (
                              <View style={styles.seasonCheck}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={26}
                                  color="#fff"
                                />
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {form.season && (
                  <View style={styles.infoBox}>
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color={C.green700}
                    />
                    <Text style={styles.infoText}>
                      <Text style={{ fontWeight: "700" }}>{form.year}</Text> વર્ષ
                      ·{" "}
                      <Text style={{ fontWeight: "700" }}>
                        {SEASONS.find((s) => s.value === form.season)?.label}
                      </Text>{" "}
                      સિઝન પસંદ થઈ.
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          )}

          {/* ══ STEP 1 — Crop + Sub Type (same tab) ══ */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>પાક પસંદ કરો</Text>
              <Text style={styles.stepDesc}>
                {SEASONS.find((s) => s.value === form.season)?.label} સિઝનના
                સામાન્ય પાક — એક પાક પસંદ કરો
              </Text>
              <View style={styles.cropGrid}>
                {CROPS.map((c) => (
                  <CropCard
                    key={c.value}
                    label={c.label}
                    emoji={c.emoji}
                    selected={form.cropValue === c.value && !form.customCrop}
                    onPress={() =>
                      setForm((p) => ({
                        ...p,
                        cropValue: c.value,
                        cropLabel: c.label,
                        cropEmoji: c.emoji,
                        customCrop: "",
                        subType: "",
                        customSubType: "",
                      }))
                    }
                  />
                ))}
              </View>
              <Text style={styles.orDivider}>— અથવા, બીજો પાક —</Text>
              <View
                style={[
                  styles.textBox,
                  form.customCrop.length > 0 && styles.textBoxActive,
                ]}
              >
                <Text>✏️</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.customCrop}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      customCrop: v,
                      ...(v
                        ? { cropValue: "", cropLabel: "", cropEmoji: "🌱" }
                        : {}),
                    }))
                  }
                  placeholder="પાકનું નામ ટાઈપ કરો..."
                  placeholderTextColor="#9CA3AF"
                />
                {form.customCrop.length > 0 && (
                  <TouchableOpacity onPress={() => set("customCrop", "")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Sub type on same step when crop selected */}
              {(form.cropValue || form.customCrop.trim()) && (
                <>
                  <Text style={[styles.orDivider, { marginTop: 20 }]}>
                    — બીજ / જાત —
                  </Text>
                  <Text style={styles.stepDesc}>
                    {finalCropEmoji} {finalCropLabel} નો પ્રકાર પસંદ કરો અથવા ટાઈપ કરો
                  </Text>
                  <View style={styles.fieldCard}>
                    {currentCropSubtypes.length > 0 && (
                      <View style={styles.subTypeGrid}>
                        {currentCropSubtypes.map((st) => (
                          <SubTypeCard
                            key={st}
                            label={st}
                            cropEmoji={finalCropEmoji}
                            selected={form.subType === st && !form.customSubType}
                            onPress={() =>
                              setForm((p) => ({
                                ...p,
                                subType: st,
                                customSubType: "",
                              }))
                            }
                          />
                        ))}
                      </View>
                    )}
                    <Text style={styles.orDivider}>— કસ્ટમ પ્રકાર —</Text>
                    <View
                      style={[
                        styles.textBox,
                        form.customSubType.length > 0 && styles.textBoxActive,
                      ]}
                    >
                      <Text>✏️</Text>
                      <TextInput
                        style={styles.textInput}
                        value={form.customSubType}
                        onChangeText={(v) =>
                          setForm((p) => ({
                            ...p,
                            customSubType: v,
                            ...(v ? { subType: "" } : {}),
                          }))
                        }
                        placeholder={`${finalCropLabel} નો પ્રકાર... (દા.ત. Desi, GG-4)`}
                        placeholderTextColor="#9CA3AF"
                      />
                      {form.customSubType.length > 0 && (
                        <TouchableOpacity onPress={() => set("customSubType", "")}>
                          <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ══ STEP 2 — Farm + Area (large vadi/vigha cards + crop summary) ══ */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>વાડી અને વિસ્તાર</Text>
              <Text style={styles.stepDesc}>વાડી પસંદ કરો અને વીઘામાં વિસ્તાર દાખલ કરો</Text>

              {/* Crop summary card — graphical */}
              <View style={styles.cropSummaryCard}>
                <View style={styles.cropSummaryIconRow}>
                  <Text style={styles.cropSummaryEmoji}>{finalCropEmoji}</Text>
                  <View style={styles.cropSummaryTextWrap}>
                    <Text style={styles.cropSummaryCrop}>{finalCropLabel}</Text>
                    <Text style={styles.cropSummaryMeta}>
                      {finalSubType ? `${finalSubType} · ` : ""}
                      {SEASONS.find((s) => s.value === form.season)?.label} {form.year}
                    </Text>
                  </View>
                </View>
              </View>

              {profile?.farms && profile.farms.length > 0 && (
                <>
                  <Text style={styles.myFarmsLabel}>વાડી પસંદ કરો *</Text>
                  <View style={styles.farmChipsRow}>
                    {profile.farms.map((farm, idx) => {
                      const used = usedAreaByFarm[farm.name] ?? 0;
                      const available = Math.max(0, farm.area - used);
                      const isSelected = selectedFarm?.name === farm.name;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.farmChip, isSelected && styles.farmChipActive]}
                          onPress={() => {
                            setSelectedFarm(farm);
                            setForm((p) => ({ ...p, area: "" }));
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.farmChipName, isSelected && styles.farmChipNameActive]}>
                            {farm.name}
                            {(farm as any).category === "lease" ? " (ભાડા)" : ""}
                          </Text>
                          <Text style={[styles.farmChipArea, isSelected && styles.farmChipAreaActive]}>
                            ઉપલબ્ધ: {available} વીઘા
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              {selectedFarm && maxBighaForSelectedFarm !== null && (
                <Text style={styles.availableHint}>
                  મહત્તમ {maxBighaForSelectedFarm} વીઘા દાખલ કરી શકો (અન્ય સક્રિય પાક સિવાય)
                </Text>
              )}
              <View style={styles.areaCard}>
                <View style={styles.areaInputRow}>
                  <TextInput
                    style={styles.areaInput}
                    value={form.area}
                    onChangeText={(v) => set("area", v)}
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                    autoFocus={!(profile?.farms && profile.farms.length > 0)}
                  />
                  <View style={styles.areaUnitBadge}>
                    <Text style={styles.areaUnitText}>વીઘા</Text>
                  </View>
                </View>
                {form.area &&
                  !isNaN(Number(form.area)) &&
                  Number(form.area) > 0 && (
                    <Text style={styles.areaHint}>
                      {Math.round(Number(form.area))} વીઘા જમીન પર {finalCropLabel} ઉગાડવામાં આવશે
                      {selectedFarm ? ` (${selectedFarm.name})` : ""}
                    </Text>
                  )}
              </View>
              <Text style={styles.orDivider}>— ઝડપી પસંદ —</Text>
              <View style={styles.presetRow}>
                {["1", "2", "5", "10", "15", "25"].map((n) => {
                  const num = Number(n);
                  const allowed = maxBighaForSelectedFarm == null || num <= maxBighaForSelectedFarm;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.presetChip,
                        form.area === n && styles.presetChipActive,
                        !allowed && styles.presetChipDisabled,
                      ]}
                      onPress={() => allowed && set("area", n)}
                      disabled={!allowed}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          form.area === n && styles.presetTextActive,
                          !allowed && styles.presetTextDisabled,
                        ]}
                      >
                        {n} વીઘા
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bhagma Aapyu Chhe? — ha/na, default na; when ha show 2/3/4 bhage options */}
              <Text style={[styles.fieldLabel, styles.bhagmaSectionLabel]}>
                ભાગમા આપ્યું છે?
              </Text>
              <View style={styles.bhagmaCard}>
                <View style={styles.bhagmaChipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.bhagmaChip,
                      form.bhagmaOption === "ha" && styles.bhagmaChipActive,
                    ]}
                    onPress={() =>
                      setForm((p) => ({ ...p, bhagmaOption: "ha" as const }))
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.bhagmaChipText,
                        form.bhagmaOption === "ha" && styles.bhagmaChipTextActive,
                      ]}
                    >
                      હા
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.bhagmaChip,
                      form.bhagmaOption === "na" && styles.bhagmaChipActive,
                    ]}
                    onPress={() =>
                      setForm((p) => ({
                        ...p,
                        bhagmaOption: "na" as const,
                        bhagmaPercentage: "",
                      }))
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.bhagmaChipText,
                        form.bhagmaOption === "na" && styles.bhagmaChipTextActive,
                      ]}
                    >
                      ના
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {form.bhagmaOption === "ha" && (
                <View style={styles.bhagmaShareRow}>
                  {BHAGMA_SHARE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.bhagmaShareChip,
                        form.bhagmaPercentage === opt.value && styles.bhagmaShareChipActive,
                      ]}
                      onPress={() => set("bhagmaPercentage", opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.bhagmaShareChipText,
                          form.bhagmaPercentage === opt.value && styles.bhagmaShareChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ══ STEP 3 — Confirm ══ */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>નોંધ અને પુષ્ટિ</Text>
              <Text style={styles.stepDesc}>બધી વિગત ચકાસો અને સાચવો</Text>

              {/* Summary card — light green */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHeader}>
                  <Text style={styles.summaryCardTitle}>📋 પાક સારાંશ</Text>
                </View>
                <View style={styles.summaryDivider} />
                <SummaryRow
                  icon={finalCropEmoji}
                  title="પાક"
                  value={finalCropLabel}
                />
                {finalSubType && (
                  <SummaryRow icon="🏷️" title="પ્રકાર" value={finalSubType} />
                )}
                {selectedFarm && (
                  <SummaryRow icon="🌾" title="વાડી" value={selectedFarm.name} />
                )}
                <SummaryRow
                  icon="🌦️"
                  title="સિઝન"
                  value={`${SEASONS.find((s) => s.value === form.season)?.label ?? ""} · ${form.year}`}
                />
                <SummaryRow
                  icon="📐"
                  title="વિઘા"
                  value={`${Math.round(Number(form.area)) || form.area} વીઘા`}
                />
                <SummaryRow
                  icon="🤝"
                  title="ભાગમા"
                  value={
                    form.bhagmaOption === "ha"
                      ? `હા · ${BHAGMA_SHARE_OPTIONS.find((o) => o.value === form.bhagmaPercentage)?.label ?? "—"}`
                      : "ના (ઘરે)"
                  }
                />
                <SummaryRow icon="✅" title="સ્ટેટ" value="સક્રિય (Active)" />
              </View>

              {/* Notes */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={C.green700}
                  />
                  <Text style={styles.cardTitle}>નોંધ (વૈકલ્પિક)</Text>
                </View>
                <TextInput
                  style={styles.notesInput}
                  value={form.notes}
                  onChangeText={(v) => set("notes", v)}
                  placeholder="બિયારણની જાત, ખેતર નંબર, સિંચાઈ પ્રકાર..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.statusNote}>
                <Ionicons name="leaf" size={15} color={C.green700} />
                <Text style={styles.statusNoteText}>
                  પાક{" "}
                  <Text style={{ fontWeight: "800", color: C.green700 }}>
                    "સક્રિય"
                  </Text>{" "}
                  સ્ટેટ સાથે ઉમેરાશે. લણણી પછી ડેશબોર્ડ પરથી બંધ કરી શકાશે.
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBar}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[C.green700, C.green500]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.btnText}>આગળ વધો</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, saving && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={
                saving ? ["#9CA3AF", "#6B7280"] : [C.green700, C.green500]
              }
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons
                name={saving ? "hourglass-outline" : "checkmark-circle"}
                size={20}
                color="#fff"
              />
              <Text style={styles.btnText}>
                {saving ? "સાચવી રહ્યા છીએ..." : "પાક સાચવો"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Lease / contract farm modal */}
      <Modal
        visible={leaseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaseModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLeaseModalVisible(false)}>
          <View style={styles.leaseModalCard}>
            <Text style={styles.leaseModalTitle}>ભાડા / કોન્ટ્રાક્ટ વાડી ઉમેરો</Text>
            <Text style={styles.leaseModalSub}>
              વાડીનું નામ અને વીઘા દાખલ કરો. આ તમારી પ્રોફાઇલમાં ઉમેરાશે.
            </Text>
            <Text style={styles.fieldLabel}>વાડીનું નામ</Text>
            <TextInput
              style={styles.leaseInput}
              value={leaseFarmName}
              onChangeText={setLeaseFarmName}
              placeholder="દા.ત. ભાડાની જમીન"
              placeholderTextColor={C.textMuted}
            />
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>વીઘા</Text>
            <TextInput
              style={styles.leaseInput}
              value={leaseFarmBigha}
              onChangeText={setLeaseFarmBigha}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              keyboardType="decimal-pad"
            />
            <View style={styles.leaseModalButtons}>
              <TouchableOpacity
                style={styles.leaseCancelBtn}
                onPress={() => {
                  setLeaseModalVisible(false);
                  setLeaseFarmName("");
                  setLeaseFarmBigha("");
                }}
              >
                <Text style={styles.leaseCancelText}>રદ કરો</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.leaseAddBtn} onPress={handleLeaseAdd}>
                <Text style={styles.leaseAddText}>ઉમેરો</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: 18,
    paddingHorizontal: 20,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  decorCircle1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.green100 + "80",
    top: -40,
    right: -30,
  },
  decorCircle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.green100 + "50",
    bottom: 8,
    left: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green100 },
  dotDone: { backgroundColor: C.green500 },
  dotActive: { width: 22, backgroundColor: C.green700, borderRadius: 4 },
  progressTrack: {
    height: 3,
    backgroundColor: C.green100,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: C.green700, borderRadius: 2 },

  scroll: { padding: 18 },
  stepTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 16,
    color: C.textMuted,
    marginBottom: 20,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 8,
  },

  // Year row
  yearRow: { flexDirection: "row", gap: 10 },
  yearChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  yearChipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  yearChipText: { fontSize: 19, fontWeight: "700", color: C.textMuted },
  yearChipTextActive: { color: C.green700 },

  // Step 0 seasonal screen wrapper
  seasonStepWrapper: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 8,
    overflow: "hidden",
  },
  seasonStepInner: {},

  // Season — icon left, label right (horizontal); selected = zoom + darker
  seasonGrid: { gap: 16 },
  seasonCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  seasonCardActive: { borderColor: "#fff", borderWidth: 2.5 },
  seasonGrad: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    position: "relative",
    minHeight: 88,
  },
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  seasonIconWrap: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  seasonIcon: { fontSize: 48 },
  seasonTextWrap: { flex: 1, justifyContent: "center", paddingLeft: 8 },
  seasonLabel: {
    fontSize: 26,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 2,
  },
  seasonLabelActive: { color: "#fff" },
  seasonSub: { fontSize: 16, color: "#6B7280" },
  seasonSubActive: { color: "rgba(255,255,255,0.9)" },
  seasonCheck: { marginLeft: "auto" },

  infoBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: C.green50,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.green100,
  },
  infoText: { fontSize: 12, color: C.green900, flex: 1, lineHeight: 18 },

  // Lease modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  leaseModalCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 22,
    width: "100%",
    maxWidth: 340,
  },
  leaseModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 6,
  },
  leaseModalSub: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  leaseInput: {
    borderWidth: 2,
    borderColor: C.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.textPrimary,
    backgroundColor: "#F9FAFB",
  },
  leaseModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  leaseCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.borderLight,
    alignItems: "center",
  },
  leaseCancelText: { fontSize: 15, fontWeight: "700", color: C.textMuted },
  leaseAddBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.green700,
    alignItems: "center",
  },
  leaseAddText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Crop grid — 3 per row, large icons
  cropGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  cropCard: {
    width: "31%",
    minWidth: 100,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2.5,
    borderColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cropCardActive: {
    borderColor: C.green700,
    backgroundColor: C.green50,
  },
  cropCardEmoji: { fontSize: 36, marginBottom: 6 },
  cropCardLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textPrimary,
    textAlign: "center",
  },
  cropCardLabelActive: { color: C.green900 },
  cropCardCheck: { position: "absolute", top: 8, right: 8 },

  // SubType — large cards, icon left, label right
  subTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  subTypeCard: {
    width: "48%",
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2.5,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  subTypeCardActive: { borderColor: C.green700, backgroundColor: C.green50 },
  subTypeIconWrap: { width: 44, alignItems: "center" },
  subTypeEmoji: { fontSize: 28 },
  subTypeLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: C.textPrimary,
  },
  subTypeLabelActive: { color: C.green900 },

  // Chips
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: C.green700 },
  orDivider: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    marginVertical: 10,
  },

  textBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 13,
    padding: 12,
    backgroundColor: C.surface,
  },
  textBoxActive: { borderColor: C.green700, backgroundColor: C.surface },
  textInput: { flex: 1, fontSize: 14, color: C.textPrimary },

  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.green50,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.green100,
  },
  previewSmall: { fontSize: 10, color: C.textMuted },
  previewBig: { fontSize: 15, fontWeight: "800", color: C.green700 },

  // Field card (for subType + batch sections)
  fieldCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  fieldCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  fieldCardIcon: { fontSize: 24 },
  fieldCardTitle: { fontSize: 15, fontWeight: "800", color: C.textPrimary },
  fieldCardSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  // Crop summary card (step 3) — graphical
  cropSummaryCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: C.green100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cropSummaryIconRow: { flexDirection: "row", alignItems: "center" },
  cropSummaryEmoji: { fontSize: 40, marginRight: 14 },
  cropSummaryTextWrap: { flex: 1 },
  cropSummaryCrop: { fontSize: 20, fontWeight: "800", color: C.textPrimary, marginBottom: 2 },
  cropSummaryMeta: { fontSize: 14, fontWeight: "600", color: C.green700 },

  // Mini summary pill (legacy, kept for any other use)
  miniSummary: {
    alignSelf: "flex-start",
    backgroundColor: C.green50,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.green100,
  },
  miniSummaryText: { fontSize: 12, fontWeight: "700", color: C.green700 },

  // Area
  areaCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  areaInputRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  areaInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: "900",
    color: C.textPrimary,
    borderBottomWidth: 3,
    borderBottomColor: C.green500,
    paddingBottom: 4,
  },
  areaUnitBadge: {
    backgroundColor: C.green50,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.green100,
  },
  areaUnitText: { fontSize: 14, fontWeight: "800", color: C.green700 },
  areaHint: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 10,
    fontStyle: "italic",
  },
  myFarmsLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: C.textSecondary,
    marginBottom: 12,
  },
  farmChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  farmChip: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: C.borderLight,
    backgroundColor: C.surface,
    minWidth: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  farmChipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  farmChipName: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  farmChipNameActive: { color: C.green900 },
  farmChipArea: { fontSize: 13, color: C.textMuted, marginTop: 4 },
  farmChipAreaActive: { color: C.green700 },
  bhagmaSectionLabel: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 24,
    fontWeight: "800",
  },
  bhagmaShareRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  bhagmaShareChip: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: C.borderLight,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bhagmaShareChipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  bhagmaShareChipText: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  bhagmaShareChipTextActive: { color: C.green900 },
  bhagmaCard: {
    marginTop: 0,
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.borderLight,
    backgroundColor: C.surface,
  },
  bhagmaLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: C.textPrimary,
    textAlign: "left",
    marginBottom: 6,
  },
  bhagmaChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 0 },
  bhagmaChip: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: C.borderLight,
    backgroundColor: C.surface,
  },
  bhagmaChipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  bhagmaChipText: { fontSize: 16, fontWeight: "700", color: C.textPrimary },
  bhagmaChipTextActive: { color: C.green900 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  presetChip: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    minWidth: 72,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  presetChipActive: { borderColor: C.green700, backgroundColor: C.green50 },
  presetText: { fontSize: 15, fontWeight: "700", color: C.textMuted },
  presetTextActive: { color: C.green700, fontWeight: "800" },
  presetChipDisabled: { opacity: 0.5 },
  presetTextDisabled: { color: C.textMuted },
  availableHint: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: 12,
    fontStyle: "italic",
  },

  // Summary card (step 4) — large graphical crop summary
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: C.green100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryCardHeader: { marginBottom: 14 },
  summaryCardTitle: { fontSize: 18, fontWeight: "800", color: C.green700 },
  summaryDivider: {
    height: 2,
    backgroundColor: C.green100,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  summaryIcon: { fontSize: 26, width: 36 },
  summaryTitle: { fontSize: 12, color: C.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: "800", color: C.textPrimary },

  // Notes card
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  notesInput: {
    fontSize: 13,
    color: C.textPrimary,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
  },

  statusNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: C.green50,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.green100,
  },
  statusNoteText: { fontSize: 12, color: C.green900, flex: 1, lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 18,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  nextBtn: { borderRadius: 14, overflow: "hidden" },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 16,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
});

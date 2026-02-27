import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── API ──────────────────────────────────────────────────────────────────────
import { useProfile } from "@/contexts/ProfileContext";
import { createCrop, type CropPayload, type CropSeason } from "@/utils/api";

// ─── Location ─────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────
const SEASONS: {
  value: CropSeason;
  label: string;
  sublabel: string;
  icon: string;
  colors: [string, string];
}[] = [
  {
    value: "Kharif",
    label: "ખરીફ",
    sublabel: "જૂન – ઓક્ટોબર",
    icon: "☔",
    colors: ["#0EA5E9", "#0369A1"],
  },
  {
    value: "Rabi",
    label: "રવી",
    sublabel: "નવેમ્બર – માર્ચ",
    icon: "❄️",
    colors: ["#6366F1", "#4338CA"],
  },
  {
    value: "Summer",
    label: "ઉનાળો",
    sublabel: "એપ્રિલ – જૂન",
    icon: "☀️",
    colors: ["#F59E0B", "#B45309"],
  },
];

const CROPS: { value: string; label: string; emoji: string }[] = [
  { value: "Cotton", label: "કપાસ", emoji: "🌿" },
  { value: "Groundnut", label: "મગફળી", emoji: "🥜" },
  { value: "Jeera", label: "જીરું", emoji: "🌱" },
  { value: "Onion", label: "ડુંગળી", emoji: "🧅" },
  { value: "Garlic", label: "લસણ", emoji: "🧄" },
  { value: "Chana", label: "ચણા", emoji: "🫘" },
  { value: "Wheat", label: "ઘઉં", emoji: "🌾" },
  { value: "Bajra", label: "બાજરી", emoji: "🌾" },
  { value: "Maize", label: "મકાઈ", emoji: "🌽" },
];

const STEPS = [
  { label: "સિઝન", icon: "☔" },
  { label: "પાક", icon: "🌱" },
  { label: "વિસ્તાર", icon: "📐" },
  { label: "પુષ્ટિ", icon: "✅" },
];

// ─── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  season: CropSeason | "";
  cropValue: string;
  cropLabel: string;
  cropEmoji: string;
  customCrop: string;
  area: string;
  notes: string;
}

const EMPTY: FormState = {
  season: "",
  cropValue: "",
  cropLabel: "",
  cropEmoji: "🌱",
  customCrop: "",
  area: "",
  notes: "",
};

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
          color="#059669"
          style={{ marginLeft: 3 }}
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
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { profile } = useProfile();

  const set = (key: keyof FormState, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  // ── Animation ──────────────────────────────────────────────────────────────
  const animateStep = (next: number) => {
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
    ]).start(() => {
      setStep(next);
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

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (step === 0 && !form.season) return "કૃપા કરીને સિઝન પસંદ કરો.";
    if (step === 1 && !form.cropValue && !form.customCrop.trim())
      return "કૃપા કરીને પાક પસંદ કરો.";
    if (
      step === 2 &&
      (!form.area.trim() || isNaN(Number(form.area)) || Number(form.area) <= 0)
    )
      return "કૃપા કરીને માન્ય વિઘા સંખ્યા દાખલ કરો.";
    return null;
  };

  const handleNext = () => {
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

  // ── Derived crop values ────────────────────────────────────────────────────
  const finalCropValue = form.customCrop.trim() || form.cropValue;
  const finalCropLabel = form.customCrop.trim()
    ? form.customCrop.trim()
    : form.cropLabel || form.cropValue;
  const finalCropEmoji = form.customCrop.trim() ? "🌱" : form.cropEmoji;

  // ── Save — real API call ───────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("⚠️ ભૂલ", err);
      return;
    }

    /*
     * CropPayload (from services/api.ts):
     *   season    : CropSeason  → "Kharif" | "Rabi" | "Summer"
     *   cropName  : string
     *   cropEmoji : string (optional)
     *   area      : number
     *   areaUnit  : AreaUnit    → "Bigha" (optional, default)
     *   status    : CropStatus  → "Active" (optional, default)
     *   notes     : string (optional)
     *
     * Location is stored inside notes as a formatted string
     * OR you can extend CropPayload in api.ts to add a location field.
     */

    const payload: CropPayload = {
      userId: profile?._id, // ← real userId from logged-in farmer
      season: form.season as CropSeason, // English → stored
      cropName: finalCropValue, // English → stored
      cropEmoji: finalCropEmoji,
      area: Number(form.area),
      areaUnit: "Bigha",
      status: "Active",
      // Append location to notes if no dedicated location field on backend
      notes: form.notes.trim() || undefined,
    };

    console.log("PP", payload);

    // ── If your Crop model has a location field, uncomment below ──
    // (payload as any).location = {
    //   district: form.district,   // English key
    //   taluka:   form.taluka,     // English key
    //   village:  form.village,    // English key
    // };

    try {
      setSaving(true);

      // ✅ createCrop() from services/api.ts
      //    → POST /crops
      //    → axios interceptor auto-attaches Bearer token from AsyncStorage
      const crop = await createCrop(payload);

      Alert.alert(
        "✅ સફળ!",
        `${crop.cropEmoji} ${finalCropLabel} ઉમેરાયો!\n${form.area} વીઘા · ${SEASONS.find((s) => s.value === form.season)?.label} સિઝન`,
        [{ text: "ઠીક છે", onPress: () => router.replace("/(tabs)") }],
      );
    } catch (error: any) {
      // Axios interceptor already normalises error.message (ECONNREFUSED etc.)
      Alert.alert(
        "❌ ભૂલ",
        error?.message ?? "કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.",
        [{ text: "ઠીક છે" }],
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#14532D" />

      {/* ── Header ── */}
      <LinearGradient
        colors={["#14532D", "#166534", "#15803D"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>🌱 નવો પાક ઉમેરો</Text>
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
        style={{ flex: 1, backgroundColor: "#F0FDF4" }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* ══ STEP 0 — Season ══════════════════════════════════════ */}
          {step === 0 && (
            <View>
              <Text style={styles.stepTitle}>સિઝન પસંદ કરો</Text>
              <Text style={styles.stepDesc}>
                પાકની સિઝન અનુસાર ટ્રેકિંગ થશે
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
                      ]}
                      onPress={() => set("season", s.value)}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={active ? s.colors : ["#F9FAFB", "#F3F4F6"]}
                        style={styles.seasonGrad}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.seasonIcon}>{s.icon}</Text>
                        <Text
                          style={[
                            styles.seasonLabel,
                            active && { color: "#fff" },
                          ]}
                        >
                          {s.label}
                        </Text>
                        <Text
                          style={[
                            styles.seasonSub,
                            active && { color: "#ffffff99" },
                          ]}
                        >
                          {s.sublabel}
                        </Text>
                        {active && (
                          <View style={styles.seasonCheck}>
                            <Ionicons
                              name="checkmark-circle"
                              size={22}
                              color="#fff"
                            />
                          </View>
                        )}
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
                    color="#059669"
                  />
                  <Text style={styles.infoText}>
                    <Text style={{ fontWeight: "700" }}>
                      {SEASONS.find((s) => s.value === form.season)?.label}
                    </Text>{" "}
                    સિઝન પસંદ થઈ.{" "}
                    {SEASONS.find((s) => s.value === form.season)?.sublabel}{" "}
                    સુધીના પાક.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══ STEP 1 — Crop ════════════════════════════════════════ */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>પાક પસંદ કરો</Text>
              <Text style={styles.stepDesc}>
                {SEASONS.find((s) => s.value === form.season)?.label} સિઝનના
                સામાન્ય પાક
              </Text>
              <View style={styles.chipWrap}>
                {CROPS.map((c) => (
                  <Chip
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
              {(form.cropValue || form.customCrop) && (
                <View style={styles.previewBox}>
                  <Text style={{ fontSize: 26 }}>{finalCropEmoji}</Text>
                  <View>
                    <Text style={styles.previewSmall}>પસંદ થયેલ પાક</Text>
                    <Text style={styles.previewBig}>{finalCropLabel}</Text>
                  </View>
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#059669"
                    style={{ marginLeft: "auto" }}
                  />
                </View>
              )}
            </View>
          )}

          {/* ══ STEP 2 — Area ════════════════════════════════════════ */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>જમીનનો વિસ્તાર</Text>
              <Text style={styles.stepDesc}>વીઘામાં વિસ્તાર દાખલ કરો</Text>
              <View style={styles.miniSummary}>
                <Text style={styles.miniSummaryText}>
                  {finalCropEmoji} {finalCropLabel} ·{" "}
                  {SEASONS.find((s) => s.value === form.season)?.label}
                </Text>
              </View>
              <View style={styles.areaCard}>
                <View style={styles.areaInputRow}>
                  <TextInput
                    style={styles.areaInput}
                    value={form.area}
                    onChangeText={(v) => set("area", v)}
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                    autoFocus
                  />
                  <View style={styles.areaUnitBadge}>
                    <Text style={styles.areaUnitText}>વીઘા</Text>
                  </View>
                </View>
                {form.area &&
                  !isNaN(Number(form.area)) &&
                  Number(form.area) > 0 && (
                    <Text style={styles.areaHint}>
                      {form.area} વીઘા જમીન પર {finalCropLabel} ઉગાડવામાં આવશે
                    </Text>
                  )}
              </View>
              <Text style={styles.orDivider}>— ઝડપી પસંદ —</Text>
              <View style={styles.presetRow}>
                {["1", "2", "5", "10", "15", "25"].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.presetChip,
                      form.area === n && styles.presetChipActive,
                    ]}
                    onPress={() => set("area", n)}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        form.area === n && styles.presetTextActive,
                      ]}
                    >
                      {n} વીઘા
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ══ STEP 4 — Confirm ═════════════════════════════════════ */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>નોંધ અને પુષ્ટિ</Text>
              <Text style={styles.stepDesc}>બધી વિગત ચકાસો અને સાચવો</Text>

              <LinearGradient
                colors={["#064E3B", "#065F46", "#047857"]}
                style={styles.summaryCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.summaryHeading}>📋 પાક સારાંશ</Text>
                <View style={styles.summaryDivider} />
                <SummaryRow
                  icon={finalCropEmoji}
                  title="પાક"
                  value={finalCropLabel}
                />
                <SummaryRow
                  icon="☔"
                  title="સિઝન"
                  value={
                    SEASONS.find((s) => s.value === form.season)?.label ?? ""
                  }
                />
                <SummaryRow
                  icon="📐"
                  title="વિઘા"
                  value={`${form.area} વીઘા`}
                />

                <SummaryRow icon="✅" title="સ્ટેટ" value="સક્રિય (Active)" />
              </LinearGradient>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color="#059669"
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
                <Ionicons name="leaf" size={15} color="#059669" />
                <Text style={styles.statusNoteText}>
                  પાક{" "}
                  <Text style={{ fontWeight: "800", color: "#059669" }}>
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
              colors={["#065F46", "#059669", "#10B981"]}
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
                saving
                  ? ["#9CA3AF", "#6B7280"]
                  : ["#065F46", "#059669", "#10B981"]
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
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#ffffff0D",
    top: -60,
    right: -50,
  },
  decorCircle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ffffff08",
    bottom: 10,
    left: 30,
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
    backgroundColor: "#ffffff22",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 11, color: "#A7F3D0", marginTop: 2 },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff30" },
  dotDone: { backgroundColor: "#A7F3D0" },
  dotActive: { width: 22, backgroundColor: "#fff", borderRadius: 4 },
  progressTrack: {
    height: 3,
    backgroundColor: "#ffffff20",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: "#A7F3D0", borderRadius: 2 },

  scroll: { padding: 18 },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 18,
  },

  seasonGrid: { gap: 10 },
  seasonCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  seasonCardActive: { borderColor: "#059669" },
  seasonGrad: { padding: 18, position: "relative" },
  seasonIcon: { fontSize: 30, marginBottom: 6 },
  seasonLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 2,
  },
  seasonSub: { fontSize: 12, color: "#9CA3AF" },
  seasonCheck: { position: "absolute", top: 14, right: 14 },

  infoBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  infoText: { fontSize: 12, color: "#065F46", flex: 1, lineHeight: 18 },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive: { borderColor: "#059669", backgroundColor: "#D1FAE5" },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#065F46" },

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
    borderColor: "#E5E7EB",
    borderRadius: 13,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  textBoxActive: { borderColor: "#059669", backgroundColor: "#fff" },
  textInput: { flex: 1, fontSize: 14, color: "#1F2937" },

  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#D1FAE5",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  previewSmall: { fontSize: 10, color: "#6B7280" },
  previewBig: { fontSize: 16, fontWeight: "800", color: "#065F46" },

  miniSummary: {
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  miniSummaryText: { fontSize: 13, fontWeight: "700", color: "#065F46" },

  areaCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  areaInputRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  areaInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: "900",
    color: "#1F2937",
    borderBottomWidth: 3,
    borderBottomColor: "#10B981",
    paddingBottom: 4,
  },
  areaUnitBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  areaUnitText: { fontSize: 14, fontWeight: "800", color: "#065F46" },
  areaHint: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 10,
    fontStyle: "italic",
  },

  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  presetChipActive: { borderColor: "#059669", backgroundColor: "#D1FAE5" },
  presetText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  presetTextActive: { color: "#065F46" },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginTop: 14,
    marginBottom: 6,
  },
  hint: { fontSize: 11, color: "#9CA3AF", marginTop: 8 },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownLabel: { fontSize: 10, color: "#9CA3AF", marginBottom: 2 },
  dropdownValue: { fontSize: 14, fontWeight: "600", color: "#1F2937" },

  inlinePicker: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D1FAE5",
    marginTop: 4,
    marginBottom: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pickerRowActive: { backgroundColor: "#D1FAE5" },
  pickerRowText: { fontSize: 14, color: "#374151" },
  pickerRowTextActive: { fontWeight: "700", color: "#065F46" },

  locationPreview: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  locationText: { fontSize: 13, fontWeight: "600", color: "#065F46", flex: 1 },

  summaryCard: { borderRadius: 18, padding: 18, marginBottom: 14 },
  summaryHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#A7F3D0",
    marginBottom: 10,
  },
  summaryDivider: { height: 1, backgroundColor: "#ffffff20", marginBottom: 12 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  summaryIcon: { fontSize: 20, width: 28 },
  summaryTitle: { fontSize: 10, color: "#A7F3D0", marginBottom: 1 },
  summaryValue: { fontSize: 14, fontWeight: "700", color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" },

  notesInput: {
    fontSize: 13,
    color: "#1F2937",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
  },

  statusNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusNoteText: { fontSize: 12, color: "#065F46", flex: 1, lineHeight: 18 },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 18,
    backgroundColor: "#F0FDF4",
    borderTopWidth: 1,
    borderTopColor: "#D1FAE5",
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

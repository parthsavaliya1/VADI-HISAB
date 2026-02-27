import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

const { width } = Dimensions.get("window");

// ─── Constants ────────────────────────────────────────────────────────────────
const SEASONS = [
    { label: "ખરીફ", sublabel: "જૂન – ઓક્ટોબર", icon: "☔", color: ["#0EA5E9", "#0284C7"] },
    { label: "રવી", sublabel: "નવેમ્બર – માર્ચ", icon: "❄️", color: ["#6366F1", "#4F46E5"] },
    { label: "ઉનાળો", sublabel: "એપ્રિલ – જૂન", icon: "☀️", color: ["#F59E0B", "#D97706"] },
];

const CROP_SUGGESTIONS: Record<string, { name: string; emoji: string }[]> = {
    ખરીફ: [
        { name: "મગફળી", emoji: "🥜" },
        { name: "કપાસ", emoji: "🌿" },
        { name: "મકાઈ", emoji: "🌽" },
        { name: "ડાંગર", emoji: "🌾" },
        { name: "સોયાબીન", emoji: "🫘" },
        { name: "તુવેર", emoji: "🟤" },
    ],
    રવી: [
        { name: "ઘઉં", emoji: "🌾" },
        { name: "ચણા", emoji: "🫘" },
        { name: "રાઈ", emoji: "🌱" },
        { name: "વટાણા", emoji: "🟢" },
        { name: "જવ", emoji: "🌾" },
        { name: "ધાણા", emoji: "🌿" },
    ],
    ઉનાળો: [
        { name: "તલ", emoji: "🌻" },
        { name: "મગ", emoji: "🫘" },
        { name: "અડદ", emoji: "🟤" },
        { name: "ભીંડા", emoji: "🥬" },
        { name: "કાકડી", emoji: "🥒" },
        { name: "તરબૂચ", emoji: "🍉" },
    ],
};

const AREA_UNITS = ["વીઘા", "એકર", "હેક્ટર"];

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
    const steps = ["સિઝન", "પાક", "વિગત"];
    return (
        <View style={styles.stepRow}>
            {steps.map((s, i) => (
                <React.Fragment key={i}>
                    <View style={styles.stepItem}>
                        <View style={[styles.stepCircle, i <= currentStep && styles.stepCircleActive]}>
                            {i < currentStep ? (
                                <Ionicons name="checkmark" size={14} color="#fff" />
                            ) : (
                                <Text style={[styles.stepNum, i === currentStep && styles.stepNumActive]}>{i + 1}</Text>
                            )}
                        </View>
                        <Text style={[styles.stepLabel, i <= currentStep && styles.stepLabelActive]}>{s}</Text>
                    </View>
                    {i < steps.length - 1 && (
                        <View style={[styles.stepLine, i < currentStep && styles.stepLineActive]} />
                    )}
                </React.Fragment>
            ))}
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddCrop() {
    const [step, setStep] = useState(0);
    const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
    const [selectedCrop, setSelectedCrop] = useState<{ name: string; emoji: string } | null>(null);
    const [customCrop, setCustomCrop] = useState("");
    const [area, setArea] = useState("");
    const [areaUnit, setAreaUnit] = useState("વીઘા");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: ((step + 1) / 3) * 100,
            duration: 400,
            useNativeDriver: false,
        }).start();
    }, [step]);

    const animateStep = (newStep: number) => {
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 20, duration: 0, useNativeDriver: true }),
        ]).start(() => {
            setStep(newStep);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start();
        });
    };

    const handleNext = () => {
        if (step === 0 && !selectedSeason) {
            Alert.alert("⚠️ ભૂલ", "કૃપા કરીને સિઝન પસંદ કરો");
            return;
        }
        if (step === 1 && !selectedCrop && !customCrop.trim()) {
            Alert.alert("⚠️ ભૂલ", "કૃપા કરીને પાક પસંદ કરો");
            return;
        }
        animateStep(step + 1);
    };

    const handleBack = () => {
        if (step === 0) { router.back(); return; }
        animateStep(step - 1);
    };

    const handleSave = async () => {
        if (!area.trim() || isNaN(Number(area)) || Number(area) <= 0) {
            Alert.alert("⚠️ ભૂલ", "કૃપા કરીને માન્ય વિસ્તાર દાખલ કરો");
            return;
        }

        setSaving(true);
        const cropData = {
            season: selectedSeason,
            cropName: selectedCrop?.name || customCrop,
            cropEmoji: selectedCrop?.emoji || "🌱",
            area: Number(area),
            areaUnit,
            notes,
            status: "સક્રિય",
            createdAt: new Date().toISOString(),
        };

        // 🔁 Replace with real API:
        // await api.post("/crops", cropData);
        console.log("Saving crop:", cropData);
        await new Promise((r) => setTimeout(r, 1200));

        setSaving(false);
        Alert.alert(
            "✅ સફળ!",
            `${cropData.cropEmoji} ${cropData.cropName} ઉમેરાયો!\n${area} ${areaUnit} · ${selectedSeason} સિઝન`,
            [{ text: "ઠીક છે", onPress: () => router.replace("/(tabs)") }]
        );
    };

    const cropName = selectedCrop?.name || customCrop || "—";
    const cropEmoji = selectedCrop?.emoji || "🌱";

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#1A5C2A" />

                {/* ── Header ── */}
                <LinearGradient
                    colors={["#1A5C2A", "#2D8B45", "#3DAA56"]}
                    style={styles.header}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.headerDecor1} />
                    <View style={styles.headerDecor2} />

                    <View style={styles.headerTop}>
                        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                            <Ionicons name="arrow-back" size={20} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>🌱 નવો પાક ઉમેરો</Text>
                        <View style={{ width: 36 }} />
                    </View>

                    <StepIndicator currentStep={step} />

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 100],
                                        outputRange: ["0%", "100%"],
                                    }),
                                },
                            ]}
                        />
                    </View>
                </LinearGradient>

                {/* ── Content ── */}
                <Animated.ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                        {/* ── STEP 0: Season Selection ── */}
                        {step === 0 && (
                            <View>
                                <Text style={styles.stepHeading}>સિઝન પસંદ કરો</Text>
                                <Text style={styles.stepSubheading}>પાકની સિઝન પ્રમાણે ચૂકવણી અને ખર્ચ ટ્રેક થશે</Text>
                                <View style={styles.seasonGrid}>
                                    {SEASONS.map((s) => (
                                        <TouchableOpacity
                                            key={s.label}
                                            style={[styles.seasonCard, selectedSeason === s.label && styles.seasonCardSelected]}
                                            onPress={() => setSelectedSeason(s.label)}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={selectedSeason === s.label ? (s.color as [string, string]) : ["#F9FAFB", "#F3F4F6"]}
                                                style={styles.seasonCardGradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            >
                                                <Text style={styles.seasonEmoji}>{s.icon}</Text>
                                                <Text style={[styles.seasonLabel, selectedSeason === s.label && styles.seasonLabelActive]}>
                                                    {s.label}
                                                </Text>
                                                <Text style={[styles.seasonSublabel, selectedSeason === s.label && styles.seasonSublabelActive]}>
                                                    {s.sublabel}
                                                </Text>
                                                {selectedSeason === s.label && (
                                                    <View style={styles.seasonCheckmark}>
                                                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                                    </View>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {selectedSeason && (
                                    <View style={styles.selectionInfo}>
                                        <Ionicons name="information-circle" size={16} color="#059669" />
                                        <Text style={styles.selectionInfoText}>
                                            <Text style={{ fontWeight: "700" }}>{selectedSeason}</Text> સિઝન પસંદ થઈ.{" "}
                                            {selectedSeason === "ખરીફ" ? "જૂન થી ઓક્ટોબર" : selectedSeason === "રવી" ? "નવેમ્બર થી માર્ચ" : "એપ્રિલ થી જૂન"} સુધીના પાક
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── STEP 1: Crop Selection ── */}
                        {step === 1 && selectedSeason && (
                            <View>
                                <Text style={styles.stepHeading}>પાક પસંદ કરો</Text>
                                <Text style={styles.stepSubheading}>{selectedSeason} સિઝનના સામાન્ય પાક</Text>

                                <View style={styles.cropGrid}>
                                    {CROP_SUGGESTIONS[selectedSeason].map((crop) => (
                                        <TouchableOpacity
                                            key={crop.name}
                                            style={[styles.cropChip, selectedCrop?.name === crop.name && styles.cropChipSelected]}
                                            onPress={() => { setSelectedCrop(crop); setCustomCrop(""); }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.cropChipEmoji}>{crop.emoji}</Text>
                                            <Text style={[styles.cropChipText, selectedCrop?.name === crop.name && styles.cropChipTextSelected]}>
                                                {crop.name}
                                            </Text>
                                            {selectedCrop?.name === crop.name && (
                                                <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginLeft: 4 }} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Custom crop input */}
                                <View style={styles.customCropSection}>
                                    <Text style={styles.customCropLabel}>અથવા, બીજો પાક દાખલ કરો</Text>
                                    <View style={[styles.customCropInput, customCrop.length > 0 && styles.customCropInputActive]}>
                                        <Text style={styles.customCropIcon}>✏️</Text>
                                        <TextInput
                                            style={styles.customCropText}
                                            value={customCrop}
                                            onChangeText={(v) => { setCustomCrop(v); if (v) setSelectedCrop(null); }}
                                            placeholder="પાકનું નામ ટાઈપ કરો..."
                                            placeholderTextColor="#9CA3AF"
                                        />
                                        {customCrop.length > 0 && (
                                            <TouchableOpacity onPress={() => setCustomCrop("")}>
                                                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Preview */}
                                {(selectedCrop || customCrop) && (
                                    <View style={styles.cropPreview}>
                                        <Text style={styles.cropPreviewEmoji}>{cropEmoji}</Text>
                                        <View>
                                            <Text style={styles.cropPreviewLabel}>પસંદ થયેલ પાક</Text>
                                            <Text style={styles.cropPreviewName}>{cropName}</Text>
                                        </View>
                                        <Ionicons name="checkmark-circle" size={22} color="#059669" style={{ marginLeft: "auto" }} />
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── STEP 2: Details ── */}
                        {step === 2 && (
                            <View>
                                <Text style={styles.stepHeading}>પાકની વિગત</Text>
                                <Text style={styles.stepSubheading}>વિસ્તાર અને અન્ય માહિતી ભરો</Text>

                                {/* Summary card */}
                                <View style={styles.summaryCard}>
                                    <LinearGradient colors={["#065F46", "#059669"]} style={styles.summaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                        <View style={styles.summaryRow}>
                                            <View>
                                                <Text style={styles.summarySmall}>પસંદ થયેલ પાક</Text>
                                                <Text style={styles.summaryBig}>{cropEmoji} {cropName}</Text>
                                            </View>
                                            <View style={styles.summaryDivider} />
                                            <View>
                                                <Text style={styles.summarySmall}>સિઝન</Text>
                                                <Text style={styles.summaryBig}>{selectedSeason}</Text>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </View>

                                {/* Area input */}
                                <View style={styles.inputCard}>
                                    <View style={styles.inputCardHeader}>
                                        <Ionicons name="resize-outline" size={16} color="#059669" />
                                        <Text style={styles.inputCardTitle}>વિસ્તાર (જમીન)</Text>
                                    </View>
                                    <View style={styles.areaInputRow}>
                                        <TextInput
                                            style={styles.areaInput}
                                            value={area}
                                            onChangeText={setArea}
                                            placeholder="0"
                                            placeholderTextColor="#D1D5DB"
                                            keyboardType="numeric"
                                        />
                                        <View style={styles.unitPicker}>
                                            {AREA_UNITS.map((u) => (
                                                <TouchableOpacity
                                                    key={u}
                                                    style={[styles.unitChip, areaUnit === u && styles.unitChipSelected]}
                                                    onPress={() => setAreaUnit(u)}
                                                >
                                                    <Text style={[styles.unitChipText, areaUnit === u && styles.unitChipTextSelected]}>{u}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                    {area && !isNaN(Number(area)) && (
                                        <Text style={styles.areaHint}>
                                            {Number(area)} {areaUnit} જમીન પર {cropName} ઉગાડવામાં આવશે
                                        </Text>
                                    )}
                                </View>

                                {/* Notes */}
                                <View style={styles.inputCard}>
                                    <View style={styles.inputCardHeader}>
                                        <Ionicons name="document-text-outline" size={16} color="#059669" />
                                        <Text style={styles.inputCardTitle}>નોંધ (વૈકલ્પિક)</Text>
                                    </View>
                                    <TextInput
                                        style={styles.notesInput}
                                        value={notes}
                                        onChangeText={setNotes}
                                        placeholder="કોઈ ખાસ નોંધ? (ઉ.દા. બિયારણની જાત, ખેતર નંબર...)"
                                        placeholderTextColor="#9CA3AF"
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                {/* Status info */}
                                <View style={styles.statusInfoCard}>
                                    <Ionicons name="leaf" size={16} color="#059669" />
                                    <Text style={styles.statusInfoText}>
                                        પાક <Text style={{ fontWeight: "700", color: "#059669" }}>"સક્રિય"</Text> સ્ટેટ સાથે ઉમેરાશે.{"\n"}
                                        પછી ડેશબોર્ડ પરથી <Text style={{ fontWeight: "600" }}>લણણી → બંધ</Text> કરી શકાશે.
                                    </Text>
                                </View>
                            </View>
                        )}
                    </Animated.View>

                    <View style={{ height: 120 }} />
                </Animated.ScrollView>

                {/* ── Bottom Action Buttons ── */}
                <View style={styles.bottomBar}>
                    {step < 2 ? (
                        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
                            <LinearGradient
                                colors={["#065F46", "#059669", "#10B981"]}
                                style={styles.nextBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.nextBtnText}>આગળ વધો</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.nextBtn, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={saving ? ["#9CA3AF", "#6B7280"] : ["#065F46", "#059669", "#10B981"]}
                                style={styles.nextBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {saving ? (
                                    <>
                                        <Ionicons name="hourglass-outline" size={18} color="#fff" />
                                        <Text style={styles.nextBtnText}>સાચવી રહ્યા છીએ...</Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                        <Text style={styles.nextBtnText}>પાક સાચવો</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0FDF4" },

    // Header
    header: {
        paddingTop: 54, paddingBottom: 20,
        paddingHorizontal: 20, position: "relative", overflow: "hidden",
    },
    headerDecor1: {
        position: "absolute", width: 160, height: 160, borderRadius: 80,
        backgroundColor: "#ffffff10", top: -50, right: -40,
    },
    headerDecor2: {
        position: "absolute", width: 80, height: 80, borderRadius: 40,
        backgroundColor: "#ffffff08", bottom: 10, left: 20,
    },
    headerTop: {
        flexDirection: "row", alignItems: "center",
        justifyContent: "space-between", marginBottom: 20,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: "#ffffff25", justifyContent: "center", alignItems: "center",
    },
    headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },

    // Step indicator
    stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    stepItem: { alignItems: "center", gap: 4 },
    stepCircle: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: "#ffffff30", justifyContent: "center", alignItems: "center",
        borderWidth: 1.5, borderColor: "#ffffff50",
    },
    stepCircleActive: { backgroundColor: "#fff", borderColor: "#fff" },
    stepNum: { fontSize: 12, fontWeight: "700", color: "#ffffff80" },
    stepNumActive: { color: "#059669" },
    stepLabel: { fontSize: 10, color: "#ffffff60" },
    stepLabelActive: { color: "#A7F3D0", fontWeight: "600" },
    stepLine: { width: 36, height: 2, backgroundColor: "#ffffff25", marginHorizontal: 6, marginBottom: 16 },
    stepLineActive: { backgroundColor: "#A7F3D0" },

    // Progress
    progressTrack: { height: 3, backgroundColor: "#ffffff25", borderRadius: 2, overflow: "hidden" },
    progressFill: { height: 3, backgroundColor: "#A7F3D0", borderRadius: 2 },

    // Scroll
    scrollContent: { padding: 20 },
    stepHeading: { fontSize: 22, fontWeight: "800", color: "#1F2937", marginBottom: 6 },
    stepSubheading: { fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 18 },

    // Season
    seasonGrid: { gap: 12 },
    seasonCard: {
        borderRadius: 18, overflow: "hidden",
        borderWidth: 2, borderColor: "transparent",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    seasonCardSelected: { borderColor: "#059669" },
    seasonCardGradient: { padding: 18, position: "relative" },
    seasonEmoji: { fontSize: 32, marginBottom: 8 },
    seasonLabel: { fontSize: 18, fontWeight: "800", color: "#374151", marginBottom: 2 },
    seasonLabelActive: { color: "#fff" },
    seasonSublabel: { fontSize: 12, color: "#9CA3AF" },
    seasonSublabelActive: { color: "#ffffff90" },
    seasonCheckmark: { position: "absolute", top: 14, right: 14 },

    // Selection info
    selectionInfo: {
        flexDirection: "row", gap: 8, alignItems: "flex-start",
        backgroundColor: "#D1FAE5", borderRadius: 12, padding: 12, marginTop: 14,
    },
    selectionInfoText: { fontSize: 12, color: "#065F46", flex: 1, lineHeight: 18 },

    // Crop grid
    cropGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
    cropChip: {
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 14, borderWidth: 1.5, borderColor: "#E5E7EB",
        backgroundColor: "#fff",
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    cropChipSelected: { borderColor: "#059669", backgroundColor: "#D1FAE5" },
    cropChipEmoji: { fontSize: 18 },
    cropChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
    cropChipTextSelected: { color: "#065F46" },

    // Custom crop
    customCropSection: { marginTop: 4 },
    customCropLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 8 },
    customCropInput: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#fff", borderRadius: 14,
        borderWidth: 1.5, borderColor: "#E5E7EB", padding: 12,
    },
    customCropInputActive: { borderColor: "#059669" },
    customCropIcon: { fontSize: 16 },
    customCropText: { flex: 1, fontSize: 14, color: "#1F2937" },

    // Crop preview
    cropPreview: {
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: "#D1FAE5", borderRadius: 14, padding: 14, marginTop: 16,
    },
    cropPreviewEmoji: { fontSize: 28 },
    cropPreviewLabel: { fontSize: 11, color: "#6B7280" },
    cropPreviewName: { fontSize: 16, fontWeight: "800", color: "#065F46" },

    // Step 2
    summaryCard: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
    summaryGradient: { padding: 16 },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    summarySmall: { fontSize: 10, color: "#A7F3D0", marginBottom: 2 },
    summaryBig: { fontSize: 16, fontWeight: "800", color: "#fff" },
    summaryDivider: { width: 1, height: 36, backgroundColor: "#ffffff30" },

    // Input card
    inputCard: {
        backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    inputCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    inputCardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" },

    // Area input
    areaInputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    areaInput: {
        flex: 1, fontSize: 36, fontWeight: "800", color: "#1F2937",
        borderBottomWidth: 2, borderBottomColor: "#10B981", paddingBottom: 4,
    },
    unitPicker: { gap: 6 },
    unitChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
        borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
    },
    unitChipSelected: { borderColor: "#059669", backgroundColor: "#D1FAE5" },
    unitChipText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
    unitChipTextSelected: { color: "#065F46" },
    areaHint: { fontSize: 11, color: "#6B7280", marginTop: 8, fontStyle: "italic" },

    // Notes
    notesInput: {
        fontSize: 13, color: "#1F2937", borderWidth: 1.5,
        borderColor: "#E5E7EB", borderRadius: 12, padding: 12,
        textAlignVertical: "top", minHeight: 80,
    },

    // Status info
    statusInfoCard: {
        flexDirection: "row", gap: 8, alignItems: "flex-start",
        backgroundColor: "#ECFDF5", borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: "#A7F3D0",
    },
    statusInfoText: { fontSize: 12, color: "#065F46", flex: 1, lineHeight: 18 },

    // Bottom bar
    bottomBar: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: 20, paddingBottom: 36,
        backgroundColor: "#F0FDF4",
        borderTopWidth: 1, borderTopColor: "#D1FAE5",
    },
    nextBtn: { borderRadius: 16, overflow: "hidden" },
    nextBtnGradient: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, paddingVertical: 16,
    },
    nextBtnText: { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
});
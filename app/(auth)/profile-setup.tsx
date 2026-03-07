import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import {
    getDistrictItems,
    getTalukaItems,
    getVillageItems,
    type VillageItem,
} from "@/data/gujarati-location";
import translations from "@/translations.json";
import type { District, LabourType, TractorService, WaterSource } from "@/utils/api";
import { completeProfile, getMe } from "@/utils/api";

const LANG = "gu" as const;
const t = translations[LANG].profile;

// ─── Dashboard-matching palette ─────────────────────────────────────────────
const C = {
  green900: "#1B5E20",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  surfaceGreen: "#F1F8F1",
  textPrimary: "#1A2E1C",
  textSecondary: "#3D5C40",
  textMuted: "#7A9B7E",
  border: "#C8E6C9",
  borderLight: "#EAF4EA",
  expense: "#C62828",
  expensePale: "#FFEBEE",
};

const WATER_SOURCES = ["Rain", "Borewell", "Canal"];
const LABOUR_TYPES = ["Family", "Hired", "Mixed"];
const TRACTOR_SERVICES = ["Rotavator", "RAP", "Bagi", "Savda"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DropdownItem = { value: string; label: string };

// ✅ FormData only holds English keys — clean & simple
type FormData = {
    name: string;
    district: string;
    taluka: string;
    village: string;
    totalLandValue: string;
    totalLandUnit: "acre" | "bigha";
    waterSources: string[];
    tractorAvailable: boolean | null;
    implementsAvailable: string[];  // tractor services when tractor yes
    labourTypes: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-Sheet Dropdown Modal
// ─────────────────────────────────────────────────────────────────────────────

const DropdownModal = ({
    visible,
    title,
    items,
    selectedValue,
    onSelect,
    onClose,
}: {
    visible: boolean;
    title: string;
    items: DropdownItem[];
    selectedValue: string;
    onSelect: (item: DropdownItem) => void;
    onClose: () => void;
}) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={modalStyles.backdrop} onPress={onClose} />
        <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>{title}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {items.map((item) => {
                    const isSelected = item.value === selectedValue;
                    return (
                        <Pressable
                            key={item.value}
                            style={[modalStyles.item, isSelected && modalStyles.itemSelected]}
                            onPress={() => { onSelect(item); onClose(); }}
                            android_ripple={{ color: C.green100 }}
                        >
                            <View style={modalStyles.itemInner}>
                                {/* Gujarati label — big & prominent */}
                                <Text style={[modalStyles.itemLabel, isSelected && modalStyles.itemLabelSelected]}>
                                    {item.label}
                                </Text>
                                {/* English key — small & subtle, helps admins debug */}
                                <Text style={modalStyles.itemSub}>{item.value}</Text>
                            </View>
                            {isSelected && <Text style={modalStyles.itemCheck}>✓</Text>}
                        </Pressable>
                    );
                })}
                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    </Modal>
);

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown Button — receives Gujarati label derived from English key
// ─────────────────────────────────────────────────────────────────────────────

const DropdownButton = ({
    label,
    displayLabel,      // ← Gujarati label for display (looked up from key)
    placeholder,
    disabled = false,
    onPress,
}: {
    label: string;
    displayLabel: string;
    placeholder: string;
    disabled?: boolean;
    onPress: () => void;
}) => (
    <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.dropdownBtn,
                displayLabel ? styles.dropdownBtnFilled : null,
                disabled ? styles.dropdownBtnDisabled : null,
            ]}
            android_ripple={{ color: C.green100 }}
        >
            <Text
                style={[styles.dropdownBtnText, !displayLabel && styles.dropdownBtnPlaceholder]}
                numberOfLines={1}
            >
                {displayLabel || placeholder}
            </Text>
            <Text style={styles.dropdownArrow}>
                {disabled ? "—" : displayLabel ? "✓" : "▾"}
            </Text>
        </Pressable>
    </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Text Input Field
// ─────────────────────────────────────────────────────────────────────────────

const InputField = ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = "default",
    focusedField,
    setFocusedField,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    keyboardType?: string;
    focusedField: string | null;
    setFocusedField: (v: string | null) => void;
}) => {
    const isFocused = focusedField === label;
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={[
                styles.textInputWrap,
                isFocused && styles.textInputWrapFocused,
                value ? styles.textInputWrapFilled : null,
            ]}>
                <TextInput
                    style={styles.textInput}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={C.textMuted}
                    keyboardType={keyboardType as any}
                    onFocus={() => setFocusedField(label)}
                    onBlur={() => setFocusedField(null)}
                    selectionColor={C.green700}
                />
                {value ? <Text style={styles.fieldCheck}>✓</Text> : null}
            </View>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Multi Chip Selector (multiple selection)
// ─────────────────────────────────────────────────────────────────────────────

const MultiChipSelector = ({
    label,
    options,
    labels,
    selected,
    onToggle,
}: {
    label: string;
    options: string[];
    labels: Record<string, string>;
    selected: string[];
    onToggle: (opt: string) => void;
}) => (
    <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.chipsWrap}>
            {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                    <Pressable
                        key={opt}
                        onPress={() => onToggle(opt)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        android_ripple={{ color: "#C8E6C9", borderless: false }}
                    >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {labels[opt] ?? opt}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileSetup() {
    const [form, setForm] = useState<FormData>({
        name: "",
        district: "",
        taluka: "",
        village: "",
        totalLandValue: "",
        totalLandUnit: "acre",
        waterSources: [],
        tractorAvailable: null,
        implementsAvailable: [],
        labourTypes: [],
    });
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showDistrict, setShowDistrict] = useState(false);
    const [showTaluka, setShowTaluka] = useState(false);
    const [showVillage, setShowVillage] = useState(false);

    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(50)).current;
    const headerSlide = useRef(new Animated.Value(-30)).current;
    const headerFade = useRef(new Animated.Value(0)).current;
    const tractorFloat = useRef(new Animated.Value(0)).current;
    const submitScale = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const filledCount =
        [form.name, form.district, form.taluka, form.village, form.totalLandValue]
            .filter(Boolean).length
        + (form.waterSources.length > 0 ? 1 : 0)
        + (form.tractorAvailable !== null ? 1 : 0)
        + (form.labourTypes.length > 0 ? 1 : 0);
    const totalFields = 8;
    const progress = filledCount / totalFields;

    const isValid =
        !!form.name && !!form.district && !!form.taluka && !!form.village &&
        !!form.totalLandValue && form.waterSources.length > 0 &&
        form.tractorAvailable !== null && form.labourTypes.length > 0;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideUp, { toValue: 0, duration: 700, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
            Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(headerSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(tractorFloat, { toValue: -6, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(tractorFloat, { toValue: 6, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
        setForm((prev) => ({ ...prev, [key]: val }));

    const toggleWater = (opt: string) => {
        setForm((prev) => ({
            ...prev,
            waterSources: prev.waterSources.includes(opt)
                ? prev.waterSources.filter((x) => x !== opt)
                : [...prev.waterSources, opt],
        }));
    };
    const toggleLabour = (opt: string) => {
        setForm((prev) => ({
            ...prev,
            labourTypes: prev.labourTypes.includes(opt)
                ? prev.labourTypes.filter((x) => x !== opt)
                : [...prev.labourTypes, opt],
        }));
    };
    const toggleTractorService = (opt: string) => {
        setForm((prev) => ({
            ...prev,
            implementsAvailable: prev.implementsAvailable.includes(opt)
                ? prev.implementsAvailable.filter((x) => x !== opt)
                : [...prev.implementsAvailable, opt],
        }));
    };

    // ── Location handlers — store only English key, reset downstream ──────

    const handleDistrictSelect = (item: DropdownItem) => {
        setForm((prev) => ({ ...prev, district: item.value, taluka: "", village: "" }));
    };

    const handleTalukaSelect = (item: DropdownItem) => {
        setForm((prev) => ({ ...prev, taluka: item.value, village: "" }));
    };

    const handleVillageSelect = (item: VillageItem) => {
        setForm((prev) => ({ ...prev, village: item.value }));
    };

    // ── Derive display labels from English keys at render time ────────────
    // No extra state — just a lookup. Free and instant.
    const districtItems = getDistrictItems();
    const talukaItems = form.district ? getTalukaItems(form.district) : [];
    const villageItems = (form.district && form.taluka)
        ? getVillageItems(form.district, form.taluka)
        : [];

    const districtLabel = districtItems.find(d => d.value === form.district)?.label ?? "";
    const talukaLabel = talukaItems.find(t => t.value === form.taluka)?.label ?? "";
    const villageLabel = villageItems.find(v => v.value === form.village)?.label ?? "";

    // ── Submit — send English keys to API ─────────────────────────────────

    const submit = async () => {
        if (!isValid) { Alert.alert(t.errTitle, t.errFill); return; }
        setLoading(true);
        try {
            await completeProfile({
                name: form.name,
                district: form.district as District,
                taluka: form.taluka,
                village: form.village,
                totalLand: { value: parseFloat(form.totalLandValue), unit: form.totalLandUnit },
                waterSources: form.waterSources as WaterSource[],
                tractorAvailable: form.tractorAvailable!,
                implementsAvailable: form.tractorAvailable ? (form.implementsAvailable as TractorService[]) : [],
                labourTypes: form.labourTypes as LabourType[],
            });
            const user = await getMe();
            if (user.analyticsConsent === null) {
                router.replace("/(auth)/consent");
            } else {
                router.replace("/(tabs)");
            }
        } catch (err: any) {
            Alert.alert(t.errTitle, err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={[C.green50, "#EEF6EE", C.bg]} style={styles.container} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
            <View style={styles.circle1} />
            <View style={styles.circle2} />

            {/* ── Sticky Header ── */}
            <Animated.View style={[styles.stickyHeader, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>{t.title}</Text>
                        <Text style={styles.headerSubtitle}>{t.subtitle}</Text>
                    </View>
                    <Animated.Text style={[styles.tractorEmoji, { transform: [{ translateY: tractorFloat }] }]}>
                        🌾
                    </Animated.Text>
                </View>
                <View style={styles.progressBg}>
                    <Animated.View
                        style={[styles.progressFill, {
                            width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                        }]}
                    />
                </View>
                <Text style={styles.progressLabel}>
                    {filledCount}/{totalFields} {t.fieldsCompleted}
                </Text>
            </Animated.View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={[styles.card, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

                        {/* ── Section 1: Basic Details ── */}
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>1</Text></View>
                            <Text style={styles.sectionTitle}>{t.sectionBasic}</Text>
                        </View>

                        <InputField
                            label={t.name}
                            value={form.name}
                            onChangeText={(v) => set("name", v)}
                            placeholder={t.namePH}
                            focusedField={focusedField}
                            setFocusedField={setFocusedField}
                        />

                        {/* District: stores "Jamnagar", shows "જામનગર" */}
                        <DropdownButton
                            label={t.district ?? "જિલ્લો"}
                            displayLabel={districtLabel}
                            placeholder="જિલ્લો પસંદ કરો..."
                            onPress={() => setShowDistrict(true)}
                        />

                        {/* Taluka: stores "Kalavad", shows "કાળાવડ" */}
                        <DropdownButton
                            label="તાલુકો"
                            displayLabel={talukaLabel}
                            placeholder={form.district ? "તાલુકો પસંદ કરો..." : "પહેલા જિલ્લો પસંદ કરો"}
                            disabled={!form.district}
                            onPress={() => setShowTaluka(true)}
                        />

                        {/* Village: stores "Khijadia", shows "ખીજડીયા" */}
                        <DropdownButton
                            label="ગામ"
                            displayLabel={villageLabel}
                            placeholder={form.taluka ? "ગામ પસંદ કરો..." : "પહેલા તાલુકો પસંદ કરો"}
                            disabled={!form.taluka}
                            onPress={() => setShowVillage(true)}
                        />

                        {/* ── Section 2: Land & Water ── */}
                        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>2</Text></View>
                            <Text style={styles.sectionTitle}>{t.sectionLand}</Text>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>{t.land}</Text>
                            <View style={styles.landRow}>
                                <View style={[styles.textInputWrap, { flex: 1 }, form.totalLandValue ? styles.textInputWrapFilled : null]}>
                                    <TextInput
                                        style={styles.textInput}
                                        value={form.totalLandValue}
                                        onChangeText={(v) => set("totalLandValue", v)}
                                        placeholder={t.landPH}
                    placeholderTextColor={C.textMuted}
                    keyboardType="decimal-pad"
                    selectionColor={C.green700}
                                    />
                                </View>
                                <View style={styles.unitToggle}>
                                    <Pressable onPress={() => set("totalLandUnit", "acre")} style={[styles.unitBtn, form.totalLandUnit === "acre" && styles.unitBtnActive]}>
                                        <Text style={[styles.unitBtnText, form.totalLandUnit === "acre" && styles.unitBtnTextActive]}>{t.unitAcre}</Text>
                                    </Pressable>
                                    <Pressable onPress={() => set("totalLandUnit", "bigha")} style={[styles.unitBtn, form.totalLandUnit === "bigha" && styles.unitBtnActive]}>
                                        <Text style={[styles.unitBtnText, form.totalLandUnit === "bigha" && styles.unitBtnTextActive]}>{t.unitBigha}</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        <MultiChipSelector
                            label={t.water}
                            options={WATER_SOURCES}
                            labels={t.waterLabels}
                            selected={form.waterSources}
                            onToggle={toggleWater}
                        />

                        {/* ── Section 3: Resources ── */}
                        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>3</Text></View>
                            <Text style={styles.sectionTitle}>{t.sectionResources}</Text>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>{t.tractor}</Text>
                            <View style={styles.toggleRow}>
                                <Pressable onPress={() => setForm((prev) => ({ ...prev, tractorAvailable: true }))} style={[styles.toggleBtn, form.tractorAvailable === true && styles.toggleBtnYes]}>
                                    <Text style={styles.toggleEmoji}>🚜</Text>
                                    <Text style={[styles.toggleText, form.tractorAvailable === true && styles.toggleTextActive]}>{t.tractorYes}</Text>
                                </Pressable>
                                <Pressable onPress={() => setForm((prev) => ({ ...prev, tractorAvailable: false, implementsAvailable: [] }))} style={[styles.toggleBtn, form.tractorAvailable === false && styles.toggleBtnNo]}>
                                    <Text style={styles.toggleEmoji}>🚫</Text>
                                    <Text style={[styles.toggleText, form.tractorAvailable === false && styles.toggleTextActive]}>{t.tractorNo}</Text>
                                </Pressable>
                            </View>
                        </View>

                        {form.tractorAvailable === true && (
                            <MultiChipSelector
                                label={t.tractorServices ?? "ટ્રેક્ટર સેવાઓ"}
                                options={TRACTOR_SERVICES}
                                labels={t.tractorServiceLabels ?? {}}
                                selected={form.implementsAvailable}
                                onToggle={toggleTractorService}
                            />
                        )}

                        <MultiChipSelector
                            label={t.labour}
                            options={LABOUR_TYPES}
                            labels={t.labourLabels}
                            selected={form.labourTypes}
                            onToggle={toggleLabour}
                        />

                        {/* ── Submit ── */}
                        <Animated.View style={[{ transform: [{ scale: submitScale }] }, { marginTop: 8 }]}>
                            <Pressable
                                style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
                                onPressIn={() => Animated.spring(submitScale, { toValue: 0.97, useNativeDriver: true }).start()}
                                onPressOut={() => Animated.spring(submitScale, { toValue: 1, useNativeDriver: true }).start()}
                                onPress={submit}
                                disabled={!isValid || loading}
                            >
                                <LinearGradient
                                    colors={isValid ? [C.green700, C.green500, "#66BB6A"] : [C.borderLight, C.borderLight]}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.submitGradient}
                                >
                                    {loading
                                        ? <ActivityIndicator color="white" />
                                        : <Text style={[styles.submitText, !isValid && styles.submitTextOff]}>{t.save}</Text>
                                    }
                                </LinearGradient>
                            </Pressable>
                        </Animated.View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Modals ── */}
            <DropdownModal
                visible={showDistrict}
                title="જિલ્લો પસંદ કરો"
                items={districtItems}
                selectedValue={form.district}
                onSelect={handleDistrictSelect}
                onClose={() => setShowDistrict(false)}
            />
            <DropdownModal
                visible={showTaluka}
                title="તાલુકો પસંદ કરો"
                items={talukaItems}
                selectedValue={form.taluka}
                onSelect={handleTalukaSelect}
                onClose={() => setShowTaluka(false)}
            />
            <DropdownModal
                visible={showVillage}
                title="ગામ પસંદ કરો"
                items={villageItems}
                selectedValue={form.village}
                onSelect={handleVillageSelect}
                onClose={() => setShowVillage(false)}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    circle1: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: C.green100 + "80", top: -60, right: -60 },
    circle2: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: C.green100 + "50", top: 80, left: -60 },
    stickyHeader: { paddingHorizontal: 22, paddingTop: Platform.OS === "ios" ? 58 : 38, paddingBottom: 14, zIndex: 10 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    headerTitle: { fontSize: 24, fontWeight: "900", color: C.textPrimary, letterSpacing: 0.3 },
    headerSubtitle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    tractorEmoji: { fontSize: 40 },
    progressBg: { height: 6, backgroundColor: C.green100, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: C.green500, borderRadius: 3 },
    progressLabel: { fontSize: 11, color: C.textMuted, marginTop: 6 },
    scrollContent: { paddingHorizontal: 22, paddingBottom: 40, paddingTop: 10 },
    card: { backgroundColor: C.surface, borderRadius: 28, padding: 22, elevation: 8, shadowColor: "#1A2E1C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, borderWidth: 1, borderColor: C.borderLight },
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 },
    sectionBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.green700, justifyContent: "center", alignItems: "center" },
    sectionBadgeText: { color: "white", fontWeight: "800", fontSize: 13 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
    fieldGroup: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: "700", color: C.textSecondary, marginBottom: 8, letterSpacing: 0.2 },
    dropdownBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, borderRadius: 14, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, paddingHorizontal: 14, paddingVertical: 14 },
    dropdownBtnFilled: { borderColor: C.green500 },
    dropdownBtnDisabled: { opacity: 0.4, backgroundColor: C.borderLight },
    dropdownBtnText: { fontSize: 15, color: C.textPrimary, fontWeight: "600", flex: 1 },
    dropdownBtnPlaceholder: { color: C.textMuted, fontWeight: "400" },
    dropdownArrow: { fontSize: 16, color: C.green700, marginLeft: 8, fontWeight: "700" },
    textInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 14, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, paddingHorizontal: 14 },
    textInputWrapFocused: { borderColor: C.green700, backgroundColor: C.surfaceGreen },
    textInputWrapFilled: { borderColor: C.green500 },
    textInput: { flex: 1, fontSize: 15, color: C.textPrimary, paddingVertical: 13 },
    fieldCheck: { fontSize: 18, color: C.green700, fontWeight: "900" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 2, borderColor: C.borderLight, backgroundColor: C.surfaceGreen },
    chipSelected: { borderColor: C.green700, backgroundColor: C.green50 },
    chipText: { fontSize: 13, fontWeight: "600", color: C.textMuted },
    chipTextSelected: { color: C.green900, fontWeight: "800" },
    landRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    unitToggle: { flexDirection: "row", borderWidth: 2, borderColor: C.borderLight, borderRadius: 12, overflow: "hidden" },
    unitBtn: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.surfaceGreen },
    unitBtnActive: { backgroundColor: C.green700 },
    unitBtnText: { fontSize: 13, fontWeight: "700", color: C.textMuted },
    unitBtnTextActive: { color: "white" },
    toggleRow: { flexDirection: "row", gap: 12 },
    toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, gap: 6 },
    toggleBtnYes: { borderColor: C.green700, backgroundColor: C.green50 },
    toggleBtnNo: { borderColor: C.expense, backgroundColor: C.expensePale },
    toggleEmoji: { fontSize: 20 },
    toggleText: { fontSize: 14, fontWeight: "700", color: C.textMuted },
    toggleTextActive: { color: C.textPrimary },
    submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
    submitBtnDisabled: {},
    submitGradient: { paddingVertical: 18, alignItems: "center" },
    submitText: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: 0.4 },
    submitTextOff: { color: C.textMuted },
});

const modalStyles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, maxHeight: "65%" },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 6 },
    title: { fontSize: 17, fontWeight: "800", color: C.textPrimary, textAlign: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight, marginBottom: 4 },
    item: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight, paddingHorizontal: 4 },
    itemSelected: { backgroundColor: C.surfaceGreen, borderRadius: 10, paddingHorizontal: 8 },
    itemInner: { flex: 1 },
    itemLabel: { fontSize: 16, color: C.textPrimary, fontWeight: "600" },
    itemLabelSelected: { color: C.green900, fontWeight: "800" },
    itemSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    itemCheck: { fontSize: 18, color: C.green700, fontWeight: "900", marginLeft: 8 },
});
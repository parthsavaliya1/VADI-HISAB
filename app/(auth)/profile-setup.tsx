import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

import * as Location from "expo-location";
import { HEADER_PADDING_TOP } from "@/constants/theme";
import {
    getDistrictItems,
    getTalukaItems,
    getVillageItems,
    GUJARAT_LOCATIONS,
    type VillageItem,
} from "@/data/gujarati-location";
import { useLocations } from "@/hooks/useLocations";
import translations from "@/translations.json";
import { TRACTOR_SERVICES as API_TRACTOR_SERVICES, type District, type LabourType, type TractorService, type WaterSource } from "@/utils/api";
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
const TRACTOR_SERVICES = API_TRACTOR_SERVICES;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DropdownItem = { value: string; label: string };

// One farm entry: name (e.g. "vadi", "farm-2") and area in bigha
export type FarmEntry = { name: string; area: string };

// ✅ FormData only holds English keys — clean & simple
type FormData = {
    name: string;
    district: string;
    taluka: string;
    village: string;
    /** Farms with area (bigha). Default first farm name is "vadi". At least one farm mandatory. */
    farms: FarmEntry[];
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
                                <Text style={[modalStyles.itemLabel, isSelected && modalStyles.itemLabelSelected]}>
                                    {item.label}
                                </Text>
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
    loading = false,
    error = null,
    onPress,
}: {
    label: string;
    displayLabel: string;
    placeholder: string;
    disabled?: boolean;
    loading?: boolean;
    error?: string | null;
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
            {loading ? (
                <View style={styles.dropdownLoadingWrap}>
                    <ActivityIndicator size="small" color={C.green700} />
                    <Text style={styles.dropdownBtnPlaceholder}>{placeholder}</Text>
                </View>
            ) : (
                <Text
                    style={[
                        styles.dropdownBtnText,
                        !displayLabel && styles.dropdownBtnPlaceholder,
                        error ? styles.dropdownBtnError : null,
                    ]}
                    numberOfLines={1}
                >
                    {error || displayLabel || placeholder}
                </Text>
            )}
            <Text style={styles.dropdownArrow}>
                {disabled ? "—" : loading ? "" : displayLabel ? "✓" : "▾"}
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
                    autoCorrect={false}
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
    largeChips = false,
}: {
    label: string;
    options: string[];
    labels: Record<string, string>;
    selected: string[];
    onToggle: (opt: string) => void;
    largeChips?: boolean;
}) => (
    <View style={styles.fieldGroup}>
        {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <View style={[styles.chipsWrap, largeChips && styles.chipsWrapLarge]}>
            {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                    <Pressable
                        key={opt}
                        onPress={() => onToggle(opt)}
                        style={[largeChips ? styles.chipLarge : styles.chip, isSelected && (largeChips ? styles.chipLargeSelected : styles.chipSelected)]}
                        android_ripple={{ color: "#C8E6C9", borderless: false }}
                    >
                        <Text style={[largeChips ? styles.chipTextLarge : styles.chipText, isSelected && styles.chipTextSelected]}>
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
        farms: [{ name: "ખેતર ૧", area: "" }],
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
    const [showDistrictOther, setShowDistrictOther] = useState(false);
    const [districtSearchQuery, setDistrictSearchQuery] = useState("");
    const suggestedLocation = useRef<{ district: string; taluka: string; village: string } | null>(null);

    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(50)).current;
    const headerSlide = useRef(new Animated.Value(-30)).current;
    const headerFade = useRef(new Animated.Value(0)).current;
    const tractorFloat = useRef(new Animated.Value(0)).current;
    const submitScale = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const atLeastOneFarmFilled = form.farms.some(
        (f) => f.name.trim() !== "" && f.area.trim() !== "" && parseFloat(f.area) > 0
    );
    const filledCount =
        [form.name, form.district, form.taluka, form.village].filter(Boolean).length
        + (atLeastOneFarmFilled ? 1 : 0)
        + (form.waterSources.length > 0 ? 1 : 0)
        + (form.tractorAvailable !== null ? 1 : 0)
        + (form.labourTypes.length > 0 ? 1 : 0);
    const totalFields = 8;
    const progress = filledCount / totalFields;

    const isValid =
        !!form.name && !!form.district && !!form.taluka && !!form.village &&
        atLeastOneFarmFilled && form.waterSources.length > 0 &&
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

    // Location permission and suggest current location (e.g. Rajkot, Mavdi)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted" || !mounted) return;
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [addr] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                if (!addr || !mounted) return;
                const city = (addr.city ?? addr.subregion ?? addr.region ?? "").toLowerCase();
                const districtKeys = Object.keys(GUJARAT_LOCATIONS).filter((k) => k !== "Other");
                const matched = districtKeys.find((key) => key.toLowerCase() === city || GUJARAT_LOCATIONS[key].label.toLowerCase().includes(city) || city.includes(key.toLowerCase()));
                if (matched) {
                    const districtData = GUJARAT_LOCATIONS[matched];
                    const firstTalukaKey = Object.keys(districtData.talukas)[0];
                    const firstTaluka = districtData.talukas[firstTalukaKey];
                    const firstVillage = firstTaluka?.villages?.[0];
                    suggestedLocation.current = {
                        district: matched,
                        taluka: firstTalukaKey ?? "",
                        village: firstVillage?.value ?? "",
                    };
                    setForm((prev) => {
                        if (prev.district) return prev;
                        return {
                            ...prev,
                            district: matched,
                            taluka: firstTalukaKey ?? "",
                            village: firstVillage?.value ?? "",
                        };
                    });
                }
            } catch (_) {}
        })();
        return () => { mounted = false; };
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

    const updateFarm = (index: number, field: "name" | "area", value: string) => {
        setForm((prev) => ({
            ...prev,
            farms: prev.farms.map((f, i) =>
                i === index ? { ...f, [field]: value } : f
            ),
        }));
    };

    const GUJARATI_NUMBERS = ["૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯", "૧૦"];
    const addFarm = () => {
        setForm((prev) => {
            const n = prev.farms.length + 1;
            const name = n <= 10 ? `ખેતર ${GUJARATI_NUMBERS[n - 1]}` : `ખેતર ${n}`;
            return { ...prev, farms: [...prev.farms, { name, area: "" }] };
        });
    };

    const removeFarm = (index: number) => {
        if (form.farms.length <= 1) return;
        setForm((prev) => ({
            ...prev,
            farms: prev.farms.filter((_, i) => i !== index),
        }));
    };

    // ── Location handlers — store only English key, reset downstream ──────

    const handleDistrictSelect = (item: DropdownItem) => {
        if (item.value === "Other") {
            setShowDistrict(false);
            setShowDistrictOther(true);
            return;
        }
        setForm((prev) => ({ ...prev, district: item.value, taluka: "", village: "" }));
        setShowDistrict(false);
    };
    const handleDistrictOtherSelect = (item: DropdownItem) => {
        setForm((prev) => ({ ...prev, district: item.value, taluka: "", village: "" }));
        setShowDistrictOther(false);
        setDistrictSearchQuery("");
    };

    const handleTalukaSelect = (item: DropdownItem) => {
        setForm((prev) => ({ ...prev, taluka: item.value, village: "" }));
    };

    const handleVillageSelect = (item: VillageItem) => {
        setForm((prev) => ({ ...prev, village: item.value }));
    };

    // ── Locations: fetch from API with fallback to static data on error ───
    const {
        districtItems: apiDistrictItems,
        talukaItems: apiTalukaItems,
        villageItems: apiVillageItems,
        districtsLoading,
        talukasLoading,
        villagesLoading,
        districtsError,
        talukasError,
        villagesError,
    } = useLocations(form.district, form.taluka);

    // Fallback to static data when API fails
    const staticDistrictItems = getDistrictItems();
    const staticTalukaItems = form.district ? getTalukaItems(form.district) : [];
    const staticVillageItems = (form.district && form.taluka)
        ? getVillageItems(form.district, form.taluka)
        : [];

    const talukaItems = talukasError ? staticTalukaItems : apiTalukaItems;
    const villageItems = villagesError ? staticVillageItems : apiVillageItems;

    // Primary district list: Jamnagar, Rajkot, Junagadh, Morbi, Surendranagar, then અન્ય (Other)
    const PREFERRED_KEYS = ["Jamnagar", "Rajkot", "Junagadh", "Morbi", "Surendranagar"];
    const primaryDistrictItems = useMemo(() => {
        const preferred = PREFERRED_KEYS.filter((k) => GUJARAT_LOCATIONS[k]).map((key) => ({
            value: key,
            label: GUJARAT_LOCATIONS[key].label,
        }));
        return [...preferred, { value: "Other", label: t.districtOther ?? "અન્ય જિલ્લો" }];
    }, []);

    const allDistrictsForOther = useMemo(
        () => staticDistrictItems.filter((d) => d.value !== "Other"),
        [staticDistrictItems]
    );
    const filteredOtherDistricts = useMemo(() => {
        if (!districtSearchQuery.trim()) return allDistrictsForOther;
        const q = districtSearchQuery.trim().toLowerCase();
        return allDistrictsForOther.filter(
            (d) => d.label.toLowerCase().includes(q) || d.value.toLowerCase().includes(q)
        );
    }, [allDistrictsForOther, districtSearchQuery]);

    const districtLabel =
        GUJARAT_LOCATIONS[form.district]?.label ?? staticDistrictItems.find((d) => d.value === form.district)?.label ?? "";
    const talukaLabel = talukaItems.find((t) => t.value === form.taluka)?.label ?? "";
    const villageLabel = villageItems.find((v) => v.value === form.village)?.label ?? "";

    // ── Submit — send English keys to API ─────────────────────────────────

    const submit = async () => {
        if (!isValid) { Alert.alert(t.errTitle, t.errFill); return; }
        const totalBigha = form.farms.reduce(
            (sum, f) => sum + (parseFloat(f.area) || 0),
            0
        );
        if (totalBigha <= 0) {
            Alert.alert(t.errTitle, t.farmsAtLeastOne);
            return;
        }
        const farmsPayload = form.farms
            .filter((f) => f.name.trim() !== "" && parseFloat(f.area) > 0)
            .map((f) => ({ name: f.name.trim(), area: parseFloat(f.area), category: "owned" as const }));
        setLoading(true);
        try {
            await completeProfile({
                name: form.name,
                district: form.district as District,
                taluka: form.taluka,
                village: form.village,
                totalLand: { value: totalBigha, unit: "bigha" as const },
                farms: farmsPayload,
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

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={[styles.card, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
                        <LinearGradient
                            colors={[C.green700, C.green500, "#66BB6A"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.cardTopBar}
                        />

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
                            loading={false}
                            error={null}
                            onPress={() => { setShowDistrict(true); }}
                        />

                        {/* Taluka: stores "Kalavad", shows "કાળાવડ" */}
                        <DropdownButton
                            label="તાલુકો"
                            displayLabel={talukaLabel}
                            placeholder={form.district ? "તાલુકો પસંદ કરો..." : "પહેલા જિલ્લો પસંદ કરો"}
                            disabled={!form.district}
                            loading={talukasLoading}
                            error={talukasError}
                            onPress={() => setShowTaluka(true)}
                        />

                        {/* Village: stores "Khijadia", shows "ખીજડીયા" */}
                        <DropdownButton
                            label="ગામ"
                            displayLabel={villageLabel}
                            placeholder={form.taluka ? "ગામ પસંદ કરો..." : "પહેલા તાલુકો પસંદ કરો"}
                            disabled={!form.taluka}
                            loading={villagesLoading}
                            error={villagesError}
                            onPress={() => setShowVillage(true)}
                        />

                        <View style={styles.sectionDivider} />
                        {/* ── Section 2: Land & Water ── */}
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>2</Text></View>
                            <Text style={styles.sectionTitle}>{t.sectionLand}</Text>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.farmsHint}>{t.farmsHint ?? "ઓછામાં ઓછી એક ખેતરનું નામ અને વિસ્તાર (વીઘા) ભરો"}</Text>
                            {form.farms.map((farm, index) => (
                                <View key={index} style={styles.farmRow}>
                                    <View style={[styles.farmNameWrap, farm.name.trim() ? styles.textInputWrapFilled : null]}>
                                        <TextInput
                                            style={[styles.textInput, index === 0 && farm.name === "ખેતર ૧" && styles.textInputDefault]}
                                            value={farm.name}
                                            onChangeText={(v) => updateFarm(index, "name", v)}
                                            placeholder={index === 0 ? (t.farmNamePH ?? "ખેતર ૧") : (t.farmNamePH2 ?? "નામ")}
                                            placeholderTextColor={C.textMuted}
                                            onFocus={() => setFocusedField(`farm-name-${index}`)}
                                            onBlur={() => setFocusedField(null)}
                                            selectionColor={C.green700}
                                            autoCorrect={false}
                                        />
                                    </View>
                                    <View style={[styles.farmAreaWrap, farm.area ? styles.textInputWrapFilled : null]}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={farm.area}
                                            onChangeText={(v) => updateFarm(index, "area", v)}
                                            placeholder={t.landPH}
                                            placeholderTextColor={C.textMuted}
                                            keyboardType="decimal-pad"
                                            onFocus={() => setFocusedField(`farm-area-${index}`)}
                                            onBlur={() => setFocusedField(null)}
                                            selectionColor={C.green700}
                                        />
                                        <Text style={styles.farmUnit}>{t.unitBigha}</Text>
                                    </View>
                                    {form.farms.length > 1 ? (
                                        <Pressable
                                            onPress={() => removeFarm(index)}
                                            style={styles.removeFarmBtn}
                                            android_ripple={{ color: C.expensePale }}
                                        >
                                            <Text style={styles.removeFarmText}>✕</Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            ))}
                            <Pressable
                                onPress={addFarm}
                                style={styles.addFarmBtn}
                                android_ripple={{ color: C.green100 }}
                            >
                                <Text style={styles.addFarmText}>+ {t.addFarm ?? "બીજી ખેતર ઉમેરો"}</Text>
                            </Pressable>
                        </View>

                        <MultiChipSelector
                            label={t.water}
                            options={WATER_SOURCES}
                            labels={t.waterLabels}
                            selected={form.waterSources}
                            onToggle={toggleWater}
                        />

                        <View style={styles.sectionDivider} />
                        {/* ── Section 3: Tractor (question left, હા/ના right) ── */}
                        <View style={styles.sectionHeaderTractor}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>3</Text></View>
                                <Text style={styles.sectionTitle}>🚜 {t.tractor}</Text>
                            </View>
                            <View style={styles.toggleRowCompact}>
                                <Pressable onPress={() => setForm((prev) => ({ ...prev, tractorAvailable: true }))} style={[styles.toggleBtnCompact, form.tractorAvailable === true && styles.toggleBtnYes]}>
                                    <Text style={[styles.toggleSymbol, styles.toggleSymbolYes]}>✓</Text>
                                    <Text style={[styles.toggleText, form.tractorAvailable === true && styles.toggleTextActive]}>{t.tractorYes}</Text>
                                </Pressable>
                                <Pressable onPress={() => setForm((prev) => ({ ...prev, tractorAvailable: false, implementsAvailable: [] }))} style={[styles.toggleBtnCompact, form.tractorAvailable === false && styles.toggleBtnNo]}>
                                    <Text style={[styles.toggleSymbol, styles.toggleSymbolNo]}>✗</Text>
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

                        <View style={styles.sectionDivider} />
                        {/* ── Section 4: Labour ── */}
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>4</Text></View>
                            <Text style={styles.sectionTitle}>{t.labour}</Text>
                        </View>
                        <MultiChipSelector
                            label=""
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
                items={primaryDistrictItems}
                selectedValue={form.district === "Other" ? "" : form.district}
                onSelect={handleDistrictSelect}
                onClose={() => setShowDistrict(false)}
            />
            <Modal visible={showDistrictOther} transparent animationType="slide" onRequestClose={() => setShowDistrictOther(false)}>
                <Pressable style={modalStyles.backdrop} onPress={() => setShowDistrictOther(false)} />
                <View style={modalStyles.sheet}>
                    <View style={modalStyles.handle} />
                    <Text style={modalStyles.title}>{t.districtOther ?? "અન્ય જિલ્લો"}</Text>
                    <TextInput
                        style={districtSearchInputStyle}
                        placeholder={t.districtSearchPH ?? "જિલ્લો શોધો..."}
                        placeholderTextColor={C.textMuted}
                        value={districtSearchQuery}
                        onChangeText={setDistrictSearchQuery}
                    />
                    <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {filteredOtherDistricts.map((item) => (
                            <Pressable
                                key={item.value}
                                style={[modalStyles.item, form.district === item.value && modalStyles.itemSelected]}
                                onPress={() => handleDistrictOtherSelect(item)}
                                android_ripple={{ color: C.green100 }}
                            >
                                <Text style={[modalStyles.itemLabel, form.district === item.value && modalStyles.itemLabelSelected]}>
                                    {item.label}
                                </Text>
                                {form.district === item.value && <Text style={modalStyles.itemCheck}>✓</Text>}
                            </Pressable>
                        ))}
                        <View style={{ height: 20 }} />
                    </ScrollView>
                </View>
            </Modal>
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
    stickyHeader: { paddingHorizontal: 22, paddingTop: HEADER_PADDING_TOP, paddingBottom: 14, zIndex: 10 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    headerTitle: { fontSize: 28, fontWeight: "900", color: C.textPrimary, letterSpacing: 0.3 },
    headerSubtitle: { fontSize: 17, color: C.textSecondary, marginTop: 2 },
    tractorEmoji: { fontSize: 40 },
    progressBg: { height: 6, backgroundColor: C.green100, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: C.green500, borderRadius: 3 },
    progressLabel: { fontSize: 15, color: C.textMuted, marginTop: 6 },
    scrollContent: { paddingHorizontal: 22, paddingBottom: 40, paddingTop: 10 },
    card: { backgroundColor: C.surface, borderRadius: 28, padding: 22, paddingTop: 0, elevation: 8, shadowColor: "#1A2E1C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, borderWidth: 1, borderColor: C.borderLight, overflow: "hidden" },
    cardTopBar: { height: 5, marginHorizontal: -22, marginBottom: 20 },
    sectionDivider: { height: 1, backgroundColor: C.borderLight, marginVertical: 16, marginHorizontal: 4 },
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 },
    sectionBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green700, justifyContent: "center", alignItems: "center" },
    sectionBadgeText: { color: "white", fontWeight: "800", fontSize: 16 },
    sectionTitle: { fontSize: 19, fontWeight: "700", color: C.textPrimary },
    fieldGroup: { marginBottom: 16 },
    fieldLabel: { fontSize: 17, fontWeight: "700", color: C.textSecondary, marginBottom: 8, letterSpacing: 0.2 },
    dropdownBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, borderRadius: 14, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, paddingHorizontal: 14, paddingVertical: 14 },
    dropdownBtnFilled: { borderColor: C.green500 },
    dropdownBtnDisabled: { opacity: 0.4, backgroundColor: C.borderLight },
    dropdownBtnText: { fontSize: 19, color: C.textPrimary, fontWeight: "600", flex: 1 },
    dropdownBtnPlaceholder: { color: C.textMuted, fontWeight: "400" },
    dropdownBtnError: { color: C.expense },
    dropdownLoadingWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    dropdownArrow: { fontSize: 20, color: C.green700, marginLeft: 8, fontWeight: "700" },
    textInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 14, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, paddingHorizontal: 14 },
    textInputWrapFocused: { borderColor: C.green700, backgroundColor: C.surfaceGreen },
    textInputWrapFilled: { borderColor: C.green500 },
    textInput: { flex: 1, fontSize: 19, color: C.textPrimary, paddingVertical: 13 },
    textInputDefault: { color: C.textMuted, fontWeight: "500" },
    fieldCheck: { fontSize: 20, color: C.green700, fontWeight: "900" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chipsWrapLarge: { gap: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 2, borderColor: C.borderLight, backgroundColor: C.surfaceGreen },
    chipLarge: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 2, borderColor: C.borderLight, backgroundColor: C.surfaceGreen },
    chipSelected: { borderColor: C.green700, backgroundColor: C.green50 },
    chipLargeSelected: { borderColor: C.green700, backgroundColor: C.green50 },
    chipText: { fontSize: 16, fontWeight: "600", color: C.textMuted },
    chipTextLarge: { fontSize: 16, fontWeight: "600", color: C.textMuted },
    chipTextSelected: { color: C.green900, fontWeight: "800" },
    farmsHint: { fontSize: 17, fontWeight: "700", color: C.textSecondary, marginBottom: 8, letterSpacing: 0.2 },
    farmRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
    farmNameWrap: { flex: 1, minWidth: 80, borderWidth: 2, borderRadius: 14, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, paddingHorizontal: 12 },
    farmAreaWrap: { flexDirection: "row", alignItems: "center", minWidth: 100, width: 100, borderWidth: 2, borderRadius: 14, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, paddingHorizontal: 10 },
    farmUnit: { fontSize: 16, color: C.textMuted, marginLeft: 4, fontWeight: "600" },
    removeFarmBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.expensePale, justifyContent: "center", alignItems: "center" },
    removeFarmText: { fontSize: 18, color: C.expense, fontWeight: "700" },
    addFarmBtn: { marginTop: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderColor: C.border, borderStyle: "dashed", alignItems: "center" },
    addFarmText: { fontSize: 18, fontWeight: "700", color: C.green700 },
    landRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    unitToggle: { flexDirection: "row", borderWidth: 2, borderColor: C.borderLight, borderRadius: 12, overflow: "hidden" },
    unitBtn: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.surfaceGreen },
    unitBtnActive: { backgroundColor: C.green700 },
    unitBtnText: { fontSize: 15, fontWeight: "700", color: C.textMuted },
    unitBtnTextActive: { color: "white" },
    sectionHeaderTractor: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 },
    toggleRow: { flexDirection: "row", gap: 12 },
    toggleRowCompact: { flexDirection: "row", gap: 8 },
    toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, gap: 6 },
    toggleBtnCompact: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: C.borderLight, backgroundColor: C.surfaceGreen, gap: 4 },
    toggleBtnYes: { borderColor: C.green700, backgroundColor: C.green50 },
    toggleBtnNo: { borderColor: C.expense, backgroundColor: C.expensePale },
    toggleSymbol: { fontSize: 22, fontWeight: "800" },
    toggleSymbolYes: { color: C.green700 },
    toggleSymbolNo: { color: C.expense },
    toggleText: { fontSize: 18, fontWeight: "700", color: C.textMuted },
    toggleTextActive: { color: C.textPrimary },
    submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
    submitBtnDisabled: {},
    submitGradient: { paddingVertical: 18, alignItems: "center" },
    submitText: { color: "white", fontSize: 21, fontWeight: "800", letterSpacing: 0.4 },
    submitTextOff: { color: C.textMuted },
});

const modalStyles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, maxHeight: "65%" },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 6 },
    title: { fontSize: 21, fontWeight: "800", color: C.textPrimary, textAlign: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight, marginBottom: 4 },
    item: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight, paddingHorizontal: 4 },
    itemSelected: { backgroundColor: C.surfaceGreen, borderRadius: 10, paddingHorizontal: 8 },
    itemInner: { flex: 1 },
    itemLabel: { fontSize: 19, color: C.textPrimary, fontWeight: "600" },
    itemLabelSelected: { color: C.green900, fontWeight: "800" },
    itemSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
    itemCheck: { fontSize: 20, color: C.green700, fontWeight: "900", marginLeft: 8 },
});

const districtSearchInputStyle = {
    borderWidth: 2,
    borderColor: C.borderLight,
    borderRadius: 12,
    backgroundColor: C.surfaceGreen,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: C.textPrimary,
    marginHorizontal: 20,
    marginBottom: 8,
};
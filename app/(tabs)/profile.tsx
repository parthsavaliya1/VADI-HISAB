import { useLanguage } from "@/contexts/LanguageContext";
import {
    getDistrictItems,
    getTalukaItems,
    getVillageItems,
} from "@/data/gujarati-location";
import type { FarmerProfile as APIFarmerProfile } from "@/utils/api";
import { getCrops, getMyProfile, getYearlyReport, logout, saveConsent, updateProfile } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gujarati UI labels
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const T = {
    title: "મારી પ્રોફાઇલ",
    edit: "સુધારો",
    editProfile: "પ્રોફાઇલ સુધારો",
    cancel: "રદ કરો",
    save: "સાચવો",
    saving: "સાચવી રહ્યા છીએ...",
    logout: "લૉગ આઉટ",
    logoutTitle: "લૉગ આઉટ",
    logoutMsg: "શું તમે ખરેખર લૉગ આઉટ કરવા માંગો છો?",
    logoutYes: "હા, લૉગ આઉટ",
    logoutNo: "ના",
    saveSuccess: "✅ સફળ",
    saveDone: "પ્રોફાઇલ સાચવી લેવામાં આવી!",
    errTitle: "ભૂલ",
    errName: "કૃપા કરીને નામ દાખલ કરો",
    errDistrict: "કૃપા કરીને જિલ્લો પસંદ કરો",
    errLand: "કૃપા કરીને માન્ય જમીન દાખલ કરો",
    loading: "લોડ થઈ રહ્યું છે...",
    loadErr: "પ્રોફાઇલ લોડ નહીં થઈ",
    retry: "ફરી પ્રયાસ કરો",
    sectionPersonal: "વ્યક્તિગત",
    sectionLocation: "સ્થળ",
    sectionFarm: "ખેતી",
    sectionPrivacy: "પ્રાઇવસી",
    fullName: "પૂરું નામ",
    mobile: "મોબાઇલ",
    village: "ગામ",
    taluka: "તાલુકો",
    district: "જિલ્લો",
    totalLand: "કુલ જમીન",
    waterSource: "પાણીનો સ્ત્રોત",
    labourType: "મજૂર પ્રકાર",
    tractor: "ટ્રેક્ટર",
    tractorSub: "ટ્રેક્ટર ઉપલબ્ધ છે?",
    dataSharing: "ડેટા શેરિંગ",
    dataSharingSub: "ગામ-સ્તરના આંકડા",
    dataSharingNote: "તમારો ડેટા ગામ-સ્તરના સરેરાશ અહેવાલ માટે ઉપયોગ થશે.",
    activeCrops: "સક્રિય પાક",
    netProfit: "ચોખ્ખો નફો",
    seasons: "સિઝન",
    namePH: "નામ દાખલ કરો",
    landPH: "જમીન",
    farmer: "ખેડૂત",
    version: "VADI-Hisaab v1.0.0",
    language: "ભાષા",
    gujarati: "ગુજરાતી",
    english: "અંગ્રેજી",
};

// ─── English key → Gujarati label lookup maps ────────────────────────────────
// These are used to convert English keys from DB into Gujarati for display

const WATER_OPTIONS = [
    { key: "Rain", label: "🌧 વરસાદ" },
    { key: "Borewell", label: "⛽ બોરવેલ" },
    { key: "Canal", label: "💧 નહેર" },
];
const LABOUR_OPTIONS = [
    { key: "Family", label: "👨‍👩‍👧 પારિવારિક" },
    { key: "Hired", label: "👷 ભાડે" },
    { key: "Mixed", label: "🤝 મિશ્ર" },
];
const TRACTOR_SERVICE_OPTIONS = [
    { key: "Rotavator", label: "રોટાવેટર" },
    { key: "RAP", label: "RAP" },
    { key: "Bagi", label: "બગી" },
    { key: "Savda", label: "સવડા" },
];

/** Look up Gujarati label from English key in any options array */
function toLabel(options: { key: string; label: string }[], key: string) {
    return options.find((o) => o.key === key)?.label ?? key;
}

/** Format multiple keys as labels joined by comma */
function toLabels(options: { key: string; label: string }[], keys: string[]) {
    if (!keys || keys.length === 0) return "—";
    return keys.map((k) => toLabel(options, k)).join(", ");
}

/**
 * Look up Gujarati location label from English key using the location data.
 * Works for district, taluka, and village.
 */
function getLocationLabel(type: "district" | "taluka" | "village", keys: {
    district: string;
    taluka?: string;
    village?: string;
}): string {
    if (type === "district") {
        return getDistrictItems().find(d => d.value === keys.district)?.label ?? keys.district;
    }
    if (type === "taluka" && keys.taluka) {
        return getTalukaItems(keys.district).find(t => t.value === keys.taluka)?.label ?? keys.taluka;
    }
    if (type === "village" && keys.taluka && keys.village) {
        return getVillageItems(keys.district, keys.taluka).find(v => v.value === keys.village)?.label ?? keys.village;
    }
    return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileDraft — mirrors what we send to API (all English keys)
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileDraft {
    name: string;
    district: string;
    taluka: string;
    village: string;
    totalLand: string;
    totalLandUnit: "acre" | "bigha";
    waterSources: string[];
    tractorAvailable: boolean;
    implementsAvailable: string[];
    labourTypes: string[];
    dataSharing: boolean;
}

function apiToDraft(p: APIFarmerProfile | null): ProfileDraft {
    if (!p) return { name: "", district: "", taluka: "", village: "", totalLand: "", totalLandUnit: "acre", waterSources: [], tractorAvailable: false, implementsAvailable: [], labourTypes: [], dataSharing: false };
    const waterSources = Array.isArray((p as any).waterSources) ? (p as any).waterSources : ((p as any).waterSource != null ? [(p as any).waterSource] : []);
    const labourTypes = Array.isArray((p as any).labourTypes) ? (p as any).labourTypes : ((p as any).labourType != null ? [(p as any).labourType] : []);
    const implementsAvailable = Array.isArray((p as any).implementsAvailable) ? (p as any).implementsAvailable : [];
    return {
        name: p.name,
        district: p.district,
        taluka: (p as any).taluka ?? "",
        village: p.village,
        totalLand: String(p.totalLand?.value ?? ""),
        totalLandUnit: p.totalLand?.unit ?? "acre",
        waterSources,
        tractorAvailable: p.tractorAvailable,
        implementsAvailable,
        labourTypes,
        dataSharing: (p as any).analyticsConsent ?? false,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip Picker single (edit mode) — kept for any single-select if needed
// ─────────────────────────────────────────────────────────────────────────────

function ChipPicker({ options, selected, onSelect }: {
    options: { key: string; label: string }[];
    selected: string;
    onSelect: (k: string) => void;
}) {
    return (
        <View style={editStyles.chipsWrap}>
            {options.map((opt) => (
                <Pressable
                    key={opt.key}
                    onPress={() => onSelect(opt.key)}
                    style={[editStyles.chip, selected === opt.key && editStyles.chipActive]}
                    android_ripple={{ color: "#E8F5E9" }}
                >
                    <Text style={[editStyles.chipText, selected === opt.key && editStyles.chipTextActive]}>
                        {opt.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi Chip Picker (edit mode)
// ─────────────────────────────────────────────────────────────────────────────

function MultiChipPicker({ options, selected, onToggle }: {
    options: { key: string; label: string }[];
    selected: string[];
    onToggle: (k: string) => void;
}) {
    return (
        <View style={editStyles.chipsWrap}>
            {options.map((opt) => {
                const isSelected = selected.includes(opt.key);
                return (
                    <Pressable
                        key={opt.key}
                        onPress={() => onToggle(opt.key)}
                        style={[editStyles.chip, isSelected && editStyles.chipActive]}
                        android_ripple={{ color: "#E8F5E9" }}
                    >
                        <Text style={[editStyles.chipText, isSelected && editStyles.chipTextActive]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Dropdown for edit modal
// ─────────────────────────────────────────────────────────────────────────────

function LocationDropdown({ label, displayLabel, placeholder, disabled, onPress }: {
    label: string;
    displayLabel: string;
    placeholder: string;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={editStyles.inputLabel}>{label}</Text>
            <Pressable
                onPress={onPress}
                disabled={disabled}
                style={[editStyles.locationBtn, displayLabel ? editStyles.locationBtnFilled : null, disabled ? editStyles.locationBtnDisabled : null]}
            >
                <Text style={[editStyles.locationBtnText, !displayLabel && editStyles.locationBtnPlaceholder]}>
                    {displayLabel || placeholder}
                </Text>
                <Text style={editStyles.locationBtnArrow}>{disabled ? "—" : displayLabel ? "✓" : "▾"}</Text>
            </Pressable>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Modal (shared between district/taluka/village pickers)
// ─────────────────────────────────────────────────────────────────────────────

function LocationModal({ visible, title, items, selectedValue, onSelect, onClose }: {
    visible: boolean;
    title: string;
    items: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (item: { value: string; label: string }) => void;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={editStyles.locModalBackdrop} onPress={onClose} />
            <View style={editStyles.locModalSheet}>
                <View style={editStyles.locModalHandle} />
                <Text style={editStyles.locModalTitle}>{title}</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {items.map((item) => {
                        const sel = item.value === selectedValue;
                        return (
                            <Pressable
                                key={item.value}
                                style={[editStyles.locItem, sel && editStyles.locItemSelected]}
                                onPress={() => { onSelect(item); onClose(); }}
                                android_ripple={{ color: "#E8F5E9" }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[editStyles.locItemLabel, sel && editStyles.locItemLabelSel]}>{item.label}</Text>
                                    <Text style={editStyles.locItemSub}>{item.value}</Text>
                                </View>
                                {sel && <Text style={editStyles.locItemCheck}>✓</Text>}
                            </Pressable>
                        );
                    })}
                    <View style={{ height: 30 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({ visible, draft, setDraft, saving, onSave, onClose }: {
    visible: boolean;
    draft: ProfileDraft;
    setDraft: (d: ProfileDraft) => void;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

    // Location modal states
    const [showDistrict, setShowDistrict] = useState(false);
    const [showTaluka, setShowTaluka] = useState(false);
    const [showVillage, setShowVillage] = useState(false);

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : SCREEN_H,
            friction: 22, tension: 180, useNativeDriver: true,
        }).start();
    }, [visible]);

    const set = (key: keyof ProfileDraft, val: any) => setDraft({ ...draft, [key]: val });

    // Location dropdown items (from location data)
    const districtItems = getDistrictItems();
    const talukaItems = draft.district ? getTalukaItems(draft.district) : [];
    const villageItems = (draft.district && draft.taluka) ? getVillageItems(draft.district, draft.taluka) : [];

    // Display labels for dropdowns
    const districtLabel = districtItems.find(d => d.value === draft.district)?.label ?? "";
    const talukaLabel = talukaItems.find(t => t.value === draft.taluka)?.label ?? "";
    const villageLabel = villageItems.find(v => v.value === draft.village)?.label ?? "";

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={editStyles.modalOverlay}>
                <Pressable style={editStyles.modalBackdrop} onPress={onClose} />
                <Animated.View style={[editStyles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>

                    {/* Header */}
                    <View style={editStyles.sheetHeader}>
                        <Pressable onPress={onClose} style={editStyles.sheetCloseBtn}>
                            <Ionicons name="close" size={20} color="#6B7280" />
                        </Pressable>
                        <Text style={editStyles.sheetTitle}>{T.editProfile}</Text>
                        <Pressable onPress={onSave} disabled={saving} style={editStyles.sheetSaveBtn}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={editStyles.sheetSaveBtnText}>{T.save}</Text>}
                        </Pressable>
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={editStyles.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                            {/* Personal */}
                            <Text style={editStyles.groupLabel}>👤 {T.sectionPersonal}</Text>
                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{T.fullName}</Text>
                                <TextInput
                                    style={editStyles.textInput}
                                    value={draft.name}
                                    onChangeText={(v) => set("name", v)}
                                    placeholder={T.namePH}
                                    placeholderTextColor="#9CA3AF"
                                    selectionColor="#2E7D32"
                                />
                            </View>

                            {/* Location */}
                            <Text style={editStyles.groupLabel}>📍 {T.sectionLocation}</Text>
                            <View style={editStyles.inputGroup}>
                                {/* District dropdown — stores "Jamnagar", shows "જામનગર" */}
                                <LocationDropdown
                                    label={T.district}
                                    displayLabel={districtLabel}
                                    placeholder="જિલ્લો પસંદ કરો..."
                                    onPress={() => setShowDistrict(true)}
                                />
                                {/* Taluka dropdown */}
                                <LocationDropdown
                                    label={T.taluka}
                                    displayLabel={talukaLabel}
                                    placeholder={draft.district ? "તાલુકો પસંદ કરો..." : "પહેલા જિલ્લો પસંદ કરો"}
                                    disabled={!draft.district}
                                    onPress={() => setShowTaluka(true)}
                                />
                                {/* Village dropdown */}
                                <LocationDropdown
                                    label={T.village}
                                    displayLabel={villageLabel}
                                    placeholder={draft.taluka ? "ગામ પસંદ કરો..." : "પહેલા તાલુકો પસંદ કરો"}
                                    disabled={!draft.taluka}
                                    onPress={() => setShowVillage(true)}
                                />
                            </View>

                            {/* Farm */}
                            <Text style={editStyles.groupLabel}>🌾 {T.sectionFarm}</Text>
                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{T.totalLand}</Text>
                                <View style={editStyles.landRow}>
                                    <TextInput
                                        style={[editStyles.textInput, { flex: 1, marginRight: 10 }]}
                                        value={draft.totalLand}
                                        onChangeText={(v) => set("totalLand", v)}
                                        placeholder={T.landPH}
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="decimal-pad"
                                        selectionColor="#2E7D32"
                                    />
                                    <View style={editStyles.unitToggle}>
                                        <Pressable onPress={() => set("totalLandUnit", "acre")} style={[editStyles.unitBtn, draft.totalLandUnit === "acre" && editStyles.unitBtnActive]}>
                                            <Text style={[editStyles.unitBtnText, draft.totalLandUnit === "acre" && editStyles.unitBtnTextActive]}>એકર</Text>
                                        </Pressable>
                                        <Pressable onPress={() => set("totalLandUnit", "bigha")} style={[editStyles.unitBtn, draft.totalLandUnit === "bigha" && editStyles.unitBtnActive]}>
                                            <Text style={[editStyles.unitBtnText, draft.totalLandUnit === "bigha" && editStyles.unitBtnTextActive]}>વીઘા</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{T.waterSource}</Text>
                                <MultiChipPicker
                                    options={WATER_OPTIONS}
                                    selected={draft.waterSources}
                                    onToggle={(k) => set("waterSources", draft.waterSources.includes(k) ? draft.waterSources.filter((x) => x !== k) : [...draft.waterSources, k])}
                                />
                            </View>

                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{T.labourType}</Text>
                                <MultiChipPicker
                                    options={LABOUR_OPTIONS}
                                    selected={draft.labourTypes}
                                    onToggle={(k) => set("labourTypes", draft.labourTypes.includes(k) ? draft.labourTypes.filter((x) => x !== k) : [...draft.labourTypes, k])}
                                />
                            </View>

                            <View style={editStyles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={editStyles.inputLabel}>🚜 {T.tractor}</Text>
                                    <Text style={editStyles.inputSub}>{T.tractorSub}</Text>
                                </View>
                                <Switch value={draft.tractorAvailable} onValueChange={(v) => set("tractorAvailable", v)} trackColor={{ false: "#E5E7EB", true: "#C8E6C9" }} thumbColor={draft.tractorAvailable ? "#2E7D32" : "#D1D5DB"} />
                            </View>

                            {draft.tractorAvailable && (
                                <View style={editStyles.inputGroup}>
                                    <Text style={editStyles.inputLabel}>ટ્રેક્ટર સેવાઓ</Text>
                                    <MultiChipPicker
                                        options={TRACTOR_SERVICE_OPTIONS}
                                        selected={draft.implementsAvailable}
                                        onToggle={(k) => set("implementsAvailable", draft.implementsAvailable.includes(k) ? draft.implementsAvailable.filter((x) => x !== k) : [...draft.implementsAvailable, k])}
                                    />
                                </View>
                            )}

                            {/* Privacy */}
                            <Text style={editStyles.groupLabel}>🔐 {T.sectionPrivacy}</Text>
                            <View style={editStyles.switchRow}>
                                <View style={{ flex: 1, marginRight: 16 }}>
                                    <Text style={editStyles.inputLabel}>{T.dataSharing}</Text>
                                    <Text style={editStyles.inputSub}>{T.dataSharingSub}</Text>
                                </View>
                                <Switch value={draft.dataSharing} onValueChange={(v) => set("dataSharing", v)} trackColor={{ false: "#E5E7EB", true: "#C8E6C9" }} thumbColor={draft.dataSharing ? "#2E7D32" : "#D1D5DB"} />
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </KeyboardAvoidingView>
                </Animated.View>
            </View>

            {/* Location sub-modals — rendered inside EditModal so z-index stacks correctly */}
            <LocationModal
                visible={showDistrict}
                title="જિલ્લો પસંદ કરો"
                items={districtItems}
                selectedValue={draft.district}
                onSelect={(item) => {
                    setDraft({ ...draft, district: item.value, taluka: "", village: "" });
                }}
                onClose={() => setShowDistrict(false)}
            />
            <LocationModal
                visible={showTaluka}
                title="તાલુકો પસંદ કરો"
                items={talukaItems}
                selectedValue={draft.taluka}
                onSelect={(item) => {
                    setDraft({ ...draft, taluka: item.value, village: "" });
                }}
                onClose={() => setShowTaluka(false)}
            />
            <LocationModal
                visible={showVillage}
                title="ગામ પસંદ કરો"
                items={villageItems}
                selectedValue={draft.village}
                onSelect={(item) => {
                    setDraft({ ...draft, village: item.value });
                }}
                onClose={() => setShowVillage(false)}
            />
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// View Mode sub-components
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, last = false }: { icon: string; label: string; value: string; last?: boolean }) {
    return (
        <>
            <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                    <Ionicons name={icon as any} size={14} color="#2E7D32" />
                </View>
                <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>{label}</Text>
                    <Text style={styles.infoValue}>{value || "—"}</Text>
                </View>
            </View>
            {!last && <View style={styles.rowDivider} />}
        </>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return <View style={styles.card}>{children}</View>;
}

function CardHeader({ emoji, title }: { emoji: string; title: string }) {
    return (
        <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderEmoji}>{emoji}</Text>
            <Text style={styles.cardHeaderTitle}>{title}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
    const { lang, setLang, t } = useLanguage();
    const [apiProfile, setApiProfile] = useState<APIFarmerProfile | null>(null);
    const [draft, setDraft] = useState<ProfileDraft | null>(null);
    const [phone, setPhone] = useState<string>("");
    const [editVisible, setEditVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [activeCropsCount, setActiveCropsCount] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [totalCropsThisYear, setTotalCropsThisYear] = useState(0);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const avatarScale = useRef(new Animated.Value(0.75)).current;
    const headerPulse = useRef(new Animated.Value(1)).current;

    const loadProfile = async () => {
        setLoading(true); setLoadError("");
        try {
            const [data, cropRes, report] = await Promise.all([
                getMyProfile(),
                getCrops(1, 50),
                getYearlyReport(),
            ]);
            setApiProfile(data);
            setPhone((data as any).phone ?? (data as any).user?.phone ?? "");
            const crops = cropRes?.data ?? [];
            setActiveCropsCount(crops.filter((c: any) => c.status === "Active").length);
            setNetProfit(report?.summary?.netProfit ?? 0);
            setTotalCropsThisYear(report?.summary?.totalCrops ?? 0);
        } catch (err: any) {
            setLoadError(err.message ?? T.loadErr);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProfile(); }, []);

    useEffect(() => {
        if (!loading && apiProfile) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                Animated.spring(avatarScale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
            ]).start();
        }
    }, [loading, apiProfile]);

    const handleEditOpen = () => {
        Animated.sequence([
            Animated.timing(headerPulse, { toValue: 0.97, duration: 100, useNativeDriver: true }),
            Animated.spring(headerPulse, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]).start();
        setDraft(apiToDraft(apiProfile));
        setEditVisible(true);
    };

    const handleSave = async () => {
        if (!draft) return;
        if (!draft.name.trim()) { Alert.alert(T.errTitle, T.errName); return; }
        if (!draft.totalLand.trim() || isNaN(Number(draft.totalLand))) { Alert.alert(T.errTitle, T.errLand); return; }
        setSaving(true);
        try {
            const [updated] = await Promise.all([
                updateProfile({
                    name: draft.name,
                    district: draft.district,
                    taluka: draft.taluka,
                    village: draft.village,
                    totalLand: { value: parseFloat(draft.totalLand), unit: draft.totalLandUnit },
                    waterSources: draft.waterSources as any,
                    tractorAvailable: draft.tractorAvailable,
                    implementsAvailable: draft.implementsAvailable,
                    labourTypes: draft.labourTypes as any,
                }),
                saveConsent(draft.dataSharing),
            ]);
            setApiProfile(updated.profile);
            setEditVisible(false);
            setDraft(null);
            Alert.alert(T.saveSuccess, T.saveDone);
        } catch (err: any) {
            Alert.alert(T.errTitle, err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(T.logoutTitle, T.logoutMsg, [
            { text: T.logoutNo, style: "cancel" },
            { text: T.logoutYes, style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
        ]);
    };

    if (loading) {
        return <View style={styles.centerScreen}><ActivityIndicator size="large" color="#2E7D32" /><Text style={styles.loadingText}>{T.loading}</Text></View>;
    }
    if (loadError) {
        return (
            <View style={styles.centerScreen}>
                <Ionicons name="cloud-offline-outline" size={52} color="#2D4230" />
                <Text style={styles.loadErrText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
                    <Text style={styles.retryBtnText}>{T.retry}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const p = apiProfile!;
    const initials = (p.name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    const landDisplay = `${p.totalLand?.value ?? "?"} ${p.totalLand?.unit === "bigha" ? "વીઘા" : "એકર"}`;

    // ✅ Convert English keys from DB → Gujarati labels for display
    const taluka = (p as any).taluka ?? "";
    const districtDisplay = getLocationLabel("district", { district: p.district });
    const talukaDisplay = taluka ? getLocationLabel("taluka", { district: p.district, taluka }) : "—";
    const villageDisplay = p.village ? getLocationLabel("village", { district: p.district, taluka, village: p.village }) : "—";
    const waterSources = Array.isArray((p as any).waterSources) ? (p as any).waterSources : ((p as any).waterSource != null ? [(p as any).waterSource] : []);
    const labourTypes = Array.isArray((p as any).labourTypes) ? (p as any).labourTypes : ((p as any).labourType != null ? [(p as any).labourType] : []);
    const implementsAvailable = Array.isArray((p as any).implementsAvailable) ? (p as any).implementsAvailable : [];
    const waterDisplay = toLabels(WATER_OPTIONS, waterSources);
    const labourDisplay = toLabels(LABOUR_OPTIONS, labourTypes);
    const tractorServicesDisplay = implementsAvailable.length > 0 ? toLabels(TRACTOR_SERVICE_OPTIONS, implementsAvailable) : null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
            <View style={styles.bgDecor1} />
            <View style={styles.bgDecor2} />

            <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                    {/* ══ Hero Header ══ */}
                    <Animated.View style={[styles.hero, { transform: [{ scale: headerPulse }] }]}>
                        <LinearGradient colors={["#1B5E20", "#2E7D32", "#4CAF50"]} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                        <View style={styles.heroTopBar}>
                            <Text style={styles.heroTopLabel}>{T.title}</Text>
                            <Pressable onPress={handleEditOpen} style={({ pressed }) => [styles.editFAB, pressed && styles.editFABPressed]}>
                                <Ionicons name="create-outline" size={15} color="#065F46" />
                                <Text style={styles.editFABText}>{T.edit}</Text>
                            </Pressable>
                        </View>
                        <Animated.View style={[styles.avatarRing, { transform: [{ scale: avatarScale }] }]}>
                            <LinearGradient colors={["#D1FAE5", "#6EE7B7", "#34D399"]} style={styles.avatarGrad}>
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            </LinearGradient>
                        </Animated.View>
                        <Text style={styles.heroName}>{p.name}</Text>
                        <Text style={styles.heroRole}>🌾 {T.farmer}</Text>
                        <View style={styles.langRow}>
                            <Text style={styles.langLabel}>{t("common", "language")}</Text>
                            <View style={styles.langChips}>
                                <Pressable style={[styles.langChip, lang === "gu" && styles.langChipActive]} onPress={() => setLang("gu")}>
                                    <Text style={[styles.langChipText, lang === "gu" && styles.langChipTextActive]}>{t("common", "gujarati")}</Text>
                                </Pressable>
                                <Pressable style={[styles.langChip, lang === "en" && styles.langChipActive]} onPress={() => setLang("en")}>
                                    <Text style={[styles.langChipText, lang === "en" && styles.langChipTextActive]}>{t("common", "english")}</Text>
                                </Pressable>
                            </View>
                        </View>
                        <View style={styles.heroBadgeRow}>
                            <View style={styles.heroBadge}><Ionicons name="location-sharp" size={11} color="#A7F3D0" /><Text style={styles.heroBadgeText}>{villageDisplay}</Text></View>
                            <View style={styles.heroBadgeDot} />
                            <View style={styles.heroBadge}><Ionicons name="map" size={11} color="#A7F3D0" /><Text style={styles.heroBadgeText}>{districtDisplay}</Text></View>
                            <View style={styles.heroBadgeDot} />
                            <View style={styles.heroBadge}><Ionicons name="leaf" size={11} color="#A7F3D0" /><Text style={styles.heroBadgeText}>{landDisplay}</Text></View>
                        </View>
                        <View style={styles.statsStrip}>
                            <View style={styles.statBox}><Text style={styles.statNum}>{activeCropsCount}</Text><Text style={styles.statLbl}>{T.activeCrops}</Text></View>
                            <View style={styles.statSep} />
                            <View style={styles.statBox}><Text style={styles.statNum}>{netProfit >= 1000 ? `₹${(netProfit / 1000).toFixed(1)}K` : `₹${Math.round(netProfit).toLocaleString("en-IN")}`}</Text><Text style={styles.statLbl}>{T.netProfit}</Text></View>
                            <View style={styles.statSep} />
                            <View style={styles.statBox}><Text style={styles.statNum}>{totalCropsThisYear}</Text><Text style={styles.statLbl}>{T.seasons}</Text></View>
                        </View>
                    </Animated.View>

                    {/* 4 options — All Income, Add Expense, Contact Us, About Us */}
                    <Card>
                        <CardHeader emoji="📋" title="મેનૂ" />
                        <Pressable style={styles.linkRow} onPress={() => router.push("/all-income")} android_ripple={{ color: "#E8F5E9" }}>
                            <View style={[styles.infoIconWrap, { backgroundColor: "#E8F5E9" }]}>
                                <Ionicons name="add-circle-outline" size={18} color="#1B5E20" />
                            </View>
                            <Text style={styles.linkRowLabel}>બધી આવક</Text>
                            <Ionicons name="chevron-forward" size={18} color="#2E7D32" />
                        </Pressable>
                        <View style={styles.linkDivider} />
                        <Pressable style={styles.linkRow} onPress={() => router.push("/all-expense")} android_ripple={{ color: "#E8F5E9" }}>
                            <View style={[styles.infoIconWrap, { backgroundColor: "#FFEBEE" }]}>
                                <Ionicons name="remove-circle-outline" size={18} color="#B71C1C" />
                            </View>
                            <Text style={styles.linkRowLabel}>બધા ખર્ચ</Text>
                            <Ionicons name="chevron-forward" size={18} color="#2E7D32" />
                        </Pressable>
                        <View style={styles.linkDivider} />
                        <Pressable style={styles.linkRow} onPress={() => Alert.alert("અમારો સંપર્ક કરો", "ઇમેઇલ: support@vadihisaab.com\nફોન: +91 XXXXX XXXXX\nઅમને સંપર્ક કરો — અમે મદદ કરીશું.", [{ text: "ઠીક છે" }])} android_ripple={{ color: "#E8F5E9" }}>
                            <View style={[styles.infoIconWrap, { backgroundColor: "#E3F2FD" }]}>
                                <Ionicons name="call-outline" size={18} color="#1565C0" />
                            </View>
                            <Text style={styles.linkRowLabel}>અમારો સંપર્ક કરો</Text>
                            <Ionicons name="chevron-forward" size={18} color="#2E7D32" />
                        </Pressable>
                        <View style={styles.linkDivider} />
                        <Pressable style={styles.linkRow} onPress={() => Alert.alert("અમારા વિશે", "VADI-Hisaab — ખેડૂત માટે સ્માર્ટ હિસાબ.\nપાક, ખર્ચ અને આવકનું સરળ રેકોર્ડ.\n\n" + T.version, [{ text: "ઠીક છે" }])} android_ripple={{ color: "#E8F5E9" }}>
                            <View style={[styles.infoIconWrap, { backgroundColor: "#F3E5F5" }]}>
                                <Ionicons name="information-circle-outline" size={18} color="#7B1FA2" />
                            </View>
                            <Text style={styles.linkRowLabel}>અમારા વિશે</Text>
                            <Ionicons name="chevron-forward" size={18} color="#2E7D32" />
                        </Pressable>
                    </Card>

                    <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}>
                        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                        <Text style={styles.logoutBtnText}>{T.logout}</Text>
                    </Pressable>

                    <Text style={styles.versionText}>{T.version}</Text>
                    <View style={{ height: 100 }} />
                </Animated.View>
            </Animated.ScrollView>

            {draft && (
                <EditModal
                    visible={editVisible}
                    draft={draft}
                    setDraft={setDraft}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => { setEditVisible(false); setDraft(null); }}
                />
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// View Styles
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard theme: bg #F5F7F2, green700 #2E7D32, textPrimary #0A0E0B
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F7F2" },
    centerScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#F5F7F2" },
    loadingText: { fontSize: 16, color: "#2D4230" },
    loadErrText: { fontSize: 14, color: "#EF4444", textAlign: "center", paddingHorizontal: 32, lineHeight: 22 },
    retryBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
    retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    bgDecor1: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "#C8E6C920", top: -80, right: -80 },
    bgDecor2: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#E8F5E915", top: 200, left: -60 },
    scrollContent: { paddingBottom: 20 },
    hero: { overflow: "hidden", paddingTop: Platform.OS === "ios" ? 60 : 44, paddingBottom: 28, paddingHorizontal: 22, alignItems: "center", borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 20, shadowColor: "#1B5E20", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
    heroTopBar: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
    heroTopLabel: { fontSize: 17, fontWeight: "700", color: "rgba(255,255,255,0.7)" },
    editFAB: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#C8E6C9", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
    editFABPressed: { opacity: 0.8 },
    editFABText: { fontSize: 14, fontWeight: "800", color: "#1B5E20" },
    avatarRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)", marginBottom: 12 },
    avatarGrad: { flex: 1, borderRadius: 45, justifyContent: "center", alignItems: "center" },
    avatarInitials: { fontSize: 30, fontWeight: "900", color: "#1B5E20" },
    heroName: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: 0.2, marginBottom: 2 },
    heroRole: { fontSize: 17, color: "rgba(255,255,255,0.65)", marginBottom: 10 },
    langRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 },
    langLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
    langChips: { flexDirection: "row", gap: 8 },
    langChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
    langChipActive: { backgroundColor: "rgba(255,255,255,0.35)", borderColor: "#C8E6C9" },
    langChipText: { fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
    langChipTextActive: { color: "#fff", fontWeight: "700" },
    heroBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" },
    heroBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
    heroBadgeText: { fontSize: 12, color: "#C8E6C9", fontWeight: "600" },
    heroBadgeDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#C8E6C950" },
    statsStrip: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 8, width: "100%", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
    statBox: { flex: 1, alignItems: "center" },
    statNum: { fontSize: 20, fontWeight: "900", color: "#fff" },
    statLbl: { fontSize: 12, color: "rgba(200,230,201,0.95)", marginTop: 3, textAlign: "center", fontWeight: "700" },
    statSep: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 4 },
    card: { backgroundColor: "#fff", borderRadius: 20, marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: "#0A0E0B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EAF4EA" },
    cardHeaderEmoji: { fontSize: 20 },
    cardHeaderTitle: { fontSize: 20, fontWeight: "800", color: "#1A2E1C", letterSpacing: 0.2 },
    infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
    infoIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
    infoTextWrap: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    infoLabel: { fontSize: 17, color: "#3D5C40", fontWeight: "600" },
    infoValue: { fontSize: 17, fontWeight: "700", color: "#1A2E1C", textAlign: "right", flex: 1, marginLeft: 8 },
    rowDivider: { height: 1, backgroundColor: "#F9FAFB", marginLeft: 40 },
    linkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
    linkRowLabel: { fontSize: 18, fontWeight: "800", color: "#1A2E1C", flex: 1 },
    linkDivider: { height: 1, backgroundColor: "#F0F7F0", marginLeft: 40 },
    switchInfoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    switchInfoLabel: { fontSize: 14, fontWeight: "700", color: "#0A0E0B" },
    switchInfoSub: { fontSize: 12, color: "#2D4230", marginTop: 2 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, paddingVertical: 16, borderRadius: 18, backgroundColor: "#FFEBEE", borderWidth: 1.5, borderColor: "#FFCDD2", marginBottom: 12 },
    logoutBtnPressed: { opacity: 0.7 },
    logoutBtnText: { fontSize: 17, fontWeight: "800", color: "#B71C1C" },
    versionText: { textAlign: "center", fontSize: 12, color: "#2D4230", marginBottom: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal Styles
// ─────────────────────────────────────────────────────────────────────────────
const editStyles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: "flex-end" },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    modalSheet: { height: SCREEN_H * 0.92, backgroundColor: "#F5F7F2", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
    sheetTitle: { fontSize: 16, fontWeight: "800", color: "#1F2937" },
    sheetSaveBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: "center" },
    sheetSaveBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
    sheetScroll: { padding: 18 },
    groupLabel: { fontSize: 13, fontWeight: "800", color: "#2E7D32", letterSpacing: 0.8, marginBottom: 10, marginTop: 8, textTransform: "uppercase" },
    inputGroup: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#0D4A1F", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    inputLabel: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 8 },
    inputSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
    textInput: { fontSize: 15, fontWeight: "600", color: "#1F2937", borderBottomWidth: 2, borderBottomColor: "#C8E6C9", paddingVertical: 6, paddingHorizontal: 2 },
    landRow: { flexDirection: "row", alignItems: "center" },
    unitToggle: { flexDirection: "row", borderWidth: 1.5, borderColor: "#C8E6C9", borderRadius: 12, overflow: "hidden" },
    unitBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F9FAFB" },
    unitBtnActive: { backgroundColor: "#2E7D32" },
    unitBtnText: { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },
    unitBtnTextActive: { color: "#fff" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#C8E6C9", backgroundColor: "#F9FAFB" },
    chipActive: { borderColor: "#2E7D32", backgroundColor: "#E8F5E9" },
    chipText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
    chipTextActive: { color: "#1B5E20", fontWeight: "800" },
    switchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#0D4A1F", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    // Location dropdown in edit mode
    locationBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderRadius: 12, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
    locationBtnFilled: { borderColor: "#66BB6A" },
    locationBtnDisabled: { opacity: 0.4 },
    locationBtnText: { fontSize: 14, color: "#1F2937", fontWeight: "600", flex: 1 },
    locationBtnPlaceholder: { color: "#9CA3AF", fontWeight: "400" },
    locationBtnArrow: { fontSize: 14, color: "#2E7D32", marginLeft: 6, fontWeight: "700" },
    // Location sub-modal
    locModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    locModalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, maxHeight: "60%" },
    locModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginTop: 12, marginBottom: 6 },
    locModalTitle: { fontSize: 16, fontWeight: "800", color: "#1F2937", textAlign: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", marginBottom: 4 },
    locItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
    locItemSelected: { backgroundColor: "#F0FDF4", borderRadius: 10, paddingHorizontal: 8 },
    locItemLabel: { fontSize: 15, color: "#1F2937", fontWeight: "600" },
    locItemLabelSel: { color: "#2E7D32", fontWeight: "800" },
    locItemSub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
    locItemCheck: { fontSize: 16, color: "#2E7D32", fontWeight: "900", marginLeft: 8 },
});
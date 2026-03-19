import { useLanguage } from "@/contexts/LanguageContext";
import { HEADER_PADDING_TOP } from "@/constants/theme";
import {
    getDistrictItems,
    getTalukaItems,
    getVillageItems,
} from "@/data/gujarati-location";
import { FarmerProfileCard } from "@/components/FarmerProfileCard";
import type { FarmerProfile as APIFarmerProfile, VadiScoreResponse } from "@/utils/api";
import { getMyProfile, logout, updateProfile, getVadiScore } from "@/utils/api";
import { formatArea, formatWholeNumber } from "@/utils/format";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// Optional: image capture & share (app works without these; run: npx expo install expo-media-library expo-sharing react-native-view-shot)
let MediaLibrary: typeof import("expo-media-library") | null = null;
let Sharing: typeof import("expo-sharing") | null = null;
let ViewShotComponent: React.ComponentType<any> | null = null;
try {
  MediaLibrary = require("expo-media-library");
} catch (_) {}
try {
  Sharing = require("expo-sharing");
} catch (_) {}
try {
  ViewShotComponent = require("react-native-view-shot").default;
} catch (_) {}
const hasImageShare = !!(Sharing && ViewShotComponent);
const hasImageDownload = !!(MediaLibrary && ViewShotComponent);
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal } from "react-native";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Options built from translations in ProfileScreen

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
        dataSharing: p.analyticsConsent ?? false,
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

function EditModal({
    visible,
    draft,
    setDraft,
    saving,
    onSave,
    onClose,
    waterOptions,
    labourOptions,
    tractorServiceOptions,
}: {
    visible: boolean;
    draft: ProfileDraft;
    setDraft: (d: ProfileDraft) => void;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
    waterOptions: { key: string; label: string }[];
    labourOptions: { key: string; label: string }[];
    tractorServiceOptions: { key: string; label: string }[];
}) {
    const { t } = useLanguage();
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
                    <View style={editStyles.sheetTopBar} />
                    {/* Header */}
                    <View style={editStyles.sheetHeader}>
                        <Pressable onPress={onClose} style={editStyles.sheetCloseBtn}>
                            <Ionicons name="close" size={24} color="#2E7D32" />
                        </Pressable>
                        <Text style={editStyles.sheetTitle}>{t("profileTab", "editProfile")}</Text>
                        <Pressable onPress={onSave} disabled={saving} style={editStyles.sheetSaveBtn}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={editStyles.sheetSaveBtnText}>{t("profileTab", "save")}</Text>}
                        </Pressable>
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={editStyles.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                            {/* Personal */}
                            <Text style={editStyles.groupLabel}>👤 {t("profileTab", "sectionPersonal")}</Text>
                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{t("profileTab", "fullName")}</Text>
                                <TextInput
                                    style={editStyles.textInput}
                                    value={draft.name}
                                    onChangeText={(v) => set("name", v)}
                                    placeholder={t("profileTab", "namePH")}
                                    placeholderTextColor="#9CA3AF"
                                    selectionColor="#2E7D32"
                                />
                            </View>

                            {/* Location */}
                            <Text style={editStyles.groupLabel}>📍 {t("profileTab", "sectionLocation")}</Text>
                            <View style={editStyles.inputGroup}>
                                {/* District dropdown — stores English key (e.g. Jamnagar), display label from location data */}
                                <LocationDropdown
                                    label={t("profileTab", "district")}
                                    displayLabel={districtLabel}
                                    placeholder={t("profileTab", "selectDistrictPlaceholder")}
                                    onPress={() => setShowDistrict(true)}
                                />
                                {/* Taluka dropdown */}
                                <LocationDropdown
                                    label={t("profileTab", "taluka")}
                                    displayLabel={talukaLabel}
                                    placeholder={draft.district ? t("profileTab", "selectTalukaPlaceholder") : t("profileTab", "selectDistrictFirst")}
                                    disabled={!draft.district}
                                    onPress={() => setShowTaluka(true)}
                                />
                                {/* Village dropdown */}
                                <LocationDropdown
                                    label={t("profileTab", "village")}
                                    displayLabel={villageLabel}
                                    placeholder={draft.taluka ? t("profileTab", "selectVillagePlaceholder") : t("profileTab", "selectTalukaFirst")}
                                    disabled={!draft.taluka}
                                    onPress={() => setShowVillage(true)}
                                />
                            </View>

                            {/* Farm */}
                            <Text style={editStyles.groupLabel}>🌾 {t("profileTab", "sectionFarm")}</Text>
                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{t("profileTab", "totalLand")}</Text>
                                <View style={editStyles.landRow}>
                                    <TextInput
                                        style={[editStyles.textInput, { flex: 1, marginRight: 10 }]}
                                        value={draft.totalLand}
                                        onChangeText={(v) => set("totalLand", v)}
                                        placeholder={t("profileTab", "landPH")}
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="decimal-pad"
                                        selectionColor="#2E7D32"
                                    />
                                    <View style={editStyles.unitToggle}>
                                        <Pressable onPress={() => set("totalLandUnit", "acre")} style={[editStyles.unitBtn, draft.totalLandUnit === "acre" && editStyles.unitBtnActive]}>
                                            <Text style={[editStyles.unitBtnText, draft.totalLandUnit === "acre" && editStyles.unitBtnTextActive]}>{t("common", "acre")}</Text>
                                        </Pressable>
                                        <Pressable onPress={() => set("totalLandUnit", "bigha")} style={[editStyles.unitBtn, draft.totalLandUnit === "bigha" && editStyles.unitBtnActive]}>
                                            <Text style={[editStyles.unitBtnText, draft.totalLandUnit === "bigha" && editStyles.unitBtnTextActive]}>{t("common", "bigha")}</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{t("profileTab", "waterSource")}</Text>
                                <MultiChipPicker
                                    options={waterOptions}
                                    selected={draft.waterSources}
                                    onToggle={(k) => set("waterSources", draft.waterSources.includes(k) ? draft.waterSources.filter((x) => x !== k) : [...draft.waterSources, k])}
                                />
                            </View>

                            <View style={editStyles.inputGroup}>
                                <Text style={editStyles.inputLabel}>{t("profileTab", "labourType")}</Text>
                                <MultiChipPicker
                                    options={labourOptions}
                                    selected={draft.labourTypes}
                                    onToggle={(k) => set("labourTypes", draft.labourTypes.includes(k) ? draft.labourTypes.filter((x) => x !== k) : [...draft.labourTypes, k])}
                                />
                            </View>

                            <View style={editStyles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={editStyles.inputLabel}>🚜 {t("profileTab", "tractor")}</Text>
                                    <Text style={editStyles.inputSub}>{t("profileTab", "tractorSub")}</Text>
                                </View>
                                <Switch value={draft.tractorAvailable} onValueChange={(v) => set("tractorAvailable", v)} trackColor={{ false: "#E5E7EB", true: "#C8E6C9" }} thumbColor={draft.tractorAvailable ? "#2E7D32" : "#D1D5DB"} />
                            </View>

                            {/* Privacy */}
                            <Text style={editStyles.groupLabel}>🔐 {t("profileTab", "sectionPrivacy")}</Text>
                            <View style={editStyles.switchRow}>
                                <View style={{ flex: 1, marginRight: 16 }}>
                                    <Text style={editStyles.inputLabel}>{t("profileTab", "dataSharing")}</Text>
                                    <Text style={editStyles.inputSub}>{t("profileTab", "dataSharingSub")}</Text>
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
                title={t("profileTab", "selectDistrict")}
                items={districtItems}
                selectedValue={draft.district}
                onSelect={(item) => {
                    setDraft({ ...draft, district: item.value, taluka: "", village: "" });
                }}
                onClose={() => setShowDistrict(false)}
            />
            <LocationModal
                visible={showTaluka}
                title={t("profileTab", "selectTaluka")}
                items={talukaItems}
                selectedValue={draft.taluka}
                onSelect={(item) => {
                    setDraft({ ...draft, taluka: item.value, village: "" });
                }}
                onClose={() => setShowTaluka(false)}
            />
            <LocationModal
                visible={showVillage}
                title={t("profileTab", "selectVillage")}
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
                            <Ionicons name={icon as any} size={18} color="#2E7D32" />
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

type ProfilePopupAction = {
    label: string;
    onPress?: () => void | Promise<void>;
    variant?: "primary" | "secondary" | "danger" | "ghost";
    icon?: string;
};

type ProfilePopupConfig = {
    title: string;
    message?: string;
    icon: string;
    iconColor: string;
    iconBg: string;
    actions: ProfilePopupAction[];
};

function ProfilePopupModal({
    visible,
    config,
    busy,
    onClose,
    onAction,
}: {
    visible: boolean;
    config: ProfilePopupConfig | null;
    busy: boolean;
    onClose: () => void;
    onAction: (action: ProfilePopupAction) => void;
}) {
    if (!visible || !config) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.popupOverlay}>
                <Pressable style={styles.popupBackdrop} onPress={busy ? undefined : onClose} />
                <View style={styles.popupCard}>
                    <View style={[styles.popupIconWrap, { backgroundColor: config.iconBg }]}>
                        <Ionicons name={config.icon as any} size={28} color={config.iconColor} />
                    </View>
                    <Text style={styles.popupTitle}>{config.title}</Text>
                    {config.message ? <Text style={styles.popupMessage}>{config.message}</Text> : null}
                    <View style={styles.popupActions}>
                        {config.actions.map((action) => (
                            <Pressable
                                key={action.label}
                                onPress={() => onAction(action)}
                                disabled={busy}
                                style={({ pressed }) => [
                                    styles.popupActionBtn,
                                    action.variant === "primary" && styles.popupActionBtnPrimary,
                                    action.variant === "secondary" && styles.popupActionBtnSecondary,
                                    action.variant === "danger" && styles.popupActionBtnDanger,
                                    action.variant === "ghost" && styles.popupActionBtnGhost,
                                    (pressed || busy) && styles.popupActionBtnPressed,
                                ]}
                            >
                                <View style={styles.popupActionInner}>
                                    {action.icon ? (
                                        <Ionicons
                                            name={action.icon as any}
                                            size={18}
                                            color={
                                                action.variant === "primary"
                                                    ? "#FFFFFF"
                                                    : action.variant === "danger"
                                                        ? "#B91C1C"
                                                        : "#1A2E1C"
                                            }
                                        />
                                    ) : null}
                                    <Text
                                        style={[
                                            styles.popupActionText,
                                            action.variant === "primary" && styles.popupActionTextPrimary,
                                            action.variant === "danger" && styles.popupActionTextDanger,
                                        ]}
                                    >
                                        {action.label}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
    const { lang, setLang, t } = useLanguage();
    const WATER_OPTIONS = React.useMemo(() => [
        { key: "Rain", label: `🌧 ${t("profileTab", "waterRain")}` },
        { key: "Borewell", label: `⛽ ${t("profileTab", "waterBorewell")}` },
        { key: "Canal", label: `💧 ${t("profileTab", "waterCanal")}` },
    ], [t]);
    const LABOUR_OPTIONS = React.useMemo(() => [
        { key: "Family", label: `👨‍👩‍👧 ${t("profileTab", "labourFamily")}` },
        { key: "Hired", label: `👷 ${t("profileTab", "labourHired")}` },
        { key: "Mixed", label: `🤝 ${t("profileTab", "labourMixed")}` },
    ], [t]);
    const TRACTOR_SERVICE_OPTIONS = React.useMemo(() => [
        { key: "Rotavator", label: t("profileTab", "tractorRotavator") },
        { key: "RAP", label: t("profileTab", "tractorRAP") },
        { key: "Bagi", label: t("profileTab", "tractorBagi") },
        { key: "Savda", label: t("profileTab", "tractorSavda") },
    ], [t]);
    const [apiProfile, setApiProfile] = useState<APIFarmerProfile | null>(null);
    const [draft, setDraft] = useState<ProfileDraft | null>(null);
    const [phone, setPhone] = useState<string>("");
    const [editVisible, setEditVisible] = useState(false);
    const [cardVisible, setCardVisible] = useState(false);
    const cardShotRef = useRef<{ capture: () => Promise<string> } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [profilePopup, setProfilePopup] = useState<ProfilePopupConfig | null>(null);
    const [popupBusy, setPopupBusy] = useState(false);
    const [vadiScore, setVadiScore] = useState<VadiScoreResponse | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const cardScale = useRef(new Animated.Value(0.96)).current;
    const headerPulse = useRef(new Animated.Value(1)).current;

    const loadProfile = async () => {
        setLoading(true); setLoadError("");
        try {
            const [data, score] = await Promise.all([
                getMyProfile(),
                getVadiScore().catch(() => null),
            ]);
            setApiProfile(data);
            setPhone((data as any).phone ?? (data as any).user?.phone ?? "");
            setVadiScore(score ?? null);
        } catch (err: any) {
            setLoadError(err.message ?? t("profileTab", "loadErr"));
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
                Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
            ]).start();
        }
    }, [loading, apiProfile]);

    const handleEditOpen = () => {
        Animated.sequence([
            Animated.timing(headerPulse, { toValue: 0.97, duration: 100, useNativeDriver: true }),
            Animated.spring(headerPulse, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]).start();
        // Navigate to the same profile setup flow used after OTP
        router.push("/(auth)/profile-setup");
    };

    const handleSave = async () => {
        if (!draft) return;
        if (!draft.name.trim()) { Alert.alert(t("profileTab", "errTitle"), t("profileTab", "errName")); return; }
        if (!draft.totalLand.trim() || isNaN(Number(draft.totalLand))) { Alert.alert(t("profileTab", "errTitle"), t("profileTab", "errLand")); return; }
        setSaving(true);
        try {
                const updated = await updateProfile({
                    name: draft.name,
                    district: draft.district as any,
                    taluka: draft.taluka,
                    village: draft.village,
                totalLand: { value: parseFloat(draft.totalLand), unit: draft.totalLandUnit },
                waterSources: draft.waterSources as any,
                tractorAvailable: draft.tractorAvailable,
                // Tractor services selection removed; always save empty.
                implementsAvailable: [],
                labourTypes: draft.labourTypes as any,
                dataSharing: draft.dataSharing,
            });
            setApiProfile(updated.profile);
            setEditVisible(false);
            setDraft(null);
            Toast.show({
              type: "success",
              text1: t("profileTab", "saveSuccess"),
              text2: t("profileTab", "saveDone"),
            });
        } catch (err: any) {
            Alert.alert(t("profileTab", "errTitle"), err.message);
        } finally {
            setSaving(false);
        }
    };

    const closeProfilePopup = () => {
        if (!popupBusy) setProfilePopup(null);
    };

    const runProfilePopupAction = async (action: ProfilePopupAction) => {
        if (!action.onPress) {
            closeProfilePopup();
            return;
        }
        try {
            setPopupBusy(true);
            await action.onPress();
            setProfilePopup(null);
        } finally {
            setPopupBusy(false);
        }
    };

    const handleLogout = () => {
        setProfilePopup({
            title: t("profileTab", "logoutTitle"),
            message: t("profileTab", "logoutMsg"),
            icon: "log-out-outline",
            iconColor: "#B91C1C",
            iconBg: "#FEE2E2",
            actions: [
                { label: t("profileTab", "logoutNo"), variant: "ghost", icon: "close-outline", onPress: () => {} },
                {
                    label: t("profileTab", "logoutYes"),
                    variant: "danger",
                    icon: "log-out-outline",
                    onPress: async () => {
                        await logout();
                        router.replace("/(auth)/login");
                    },
                },
            ],
        });
    };

    const buildShareMessage = () => {
        const p = apiProfile!;
        const taluka = (p as any).taluka ?? "";
        const districtDisplay = getLocationLabel("district", { district: p.district });
        const talukaDisplay = taluka ? getLocationLabel("taluka", { district: p.district, taluka }) : "—";
        const villageDisplay = p.village ? getLocationLabel("village", { district: p.district, taluka, village: p.village }) : "—";
        const waterSources = Array.isArray((p as any).waterSources) ? (p as any).waterSources : ((p as any).waterSource != null ? [(p as any).waterSource] : []);
        const labourTypes = Array.isArray((p as any).labourTypes) ? (p as any).labourTypes : ((p as any).labourType != null ? [(p as any).labourType] : []);
        const implementsAvailable = Array.isArray((p as any).implementsAvailable) ? (p as any).implementsAvailable : [];
        const landDisplay = `${p.totalLand?.unit === "bigha" ? formatArea(p.totalLand?.value) : formatWholeNumber(p.totalLand?.value)} ${p.totalLand?.unit === "bigha" ? t("common", "bigha") : t("common", "acre")}`;
        const waterDisplay = toLabels(WATER_OPTIONS, waterSources);
        const labourDisplay = toLabels(LABOUR_OPTIONS, labourTypes);
        const tractorServicesDisplay = implementsAvailable.length > 0 ? toLabels(TRACTOR_SERVICE_OPTIONS, implementsAvailable) : null;
        let msg = `🌾 VADI — ${t("profileTab", "farmerProfileSharePrefix")}\n\n${t("profileTab", "shareName")}: ${p.name}\n${t("profileTab", "shareDistrict")}: ${districtDisplay}\n${t("profileTab", "shareTaluka")}: ${talukaDisplay}\n${t("profileTab", "shareVillage")}: ${villageDisplay}\n${t("profileTab", "shareTotalLand")}: ${landDisplay}\n${t("profileTab", "shareWater")}: ${waterDisplay}\n${t("profileTab", "shareLabour")}: ${labourDisplay}\n${t("profileTab", "shareTractor")}: ${p.tractorAvailable ? t("profileTab", "shareYes") : t("profileTab", "shareNo")}`;
        if (p.tractorAvailable && tractorServicesDisplay) msg += `\n${t("profileTab", "shareTractorServices")}: ${tractorServicesDisplay}`;
        const farms = Array.isArray((p as any).farms) ? (p as any).farms : [];
        if (farms.length) msg += "\n" + t("profileTab", "shareFarms") + ": " + farms.map((f: any) => `${f.name || t("profileTab", "shareFarm")} ${f.area ?? 0} ${t("common", "bigha")}`).join(", ");
        msg += "\n\n— " + t("profileTab", "sharedFromApp");
        return msg;
    };

    const captureCardImage = async (): Promise<string | null> => {
        if (!ViewShotComponent || !cardShotRef.current?.capture) return null;
        try {
            return await cardShotRef.current.capture();
        } catch (e) {
            return null;
        }
    };

    const handleDownloadCard = async () => {
        if (!MediaLibrary) {
            Alert.alert(t("profileTab", "errTitle"), t("profileTab", "downloadInstallMsg"));
            return;
        }
        const uri = await captureCardImage();
        if (!uri) {
            Alert.alert(t("profileTab", "errTitle"), t("profileTab", "cardImageFailed"));
            return;
        }
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== "granted") {
                Alert.alert(t("profileTab", "errTitle"), t("profileTab", "galleryPermission"));
                return;
            }
            await MediaLibrary.saveToLibraryAsync(uri);
            Toast.show({
              type: "success",
              text1: t("profileTab", "saveSuccess"),
              text2: t("profileTab", "savedToGallery"),
            });
        } catch (e: any) {
            Alert.alert(t("profileTab", "errTitle"), e?.message ?? t("profileTab", "downloadFailed"));
        }
    };

    const handleShareCard = async () => {
        if (hasImageShare && Sharing) {
            const uri = await captureCardImage();
            if (uri) {
                try {
                    const isAvailable = await Sharing.isAvailableAsync();
                    if (isAvailable) {
                        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("profileTab", "shareImage") });
                        return;
                    }
                } catch (e: any) {
                    Alert.alert(t("profileTab", "errTitle"), e?.message ?? t("profileTab", "shareFailed"));
                    return;
                }
            }
        }
        try {
            await Share.share({ message: buildShareMessage(), title: t("profileTab", "farmerCard") });
        } catch (_) {}
    };

    const handleLanguagePress = () => {
        setProfilePopup({
            title: t("common", "language"),
            message: t("common", "gujarati"),
            icon: "language-outline",
            iconColor: "#0F766E",
            iconBg: "#CCFBF1",
            actions: [
                {
                    label: t("common", "gujarati"),
                    variant: lang === "gu" ? "primary" : "secondary",
                    icon: lang === "gu" ? "checkmark-circle" : "text-outline",
                    onPress: () => setLang("gu"),
                },
                { label: t("common", "cancel"), variant: "ghost", icon: "close-outline", onPress: () => {} },
            ],
        });
    };

    const handleDataSharingPress = () => {
        const current = !!apiProfile?.analyticsConsent;
        setProfilePopup({
            title: t("profileTab", "dataSharing"),
            message: t("profileTab", "dataSharingNote"),
            icon: "shield-checkmark-outline",
            iconColor: "#0F766E",
            iconBg: "#CCFBF1",
            actions: [
                {
                    label: t("profileTab", "on"),
                    variant: current ? "primary" : "secondary",
                    icon: current ? "checkmark-circle" : "shield-checkmark-outline",
                    onPress: async () => {
                        try {
                            const updated = await updateProfile({ dataSharing: true });
                            setApiProfile(updated.profile);
                        } catch (err: any) {
                            Alert.alert(t("profileTab", "errTitle"), err.message);
                        }
                    },
                },
                {
                    label: t("profileTab", "off"),
                    variant: !current ? "primary" : "secondary",
                    icon: !current ? "checkmark-circle" : "shield-outline",
                    onPress: async () => {
                        try {
                            const updated = await updateProfile({ dataSharing: false });
                            setApiProfile(updated.profile);
                        } catch (err: any) {
                            Alert.alert(t("profileTab", "errTitle"), err.message);
                        }
                    },
                },
                { label: t("common", "cancel"), variant: "ghost", icon: "close-outline", onPress: () => {} },
            ],
        });
    };

    if (loading) {
        return <View style={styles.centerScreen}><ActivityIndicator size="large" color="#2E7D32" /><Text style={styles.loadingText}>{t("profileTab", "loading")}</Text></View>;
    }
    if (loadError) {
        return (
            <View style={styles.centerScreen}>
                <Ionicons name="cloud-offline-outline" size={52} color="#2D4230" />
                <Text style={styles.loadErrText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
                    <Text style={styles.retryBtnText}>{t("profileTab", "retry")}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const p = apiProfile!;
    const initials = (p.name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    const landDisplay = `${p.totalLand?.unit === "bigha" ? formatArea(p.totalLand?.value) : formatWholeNumber(p.totalLand?.value)} ${p.totalLand?.unit === "bigha" ? t("common", "bigha") : t("common", "acre")}`;

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

    const profilePhotoUrl = (p as any).profileImage ?? (p as any).photo ?? (p as any).avatar ?? null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F6F9F4" />
            <View style={styles.bgDecor1} />
            <View style={styles.bgDecor2} />

            <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                    {/* ══ Light header: title + actions ══ */}
                    <Animated.View style={[styles.topBar, { transform: [{ scale: headerPulse }] }]}>
                        <Text style={styles.topBarTitle}>{t("profileTab", "title")}</Text>
                        <View style={styles.topBarActions}>
                            <Pressable
                                onPress={handleEditOpen}
                                style={({ pressed }) => [styles.editFAB, pressed && styles.editFABPressed]}
                            >
                                <Ionicons name="create-outline" size={20} color="#2E7D32" />
                                <Text style={styles.editFABText}>{t("profileTab", "edit")}</Text>
                            </Pressable>
                        </View>
                    </Animated.View>

                    {/* ══ Farmer card: photo + details ══ */}
                    <Animated.View style={[styles.farmerCard, { transform: [{ scale: cardScale }] }]}>
                        <View style={styles.farmerCardInner}>
                            <View style={styles.farmerPhotoWrap}>
                                {profilePhotoUrl ? (
                                    <Image source={{ uri: profilePhotoUrl }} style={styles.farmerPhoto} contentFit="cover" />
                                ) : (
                                    <View style={styles.farmerPhotoPlaceholder}>
                                        <Text style={styles.farmerInitials}>{initials}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.farmerName}>{p.name}</Text>
                            <Text style={styles.farmerRole}>🌾 {t("profileTab", "farmer")}</Text>
                            <View style={styles.farmerMeta}>
                                {villageDisplay !== "—" && (
                                    <View style={styles.farmerMetaItem}>
                                        <Ionicons name="location-outline" size={18} color="#6B7B6E" />
                                        <Text style={styles.farmerMetaText}>{villageDisplay}</Text>
                                    </View>
                                )}
                                {districtDisplay && (
                                    <View style={styles.farmerMetaItem}>
                                        <Ionicons name="map-outline" size={18} color="#6B7B6E" />
                                        <Text style={styles.farmerMetaText}>{districtDisplay}</Text>
                                    </View>
                                )}
                                <View style={styles.farmerMetaItem}>
                                    <Ionicons name="leaf-outline" size={18} color="#6B7B6E" />
                                    <Text style={styles.farmerMetaText}>{landDisplay}</Text>
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* ══ VADI score summary (above language) ══ */}
                    {vadiScore && (
                        <View style={styles.vadiScoreCard}>
                            <Text style={styles.vadiScoreTitle}>{t("profileTab", "vadiScoreTitle")}</Text>
                            <Text style={styles.vadiScoreMainValue}>
                                {vadiScore.farmer_vadi_score ?? 0}
                            </Text>
                            {vadiScore.village_rank != null && vadiScore.village_total_farmers > 0 && (
                                <Text style={styles.vadiScoreRank}>
                                    {`ગામ રેન્ક: ${vadiScore.village_rank} / ${vadiScore.village_total_farmers} ખેડૂત`}
                                </Text>
                            )}
                            <View style={{ marginTop: 10 }}>
                                <Text style={styles.vadiScoreSubtitle}>{t("profileTab", "vadiScoreTopStrength")}</Text>
                                <Text style={styles.vadiInsightText}>
                                    {vadiScore.farmer_insights && vadiScore.farmer_insights.length > 0
                                        ? vadiScore.farmer_insights[0]
                                        : "—"}
                                </Text>
                            </View>
                            <View style={{ marginTop: 10 }}>
                                <Text style={styles.vadiScoreSubtitle}>{t("profileTab", "vadiScoreImprovement")}</Text>
                                <Text style={styles.vadiInsightText}>
                                    {vadiScore.farmer_insights && vadiScore.farmer_insights.length > 1
                                        ? vadiScore.farmer_insights[1]
                                        : "—"}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* ══ Simple quick actions under profile ══ */}
                    <View style={styles.quickCard}>
                        <Pressable style={styles.quickRow} onPress={handleLanguagePress}>
                            <Ionicons name="language-outline" size={24} color="#0F766E" />
                            <View style={styles.quickTextWrap}>
                                <Text style={styles.quickTitle}>{t("common", "language")}</Text>
                                <Text style={styles.quickSub}>
                                    {lang === "gu" ? t("common", "gujarati") : t("common", "english")}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
                        </Pressable>

                        <View style={styles.quickDivider} />

                        <Pressable style={styles.quickRow} onPress={handleDataSharingPress}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#0F766E" />
                            <View style={styles.quickTextWrap}>
                                <Text style={styles.quickTitle}>{t("profileTab", "dataSharing")}</Text>
                                <Text style={styles.quickSub}>
                                    {p.analyticsConsent ? t("profileTab", "on") : t("profileTab", "off")}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
                        </Pressable>

                    </View>

                    {/* Contact details */}
                    <View style={styles.contactSimple}>
                        <Text style={styles.contactSimpleTitle}>{t("profileTab", "contactUs")}</Text>
                        <View style={styles.contactRow}>
                            <Ionicons name="mail-outline" size={22} color="#0F766E" />
                            <Text style={styles.contactDetail}>vadi.support@gmail.com</Text>
                        </View>
                        <View style={styles.contactRow}>
                            <Ionicons name="call-outline" size={22} color="#0F766E" />
                            <Text style={styles.contactDetail}>9662089386</Text>
                        </View>
                    </View>

                    <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}>
                        <Ionicons name="log-out-outline" size={22} color="#DC2626" />
                        <Text style={styles.logoutBtnText}>{t("profileTab", "logout")}</Text>
                    </Pressable>

                    <Text style={styles.versionText}>{t("profileTab", "version")}</Text>
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
                    waterOptions={WATER_OPTIONS}
                    labourOptions={LABOUR_OPTIONS}
                    tractorServiceOptions={TRACTOR_SERVICE_OPTIONS}
                />
            )}

            <ProfilePopupModal
                visible={!!profilePopup}
                config={profilePopup}
                busy={popupBusy}
                onClose={closeProfilePopup}
                onAction={runProfilePopupAction}
            />

            {/* Full farmer profile card modal — share / download */}
            <Modal visible={cardVisible} transparent animationType="fade">
                <View style={styles.cardModalBackdrop}>
                    <View style={styles.cardModalContent}>
                        <ScrollView
                            contentContainerStyle={styles.cardModalScroll}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            {ViewShotComponent ? (
                                <ViewShotComponent
                                    ref={cardShotRef}
                                    options={{ format: "png", result: "tmpfile", quality: 1 }}
                                    style={{ backgroundColor: "transparent" }}
                                >
                                    <FarmerProfileCard
                                        profile={p}
                                        districtLabel={districtDisplay}
                                        talukaLabel={talukaDisplay}
                                        villageLabel={villageDisplay}
                                        cardWidth={Math.min(SCREEN_W - 48, 440)}
                                        cardHeight={320}
                                        vadiScore={vadiScore?.farmer_vadi_score ?? 0}
                                    />
                                </ViewShotComponent>
                            ) : (
                                <FarmerProfileCard
                                    profile={p}
                                    districtLabel={districtDisplay}
                                    talukaLabel={talukaDisplay}
                                    villageLabel={villageDisplay}
                                    cardWidth={Math.min(SCREEN_W - 48, 440)}
                                    cardHeight={320}
                                    vadiScore={vadiScore?.farmer_vadi_score ?? 0}
                                />
                            )}
                        </ScrollView>
                        <View style={styles.cardModalActions}>
                            {hasImageDownload && (
                                <Pressable style={styles.cardModalDownloadBtn} onPress={handleDownloadCard}>
                                    <Ionicons name="download-outline" size={22} color="#fff" />
                                    <Text style={styles.cardModalShareBtnText}>{t("profileTab", "downloadCard")}</Text>
                                </Pressable>
                            )}
                            <Pressable style={styles.cardModalShareBtn} onPress={handleShareCard}>
                                <Ionicons name="share-social" size={22} color="#fff" />
                                <Text style={styles.cardModalShareBtnText}>{t("profileTab", "shareCard")}</Text>
                            </Pressable>
                            <Pressable style={styles.cardModalCloseBtn} onPress={() => setCardVisible(false)}>
                                <Text style={styles.cardModalCloseBtnText}>{t("profileTab", "closeCard")}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// View Styles
// ─────────────────────────────────────────────────────────────────────────────
// Light theme: soft green-tinted background, farmer-focused
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F6F9F4" },
    centerScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#F6F9F4" },
    loadingText: { fontSize: 21, color: "#3D5C40" },
    loadErrText: { fontSize: 19, color: "#EF4444", textAlign: "center", paddingHorizontal: 32, lineHeight: 28 },
    retryBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
    retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 20 },
    bgDecor1: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "#E2EDE0", top: -70, right: -70 },
    bgDecor2: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "#E8F0E6", top: 180, left: -50 },
    scrollContent: { paddingBottom: 20, paddingTop: HEADER_PADDING_TOP },
    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 18 },
    topBarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    topBarTitle: { fontSize: 28, fontWeight: "800", color: "#1A2E1C", letterSpacing: 0.2 },
    editFAB: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: "#C8E6C9", shadowColor: "#0A0E0B", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
    editFABPressed: { opacity: 0.85 },
    editFABText: { fontSize: 18, fontWeight: "800", color: "#2E7D32" },
    farmerCard: { backgroundColor: "#fff", borderRadius: 24, marginHorizontal: 18, marginBottom: 18, paddingVertical: 28, paddingHorizontal: 22, alignItems: "center", shadowColor: "#1A2E1C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
    farmerCardInner: { alignItems: "center", width: "100%", position: "relative" },
    farmerPhotoWrap: { width: 112, height: 112, borderRadius: 56, marginBottom: 16, overflow: "hidden" },
    farmerPhoto: { width: "100%", height: "100%", borderRadius: 56 },
    farmerPhotoPlaceholder: { width: "100%", height: "100%", borderRadius: 56, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
    farmerInitials: { fontSize: 38, fontWeight: "900", color: "#2E7D32" },
    farmerName: { fontSize: 30, fontWeight: "800", color: "#1A2E1C", marginBottom: 6, textAlign: "center" },
    farmerRole: { fontSize: 20, color: "#6B7B6E", marginBottom: 14 },
    profileScoreCorner: {
        position: "absolute",
        top: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: "#ECFDF3",
        borderWidth: 2,
        borderColor: "#22C55E",
        alignItems: "flex-end",
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
    },
    profileScoreCornerLabel: { fontSize: 11, fontWeight: "700", color: "#166534" },
    profileScoreCornerValue: { fontSize: 22, fontWeight: "900", color: "#166534" },
    vadiScoreCard: {
        marginHorizontal: 18,
        marginBottom: 22,
        paddingVertical: 26,
        paddingHorizontal: 22,
        borderRadius: 24,
        backgroundColor: "#EFF6FF",
        borderWidth: 1.5,
        borderColor: "#93C5FD",
        shadowColor: "#1D4ED8",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 5,
        minHeight: 170,
        justifyContent: "center",
    },
    vadiScoreMainValue: {
        fontSize: 34,
        fontWeight: "900",
        color: "#1D4ED8",
        marginTop: 6,
    },
    vadiScoreHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    vadiScoreTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
    vadiScoreSubtitle: { fontSize: 14, fontWeight: "700", color: "#4B5563", marginTop: 4 },
    vadiScoreCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#EFF6FF",
        borderWidth: 2,
        borderColor: "#3B82F6",
        justifyContent: "center",
        alignItems: "center",
    },
    vadiScoreCircleValue: { fontSize: 24, fontWeight: "900", color: "#1D4ED8" },
    vadiScoreCircleMax: { fontSize: 11, fontWeight: "600", color: "#1D4ED8" },
    vadiScoreRank: { fontSize: 13, fontWeight: "600", color: "#4B5563", marginTop: 6 },
    vadiInsightsWrap: { marginTop: 8, gap: 4 },
    vadiInsightText: { fontSize: 13, color: "#4B5563" },
    farmerMeta: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
    farmerMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    farmerMetaText: { fontSize: 18, color: "#5C6B5E", fontWeight: "600" },
    farmerCardBtn: {
        backgroundColor: "#fff",
        borderRadius: 20,
        marginHorizontal: 18,
        marginBottom: 18,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 2,
        borderColor: "#99F6E4",
        shadowColor: "#0F766E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    farmerCardBtnText: { fontSize: 18, fontWeight: "800", color: "#0F172A", flex: 1 },
    farmerCardBtnSub: { fontSize: 15, fontWeight: "600", color: "#64748B" },
    cardModalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    cardModalContent: {
        backgroundColor: "#F0F4F3",
        borderRadius: 24,
        maxHeight: "90%",
        width: "100%",
        overflow: "hidden",
    },
    cardModalScroll: { padding: 24, paddingBottom: 16, alignItems: "center" },
    cardModalActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
    cardModalDownloadBtn: {
        flex: 1,
        minWidth: 100,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#0D5C4A",
        paddingVertical: 14,
        borderRadius: 14,
    },
    cardModalShareBtn: {
        flex: 1,
        minWidth: 100,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#0F766E",
        paddingVertical: 14,
        borderRadius: 14,
    },
    cardModalShareBtnText: { fontSize: 18, fontWeight: "800", color: "#fff" },
    cardModalCloseBtn: { paddingVertical: 14, paddingHorizontal: 20, justifyContent: "center" },
    cardModalCloseBtnText: { fontSize: 17, fontWeight: "700", color: "#64748B" },
    contactCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        marginHorizontal: 18,
        marginBottom: 14,
        padding: 20,
        borderWidth: 2,
        borderColor: "#0F766E",
        shadowColor: "#0D5C4A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    contactCardInner: { flexDirection: "row", alignItems: "flex-start", gap: 18 },
    contactIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#0F766E",
        justifyContent: "center",
        alignItems: "center",
    },
    contactTextWrap: { flex: 1 },
    contactCardTitle: { fontSize: 21, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
    contactCardSub: { fontSize: 16, fontWeight: "600", color: "#64748B", marginBottom: 12 },
    contactRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    contactDetail: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
    aboutSection: { paddingHorizontal: 20, paddingVertical: 16, marginBottom: 12, backgroundColor: "#F1F5F4", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8E6" },
    aboutSectionTitle: { fontSize: 18, fontWeight: "800", color: "#334155", marginBottom: 8 },
    aboutSectionBody: { fontSize: 16, color: "#64748B", lineHeight: 24, fontWeight: "500" },
    udyamRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8E6" },
    udyamLabel: { fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 4 },
    udyamNumber: { fontSize: 15, fontWeight: "800", color: "#0D5C4A", letterSpacing: 0.5 },
    aboutLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
    aboutLinkText: { fontSize: 16, fontWeight: "700", color: "#64748B" },
    langChips: { flexDirection: "row", gap: 8 },
    langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#EEF4EE", borderWidth: 1, borderColor: "#D8E6D8" },
    langChipActive: { backgroundColor: "#E0F0E0", borderColor: "#5DAF5D" },
    langChipText: { fontSize: 16, color: "#5C6B5E", fontWeight: "600" },
    langChipTextActive: { color: "#1B5E20", fontWeight: "700" },
    settingsCard: { backgroundColor: "#fff", borderRadius: 20, marginHorizontal: 18, marginBottom: 18, padding: 18, shadowColor: "#1A2E1C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
    settingsCardTitle: { fontSize: 19, fontWeight: "800", color: "#1A2E1C", marginBottom: 14 },
    settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
    settingsLabel: { fontSize: 16, color: "#2D4230", fontWeight: "700" },
    settingsSub: { fontSize: 14, color: "#6B7B6E", marginTop: 2 },
    footerLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginBottom: 16 },
    footerLinkText: { fontSize: 16, fontWeight: "700", color: "#0F766E" },
    footerLinkDot: { fontSize: 16, color: "#9CA3AF" },
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
    switchInfoLabel: { fontSize: 15, fontWeight: "700", color: "#0A0E0B" },
    switchInfoSub: { fontSize: 14, color: "#2D4230", marginTop: 2 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 16, paddingVertical: 18, borderRadius: 18, backgroundColor: "#FFEBEE", borderWidth: 1.5, borderColor: "#FFCDD2", marginBottom: 12 },
    logoutBtnPressed: { opacity: 0.7 },
    logoutBtnText: { fontSize: 21, fontWeight: "800", color: "#B71C1C" },
    versionText: { textAlign: "center", fontSize: 16, color: "#2D4230", marginBottom: 4 },
    quickCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        marginHorizontal: 18,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 4,
        shadowColor: "#0A0E0B",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    quickRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 10,
    },
    quickTextWrap: { flex: 1 },
    quickTitle: { fontSize: 16, fontWeight: "700", color: "#1A2E1C" },
    quickSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
    quickDivider: { height: 1, backgroundColor: "#EEF2EC" },
    popupOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 22,
    },
    popupBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(11, 18, 14, 0.45)",
    },
    popupCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        paddingHorizontal: 22,
        paddingTop: 24,
        paddingBottom: 18,
        shadowColor: "#0A0E0B",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 10,
    },
    popupIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 14,
    },
    popupTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: "#1A2E1C",
        textAlign: "center",
    },
    popupMessage: {
        fontSize: 18,
        lineHeight: 24,
        color: "#5C6B5E",
        textAlign: "center",
        marginTop: 10,
    },
    popupActions: {
        gap: 10,
        marginTop: 18,
    },
    popupActionBtn: {
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    popupActionBtnPrimary: {
        backgroundColor: "#2E7D32",
    },
    popupActionBtnSecondary: {
        backgroundColor: "#ECFDF3",
        borderWidth: 1,
        borderColor: "#C8E6C9",
    },
    popupActionBtnDanger: {
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    popupActionBtnGhost: {
        backgroundColor: "#F6F9F4",
    },
    popupActionBtnPressed: {
        opacity: 0.75,
    },
    popupActionInner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    popupActionText: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1A2E1C",
    },
    popupActionTextPrimary: {
        color: "#FFFFFF",
    },
    popupActionTextDanger: {
        color: "#B91C1C",
    },
    contactSimple: {
        marginHorizontal: 18,
        marginBottom: 20,
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    contactSimpleTitle: {
        fontSize: 21,
        fontWeight: "800",
        color: "#1A2E1C",
        marginBottom: 8,
    },
});

// ─── Profile-setup matching theme (edit modal) ───────────────────────────────
const EC = {
    green700: "#2E7D32",
    green50: "#E8F5E9",
    surface: "#FFFFFF",
    surfaceGreen: "#F1F8F1",
    textPrimary: "#1A2E1C",
    textSecondary: "#3D5C40",
    textMuted: "#7A9B7E",
    borderLight: "#EAF4EA",
    border: "#C8E6C9",
};

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal Styles (same graphical theme as profile-setup)
// ─────────────────────────────────────────────────────────────────────────────
const editStyles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: "flex-end" },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    modalSheet: { height: SCREEN_H * 0.92, backgroundColor: EC.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: EC.surface, paddingHorizontal: 18, paddingVertical: 16, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomWidth: 1, borderBottomColor: EC.borderLight },
    sheetTopBar: { height: 5, backgroundColor: EC.green700, marginHorizontal: -18, marginBottom: 0 },
    sheetCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: EC.surfaceGreen, borderWidth: 2, borderColor: EC.borderLight, justifyContent: "center", alignItems: "center" },
    sheetTitle: { fontSize: 21, fontWeight: "800", color: EC.textPrimary },
    sheetSaveBtn: { backgroundColor: EC.green700, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22, minWidth: 72, alignItems: "center" },
    sheetSaveBtnText: { fontSize: 18, fontWeight: "800", color: "#fff" },
    sheetScroll: { padding: 20, paddingTop: 12, backgroundColor: "#F5F7F2" },
    groupLabel: { fontSize: 17, fontWeight: "800", color: EC.green700, letterSpacing: 0.5, marginBottom: 10, marginTop: 14 },
    inputGroup: { backgroundColor: EC.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 2, borderColor: EC.borderLight },
    inputLabel: { fontSize: 17, fontWeight: "700", color: EC.textSecondary, marginBottom: 8 },
    inputSub: { fontSize: 16, color: EC.textMuted, marginTop: 3 },
    textInput: { fontSize: 19, fontWeight: "600", color: EC.textPrimary, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 2, borderRadius: 14, borderColor: EC.borderLight, backgroundColor: EC.surfaceGreen },
    landRow: { flexDirection: "row", alignItems: "center" },
    unitToggle: { flexDirection: "row", borderWidth: 2, borderColor: EC.borderLight, borderRadius: 12, overflow: "hidden" },
    unitBtn: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: EC.surfaceGreen },
    unitBtnActive: { backgroundColor: EC.green700 },
    unitBtnText: { fontSize: 15, fontWeight: "700", color: EC.textMuted },
    unitBtnTextActive: { color: "#fff" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 2, borderColor: EC.borderLight, backgroundColor: EC.surfaceGreen },
    chipActive: { borderColor: EC.green700, backgroundColor: EC.green50 },
    chipText: { fontSize: 16, fontWeight: "600", color: EC.textMuted },
    chipTextActive: { color: EC.textPrimary, fontWeight: "800" },
    switchRow: { flexDirection: "row", alignItems: "center", backgroundColor: EC.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 2, borderColor: EC.borderLight },
    locationBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, borderRadius: 14, borderColor: EC.borderLight, backgroundColor: EC.surfaceGreen, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
    locationBtnFilled: { borderColor: EC.green700 },
    locationBtnDisabled: { opacity: 0.4 },
    locationBtnText: { fontSize: 19, color: EC.textPrimary, fontWeight: "600", flex: 1 },
    locationBtnPlaceholder: { color: EC.textMuted, fontWeight: "400" },
    locationBtnArrow: { fontSize: 20, color: EC.green700, marginLeft: 8, fontWeight: "700" },
    locModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    locModalSheet: { backgroundColor: EC.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, maxHeight: "60%", borderWidth: 1, borderColor: EC.borderLight },
    locModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: EC.border, alignSelf: "center", marginTop: 12, marginBottom: 6 },
    locModalTitle: { fontSize: 21, fontWeight: "800", color: EC.textPrimary, textAlign: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: EC.borderLight, marginBottom: 4 },
    locItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: EC.borderLight },
    locItemSelected: { backgroundColor: EC.surfaceGreen, borderRadius: 10, paddingHorizontal: 8 },
    locItemLabel: { fontSize: 19, color: EC.textPrimary, fontWeight: "600" },
    locItemLabelSel: { color: EC.green700, fontWeight: "800" },
    locItemSub: { fontSize: 16, color: EC.textMuted, marginTop: 2 },
    locItemCheck: { fontSize: 20, color: EC.green700, fontWeight: "900", marginLeft: 8 },
});
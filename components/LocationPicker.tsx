// components/LocationPicker.tsx
import { GUJARAT_LOCATIONS } from "@/data/gujarati-location";
import { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Props = {
    onLocationChange: (location: {
        districtKey: string;
        districtLabel: string; // Gujarati
        talukaKey: string;
        talukaLabel: string;   // Gujarati
        villageKey: string;
        villageLabel: string;  // Gujarati
    }) => void;
    label?: string;
};

type DropdownItem = { value: string; label: string };

function DropdownModal({
    visible,
    title,
    items,
    onSelect,
    onClose,
}: {
    visible: boolean;
    title: string;
    items: DropdownItem[];
    onSelect: (item: DropdownItem) => void;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{title}</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {items.map((item) => (
                        <Pressable
                            key={item.value}
                            style={styles.sheetItem}
                            onPress={() => { onSelect(item); onClose(); }}
                            android_ripple={{ color: "#C8E6C9" }}
                        >
                            <Text style={styles.sheetItemText}>{item.label}</Text>
                            <Text style={styles.sheetItemSubText}>{item.value}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        </Modal>
    );
}

function DropdownButton({
    label,
    value,
    placeholder,
    disabled,
    onPress,
}: {
    label: string;
    value: string;
    placeholder: string;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Pressable
                onPress={onPress}
                disabled={disabled}
                style={[
                    styles.dropdownBtn,
                    value && styles.dropdownBtnFilled,
                    disabled && styles.dropdownBtnDisabled,
                ]}
            >
                <Text style={[styles.dropdownBtnText, !value && styles.dropdownBtnPlaceholder]}>
                    {value || placeholder}
                </Text>
                <Text style={styles.dropdownArrow}>{disabled ? "—" : "▾"}</Text>
            </Pressable>
        </View>
    );
}

export default function LocationPicker({ onLocationChange }: Props) {
    const [district, setDistrict] = useState<DropdownItem | null>(null);
    const [taluka, setTaluka] = useState<DropdownItem | null>(null);
    const [village, setVillage] = useState<DropdownItem | null>(null);

    const [showDistrict, setShowDistrict] = useState(false);
    const [showTaluka, setShowTaluka] = useState(false);
    const [showVillage, setShowVillage] = useState(false);

    // Build dropdown items from data
    const districtItems: DropdownItem[] = Object.entries(GUJARAT_LOCATIONS).map(
        ([key, val]) => ({ value: key, label: val.label })
    );

    const talukaItems: DropdownItem[] = district
        ? Object.entries(GUJARAT_LOCATIONS[district.value].talukas).map(
            ([key, val]) => ({ value: key, label: val.label })
        )
        : [];

    const villageItems: DropdownItem[] =
        district && taluka
            ? GUJARAT_LOCATIONS[district.value].talukas[taluka.value].villages
            : [];

    const handleDistrictSelect = (item: DropdownItem) => {
        setDistrict(item);
        setTaluka(null);  // reset downstream
        setVillage(null);
    };

    const handleTalukaSelect = (item: DropdownItem) => {
        setTaluka(item);
        setVillage(null); // reset downstream
    };

    const handleVillageSelect = (item: DropdownItem) => {
        setVillage(item);
        // Fire the callback with ALL Gujarati labels stored
        onLocationChange({
            districtKey: district!.value,
            districtLabel: district!.label,   // e.g. "જામનગર"
            talukaKey: taluka!.value,
            talukaLabel: taluka!.label,        // e.g. "કાળાવડ"
            villageKey: item.value,
            villageLabel: item.label,          // e.g. "ખીજડીયા"
        });
    };

    return (
        <View>
            {/* District Dropdown */}
            <DropdownButton
                label="જિલ્લો (District)"
                value={district?.label ?? ""}
                placeholder="જિલ્લો પસંદ કરો"
                onPress={() => setShowDistrict(true)}
            />

            {/* Taluka Dropdown - enabled only after district selected */}
            <DropdownButton
                label="તાલુકો (Taluka)"
                value={taluka?.label ?? ""}
                placeholder={district ? "તાલુકો પસંદ કરો" : "પહેલા જિલ્લો પસંદ કરો"}
                disabled={!district}
                onPress={() => setShowTaluka(true)}
            />

            {/* Village Dropdown - enabled only after taluka selected */}
            <DropdownButton
                label="ગામ (Village)"
                value={village?.label ?? ""}
                placeholder={taluka ? "ગામ પસંદ કરો" : "પહેલા તાલુકો પસંદ કરો"}
                disabled={!taluka}
                onPress={() => setShowVillage(true)}
            />

            {/* Modals */}
            <DropdownModal
                visible={showDistrict}
                title="જિલ્લો પસંદ કરો"
                items={districtItems}
                onSelect={handleDistrictSelect}
                onClose={() => setShowDistrict(false)}
            />
            <DropdownModal
                visible={showTaluka}
                title="તાલુકો પસંદ કરો"
                items={talukaItems}
                onSelect={handleTalukaSelect}
                onClose={() => setShowTaluka(false)}
            />
            <DropdownModal
                visible={showVillage}
                title="ગામ પસંદ કરો"
                items={villageItems}
                onSelect={handleVillageSelect}
                onClose={() => setShowVillage(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fieldGroup: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: "700", color: "#424242", marginBottom: 8 },
    dropdownBtn: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 2,
        borderRadius: 14,
        borderColor: "#E0E0E0",
        backgroundColor: "#FAFAFA",
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    dropdownBtnFilled: { borderColor: "#81C784" },
    dropdownBtnDisabled: { opacity: 0.45, backgroundColor: "#F5F5F5" },
    dropdownBtnText: { fontSize: 15, color: "#212121", fontWeight: "600" },
    dropdownBtnPlaceholder: { color: "#BDBDBD", fontWeight: "400" },
    dropdownArrow: { fontSize: 18, color: "#757575" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
        backgroundColor: "white",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 36,
        maxHeight: "60%",
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: "#E0E0E0",
        alignSelf: "center",
        marginTop: 12, marginBottom: 8,
    },
    sheetTitle: {
        fontSize: 17, fontWeight: "800", color: "#212121",
        marginBottom: 16, textAlign: "center",
    },
    sheetItem: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F5",
    },
    sheetItemText: { fontSize: 16, color: "#212121", fontWeight: "600" },
    sheetItemSubText: { fontSize: 12, color: "#9E9E9E", marginTop: 2 },
});
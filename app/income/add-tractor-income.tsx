/**
 * Add Tractor Income — shown only when profile.tractorAvailable is true.
 * Uses Income API with category "Rental Income"; rental_income JSON supports
 * farmerPhone and paymentStatus (stored in existing incomes table).
 */

import { HEADER_PADDING_TOP } from "@/constants/theme";
import { AppBackButton } from "@/components/AppBackButton";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  createIncome,
  getIncomeById,
  updateIncome,
  type RentalAssetType,
} from "@/utils/api";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Contacts from "expo-contacts";
import Toast from "react-native-toast-message";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  bg: "#FFF7ED",
  surface: "#FFFFFF",
  orange700: "#C2410C",
  orange500: "#EA580C",
  orange200: "#FED7AA",
  orange100: "#FFEDD5",
  orange50: "#FFF7ED",
  textPrimary: "#111111",
  textSecondary: "#2B2B2B",
  textMuted: "#6B7280",
  border: "#FED7AA",
};

const TRACTOR_ASSET_OPTIONS: { value: RentalAssetType; label: string }[] = [
  { value: "Tractor", label: "ટ્રેક્ટર" },
  { value: "Rotavator", label: "રોટાવેટર" },
  { value: "RAP", label: "રૅપ" },
  { value: "Samar", label: "સમાર" },
  { value: "Sah Nakhya", label: "સહ નાખ્યા" },
  { value: "Vavetar", label: "વાવેતર" },
  { value: "Kyara Bandhya", label: "ક્યારા બાંધ્યા" },
  { value: "Thresher", label: "થ્રેશર" },
  { value: "Bagu", label: "બાગુ" },
  { value: "Fukani", label: "ફૂકણી" },
  { value: "Kheti Kari", label: "ખેતી કરી" },
  { value: "Other Equipment", label: "અન્ય ઉપકરણ" },
];

const PAYMENT_STATUS_OPTIONS: { value: "Pending" | "Completed"; label: string }[] = [
  { value: "Pending", label: "બાકી" },
  { value: "Completed", label: "આપી દીધા" },
];

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return digits;
  return digits.slice(-10);
}

export default function AddTractorIncomeScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!editId;
  const { refreshTransactions } = useRefresh();
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assetType, setAssetType] = useState<RentalAssetType | "">("");
  const [farmerName, setFarmerName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [hoursOrDays, setHoursOrDays] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Pending" | "Completed">("Pending");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  const total =
    parseFloat(hoursOrDays) > 0 && parseFloat(ratePerUnit) >= 0
      ? parseFloat(hoursOrDays) * parseFloat(ratePerUnit)
      : null;

  useEffect(() => {
    if (!isEdit || !editId) return;
    (async () => {
      try {
        const inc = await getIncomeById(editId);
        if (inc.category !== "Rental Income" || !inc.rentalIncome) return;
        const r = inc.rentalIncome;
        setDate(inc.date ? new Date(inc.date) : new Date());
        setAssetType((r.assetType as RentalAssetType) ?? "");
        setFarmerName(r.rentedToName ?? "");
        setFarmerPhone(r.farmerPhone ?? "");
        setHoursOrDays(
          r.hoursOrDays != null ? String(r.hoursOrDays) : ""
        );
        setRatePerUnit(
          r.ratePerUnit != null ? String(r.ratePerUnit) : ""
        );
        setPaymentStatus(
          r.paymentStatus === "Completed" ? "Completed" : "Pending"
        );
      } catch (e) {
        Alert.alert("ભૂલ", (e as Error).message ?? "ડેટા લોડ ન થઈ શક્યો");
        router.back();
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [isEdit, editId]);

  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "પરવાનગી જરૂરી",
          "કોન્ટેક્ટ પસંદ કરવા માટે પરવાનગી આપો.",
          [{ text: "ઠીક" }]
        );
        return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const name = contact.name ?? "";
      const phone = contact.phoneNumbers?.[0]?.number ?? "";
      setFarmerName(name);
      setFarmerPhone(normalizePhone(phone));
    } catch (e) {
      Alert.alert("ભૂલ", (e as Error).message ?? "કોન્ટેક્ટ પસંદ થઈ શક્યો નહીં.");
    }
  };

  const validate = (): string | null => {
    if (!assetType) return "ઉપકરણનો પ્રકાર પસંદ કરો.";
    if (!farmerName.trim()) return "ખેડૂતનું નામ લખો.";
    if (!hoursOrDays || parseFloat(hoursOrDays) <= 0) return "કલાક/દિવસ દાખલ કરો.";
    if (!ratePerUnit || parseFloat(ratePerUnit) < 0) return "દર દાખલ કરો.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("ચકાસણી ભૂલ", err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: "Rental Income" as const,
        date: date.toISOString(),
        rentalIncome: {
          assetType: assetType as RentalAssetType,
          rentedToName: farmerName.trim(),
          ...(farmerPhone ? { farmerPhone: farmerPhone.trim() } : {}),
          paymentStatus,
          hoursOrDays: parseFloat(hoursOrDays),
          ratePerUnit: parseFloat(ratePerUnit),
        },
      };
      if (isEdit && editId) {
        await updateIncome(editId, payload);
        Toast.show({ type: "success", text1: "સફળ!", text2: "આવક સુધારાઈ!" });
      } else {
        await createIncome(payload);
        Toast.show({ type: "success", text1: "સફળ!", text2: "ટ્રેક્ટર ભાડું સાચવાયું!" });
      }
      refreshTransactions();
      router.back();
    } catch (e) {
      Alert.alert("ભૂલ", (e as Error).message ?? "કંઈક ખોટું થયું.");
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (_e: DateTimePickerEvent, d?: Date) => {
    setShowDatePicker(false);
    if (d) setDate(d);
  };

  const paddingTop = HEADER_PADDING_TOP;
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  const formSectionYRef = useRef(0);
  const scrollToForm = useCallback(() => {
    // When keyboard is open, use larger offset so lower fields stay visible above keyboard
    const offset = keyboardHeight > 0 ? 420 : 100;
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formSectionYRef.current - offset),
        animated: true,
      });
    }, 280);
  }, [keyboardHeight]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 80 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#FFF1E6", "#FFF7ED", "#FFF7ED"]}
        style={[styles.header, { paddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <AppBackButton onPress={() => router.back()} iconColor={C.orange700} backgroundColor={C.surface} borderColor={C.orange200} />
          <View style={styles.headerCenter}>
            <View style={styles.headerTractorWrap}>
              <MaterialCommunityIcons name="tractor-variant" size={40} color={C.orange700} />
            </View>
            <Text style={styles.headerTitle}>
              {isEdit ? "આવક સુધારો" : "ટ્રેક્ટર ભાડું / આવક ઉમેરો"}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerDateCard} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={C.orange700} />
            <Text style={styles.headerDateText}>
              {date.toLocaleDateString("gu-IN", { day: "2-digit", month: "short" })}
            </Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={handleDateChange}
          />
        )}
      </LinearGradient>

      {loadingEdit ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.orange700} />
          <Text style={{ marginTop: 12, fontSize: 15, color: C.textMuted }}>
            લોડ થઈ રહ્યું છે...
          </Text>
        </View>
      ) : (
        <>
      <View style={styles.card}>
        <Text style={styles.label}>પ્રકાર</Text>
        <View style={styles.chipRow}>
          {TRACTOR_ASSET_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, assetType === opt.value && styles.chipActive]}
              onPress={() => setAssetType(opt.value)}
            >
              <Text style={[styles.chipText, assetType === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.typeNote}>ઉદાહરણ: રોટાવેટર, રૅપ, સમાર, સહ નાખ્યા, વાવેતર, ક્યારા બાંધ્યા, થ્રેશર, બાગુ, ફૂકણી, ખેતી કરી, અન્ય ઉપકરણ</Text>
      </View>

      <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
        <Text style={styles.label}>ખેડૂત / ગ્રાહકનું નામ</Text>
        <TextInput
          style={styles.input}
          value={farmerName}
          onChangeText={setFarmerName}
          placeholder="નામ લખો અથવા નીચે પસંદ કરો"
          placeholderTextColor={C.textMuted}
          onFocus={scrollToForm}
        />
        <TouchableOpacity style={styles.contactBtn} onPress={pickContact}>
          <Ionicons name="people-outline" size={24} color={C.orange700} />
          <Text style={styles.contactBtnText}>મોબાઇલ કોન્ટેક્ટમાંથી પસંદ કરો</Text>
        </TouchableOpacity>
        {farmerPhone ? (
          <Text style={styles.phoneText}>📱 {farmerPhone}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>કલાક / દિવસ</Text>
        <TextInput
          style={styles.input}
          value={hoursOrDays}
          onChangeText={setHoursOrDays}
          placeholder="0"
          placeholderTextColor={C.textMuted}
          keyboardType="decimal-pad"
          onFocus={scrollToForm}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>ભાડું (પ્રતિ એકમ)</Text>
        <TextInput
          style={styles.input}
          value={ratePerUnit}
          onChangeText={setRatePerUnit}
          placeholder="0"
          placeholderTextColor={C.textMuted}
          keyboardType="decimal-pad"
          onFocus={scrollToForm}
        />
      </View>

      {total !== null && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>કુલ રકમ</Text>
          <Text style={styles.totalValue}>{Math.round(total).toLocaleString("en-IN")}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>પૈસા ચૂકવાણી</Text>
        <View style={styles.statusRow}>
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.statusBtn, paymentStatus === opt.value && styles.statusBtnActive]}
              onPress={() => setPaymentStatus(opt.value)}
            >
              <Text style={[styles.statusText, paymentStatus === opt.value && styles.statusTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <View style={[styles.saveBtnInner, saving && styles.saveBtnInnerDisabled]}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="tractor-variant" size={26} color="#fff" />
              <Text style={styles.saveBtnText}>{isEdit ? "અપડેટ કરો" : "સાચવો"}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
        </>
      )}

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  headerTractorWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.orange100,
    borderWidth: 2,
    borderColor: C.orange700,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.orange50,
    borderWidth: 1,
    borderColor: C.orange200,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: C.textPrimary, textAlign: "center" },
  headerDateCard: {
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.orange200,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  headerDateText: { fontSize: 13, fontWeight: "800", color: C.textPrimary },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: { fontSize: 20, fontWeight: "800", color: C.textPrimary, marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.orange50,
  },
  chipActive: { backgroundColor: "#FED7AA", borderColor: C.orange700 },
  chipText: { fontSize: 16, fontWeight: "700", color: C.textSecondary },
  chipTextActive: { color: C.textPrimary, fontWeight: "800" },
  typeNote: { fontSize: 13, lineHeight: 18, color: C.textMuted, marginTop: 10, fontWeight: "600" },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 20,
    color: C.textPrimary,
    backgroundColor: C.orange50,
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.orange50,
    borderWidth: 1,
    borderColor: C.orange200,
  },
  contactBtnText: { fontSize: 17, fontWeight: "800", color: C.orange700 },
  phoneText: { fontSize: 16, color: C.textSecondary, marginTop: 8, fontWeight: "700" },
  totalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.orange50,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: C.orange200,
  },
  totalLabel: { fontSize: 19, fontWeight: "800", color: C.textPrimary },
  totalValue: { fontSize: 24, fontWeight: "900", color: C.orange700 },
  statusRow: { flexDirection: "row", gap: 12 },
  statusBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.orange50,
    alignItems: "center",
  },
  statusBtnActive: { backgroundColor: C.orange700, borderColor: C.orange700 },
  statusText: { fontSize: 17, fontWeight: "800", color: C.textSecondary },
  statusTextActive: { color: "#fff" },
  saveBtn: { borderRadius: 14, marginTop: 8 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: C.orange700,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#9A3412",
  },
  saveBtnInnerDisabled: {
    backgroundColor: "#6B7280",
    borderColor: "#9CA3AF",
  },
  saveBtnText: { fontSize: 21, fontWeight: "900", color: "#fff" },
});

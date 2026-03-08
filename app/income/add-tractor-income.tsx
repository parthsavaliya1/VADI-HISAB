/**
 * Add Tractor Income — shown only when profile.tractorAvailable is true.
 * Uses Income API with category "Rental Income"; rental_income JSON supports
 * farmerPhone and paymentStatus (stored in existing incomes table).
 */

import { HEADER_PADDING_TOP } from "@/constants/theme";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useRefresh } from "@/contexts/RefreshContext";
import { createIncome, type RentalAssetType } from "@/utils/api";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Contacts from "expo-contacts";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
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
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  textPrimary: "#1A2E1C",
  textSecondary: "#3D5C40",
  textMuted: "#7A9B7E",
  border: "#D8E8D8",
};

const TRACTOR_ASSET_OPTIONS: { value: RentalAssetType; label: string }[] = [
  { value: "Tractor", label: "ટ્રેક્ટર" },
  { value: "Rotavator", label: "રોટાવેટર" },
  { value: "RAP", label: "રેપ (RAP)" },
  { value: "Bagi", label: "બાગી" },
  { value: "Savda", label: "સવડા" },
  { value: "Thresher", label: "થ્રેશર" },
  { value: "Land", label: "જમીન" },
  { value: "Water Pump", label: "પાણીની મોટર" },
  { value: "Other Equipment", label: "અન્ય ઉપકરણ" },
];

const PAYMENT_STATUS_OPTIONS: { value: "Pending" | "Completed"; label: string }[] = [
  { value: "Pending", label: "બાકી (પેન્ડિંગ)" },
  { value: "Completed", label: "ચૂકવણી થઈ (કમ્પ્લીટ)" },
];

export default function AddTractorIncomeScreen() {
  const { refreshTransactions } = useRefresh();
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assetType, setAssetType] = useState<RentalAssetType | "">("");
  const [farmerName, setFarmerName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [hoursOrDays, setHoursOrDays] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Pending" | "Completed">("Pending");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const total =
    parseFloat(hoursOrDays) > 0 && parseFloat(ratePerUnit) >= 0
      ? parseFloat(hoursOrDays) * parseFloat(ratePerUnit)
      : null;

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
      setFarmerPhone(phone.replace(/\s/g, ""));
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
      await createIncome({
        category: "Rental Income",
        date: date.toISOString(),
        notes: notes.trim() || undefined,
        rentalIncome: {
          assetType: assetType as RentalAssetType,
          rentedToName: farmerName.trim(),
          ...(farmerPhone ? { farmerPhone: farmerPhone.trim() } : {}),
          paymentStatus,
          hoursOrDays: parseFloat(hoursOrDays),
          ratePerUnit: parseFloat(ratePerUnit),
        },
      });
      refreshTransactions();
      Toast.show({ type: "success", text1: "સફળ!", text2: "ટ્રેક્ટર આવક સાચવાઈ!" });
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
        colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
        style={[styles.header, { paddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.green700} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerTractorWrap}>
              <MaterialCommunityIcons name="tractor-variant" size={36} color={C.green700} />
            </View>
            <Text style={styles.headerTitle}>ટ્રેક્ટર આવક ઉમેરો</Text>
            <Text style={styles.headerSub}>ભાડું / સેવા આવક</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.label}>ઉપકરણનો પ્રકાર *</Text>
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
      </View>

      <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
        <Text style={styles.label}>ખેડૂત / ગ્રાહકનું નામ *</Text>
        <TextInput
          style={styles.input}
          value={farmerName}
          onChangeText={setFarmerName}
          placeholder="નામ લખો અથવા નીચે પસંદ કરો"
          placeholderTextColor={C.textMuted}
          onFocus={scrollToForm}
        />
        <TouchableOpacity style={styles.contactBtn} onPress={pickContact}>
          <Ionicons name="people-outline" size={22} color={C.green700} />
          <Text style={styles.contactBtnText}>મોબાઇલ કોન્ટેક્ટમાંથી પસંદ કરો</Text>
        </TouchableOpacity>
        {farmerPhone ? (
          <Text style={styles.phoneText}>📱 {farmerPhone}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>કલાક / દિવસ *</Text>
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
        <Text style={styles.label}>દર (પ્રતિ એકમ) *</Text>
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
          <Text style={styles.totalValue}>₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>ચૂકવણી સ્થિતિ</Text>
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

      <View style={styles.card}>
        <Text style={styles.label}>📅 તારીખ</Text>
        <View style={styles.dateRow}>
          <Text style={styles.dateValue}>
            {date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </Text>
          <TouchableOpacity style={styles.calendarBtn} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={24} color={C.green700} />
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
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>📝 નોંધ</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="વૈકલ્પિક"
          placeholderTextColor={C.textMuted}
          multiline
          onFocus={scrollToForm}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <View style={[styles.saveBtnInner, saving && styles.saveBtnInnerDisabled]}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="tractor-variant" size={24} color="#fff" />
              <Text style={styles.saveBtnText}>સાચવો</Text>
            </>
          )}
        </View>
      </TouchableOpacity>

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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.green100,
    borderWidth: 2,
    borderColor: C.green700,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
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
  headerTitle: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 16, color: C.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: { fontSize: 18, fontWeight: "700", color: C.textPrimary, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.green50,
  },
  chipActive: { backgroundColor: C.green100, borderColor: C.green700 },
  chipText: { fontSize: 15, fontWeight: "600", color: C.textSecondary },
  chipTextActive: { color: C.green700, fontWeight: "700" },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: C.textPrimary,
    backgroundColor: C.green50,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },
  contactBtnText: { fontSize: 16, fontWeight: "700", color: C.green700 },
  phoneText: { fontSize: 15, color: C.textSecondary, marginTop: 8 },
  totalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.green50,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  totalLabel: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  totalValue: { fontSize: 22, fontWeight: "900", color: C.green700 },
  statusRow: { flexDirection: "row", gap: 12 },
  statusBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.green50,
    alignItems: "center",
  },
  statusBtnActive: { backgroundColor: C.green700, borderColor: C.green700 },
  statusText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  statusTextActive: { color: "#fff" },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateValue: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  calendarBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
  },
  saveBtn: { borderRadius: 14, marginTop: 8 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: "#1B5E20",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#2E7D32",
  },
  saveBtnInnerDisabled: {
    backgroundColor: "#6B7280",
    borderColor: "#9CA3AF",
  },
  saveBtnText: { fontSize: 19, fontWeight: "800", color: "#fff" },
});

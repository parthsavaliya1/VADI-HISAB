// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ભાગ્યા નો ઉપાડ — simple: type (કરિયાણું, ઉધાર, medical, other), amount, note
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useRefresh } from "@/contexts/RefreshContext";
import { createExpense, getExpenseById, updateExpense, type AdvanceReason } from "@/utils/api";
import { ScreenHeader } from "@/components/ScreenHeader";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dimensions } from "react-native";

const C = {
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
};

// Type options for ભાગ્યા નો ઉપાડ — maps to AdvanceReason
const BHAGYA_UPAD_TYPES: { value: AdvanceReason; label: string }[] = [
  { value: "Grocery", label: "કરિયાણું" },
  { value: "Loan", label: "ઉધાર" },
  { value: "Medical", label: "દવા/મેડિકલ" },
  { value: "Mobile Recharge", label: "મોબાઇલ રિચાર્જ" },
  { value: "Festival", label: "તહેવાર" },
  { value: "BhagmaMajuri", label: "ભાગમા આપેલ પાક ની મજૂરી માટે" },
  { value: "Other", label: "અન્ય" },
];

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SelectPicker({
  options,
  selected,
  onSelect,
  placeholder,
}: {
  options: { value: AdvanceReason; label: string }[];
  selected: AdvanceReason | "";
  onSelect: (v: AdvanceReason) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === selected)?.label;
  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        style={[styles.selectBtn, open && styles.selectBtnOpen]}
        onPress={() => setOpen((p) => !p)}
        activeOpacity={0.8}
      >
        <Text style={[styles.selectText, !selectedLabel && { color: "#5B6570" }]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={C.textSecondary}
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropList}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.dropItem, selected === o.value && styles.dropItemActive]}
              onPress={() => {
                onSelect(o.value);
                setOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropItemText,
                  selected === o.value && styles.dropItemTextActive,
                ]}
              >
                {o.label}
              </Text>
              {selected === o.value && (
                <Ionicons name="checkmark" size={20} color={C.green700} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AddBhagyaUpad() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = !!editId;
  const { refreshTransactions } = useRefresh();
  const keyboardHeight = useKeyboardHeight();
  const keyboardHeightRef = useRef(keyboardHeight);
  const scrollRef = useRef<ScrollView | null>(null);
  const amountRowRef = useRef<View | null>(null);

  // Keep ref in sync so we can safely read inside timeouts
  React.useEffect(() => {
    keyboardHeightRef.current = keyboardHeight;
  }, [keyboardHeight]);

  const scrollToAmount = useCallback(() => {
    if (!amountRowRef.current || !scrollRef.current) return;
    setTimeout(() => {
      amountRowRef.current?.measureLayout(
        // @ts-ignore measure relative to ScrollView content
        scrollRef.current,
        (_left: number, top: number, _width: number, _height: number) => {
          const kbH = keyboardHeightRef.current || 300;
          const windowH = Dimensions.get("window").height;
          const visibleH = windowH - kbH - 80; // 80 ≈ bottom button area
          const targetY = Math.max(0, top - visibleH * 0.4);
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
        },
        () => {
          scrollRef.current?.scrollToEnd({ animated: true });
        },
      );
    }, 280);
  }, []);
  const [type, setType] = useState<AdvanceReason | "">("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const showNoteField = type === "BhagmaMajuri" || type === "Other";

  // Load existing expense when editing
  useEffect(() => {
    if (!isEdit || !editId) return;
    (async () => {
      try {
        const doc = await getExpenseById(editId);
        const reason = doc.labourContract?.advanceReason as AdvanceReason | undefined;
        if (reason) setType(reason);
        const amt =
          doc.labourContract?.amountGiven ??
          (doc as any).amount ??
          0;
        setAmount(amt ? String(amt) : "");
        setNotes(doc.notes ?? "");
        if (doc.date) setDate(new Date(doc.date));
      } catch (e) {
        Alert.alert("ભૂલ", (e as Error).message ?? "ડેટા લોડ ન થઈ શક્યો");
        router.back();
      }
    })();
  }, [isEdit, editId]);

  const handleSave = async () => {
    if (!type) {
      Alert.alert("⚠️ ભૂલ", "પ્રકાર પસંદ કરો (કરિયાણું, ઉધાર, મેડિકલ, અન્ય વગેરે).");
      return;
    }
    const num = Number(amount);
    if (!amount.trim() || !Number.isFinite(num) || num <= 0) {
      Alert.alert("⚠️ ભૂલ", "રકમ દાખલ કરો.");
      return;
    }
    const payload = {
      cropId: null,
      category: "Labour" as const,
      expenseSource: "bhagyaUpad" as const,
      date: (date ?? new Date()).toISOString(),
      notes: notes.trim() || undefined,
      labourContract: {
        advanceReason: type,
        amountGiven: num,
        sourceTag: "bhagyaUpad" as const,
      },
    };
    try {
      setSaving(true);
      if (isEdit && editId) {
        await updateExpense(editId, payload);
      } else {
        await createExpense(payload);
      }
      refreshTransactions();
      Toast.show({
        type: "success",
        text1: "સફળ!",
        text2: isEdit ? "ભાગ્યા નો ઉપાડ અપડેટ થયો." : "ભાગ્યા નો ઉપાડ સાચવ્યો.",
      });
      router.back();
    } catch (e: any) {
      Alert.alert("ભૂલ", e?.message ?? "સાચવતી વખતે ભૂલ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={[styles.headerWrap, { backgroundColor: C.bg }]}>
        <ScreenHeader title="ભાગ્યા નો ઉપાડ" style={{ marginBottom: 0, backgroundColor: C.bg }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom:
              (keyboardHeight > 0 ? keyboardHeight + 90 : 90) + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <SectionLabel text="પ્રકાર પસંદ કરો *" />
          <SelectPicker
            options={BHAGYA_UPAD_TYPES}
            selected={type}
            onSelect={setType}
            placeholder="કરિયાણું, ઉધાર, મેડિકલ, અન્ય..."
          />
          {showNoteField && (
            <>
              <SectionLabel text="નોંધ (સ્પષ્ટતા માટે)" />
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="જરૂરી હોય તો વિગત લખો..."
                placeholderTextColor="#5B6570"
                multiline
                numberOfLines={3}
              />
            </>
          )}
          <SectionLabel text="રકમ *" />
          <View style={styles.numRow} ref={amountRowRef}>
            <Text style={styles.numPrefix} />
            <TextInput
              style={styles.numInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#5B6570"
              keyboardType="numeric"
              onFocus={scrollToAmount}
            />
          </View>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={
              saving ||
              !type ||
              !amount.trim() ||
              Number(amount) <= 0
            }
          >
            <LinearGradient
              colors={
                saving || !type || !amount.trim() || Number(amount) <= 0
                  ? ["#9CA3AF", "#6B7280"]
                  : [C.green700, C.green500]
              }
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {saving ? (
                <Text style={styles.btnText}>સાચવી રહ્યા છીએ...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.btnText}>સાચવો</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerWrap: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  scroll: {
    padding: 20,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 8,
    marginTop: 6,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.surfaceGreen,
  },
  selectBtnOpen: { borderColor: C.green700, backgroundColor: C.surface },
  selectText: { fontSize: 20, color: C.textPrimary, fontWeight: "600" },
  dropList: {
    borderWidth: 1.5,
    borderColor: C.green100,
    borderRadius: 14,
    backgroundColor: C.surface,
    overflow: "hidden",
    marginTop: 6,
    elevation: 3,
  },
  dropItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  dropItemActive: { backgroundColor: C.green50 },
  dropItemText: { fontSize: 19, color: C.textPrimary, fontWeight: "600" },
  dropItemTextActive: { fontWeight: "800", color: C.green700 },
  numRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: C.surfaceGreen,
    marginBottom: 16,
  },
  numPrefix: {
    fontSize: 20,
    color: C.textSecondary,
    marginRight: 8,
    fontWeight: "700",
  },
  numInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: C.textPrimary,
    paddingVertical: 12,
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: C.textPrimary,
    backgroundColor: C.surfaceGreen,
    minHeight: 80,
    marginBottom: 20,
  },
  saveBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  btnText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
});

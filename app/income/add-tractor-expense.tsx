/**
 * Add Tractor Expense — from tractor avak screen (ખર્ચ button).
 * Categories: Diesel, Orni, Rotavator, Thresher, Fukani, Maintenance, Any other (with note).
 * Saves as expense category "Other" with expenseSource "tractorExpense".
 * After save user stays on this screen; historical expenses shown below સાચવો button.
 */

import { HEADER_PADDING_TOP } from "@/constants/theme";
import { AppBackButton } from "@/components/AppBackButton";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  type Expense,
} from "@/utils/api";
import { getCurrentFinancialYear } from "@/utils/api";
import { useRefresh } from "@/contexts/RefreshContext";
import Toast from "react-native-toast-message";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("gu-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const C = {
  bg: "#FFF7ED",
  surface: "#FFFFFF",
  orange700: "#C2410C",
  orange500: "#EA580C",
  orange200: "#FED7AA",
  orange100: "#FFEDD5",
  textPrimary: "#111111",
  textSecondary: "#2B2B2B",
  textMuted: "#6B7280",
  border: "#FED7AA",
};

export type TractorExpenseCategory =
  | "Diesel"
  | "Orni"
  | "Rotavator"
  | "Thresher"
  | "Fukani"
  | "Maintenance"
  | "Other";

const TRACTOR_EXPENSE_CATEGORIES: { value: TractorExpenseCategory; label: string }[] = [
  { value: "Diesel", label: "ડીઝલ" },
  { value: "Orni", label: "ઓરણી" },
  { value: "Rotavator", label: "રોટાવેટર" },
  { value: "Thresher", label: "થ્રેશર" },
  { value: "Fukani", label: "ફૂકણી" },
  { value: "Maintenance", label: "મેન્ટેનન્સ" },
  { value: "Other", label: "અન્ય (નોંધ લખો)" },
];

const LABEL_TO_CATEGORY: Record<string, TractorExpenseCategory> = Object.fromEntries(
  TRACTOR_EXPENSE_CATEGORIES.map((c) => [c.label, c.value])
);

export default function AddTractorExpenseScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!editId;
  const { refreshTransactions } = useRefresh();
  const [category, setCategory] = useState<TractorExpenseCategory | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  const isOther = category === "Other";

  useEffect(() => {
    if (!isEdit || !editId) return;
    (async () => {
      try {
        const ex = await getExpenseById(editId);
        if (ex.category !== "Other" || ex.expenseSource !== "tractorExpense") return;
        const desc = ex.other?.description ?? ex.notes ?? "";
        const cat = LABEL_TO_CATEGORY[desc];
        if (cat) {
          setCategory(cat);
          setNote("");
        } else {
          setCategory("Other");
          setNote(desc || ex.notes || "");
        }
        const amt = ex.amount ?? ex.other?.totalAmount ?? 0;
        setAmount(amt > 0 ? String(amt) : "");
      } catch {
        // ignore
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [isEdit, editId]);

  const fetchTractorExpenses = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await getExpenses(
        undefined,
        "Other",
        undefined,
        1,
        100,
        getCurrentFinancialYear(),
        "tractorExpense"
      );
      setExpenses(res.data ?? []);
    } catch {
      setExpenses([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchTractorExpenses();
  }, [fetchTractorExpenses]);

  const validate = (): string | null => {
    if (!category) return "ખર્ચનો પ્રકાર પસંદ કરો.";
    if (isOther && !note.trim()) return "અન્ય ખર્ચ માટે નોંધ લખો.";
    const num = parseFloat(amount);
    if (!amount.trim() || isNaN(num) || num <= 0) return "રકમ દાખલ કરો.";
    return null;
  };

  const buildPayload = useCallback(() => {
    const categoryLabel =
      category === "Other"
        ? (note.trim() || "અન્ય ખર્ચ")
        : TRACTOR_EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
    return {
      category: "Other" as const,
      expenseSource: "tractorExpense" as const,
      cropId: null,
      date: new Date().toISOString().slice(0, 10),
      notes: isOther ? note.trim() : undefined,
      other: {
        totalAmount: parseFloat(amount),
        description: categoryLabel,
      },
    };
  }, [category, note, amount, isOther]);

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("ચકાસણી ભૂલ", err);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit && editId) {
        await updateExpense(editId, payload);
        Toast.show({ type: "success", text1: "સફળ!", text2: "ટ્રેક્ટર ખર્ચ સુધારાયું!" });
        refreshTransactions();
        router.back();
      } else {
        await createExpense(payload);
        Toast.show({ type: "success", text1: "સફળ!", text2: "ટ્રેક્ટર ખર્ચ સાચવાયું!" });
        refreshTransactions();
        setAmount("");
        setNote("");
        setCategory("");
        fetchTractorExpenses();
      }
    } catch (e) {
      Alert.alert("ભૂલ", (e as Error).message ?? "કંઈક ખોટું થયું.");
    } finally {
      setSaving(false);
    }
  };

  const handleExpensePress = (ex: Expense) => {
    Alert.alert("ટ્રેક્ટર ખર્ચ", "શું કરવું?", [
      { text: "રદ કરો", style: "cancel" },
      { text: "ફેરફાર કરો", onPress: () => router.push(`/income/add-tractor-expense?id=${ex._id}` as any) },
      {
        text: "કાઢો",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "ખર્ચ કાઢો",
            "શું તમે આ ખર્ચ કાઢવા માંગો છો?",
            [
              { text: "રદ કરો", style: "cancel" },
              {
                text: "કાઢો",
                style: "destructive",
                onPress: async () => {
                  try {
                    await deleteExpense(ex._id);
                    Toast.show({ type: "success", text1: "કાઢ્યું", text2: "ખર્ચ કાઢી નાખ્યો." });
                    refreshTransactions();
                    fetchTractorExpenses();
                  } catch (e) {
                    Alert.alert("ભૂલ", (e as Error).message ?? "કાઢવામાં ભૂલ.");
                  }
                },
              },
            ]
          );
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: HEADER_PADDING_TOP }]}>
          <AppBackButton onPress={() => router.back()} />
          <Text style={styles.title}>{isEdit ? "ટ્રેક્ટર ખર્ચ સુધારો" : "ટ્રેક્ટર ખર્ચ"}</Text>
          <Text style={styles.subtitle}>
            {isEdit ? "ફેરફાર કરી સાચવો" : "ખર્ચનો પ્રકાર અને રકમ દાખલ કરો"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ખર્ચનો પ્રકાર</Text>
          <View style={styles.chipRow}>
            {TRACTOR_EXPENSE_CATEGORIES.map((opt) => {
              const active = category === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(opt.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isOther ? (
            <View style={styles.noteWrap}>
              <Text style={styles.noteLabel}>નોંધ (ડેટા એન્ટ્રી માટે)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="ખર્ચની નોંધ લખો..."
                placeholderTextColor={C.textMuted}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={2}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>રકમ (₹)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{isEdit ? "સુધારો" : "સાચવો"}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>સાચવેલ ખર્ચ (ઇતિહાસ)</Text>
          {loadingList ? (
            <ActivityIndicator size="small" color={C.orange700} style={styles.historyLoader} />
          ) : expenses.length === 0 ? (
            <Text style={styles.historyEmpty}>કોઈ ખર્ચ નથી. ઉપરથી ઉમેરો.</Text>
          ) : (
            expenses.map((ex) => {
              const desc = ex.other?.description ?? ex.notes ?? "ખર્ચ";
              const amt = ex.amount ?? ex.other?.totalAmount ?? 0;
              return (
                <TouchableOpacity
                  key={ex._id}
                  style={styles.historyCard}
                  onPress={() => handleExpensePress(ex)}
                  activeOpacity={0.85}
                >
                  <View style={styles.historyCardLeft}>
                    <Text style={styles.historyCardDesc} numberOfLines={1}>{desc}</Text>
                    <Text style={styles.historyCardDate}>{formatDate(ex.date)}</Text>
                  </View>
                  <Text style={styles.historyCardAmount}>₹ {formatINR(amt)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  historySection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 12,
  },
  historyLoader: { marginVertical: 16 },
  historyEmpty: {
    fontSize: 14,
    color: C.textMuted,
    fontStyle: "italic",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyCardLeft: { flex: 1 },
  historyCardDesc: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPrimary,
  },
  historyCardDate: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  historyCardAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: C.orange700,
  },
  header: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: C.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipActive: {
    borderColor: C.orange700,
    backgroundColor: C.orange100,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
  },
  chipTextActive: {
    color: C.orange700,
  },
  noteWrap: {
    marginTop: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 6,
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  amountInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "800",
    color: C.orange700,
  },
  saveBtn: {
    borderRadius: 16,
    backgroundColor: C.orange700,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.8,
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
});

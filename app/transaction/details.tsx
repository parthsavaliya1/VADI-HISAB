/**
 * Transaction details — view income or expense by id.
 * Route: /transaction/details?id=xxx&type=income|expense
 * Interactive: Edit → add-income/add-expense with id; Delete → confirm then delete and go back.
 */

import { useRefresh } from "@/contexts/RefreshContext";
import { AppBackButton } from "@/components/AppBackButton";
import {
  deleteExpense,
  deleteIncome,
  getExpenseById,
  getIncomeById,
  type Expense,
  type ExpenseCategory,
  type Income,
  type IncomeCategory,
} from "@/utils/api";
import { formatWholeNumber } from "@/utils/format";
import { ScreenHeader } from "@/components/ScreenHeader";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Same as dashboard page
const C = {
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  surfaceGreen: "#F1F8F1",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  expense: "#B71C1C",
  expensePale: "#FFEBEE",
  income: "#1B5E20",
  incomePale: "#E8F5E9",
  textPrimary: "#0A0E0B",
  textSecondary: "#1A2E1C",
  textMuted: "#2D4230",
  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatINR(n: number): string {
  return formatWholeNumber(n);
}

const EXPENSE_CAT_LABELS: Record<string, string> = {
  Seed: "બિયારણ",
  Fertilizer: "ખાતર",
  Pesticide: "જંતુનાશક",
  Labour: "મજૂરી",
  Machinery: "ટ્રેક્ટર/મશીન",
  Irrigation: "સિંચાઈ",
  Other: "અન્ય ખર્ચ",
};

const INCOME_CAT_LABELS: Record<IncomeCategory, string> = {
  "Crop Sale": "પાક વેચાણ",
  Subsidy: "સબસિડી",
  "Rental Income": "ભાડાની આવક",
  Other: "અન્ય",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

export default function TransactionDetailsScreen() {
  const { refreshTransactions } = useRefresh();
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const type = (Array.isArray(params.type) ? params.type[0] : params.type) as "income" | "expense" | undefined;

  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<Income | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !type) {
      setError("Invalid transaction");
      setLoading(false);
      return;
    }
    if (type === "income") {
      getIncomeById(id)
        .then(setIncome)
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    } else {
      getExpenseById(id)
        .then(setExpense)
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }
  }, [id, type]);

  const onEdit = () => {
    if (!id || !type) return;
    if (type === "income") {
      const cropId = income?.cropId != null
        ? (typeof income.cropId === "object" ? (income.cropId as any)._id : income.cropId)
        : "";
      const q = cropId ? `?id=${id}&cropId=${cropId}` : `?id=${id}&general=1`;
      router.push(`/income/add-income${q}` as any);
    } else {
      const cropId = expense?.cropId != null
        ? (typeof expense.cropId === "object" ? (expense.cropId as any)._id : expense.cropId)
        : "";
      const q = cropId ? `?id=${id}&cropId=${cropId}` : `?id=${id}&general=1`;
      router.push(`/expense/add-expense${q}` as any);
    }
  };

  const onDelete = () => {
    if (!id || !type) return;
    const title = type === "income" ? "આવક કાઢો" : "ખર્ચ કાઢો";
    const msg = type === "income"
      ? "શું તમે આ આવકની એન્ટ્રી કાઢવા માંગો છો?"
      : "શું તમે આ ખર્ચની એન્ટ્રી કાઢવા માંગો છો?";
    Alert.alert(title, msg, [
      { text: "રદ કરો", style: "cancel" },
      {
        text: "કાઢો",
        style: "destructive",
        onPress: async () => {
          try {
            if (type === "income") await deleteIncome(id);
            else await deleteExpense(id);
            refreshTransactions();
            Toast.show({
              type: "success",
              text1: "સફળ!",
              text2: type === "income" ? "આવક કાઢી નાખી." : "ખર્ચ કાઢી નાખ્યો.",
            });
            router.back();
          } catch (e) {
            Alert.alert("ભૂલ", (e as Error).message ?? "કાઢવામાં ભૂલ.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.green500} />
        <Text style={styles.loadingText}>વિગત લોડ થઈ રહ્યું છે...</Text>
      </View>
    );
  }

  if (error || (!income && !expense)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "ડેટા મળ્યો નથી"}</Text>
        <AppBackButton onPress={() => router.back()} iconColor={C.green700} backgroundColor={C.surface} borderColor={C.green100} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const isIncome = !!income;
  const amount = isIncome ? (income!.amount ?? 0) : (expense!.amount ?? 0);
  const accentColor = isIncome ? C.income : C.expense;
  const accentPale = isIncome ? C.incomePale : C.expensePale;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={[styles.headerWrap, { backgroundColor: C.bg }]}>
        <ScreenHeader title="વ્યવહાર વિગત" style={{ marginBottom: 0, backgroundColor: C.bg }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount card */}
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: accentColor }]}>
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { color: C.textMuted }]}>
              {isIncome ? "આવક" : "ખર્ચ"}
            </Text>
            <Text style={[styles.amountValue, { color: accentColor }]}>
              {isIncome ? "+" : "-"} {formatINR(amount)}
            </Text>
          </View>
          <DetailRow
            label="પ્રકાર"
            value={isIncome ? INCOME_CAT_LABELS[income!.category] : (EXPENSE_CAT_LABELS[expense!.category] ?? expense!.category)}
          />
          <DetailRow label="તારીખ" value={formatDate(isIncome ? income!.date : expense!.date)} />
          {!isIncome && (
            <DetailRow label="પાક" value={expense!.cropId ? "જોડાયેલ પાક" : "સામાન્ય ખર્ચ (કોઈ પાક નહીં)"} />
          )}
          {isIncome && (
            <DetailRow
              label="પાક"
              value={
                income!.cropId
                  ? typeof income!.cropId === "object"
                    ? (income!.cropId as any).cropName ?? "—"
                    : "જોડાયેલ પાક"
                  : "સામાન્ય આવક (કોઈ પાક નહીં)"
              }
            />
          )}
        </View>

        {/* Category-specific details */}
        {isIncome && income && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>આવક વિગત</Text>
            {income.category === "Crop Sale" && income.cropSale && (
              <>
                <DetailRow label="જથ્થો (કિલો)" value={String(income.cropSale.quantityKg ?? "—")} />
                <DetailRow label="ભાવ/કિલો" value={String(income.cropSale.pricePerKg ?? "—")} />
                <DetailRow label="ખરીદદાર" value={income.cropSale.buyerName ?? "—"} />
                <DetailRow label="બજાર" value={income.cropSale.marketName ?? "—"} />
              </>
            )}
            {income.category === "Subsidy" && income.subsidy && (
              <>
                <DetailRow label="યોજના" value={income.subsidy.schemeType ?? "—"} />
                <DetailRow label="રકમ" value={formatINR(income.subsidy.amount ?? 0)} />
                <DetailRow label="રેફરન્સ" value={income.subsidy.referenceNumber ?? "—"} />
              </>
            )}
            {income.category === "Rental Income" && income.rentalIncome && (
              <>
                <DetailRow label="ઉપકરણ" value={income.rentalIncome.assetType ?? "—"} />
                <DetailRow label="ભાડે આપ્યું" value={income.rentalIncome.rentedToName ?? "—"} />
                <DetailRow label="રકમ" value={formatINR(income.rentalIncome.totalAmount ?? 0)} />
                <DetailRow
                  label="ચૂકવણી"
                  value={income.rentalIncome.paymentStatus === "Pending" ? "બાકી" : "ચૂકવાયું"}
                />
              </>
            )}
            {income.category === "Other" && income.otherIncome && (
              <>
                <DetailRow label="સ્રોત" value={income.otherIncome.source ?? "—"} />
                <DetailRow label="રકમ" value={formatINR(income.otherIncome.amount ?? 0)} />
                <DetailRow label="વિગત" value={income.otherIncome.description ?? "—"} />
              </>
            )}
          </View>
        )}

        {!isIncome && expense && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ખર્ચ વિગત</Text>
            {expense.category === "Seed" && expense.seed && (
              <>
                <DetailRow label="પ્રકાર" value={expense.seed.seedType ?? "—"} />
                <DetailRow label="જથ્થો (કિલો)" value={String(expense.seed.quantityKg ?? "—")} />
                <DetailRow label="કુલ ખર્ચ" value={formatINR(expense.seed.totalCost ?? 0)} />
              </>
            )}
            {expense.category === "Fertilizer" && expense.fertilizer && (
              <>
                <DetailRow label="ઉત્પાદન" value={expense.fertilizer.productName ?? "—"} />
                <DetailRow label="બૅગ" value={String(expense.fertilizer.numberOfBags ?? "—")} />
                <DetailRow label="કુલ ખર્ચ" value={formatINR(expense.fertilizer.totalCost ?? 0)} />
              </>
            )}
            {expense.category === "Pesticide" && expense.pesticide && (
              <>
                <DetailRow label="શ્રેણી" value={expense.pesticide.category ?? "—"} />
                <DetailRow label="ડોઝ (મિ.લી.)" value={String(expense.pesticide.dosageML ?? "—")} />
                <DetailRow label="ખર્ચ" value={formatINR(expense.pesticide.cost ?? 0)} />
              </>
            )}
            {expense.category === "Labour" && (
              <>
                {expense.labourDaily && (
                  <>
                    <DetailRow label="કામ" value={expense.labourDaily.task ?? "—"} />
                    <DetailRow label="લોકો" value={String(expense.labourDaily.numberOfPeople ?? "—")} />
                    <DetailRow label="દિવસ" value={String(expense.labourDaily.days ?? "—")} />
                    <DetailRow label="દર" value={formatINR(expense.labourDaily.dailyRate ?? 0)} />
                  </>
                )}
                {expense.labourContract && (
                  <>
                    <DetailRow label="ઍડ્વાન્સ કારણ" value={expense.labourContract.advanceReason ?? "—"} />
                    <DetailRow label="રકમ" value={formatINR(expense.labourContract.amountGiven ?? 0)} />
                  </>
                )}
              </>
            )}
            {expense.category === "Machinery" && expense.machinery && (
              <>
                <DetailRow label="ઓજાર" value={expense.machinery.implement ?? "—"} />
                <DetailRow label="એકમ" value={String(expense.machinery.hoursOrAcres ?? "—")} />
                <DetailRow label="દર" value={formatINR(expense.machinery.rate ?? 0)} />
                <DetailRow label="કુલ" value={formatINR(expense.machinery.totalCost ?? 0)} />
              </>
            )}
            {expense.category === "Other" && (expense as any).other && (
              <DetailRow label="કુલ રકમ" value={formatINR((expense as any).other.totalAmount ?? 0)} />
            )}
          </View>
        )}

        {/* Notes */}
        {(isIncome ? income!.notes : expense!.notes) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>નોંધ</Text>
            <Text style={styles.notesText}>{isIncome ? income!.notes : expense!.notes}</Text>
          </View>
        )}

        {/* Actions — same light style as dashboard (detailIncomeBtnCrop / detailExpenseBtnCrop) */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={onEdit} activeOpacity={0.8}>
            <Ionicons name="pencil" size={20} color={C.income} />
            <Text style={[styles.actionBtnText, styles.editBtnText]}>ફેરફાર કરો</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={20} color={C.expense} />
            <Text style={[styles.actionBtnText, styles.deleteBtnText]}>કાઢો</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg, padding: 24 },
  loadingText: { marginTop: 12, fontSize: 16, color: C.textMuted },
  errorText: { fontSize: 17, color: C.expense, textAlign: "center" },
  backBtnStandalone: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: C.green50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.green100,
  },
  backBtnText: { fontSize: 16, fontWeight: "700", color: C.green700 },

  headerWrap: { borderBottomWidth: 1, borderBottomColor: C.borderLight },

  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, flexGrow: 1 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  amountLabel: { fontSize: 15, fontWeight: "700" },
  amountValue: { fontSize: 24, fontWeight: "900" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  detailLabel: { fontSize: 15, color: C.textMuted, fontWeight: "600" },
  detailValue: { fontSize: 15, color: C.textPrimary, fontWeight: "700" },
  notesText: { fontSize: 15, color: C.textSecondary, lineHeight: 22 },

  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  editBtn: { backgroundColor: "#E8F5E9", borderColor: "#81C784" },
  editBtnText: { color: C.income },
  deleteBtn: { backgroundColor: "#FFEBEE", borderColor: "#EF9A9A" },
  deleteBtnText: { color: C.expense },
  actionBtnText: { fontSize: 16, fontWeight: "800" },
});

import { useProfile } from "@/contexts/ProfileContext";
import {
  createExpense,
  type AdvanceReason,
  type ExpenseCategory,
  type FertilizerProduct,
  type LabourTask,
  type MachineryImplement,
  type PesticideCategory,
  type SeedType,
} from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
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

// ─── Color system — matches dashboard exactly ─────────────────────────────────
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

  income: "#2E7D32",
  incomePale: "#E8F5E9",
  expense: "#C62828",
  expensePale: "#FFEBEE",

  border: "#C8E6C9",
  borderLight: "#EAF4EA",
};

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES: {
  value: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
  pale: string;
}[] = [
  {
    value: "Seed",
    label: "બિયારણ",
    icon: "🌱",
    color: "#16A34A",
    pale: "#DCFCE7",
  },
  {
    value: "Fertilizer",
    label: "ખાતર",
    icon: "🧪",
    color: "#0891B2",
    pale: "#E0F2FE",
  },
  {
    value: "Pesticide",
    label: "જંતુ.",
    icon: "🧴",
    color: "#DC2626",
    pale: "#FEE2E2",
  },
  {
    value: "Labour",
    label: "મજૂરી",
    icon: "👷",
    color: "#D97706",
    pale: "#FEF3C7",
  },
  {
    value: "Machinery",
    label: "મશીન",
    icon: "🚜",
    color: "#7C3AED",
    pale: "#EDE9FE",
  },
];

const SEED_TYPES: { value: SeedType; label: string }[] = [
  { value: "Company Brand", label: "કંપની બ્રાન્ડ" },
  { value: "Local/Desi", label: "દેશી/લોકલ" },
  { value: "Hybrid", label: "હાઇબ્રિડ" },
];
const FERTILIZER_PRODUCTS: { value: FertilizerProduct; label: string }[] = [
  { value: "Urea", label: "યુરિયા" },
  { value: "DAP", label: "ડીએપી (DAP)" },
  { value: "NPK", label: "એનપીકે (NPK)" },
  { value: "Organic", label: "ઓર્ગેનિક" },
  { value: "Sulphur", label: "સલ્ફર" },
  { value: "Micronutrients", label: "માઇક્રોન્યૂટ્રિઅન્ટ" },
];
const PESTICIDE_CATEGORIES: { value: PesticideCategory; label: string }[] = [
  { value: "Insecticide", label: "જંતુનાશક" },
  { value: "Fungicide", label: "ફૂગ નાશક" },
  { value: "Herbicide", label: "નીંદામણ નાશક" },
  { value: "Growth Booster", label: "ગ્રોથ બૂસ્ટર" },
];
const LABOUR_TASKS: { value: LabourTask; label: string }[] = [
  { value: "Weeding", label: "નીંદામણ" },
  { value: "Sowing", label: "વાવણી" },
  { value: "Spraying", label: "છંટકાવ" },
  { value: "Harvesting", label: "લણણી" },
  { value: "Irrigation", label: "સિંચાઈ" },
];
const ADVANCE_REASONS: { value: AdvanceReason; label: string }[] = [
  { value: "Medical", label: "દવા/હોસ્પિટલ" },
  { value: "Grocery", label: "કરિયાણું" },
  { value: "Mobile Recharge", label: "મોબાઇલ રિચાર્જ" },
  { value: "Festival", label: "તહેવાર" },
  { value: "Loan", label: "ઉધાર" },
  { value: "Other", label: "અન્ય" },
];
const MACHINERY_IMPLEMENTS: { value: MachineryImplement; label: string }[] = [
  { value: "Rotavator", label: "રોટાવેટર" },
  { value: "Plough", label: "હળ" },
  { value: "Sowing Machine", label: "સોઇંગ મશીન" },
  { value: "Thresher", label: "થ્રેશર" },
  { value: "Tractor Rental", label: "ટ્રેક્ટર ભાડે" },
  { value: "બલૂન (Baluun)", label: "બલૂન" },
  { value: "રેપ (Rap)", label: "રેપ" },
];

// ─── Reusable components ──────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SelectPicker<T extends string>({
  options,
  selected,
  onSelect,
  placeholder,
}: {
  options: { value: T; label: string }[];
  selected: T | "";
  onSelect: (v: T) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === selected)?.label;
  return (
    <View style={{ marginBottom: 14 }}>
      <TouchableOpacity
        style={[styles.selectBtn, open && styles.selectBtnOpen]}
        onPress={() => setOpen((p) => !p)}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.selectText, !selectedLabel && { color: "#9CA3AF" }]}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={C.textMuted}
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropList}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[
                styles.dropItem,
                selected === o.value && styles.dropItemActive,
              ]}
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
                <Ionicons name="checkmark" size={16} color={C.green700} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function NumericInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <View style={styles.numRow}>
      {prefix ? <Text style={styles.numAffix}>{prefix}</Text> : null}
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
      />
      {suffix ? <Text style={styles.numAffix}>{suffix}</Text> : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddExpense() {
  const params = useLocalSearchParams<{ cropId: string }>();
  const cropId = Array.isArray(params.cropId)
    ? params.cropId[0]
    : params.cropId;
  const { profile } = useProfile();

  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [saving, setSaving] = useState(false);
  const [seedType, setSeedType] = useState<SeedType | "">("");
  const [seedQty, setSeedQty] = useState("");
  const [seedCost, setSeedCost] = useState("");
  const [fertProduct, setFertProduct] = useState<FertilizerProduct | "">("");
  const [fertBags, setFertBags] = useState("");
  const [fertCost, setFertCost] = useState("");
  const [pestCategory, setPestCategory] = useState<PesticideCategory | "">("");
  const [pestDosage, setPestDosage] = useState("");
  const [pestCost, setPestCost] = useState("");
  const [labourMode, setLabourMode] = useState<"Daily" | "Contract">("Daily");
  const [labourTask, setLabourTask] = useState<LabourTask | "">("");
  const [labourPeople, setLabourPeople] = useState("");
  const [labourDays, setLabourDays] = useState("");
  const [labourRate, setLabourRate] = useState("");
  const [advanceReason, setAdvanceReason] = useState<AdvanceReason | "">("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [machineImpl, setMachineImpl] = useState<MachineryImplement | "">("");
  const [machineIsContract, setMachineIsContract] = useState(false);
  const [machineQty, setMachineQty] = useState("");
  const [machineRate, setMachineRate] = useState("");
  const [notes, setNotes] = useState("");

  const labourTotal =
    labourPeople && labourDays && labourRate
      ? Number(labourPeople) * Number(labourDays) * Number(labourRate)
      : null;
  const machineTotal =
    machineQty && machineRate ? Number(machineQty) * Number(machineRate) : null;
  const seedRatePerKg =
    seedQty && seedCost && Number(seedQty) > 0
      ? (Number(seedCost) / Number(seedQty)).toFixed(2)
      : null;

  const validate = (): string | null => {
    if (!cropId) return "cropId મળ્યો નથી — પાછળ જઈ ફરીથી પ્રયાસ કરો.";
    if (!category) return "કૃપા કરીને ખર્ચ પ્રકાર પસંદ કરો.";
    if (category === "Seed") {
      if (!seedType) return "બિયારણ પ્રકાર જરૂરી છે.";
      if (!seedCost || Number(seedCost) <= 0) return "ખર્ચ 0 ન હોઈ શકે.";
    }
    if (category === "Fertilizer") {
      if (!fertProduct) return "ઉત્પાદનનું નામ જરૂરી છે.";
      if (!fertCost || Number(fertCost) <= 0) return "ખર્ચ 0 ન હોઈ શકે.";
    }
    if (category === "Pesticide") {
      if (!pestCategory) return "કેટેગરી પસંદ કરો.";
      if (!pestCost || Number(pestCost) <= 0) return "ખર્ચ 0 ન હોઈ શકે.";
    }
    if (category === "Labour") {
      if (labourMode === "Daily") {
        if (!labourTask) return "કામ પ્રકાર પસંદ કરો.";
        if (!labourPeople || !labourDays || !labourRate)
          return "બધી મજૂરી માહિતી ભરો.";
      } else {
        if (!advanceReason) return "ઍડ્વાન્સ કારણ પસંદ કરો.";
        if (!advanceAmount || Number(advanceAmount) <= 0)
          return "રકમ 0 ન હોઈ શકે.";
      }
    }
    if (category === "Machinery") {
      if (!machineImpl) return "મશીન/ઓજાર પસંદ કરો.";
      if (!machineQty || !machineRate) return "બધી મશીનરી માહિતી ભરો.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("⚠️ ભૂલ", err);
      return;
    }
    try {
      setSaving(true);
      await createExpense({
        userId: profile?._id,
        cropId: cropId as string,
        category: category as ExpenseCategory,
        notes: notes.trim() || undefined,
        ...(category === "Seed" && {
          seed: {
            seedType: seedType as SeedType,
            quantityKg: Number(seedQty),
            totalCost: Number(seedCost),
          },
        }),
        ...(category === "Fertilizer" && {
          fertilizer: {
            productName: fertProduct as FertilizerProduct,
            numberOfBags: Number(fertBags),
            totalCost: Number(fertCost),
          },
        }),
        ...(category === "Pesticide" && {
          pesticide: {
            category: pestCategory as PesticideCategory,
            dosageML: Number(pestDosage),
            cost: Number(pestCost),
          },
        }),
        ...(category === "Labour" &&
          labourMode === "Daily" && {
            labourDaily: {
              task: labourTask as LabourTask,
              numberOfPeople: Number(labourPeople),
              days: Number(labourDays),
              dailyRate: Number(labourRate),
            },
          }),
        ...(category === "Labour" &&
          labourMode === "Contract" && {
            labourContract: {
              advanceReason: advanceReason as AdvanceReason,
              amountGiven: Number(advanceAmount),
            },
          }),
        ...(category === "Machinery" && {
          machinery: {
            implement: machineImpl as MachineryImplement,
            isContract: machineIsContract,
            hoursOrAcres: Number(machineQty),
            rate: Number(machineRate),
          },
        }),
      });
      Alert.alert("✅ સફળ!", "ખર્ચ સફળતાપૂર્વક ઉમેરાયો!", [
        { text: "ઠીક છે", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("❌ ભૂલ", error?.message ?? "કંઈક ખોટું થયું.");
    } finally {
      setSaving(false);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.value === category);
  const paddingTop = Platform.OS === "ios" ? 50 : 36;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header — light green, matches dashboard ── */}
      <LinearGradient
        colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
        style={[styles.header, { paddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={C.green700} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {activeCat
                ? `${activeCat.icon} ${activeCat.label} ખર્ચ`
                : "💰 ખર્ચ ઉમેરો"}
            </Text>
            <Text style={styles.headerSub}>
              {activeCat ? "વિગત ભરો અને સાચવો" : "ખર્ચ પ્રકાર પસંદ કરો"}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Category chips ── */}
        <Text style={styles.sectionTitle}>ખર્ચ પ્રકાર</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setCategory(cat.value)}
                activeOpacity={0.8}
                style={{ marginRight: 10 }}
              >
                <View
                  style={[
                    styles.catChip,
                    active && {
                      backgroundColor: cat.pale,
                      borderColor: cat.color,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.catLabel,
                      active && { color: cat.color, fontWeight: "800" },
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={cat.color}
                      style={{ marginLeft: 2 }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── SEED ── */}
        {category === "Seed" && (
          <View style={styles.card}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#16A34A" }]}>
              <Text style={styles.cardTitle}>🌱 બિયારણ ખર્ચ</Text>
            </View>
            <SectionLabel text="બિયારણ પ્રકાર *" />
            <SelectPicker
              options={SEED_TYPES}
              selected={seedType}
              onSelect={setSeedType}
              placeholder="પ્રકાર પસંદ કરો..."
            />
            <SectionLabel text="જથ્થો (કિ.ગ્રા.)" />
            <NumericInput
              value={seedQty}
              onChange={setSeedQty}
              placeholder="0"
              suffix="કિ.ગ્રા."
            />
            <SectionLabel text="કુલ ખર્ચ (₹) *" />
            <NumericInput
              value={seedCost}
              onChange={setSeedCost}
              placeholder="0"
              prefix="₹"
            />
            {seedRatePerKg && (
              <View style={styles.derivedBox}>
                <Ionicons name="calculator" size={14} color={C.green700} />
                <Text style={styles.derivedText}>
                  દર: ₹{seedRatePerKg} / કિ.ગ્રા.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── FERTILIZER ── */}
        {category === "Fertilizer" && (
          <View style={styles.card}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#0891B2" }]}>
              <Text style={styles.cardTitle}>🧪 ખાતર ખર્ચ</Text>
            </View>
            <SectionLabel text="ઉત્પાદન *" />
            <SelectPicker
              options={FERTILIZER_PRODUCTS}
              selected={fertProduct}
              onSelect={setFertProduct}
              placeholder="ખાતર પસંદ કરો..."
            />
            <SectionLabel text="બૅગ સંખ્યા" />
            <NumericInput
              value={fertBags}
              onChange={setFertBags}
              placeholder="0"
              suffix="બૅગ"
            />
            <SectionLabel text="કુલ ખર્ચ (₹) *" />
            <NumericInput
              value={fertCost}
              onChange={setFertCost}
              placeholder="0"
              prefix="₹"
            />
          </View>
        )}

        {/* ── PESTICIDE ── */}
        {category === "Pesticide" && (
          <View style={styles.card}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#DC2626" }]}>
              <Text style={styles.cardTitle}>🧴 જંતુનાશક ખર્ચ</Text>
            </View>
            <View style={styles.infoNote}>
              <Ionicons name="information-circle" size={14} color="#0891B2" />
              <Text style={styles.infoNoteText}>
                અહીં ફક્ત આર્થિક માહિતી નોંધો.
              </Text>
            </View>
            <SectionLabel text="પ્રકાર *" />
            <SelectPicker
              options={PESTICIDE_CATEGORIES}
              selected={pestCategory}
              onSelect={setPestCategory}
              placeholder="પ્રકાર પસંદ કરો..."
            />
            <SectionLabel text="જથ્થો (ml/લિ.)" />
            <NumericInput
              value={pestDosage}
              onChange={setPestDosage}
              placeholder="0"
              suffix="ml"
            />
            <SectionLabel text="ખર્ચ (₹) *" />
            <NumericInput
              value={pestCost}
              onChange={setPestCost}
              placeholder="0"
              prefix="₹"
            />
          </View>
        )}

        {/* ── LABOUR ── */}
        {category === "Labour" && (
          <View style={styles.card}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#D97706" }]}>
              <Text style={styles.cardTitle}>👷 મજૂરી ખર્ચ</Text>
            </View>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  labourMode === "Daily" && styles.toggleBtnActive,
                ]}
                onPress={() => setLabourMode("Daily")}
              >
                <Text
                  style={
                    labourMode === "Daily"
                      ? styles.toggleTextActive
                      : styles.toggleText
                  }
                >
                  દૈનિક મજૂર
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  labourMode === "Contract" && styles.toggleBtnActive,
                ]}
                onPress={() => setLabourMode("Contract")}
              >
                <Text
                  style={
                    labourMode === "Contract"
                      ? styles.toggleTextActive
                      : styles.toggleText
                  }
                >
                  કોન્ટ્રાક્ટ
                </Text>
              </TouchableOpacity>
            </View>
            {labourMode === "Daily" ? (
              <>
                <SectionLabel text="કામ પ્રકાર *" />
                <SelectPicker
                  options={LABOUR_TASKS}
                  selected={labourTask}
                  onSelect={setLabourTask}
                  placeholder="કામ પસંદ કરો..."
                />
                <SectionLabel text="લોકો × દિવસ" />
                <View style={styles.multiRow}>
                  <View style={{ flex: 1 }}>
                    <NumericInput
                      value={labourPeople}
                      onChange={setLabourPeople}
                      placeholder="લોકો"
                    />
                  </View>
                  <Text style={styles.multiX}>×</Text>
                  <View style={{ flex: 1 }}>
                    <NumericInput
                      value={labourDays}
                      onChange={setLabourDays}
                      placeholder="દિવસ"
                    />
                  </View>
                </View>
                <SectionLabel text="દૈનિક દર (₹)" />
                <NumericInput
                  value={labourRate}
                  onChange={setLabourRate}
                  placeholder="0"
                  prefix="₹"
                />
                {labourTotal !== null && (
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>કુલ =</Text>
                    <Text style={styles.totalValue}>
                      ₹ {labourTotal.toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.warnNote}>
                  <Ionicons name="warning" size={14} color="#D97706" />
                  <Text style={styles.warnNoteText}>
                    આ રકમ ખેત ખર્ચ નથી — ભવિષ્યની જવાબદારી સામે ડેબિટ છે.
                  </Text>
                </View>
                <SectionLabel text="ઍડ્વાન્સ કારણ *" />
                <SelectPicker
                  options={ADVANCE_REASONS}
                  selected={advanceReason}
                  onSelect={setAdvanceReason}
                  placeholder="કારણ પસંદ કરો..."
                />
                <SectionLabel text="આપેલ રકમ (₹) *" />
                <NumericInput
                  value={advanceAmount}
                  onChange={setAdvanceAmount}
                  placeholder="0"
                  prefix="₹"
                />
              </>
            )}
          </View>
        )}

        {/* ── MACHINERY ── */}
        {category === "Machinery" && (
          <View style={styles.card}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#7C3AED" }]}>
              <Text style={styles.cardTitle}>🚜 મશીનરી ખર્ચ</Text>
            </View>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  !machineIsContract && styles.toggleBtnActive,
                ]}
                onPress={() => setMachineIsContract(false)}
              >
                <Text
                  style={
                    !machineIsContract
                      ? styles.toggleTextActive
                      : styles.toggleText
                  }
                >
                  ભાડું
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  machineIsContract && styles.toggleBtnActive,
                ]}
                onPress={() => setMachineIsContract(true)}
              >
                <Text
                  style={
                    machineIsContract
                      ? styles.toggleTextActive
                      : styles.toggleText
                  }
                >
                  કોન્ટ્રાક્ટ
                </Text>
              </TouchableOpacity>
            </View>
            <SectionLabel text="મશીન / ઓજાર *" />
            <SelectPicker
              options={MACHINERY_IMPLEMENTS}
              selected={machineImpl}
              onSelect={setMachineImpl}
              placeholder="પ્રકાર પસંદ કરો..."
            />
            <SectionLabel text="કલાક / એકર" />
            <NumericInput
              value={machineQty}
              onChange={setMachineQty}
              placeholder="0"
            />
            <SectionLabel text="દર (₹)" />
            <NumericInput
              value={machineRate}
              onChange={setMachineRate}
              placeholder="0"
              prefix="₹"
            />
            {machineTotal !== null && (
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>કુલ =</Text>
                <Text style={styles.totalValue}>
                  ₹ {machineTotal.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Notes ── */}
        {category !== "" && (
          <View style={[styles.card, { marginTop: 4 }]}>
            <View
              style={[styles.cardTitleRow, { borderLeftColor: C.textMuted }]}
            >
              <Text style={styles.cardTitle}>📝 નોંધ (વૈકલ્પિક)</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="વધારાની માહિતી..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={saving ? ["#9CA3AF", "#6B7280"] : [C.green700, C.green500]}
            style={styles.btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons
              name={saving ? "hourglass-outline" : "checkmark-circle"}
              size={20}
              color="#fff"
            />
            <Text style={styles.btnText}>
              {saving ? "સાચવી રહ્યા છીએ..." : "ખર્ચ સાચવો"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  decorCircle1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#C8E6C980",
    top: -40,
    right: -30,
  },
  decorCircle2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#C8E6C950",
    bottom: 8,
    left: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerTitle: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  scroll: { padding: 18 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
    marginBottom: 12,
  },

  // Category chips
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  catIcon: { fontSize: 18 },
  catLabel: { fontSize: 13, fontWeight: "600", color: C.textSecondary },

  // Card
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
    marginBottom: 12,
  },
  cardTitleRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: C.textPrimary },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 6,
    marginTop: 4,
  },

  // Select / dropdown
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.surfaceGreen,
  },
  selectBtnOpen: { borderColor: C.green700, backgroundColor: C.surface },
  selectText: { fontSize: 14, color: C.textPrimary },
  dropList: {
    borderWidth: 1.5,
    borderColor: C.green100,
    borderRadius: 12,
    backgroundColor: C.surface,
    overflow: "hidden",
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  dropItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  dropItemActive: { backgroundColor: C.green50 },
  dropItemText: { fontSize: 14, color: C.textSecondary },
  dropItemTextActive: { fontWeight: "700", color: C.green700 },

  // Numeric input
  numRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: C.surfaceGreen,
    marginBottom: 4,
  },
  numAffix: { fontSize: 14, color: C.textMuted, marginHorizontal: 4 },
  numInput: {
    flex: 1,
    fontSize: 16,
    color: C.textPrimary,
    paddingVertical: 12,
  },

  // Derived / info boxes
  derivedBox: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: C.green50,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.green100,
  },
  derivedText: { fontSize: 12, fontWeight: "600", color: C.green700 },

  totalBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.green50,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  totalLabel: { fontSize: 13, color: C.textSecondary, fontWeight: "700" },
  totalValue: { fontSize: 20, color: C.green700, fontWeight: "900" },

  // Info / warn notes
  infoNote: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  infoNoteText: { fontSize: 11, color: "#0369A1", flex: 1, lineHeight: 16 },
  warnNote: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  warnNoteText: { fontSize: 11, color: "#92400E", flex: 1, lineHeight: 16 },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    backgroundColor: C.surfaceGreen,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: C.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: { fontSize: 13, fontWeight: "600", color: C.textMuted },
  toggleTextActive: { fontSize: 13, fontWeight: "800", color: C.green700 },

  multiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  multiX: {
    fontSize: 18,
    color: C.textMuted,
    fontWeight: "700",
    marginBottom: 4,
  },

  notesInput: {
    fontSize: 13,
    color: C.textPrimary,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    marginTop: 8,
    backgroundColor: C.surfaceGreen,
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 18,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  saveBtn: { borderRadius: 14, overflow: "hidden" },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 16,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
});

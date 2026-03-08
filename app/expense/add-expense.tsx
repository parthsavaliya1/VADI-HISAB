import { useProfile } from "@/contexts/ProfileContext";
import {
  createExpense,
  getCrops,
  getCurrentFinancialYear,
  getFinancialYearOptions,
  type AdvanceReason,
  type Crop,
  type ExpenseCategory,
  type FertilizerProduct,
  type LabourTask,
  type MachineryImplement,
  type PesticideCategory,
  type SeedType,
  type SharingOption,
} from "@/utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
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

const BHAGMA_SHARING_KEY = "@vadi_bhagma_sharing";

/** Financial year "2025-26" → June 1, 2025 (start of FY) */
function financialYearToStartDate(fy: string): Date {
  const [y] = fy.split("-").map(Number);
  return new Date(y, 5, 1); // month 5 = June
}

/** Year options: previous, current, next e.g. ["2024-25", "2025-26", "2026-27"] */
function getYearOptions(): string[] {
  const current = getCurrentFinancialYear();
  const [startY] = current.split("-").map(Number);
  const prev = `${startY - 1}-${String(startY % 100).padStart(2, "0")}`;
  return [prev, ...getFinancialYearOptions()];
}

const { width: SCREEN_W } = Dimensions.get("window");
const CAT_GRID_PAD = 16;
const CAT_GRID_GAP = 12;
// 3 in first row (Seed, Fertilizer, Pesticide), 2 in second row (Labour, Machinery)
const CAT_CARD_WIDTH = (SCREEN_W - CAT_GRID_PAD * 2 - CAT_GRID_GAP * 2) / 3;

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

// ─── Categories — icons: seed, fertilizer (not bag), spray pump, people, tractor ─────
const CATEGORIES: {
  value: ExpenseCategory;
  label: string;
  iconSet: "ionicons" | "mci";
  iconName: string;
  color: string;
  pale: string;
}[] = [
  { value: "Seed", label: "બિયારણ", iconSet: "mci", iconName: "sprout", color: "#16A34A", pale: "#DCFCE7" },
  { value: "Fertilizer", label: "ખાતર", iconSet: "ionicons", iconName: "flask-outline", color: "#0891B2", pale: "#E0F2FE" },
  { value: "Pesticide", label: "જંતુનાશક", iconSet: "mci", iconName: "spray", color: "#DC2626", pale: "#FEE2E2" },
  { value: "Labour", label: "મજૂરી", iconSet: "ionicons", iconName: "people-outline", color: "#D97706", pale: "#FEF3C7" },
  { value: "Machinery", label: "ટ્રેક્ટર/મશીન", iconSet: "mci", iconName: "tractor-variant", color: "#7C3AED", pale: "#EDE9FE" },
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
const SHARING_OPTIONS: { value: SharingOption; label: string }[] = [
  { value: "25", label: "25%" },
  { value: "33", label: "33%" },
  { value: "50", label: "50%" },
  { value: "custom", label: "કસ્ટમ" },
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

// ─── Crop dropdown: same format as dashboard CropPickerModal (Gujarati name, સિઝન, વીઘા) ───
const CROP_NAME_GUJ: Record<string, string> = {
  Cotton: "કપાસ",
  Groundnut: "મગફળી",
  Jeera: "જીરું",
  Garlic: "લસણ",
  Onion: "ડુંગળી",
  Chana: "ચણા",
  Wheat: "ઘઉં",
  Bajra: "બાજરી",
  Maize: "મકાઈ",
};
const SEASON_DISPLAY: Record<string, string> = {
  Kharif: "☔ ખરીફ",
  Rabi: "❄️ રવી",
  Summer: "☀️ ઉનાળો",
};
const AREA_UNIT_GUJ: Record<string, string> = {
  Bigha: "વીઘા",
  Acre: "એકર",
  Hectare: "હેક્ટર",
};
function cropDisplayNameGuj(name: string): string {
  if (!name || typeof name !== "string") return "—";
  const trimmed = name.trim();
  const exact = CROP_NAME_GUJ[trimmed];
  if (exact) return exact;
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  if (CROP_NAME_GUJ[capitalized]) return CROP_NAME_GUJ[capitalized];
  return trimmed;
}
function getCropDropdownLabel(c: Crop): string {
  const emoji = c.cropEmoji ?? "🌱";
  const name = cropDisplayNameGuj(c.cropName ?? "");
  const season = SEASON_DISPLAY[c.season ?? ""] ?? (c.season ?? "—");
  const area = c.area != null ? String(c.area) : "—";
  const unit = AREA_UNIT_GUJ[(c.areaUnit ?? "Bigha") as string] ?? "વીઘા";
  return `${emoji} ${name} · ${season} · ${area} ${unit}`;
}

// ─── Reusable components ──────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SelectPicker<T extends string>({
  options,
  selected,
  onSelect,
  placeholder,
  onOpen,
}: {
  options: { value: T; label: string }[];
  selected: T | "";
  onSelect: (v: T) => void;
  placeholder: string;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === selected)?.label;
  const handlePress = () => {
    if (!open && onOpen) onOpen();
    setOpen((p) => !p);
  };
  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        style={[styles.selectBtn, open && styles.selectBtnOpen]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.selectText, !selectedLabel && { color: "#5B6570" }]}
        >
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
                <Ionicons name="checkmark" size={20} color={C.green700} />
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
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  onFocus?: () => void;
}) {
  return (
    <View style={styles.numRow}>
      {prefix ? <Text style={styles.numAffix}>{prefix}</Text> : null}
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#5B6570"
        keyboardType="numeric"
        onFocus={onFocus}
      />
      {suffix ? <Text style={styles.numAffix}>{suffix}</Text> : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddExpense() {
  const params = useLocalSearchParams<{ cropId?: string; general?: string; year?: string }>();
  const paramCropId = Array.isArray(params.cropId) ? params.cropId[0] : params.cropId;
  const paramYear = Array.isArray(params.year) ? params.year[0] : params.year;
  const isGeneralExpense = (Array.isArray(params.general) ? params.general[0] : params.general) === "1";
  const { profile } = useProfile();

  const yearOptions = getYearOptions();
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(
    () => paramYear && yearOptions.includes(paramYear) ? paramYear : getCurrentFinancialYear(),
  );
  const [expenseDate, setExpenseDate] = useState<Date>(() =>
    financialYearToStartDate(paramYear && yearOptions.includes(paramYear) ? paramYear : getCurrentFinancialYear()),
  );

  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string | "">("");
  const [generalDescription, setGeneralDescription] = useState("");
  const [generalAmount, setGeneralAmount] = useState("");
  const cropId = selectedCropId || paramCropId || undefined;

  useEffect(() => {
    setExpenseDate(financialYearToStartDate(selectedFinancialYear));
  }, [selectedFinancialYear]);

  // Order: Active (live) first, then Harvested, then Closed
  const cropStatusOrder = (s: string | undefined) =>
    s === "Active" ? 0 : s === "Harvested" ? 1 : s === "Closed" ? 2 : 0;
  useEffect(() => {
    if (!isGeneralExpense) {
      getCrops()
        .then((r) => {
          const list = [...(r.data ?? [])];
          list.sort((a, b) => cropStatusOrder(a.status) - cropStatusOrder(b.status));
          setCrops(list);
        })
        .catch(() => setCrops([]));
    }
  }, [isGeneralExpense]);

  useEffect(() => {
    if (paramCropId && !isGeneralExpense) setSelectedCropId(paramCropId);
  }, [paramCropId, isGeneralExpense]);

  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [saving, setSaving] = useState(false);
  const [seedType, setSeedType] = useState<SeedType | "">("");
  const [seedQty, setSeedQty] = useState("");
  const [seedQtyUnit, setSeedQtyUnit] = useState<"man" | "kg">("man");
  const [seedUnitRate, setSeedUnitRate] = useState("");
  const seedCost = (() => {
    const q = Number(seedQty);
    const r = Number(seedUnitRate);
    if (q > 0 && r >= 0) return String(q * r);
    return "";
  })();
  const [fertProduct, setFertProduct] = useState<FertilizerProduct | "">("");
  const [fertBags, setFertBags] = useState("");
  const [fertUnitCost, setFertUnitCost] = useState("");
  const fertTotal =
    fertBags && fertUnitCost && Number(fertBags) > 0 && Number(fertUnitCost) >= 0
      ? Number(fertBags) * Number(fertUnitCost)
      : null;
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
  const [sharingType, setSharingType] = useState<SharingOption | "">("");
  const [sharingCustom, setSharingCustom] = useState("");
  const [machineImpl, setMachineImpl] = useState<MachineryImplement | "">("");

  // Load last-used ભાગમા sharing so we don't ask every time
  useEffect(() => {
    AsyncStorage.getItem(BHAGMA_SHARING_KEY).then((raw) => {
      try {
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.sharingType) {
          setSharingType(saved.sharingType);
          if (saved.sharingCustom != null && saved.sharingCustom !== "")
            setSharingCustom(String(saved.sharingCustom));
        }
      } catch (_) {}
    });
  }, []);

  // Persist sharing when it changes (same for all ભાગમા expenses)
  const persistSharing = useCallback((type: SharingOption | "", custom: string) => {
    if (!type) return;
    AsyncStorage.setItem(
      BHAGMA_SHARING_KEY,
      JSON.stringify({
        sharingType: type,
        ...(type === "custom" && custom !== "" ? { sharingCustom: custom } : {}),
      }),
    );
  }, []);
  const handleSharingSelect = useCallback(
    (v: SharingOption | "") => {
      setSharingType(v);
      if (v) persistSharing(v, sharingCustom);
    },
    [persistSharing, sharingCustom],
  );
  const handleSharingCustomChange = useCallback(
    (val: string) => {
      setSharingCustom(val);
      if (sharingType === "custom") persistSharing("custom", val);
    },
    [persistSharing, sharingType],
  );
  const [machineUnitType, setMachineUnitType] = useState<"hour" | "vigha">("vigha");
  const [machineQty, setMachineQty] = useState("");
  const [machineRate, setMachineRate] = useState("");
  const [notes, setNotes] = useState("");
  const [irrigationAmount, setIrrigationAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [otherDescription, setOtherDescription] = useState("");

  const labourTotal =
    labourPeople && labourDays && labourRate
      ? Number(labourPeople) * Number(labourDays) * Number(labourRate)
      : null;
  const machineTotal =
    machineQty && machineRate ? Number(machineQty) * Number(machineRate) : null;
  const seedQuantityKg =
    seedQty && Number(seedQty) > 0
      ? seedQtyUnit === "man"
        ? Number(seedQty) * 20
        : Number(seedQty)
      : 0;
  const seedRatePerKg =
    seedQuantityKg > 0 && seedCost && Number(seedCost) > 0
      ? (Number(seedCost) / seedQuantityKg).toFixed(2)
      : null;

  const validate = (): string | null => {
    if (isGeneralExpense) {
      if (!generalDescription.trim()) return "ખર્ચનો પ્રકાર / વિવરણ લખો (દા.ત. ફાર્મ વિકાસ, સાધન ખરીદી).";
      if (!generalAmount || Number(generalAmount) <= 0) return "ખર્ચની રકમ દાખલ કરો.";
      return null;
    }
    if (!cropId) return "કૃપા કરીને પાક પસંદ કરો અથવા સામાન્ય ખર્ચ માટે કોઈ પાક પસંદ કરો.";
    if (!category) return "કૃપા કરીને ખર્ચ પ્રકાર પસંદ કરો.";
    if (category === "Seed") {
      if (!seedType) return "બિયારણ પ્રકાર જરૂરી છે.";
      if (!seedQty || Number(seedQty) <= 0) return "જથ્થો દાખલ કરો.";
      if (!seedUnitRate || Number(seedUnitRate) < 0) return "દર (પ્રતિ એકમ) દાખલ કરો.";
    }
    if (category === "Fertilizer") {
      if (!fertProduct) return "ઉત્પાદનનું નામ જરૂરી છે.";
      if (!fertBags || Number(fertBags) <= 0) return "બૅગ સંખ્યા દાખલ કરો.";
      if (!fertUnitCost || Number(fertUnitCost) < 0) return "દર દર બૅગ દાખલ કરો.";
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
        if (sharingType === "custom") {
          const n = Number(sharingCustom);
          if (sharingCustom === "" || !Number.isFinite(n) || n < 0 || n > 100)
            return "કસ્ટમ શેરિંગ માટે 0–100 ટકા દાખલ કરો.";
        }
      }
    }
    if (category === "Machinery") {
      if (!machineImpl) return "મશીન/ઓજાર પસંદ કરો.";
      if (!machineQty || !machineRate) return "બધી મશીનરી માહિતી ભરો.";
    }
    if (category === "Irrigation") {
      if (!irrigationAmount || Number(irrigationAmount) <= 0) return "સિંચાઈ ખર્ચની રકમ દાખલ કરો.";
    }
    if (category === "Other") {
      if (!otherAmount || Number(otherAmount) <= 0) return "ખર્ચની રકમ દાખલ કરો.";
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
      if (category === "Labour" && labourMode === "Contract" && sharingType)
        persistSharing(sharingType, sharingCustom);
      if (isGeneralExpense) {
        await createExpense({
          cropId: null,
          category: "Labour",
          date: expenseDate.toISOString(),
          notes: generalDescription.trim(),
          labourContract: {
            advanceReason: "Other",
            amountGiven: Number(generalAmount),
          },
        });
        Alert.alert("✅ સફળ!", "સામાન્ય ખર્ચ સાચવ્યો.", [{ text: "ઠીક છે" }]);
        setGeneralDescription("");
        setGeneralAmount("");
        return;
      }
      await createExpense({
        cropId: cropId as string,
        category: category as ExpenseCategory,
        date: expenseDate.toISOString(),
        notes: notes.trim() || undefined,
        ...(category === "Seed" && {
          seed: {
            seedType: seedType as SeedType,
            quantityKg: seedQuantityKg,
            totalCost: Number(seedCost),
          },
        }),
        ...(category === "Fertilizer" && {
          fertilizer: {
            productName: fertProduct as FertilizerProduct,
            numberOfBags: Number(fertBags),
            totalCost: Number(fertBags) * Number(fertUnitCost),
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
              ...(sharingType && {
                sharingType: sharingType as SharingOption,
                ...(sharingType === "custom" && sharingCustom !== "" && {
                  sharingCustom: Number(sharingCustom),
                }),
              }),
            },
          }),
        ...(category === "Machinery" && {
          machinery: {
            implement: machineImpl as MachineryImplement,
            isContract: false,
            hoursOrAcres: Number(machineQty),
            rate: Number(machineRate),
          },
        }),
        ...(category === "Irrigation" && {
          irrigation: { amount: Number(irrigationAmount) },
        }),
        ...(category === "Other" && {
          other: { totalAmount: Number(otherAmount), description: otherDescription.trim() || undefined },
        }),
      });
      Alert.alert("✅ સફળ!", "ખર્ચ સફળતાપૂર્વક ઉમેરાયો!", [{ text: "ઠીક છે" }]);
      setCategory("");
      setSeedType("");
      setSeedQty("");
      setSeedUnitRate("");
      setFertProduct("");
      setFertBags("");
      setFertUnitCost("");
      setPestCategory("");
      setPestDosage("");
      setPestCost("");
      setLabourTask("");
      setLabourPeople("");
      setLabourDays("");
      setLabourRate("");
      setAdvanceReason("");
      setAdvanceAmount("");
      setSharingType("");
      setSharingCustom("");
      setMachineImpl("");
      setMachineQty("");
      setMachineRate("");
      setNotes("");
      setIrrigationAmount("");
      setOtherAmount("");
      setOtherDescription("");
    } catch (error: any) {
      Alert.alert("❌ ભૂલ", error?.message ?? "કંઈક ખોટું થયું.");
    } finally {
      setSaving(false);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.value === category);
  const paddingTop = Platform.OS === "ios" ? 52 : 40;
  const scrollRef = useRef<ScrollView>(null);
  const formSectionYRef = useRef(0);
  const scrollToForm = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formSectionYRef.current - 100),
        animated: true,
      });
    }, 300);
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isGeneralExpense ? (
                <Text style={styles.headerTitle}>સામાન્ય ખર્ચ</Text>
              ) : activeCat ? (
                <>
                  <View style={[styles.headerIconWrap, { backgroundColor: activeCat.pale }]}>
                    {activeCat.iconSet === "mci" ? (
                      <MaterialCommunityIcons name={activeCat.iconName as any} size={20} color={activeCat.color} />
                    ) : (
                      <Ionicons name={activeCat.iconName as any} size={20} color={activeCat.color} />
                    )}
                  </View>
                  <Text style={styles.headerTitle}>{activeCat.label} ખર્ચ</Text>
                </>
              ) : (
                <Text style={styles.headerTitle}>ખર્ચ ઉમેરો</Text>
              )}
            </View>
            <Text style={styles.headerSub}>
              {isGeneralExpense ? "ખર્ચનો પ્રકાર અને રકમ દાખલ કરો — અહેવાલમાં ગણાશે" : activeCat ? "વિગત ભરો અને સાચવો" : "ખર્ચ પ્રકાર પસંદ કરો"}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={[styles.scroll, { paddingBottom: 360 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* ── Financial year selector (before add) ── */}
        <View style={styles.yearCard}>
          <Text style={styles.yearLabel}>📅 વર્ષ પસંદ કરો (જૂન–મે)</Text>
          <View style={styles.yearRow}>
            {yearOptions.map((fy) => {
              const active = selectedFinancialYear === fy;
              return (
                <TouchableOpacity
                  key={fy}
                  onPress={() => setSelectedFinancialYear(fy)}
                  style={[styles.yearPill, active && styles.yearPillActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.yearPillText, active && styles.yearPillTextActive]}>{fy}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── General expense: description + amount — not linked to any crop; no crop required ── */}
        {isGeneralExpense ? (
          <View style={styles.card}>
            <View style={styles.generalExpenseInfo}>
              <Ionicons name="information-circle" size={18} color={C.green700} />
              <Text style={styles.generalExpenseInfoText}>
                આ ખર્ચ કોઈ પાક સાથે લિંક નથી. વાર્ષિક ફાર્મ વિકાસ, સાધન ખરીદી વગેરે — અહેવાલમાં કુલ ખર્ચમાં ગણાશે.
              </Text>
            </View>
            <SectionLabel text="ખર્ચનો પ્રકાર / વિવરણ *" />
            <TextInput
              style={styles.notesInput}
              value={generalDescription}
              onChangeText={setGeneralDescription}
              placeholder="દા.ત. ફાર્મ વિકાસ, સાધન ખરીદી, ભાડું, મરામત..."
              placeholderTextColor="#5B6570"
              multiline
            />
            <SectionLabel text="ખર્ચ રકમ *" />
            <NumericInput
              value={generalAmount}
              onChange={setGeneralAmount}
              placeholder="0"
              prefix=""
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving || !generalDescription.trim() || !generalAmount || Number(generalAmount) <= 0}
            >
              <LinearGradient
                colors={["#2E7D32", "#4CAF50"]}
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
        ) : (
          <>
        {/* ── Crop dropdown: pre-selected from dashboard (cropId in URL) or user choice ── */}
        <View style={styles.cropSelectCard}>
          <SectionLabel text="પાક પસંદ કરો *" />
          {crops.length > 0 ? (
            <SelectPicker
              options={crops.map((c) => ({ value: c._id, label: getCropDropdownLabel(c) }))}
              selected={cropId ?? ""}
              onSelect={(id) => setSelectedCropId(id)}
              placeholder="આ ખર્ચ કયા પાક માટે?"
            />
          ) : (
            <Text style={styles.generalExpenseNote}>કોઈ પાક નથી — પહેલા ડેશબોર્ડથી પાક ઉમેરો.</Text>
          )}
        </View>

        {/* ── Category: big grid when none selected, compact strip when one selected ── */}
        {category === "" ? (
          <>
            <Text style={styles.sectionTitle}>ખર્ચ પ્રકાર પસંદ કરો</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  activeOpacity={0.85}
                  style={styles.catGridItem}
                >
                  <View style={[styles.catCard, { borderColor: C.borderLight }]}>
                    <View style={[styles.catCardIconWrap, { backgroundColor: cat.pale }]}>
                      {cat.iconSet === "mci" ? (
                        <MaterialCommunityIcons name={cat.iconName as any} size={28} color={cat.color} />
                      ) : (
                        <Ionicons name={cat.iconName as any} size={28} color={cat.color} />
                      )}
                    </View>
                    <Text style={styles.catCardLabel} numberOfLines={2}>{cat.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.catStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catStripContent}>
              {CATEGORIES.map((cat) => {
                const active = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    activeOpacity={0.8}
                    style={[styles.catStripChip, active && { backgroundColor: cat.pale, borderColor: cat.color }]}
                  >
                    <Text style={[styles.catStripLabel, active && { color: cat.color, fontWeight: "800" }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── SEED ── */}
        {category === "Seed" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#16A34A" }]}>
              <Text style={styles.cardTitle}>🌱 બિયારણ ખર્ચ</Text>
            </View>
            <SectionLabel text="બિયારણ પ્રકાર *" />
            <SelectPicker
              options={SEED_TYPES}
              selected={seedType}
              onSelect={setSeedType}
              placeholder="પ્રકાર પસંદ કરો..."
              onOpen={scrollToForm}
            />
            <SectionLabel text="જથ્થો (૧ મણ = ૨૦ કિ.ગ્રા.)" />
            <View style={styles.seedQtyRow}>
              <View style={{ flex: 1 }}>
                <NumericInput
                  value={seedQty}
                  onChange={setSeedQty}
                  placeholder="0"
                  onFocus={scrollToForm}
                />
              </View>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitToggleBtn, seedQtyUnit === "man" && styles.unitToggleBtnActive]}
                  onPress={() => setSeedQtyUnit("man")}
                >
                  <Text style={[styles.unitToggleText, seedQtyUnit === "man" && styles.unitToggleTextActive]}>મણ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitToggleBtn, seedQtyUnit === "kg" && styles.unitToggleBtnActive]}
                  onPress={() => setSeedQtyUnit("kg")}
                >
                  <Text style={[styles.unitToggleText, seedQtyUnit === "kg" && styles.unitToggleTextActive]}>કિ.ગ્રા.</Text>
                </TouchableOpacity>
              </View>
            </View>
            <SectionLabel text={`દર (પ્રતિ ${seedQtyUnit === "man" ? "મણ" : "કિ.ગ્રા."}) *`} />
            <NumericInput
              value={seedUnitRate}
              onChange={setSeedUnitRate}
              placeholder="0"
              prefix=""
            />
            {Number(seedQty) > 0 && Number(seedUnitRate) >= 0 && (
              <View style={styles.derivedBox}>
                <Ionicons name="calculator" size={16} color={C.green700} />
                <Text style={styles.derivedText}>
                  કુલ ખર્ચ: {Number(seedCost).toLocaleString("en-IN")}
                  {seedRatePerKg && ` · દર ${seedRatePerKg}/કિ.ગ્રા.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── FERTILIZER ── */}
        {category === "Fertilizer" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#0891B2" }]}>
              <Text style={styles.cardTitle}>🧪 ખાતર ખર્ચ</Text>
            </View>
            <SectionLabel text="ઉત્પાદન *" />
            <SelectPicker
              options={FERTILIZER_PRODUCTS}
              selected={fertProduct}
              onSelect={setFertProduct}
              placeholder="ખાતર પસંદ કરો..."
              onOpen={scrollToForm}
            />
            <SectionLabel text="બૅગ સંખ્યા *" />
            <NumericInput
              value={fertBags}
              onChange={setFertBags}
              placeholder="0"
              suffix="બૅગ"
              onFocus={scrollToForm}
            />
            <SectionLabel text="દર દર બૅગ *" />
            <NumericInput
              value={fertUnitCost}
              onChange={setFertUnitCost}
              placeholder="0"
              prefix=""
              onFocus={scrollToForm}
            />
            {fertTotal !== null && fertTotal >= 0 && (
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>કુલ = બૅગ × દર</Text>
                <Text style={styles.totalValue}>
                  {fertTotal.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── PESTICIDE ── */}
        {category === "Pesticide" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
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
              onOpen={scrollToForm}
            />
            <SectionLabel text="જથ્થો (ml/લિ.)" />
            <NumericInput
              value={pestDosage}
              onChange={setPestDosage}
              placeholder="0"
              suffix="ml"
              onFocus={scrollToForm}
            />
            <SectionLabel text="ખર્ચ *" />
            <NumericInput
              value={pestCost}
              onChange={setPestCost}
              placeholder="0"
              prefix=""
              onFocus={scrollToForm}
            />
          </View>
        )}

        {/* ── LABOUR ── */}
        {category === "Labour" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
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
                  ભાગમા
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
                  onOpen={scrollToForm}
                />
                <SectionLabel text="લોકો × દિવસ" />
                <View style={styles.multiRow}>
                  <View style={{ flex: 1 }}>
                    <NumericInput
                      value={labourPeople}
                      onChange={setLabourPeople}
                      placeholder="લોકો"
                      onFocus={scrollToForm}
                    />
                  </View>
                  <Text style={styles.multiX}>×</Text>
                  <View style={{ flex: 1 }}>
                    <NumericInput
                      value={labourDays}
                      onChange={setLabourDays}
                      placeholder="દિવસ"
                      onFocus={scrollToForm}
                    />
                  </View>
                </View>
                <SectionLabel text="દૈનિક દર" />
                <NumericInput
                  value={labourRate}
                  onChange={setLabourRate}
                  placeholder="0"
                  prefix=""
                  onFocus={scrollToForm}
                />
                {labourTotal !== null && (
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>કુલ =</Text>
                    <Text style={styles.totalValue}>
                      {labourTotal.toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <SectionLabel text="શેરિંગ (ભાગમા વિભાજન)" />
                <SelectPicker
                  options={SHARING_OPTIONS}
                  selected={sharingType}
                  onSelect={(v) => handleSharingSelect(v as SharingOption | "")}
                  placeholder="શેરિંગ પસંદ કરો..."
                  onOpen={scrollToForm}
                />
                {sharingType === "custom" && (
                  <>
                    <SectionLabel text="ટકા દાખલ કરો (0–100)" />
                    <NumericInput
                      value={sharingCustom}
                      onChange={handleSharingCustomChange}
                      placeholder="ઉદા. 40"
                      onFocus={scrollToForm}
                    />
                  </>
                )}
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
                  onOpen={scrollToForm}
                />
                <SectionLabel text="આપેલ રકમ *" />
                <NumericInput
                  value={advanceAmount}
                  onChange={setAdvanceAmount}
                  placeholder="0"
                  prefix=""
                  onFocus={scrollToForm}
                />
              </>
            )}
          </View>
        )}

        {/* ── MACHINERY ── */}
        {category === "Machinery" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#7C3AED" }]}>
              <Text style={styles.cardTitle}>🚜 ટ્રેક્ટર ભાડું</Text>
            </View>
            <SectionLabel text="ઓજાર / હળ *" />
            <SelectPicker
              options={MACHINERY_IMPLEMENTS}
              selected={machineImpl}
              onSelect={setMachineImpl}
              placeholder="હળ અથવા ઓજાર પસંદ કરો..."
              onOpen={scrollToForm}
            />
            <SectionLabel text="દરનો એકમ" />
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  machineUnitType === "vigha" && styles.toggleBtnActive,
                ]}
                onPress={() => setMachineUnitType("vigha")}
              >
                <Text
                  style={
                    machineUnitType === "vigha"
                      ? styles.toggleTextActive
                      : styles.toggleText
                  }
                >
                  વીઘા
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  machineUnitType === "hour" && styles.toggleBtnActive,
                ]}
                onPress={() => setMachineUnitType("hour")}
              >
                <Text
                  style={
                    machineUnitType === "hour"
                      ? styles.toggleTextActive
                      : styles.toggleText
                  }
                >
                  કલાક
                </Text>
              </TouchableOpacity>
            </View>
            <SectionLabel text={machineUnitType === "vigha" ? "વીઘા *" : "કલાક *"} />
            <NumericInput
              value={machineQty}
              onChange={setMachineQty}
              placeholder="0"
              suffix={machineUnitType === "vigha" ? "વીઘા" : "કલાક"}
              onFocus={scrollToForm}
            />
            <SectionLabel text="દર *" />
            <NumericInput
              value={machineRate}
              onChange={setMachineRate}
              placeholder="0"
              prefix=""
              onFocus={scrollToForm}
            />
            {machineTotal !== null && (
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>
                  કુલ = {machineUnitType === "vigha" ? "વીઘા" : "કલાક"} × દર
                </Text>
                <Text style={styles.totalValue}>
                  {machineTotal.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── IRRIGATION ── */}
        {category === "Irrigation" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#0284C7" }]}>
              <Text style={styles.cardTitle}>💧 સિંચાઈ ખર્ચ</Text>
            </View>
            <SectionLabel text="રકમ *" />
            <NumericInput
              value={irrigationAmount}
              onChange={setIrrigationAmount}
              placeholder="0"
              prefix="₹"
              onFocus={scrollToForm}
            />
          </View>
        )}

        {/* ── OTHER ── */}
        {category === "Other" && (
          <View style={styles.card} onLayout={(e) => { formSectionYRef.current = e.nativeEvent.layout.y; }}>
            <View style={[styles.cardTitleRow, { borderLeftColor: "#64748B" }]}>
              <Text style={styles.cardTitle}>📦 અન્ય ખર્ચ</Text>
            </View>
            <SectionLabel text="રકમ *" />
            <NumericInput
              value={otherAmount}
              onChange={setOtherAmount}
              placeholder="0"
              prefix="₹"
              onFocus={scrollToForm}
            />
            <SectionLabel text="વિવરણ (ઐચ્છિક)" />
            <TextInput
              style={styles.notesInput}
              value={otherDescription}
              onChangeText={setOtherDescription}
              placeholder="દા.ત. ઘર બાંધકામ, સાધન ખરીદી..."
              placeholderTextColor="#5B6570"
              onFocus={scrollToForm}
            />
          </View>
        )}

        {/* ── Notes ── */}
        {category !== "" && (
          <View style={[styles.card, { marginTop: 4 }]}>
            <View
              style={[styles.cardTitleRow, { borderLeftColor: C.textMuted }]}
            >
              <Text style={styles.cardTitle}>📝 નોંધ</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="વધારાની માહિતી..."
              placeholderTextColor="#5B6570"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        )}

        <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {/* ── Bottom bar (hidden for general expense) ── */}
      {!isGeneralExpense && (
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
      )}
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
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 15, color: C.textSecondary, marginTop: 2 },

  scroll: { padding: CAT_GRID_PAD },
  yearCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  yearLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 10,
  },
  yearRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  yearPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  yearPillActive: {
    backgroundColor: C.green100,
    borderColor: C.green700,
  },
  yearPillText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textSecondary,
  },
  yearPillTextActive: {
    color: C.green700,
  },
  cropSelectCard: {
    backgroundColor: C.surfaceGreen,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  generalExpenseCard: {
    backgroundColor: C.surfaceGreen,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  generalExpenseTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 12,
  },
  generalExpenseNote: {
    fontSize: 17,
    color: C.textSecondary,
    lineHeight: 24,
  },
  generalExpenseInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.green50,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.green100,
  },
  generalExpenseInfoText: {
    flex: 1,
    fontSize: 15,
    color: C.textSecondary,
    lineHeight: 22,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 14,
  },

  // Category grid — 3 in first row, 2 in second (Labour, Machinery)
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CAT_GRID_GAP,
    marginBottom: 20,
  },
  catGridItem: {
    width: CAT_CARD_WIDTH,
  },
  catCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.borderLight,
    backgroundColor: C.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  catCardInactive: {
    opacity: 0.72,
    backgroundColor: C.bg,
  },
  catCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  catCardLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: C.textPrimary,
    textAlign: "center",
  },
  catCardLabelInactive: {
    color: C.textMuted,
  },
  catCardCheck: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  catStrip: {
    marginBottom: 12,
  },
  catStripContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 16,
  },
  catStripChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    backgroundColor: C.surfaceGreen,
  },
  catStripLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textSecondary,
  },
  seedQtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  unitToggle: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  unitToggleBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: C.surfaceGreen,
  },
  unitToggleBtnActive: {
    backgroundColor: C.green700,
  },
  unitToggleText: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textSecondary,
  },
  unitToggleTextActive: {
    color: "#fff",
  },

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
  cardTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary },

  label: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 8,
    marginTop: 6,
  },

  // Select / dropdown — larger, dark text, farmer-friendly
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
  selectText: { fontSize: 19, color: C.textPrimary, fontWeight: "600" },
  dropList: {
    borderWidth: 1.5,
    borderColor: C.green100,
    borderRadius: 14,
    backgroundColor: C.surface,
    overflow: "hidden",
    marginTop: 6,
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  dropItemActive: { backgroundColor: C.green50 },
  dropItemText: { fontSize: 18, color: C.textPrimary, fontWeight: "600" },
  dropItemTextActive: { fontWeight: "800", color: C.green700 },

  // Numeric input — larger font, dark, easy to read
  numRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: C.surfaceGreen,
    marginBottom: 6,
  },
  numAffix: { fontSize: 18, color: C.textSecondary, marginHorizontal: 6, fontWeight: "700" },
  numInput: {
    flex: 1,
    fontSize: 20,
    color: C.textPrimary,
    paddingVertical: 14,
    fontWeight: "600",
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
  derivedText: { fontSize: 17, fontWeight: "700", color: C.green700 },

  totalBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.green50,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  totalLabel: { fontSize: 18, color: C.textPrimary, fontWeight: "700" },
  totalValue: { fontSize: 24, color: C.green700, fontWeight: "900" },

  // Info / warn notes — readable
  infoNote: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#E0F2FE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  infoNoteText: { fontSize: 16, color: "#0C4A6E", flex: 1, lineHeight: 22, fontWeight: "600" },
  warnNote: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  warnNoteText: { fontSize: 16, color: "#78350F", flex: 1, lineHeight: 22, fontWeight: "600" },

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
  toggleText: { fontSize: 18, fontWeight: "600", color: C.textSecondary },
  toggleTextActive: { fontSize: 18, fontWeight: "800", color: C.green700 },

  multiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  multiX: {
    fontSize: 20,
    color: C.textSecondary,
    fontWeight: "700",
    marginBottom: 4,
  },

  notesInput: {
    fontSize: 17,
    color: C.textPrimary,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 56,
    marginTop: 6,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
});

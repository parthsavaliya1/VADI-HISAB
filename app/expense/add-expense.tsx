import { AppBackButton } from "@/components/AppBackButton";
import { HEADER_PADDING_TOP } from "@/constants/theme";
import { useProfile } from "@/contexts/ProfileContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import {
  createExpense,
  getCrops,
  getCurrentFinancialYear,
  getExpenseById,
  getFinancialYearOptions,
  updateExpense,
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
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
import Toast from "react-native-toast-message";

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
  {
    value: "Seed",
    label: "બિયારણ",
    iconSet: "mci",
    iconName: "sprout",
    color: "#16A34A",
    pale: "#DCFCE7",
  },
  {
    value: "Fertilizer",
    label: "ખાતર",
    iconSet: "ionicons",
    iconName: "flask-outline",
    color: "#0891B2",
    pale: "#E0F2FE",
  },
  {
    value: "Pesticide",
    label: "જંતુનાશક",
    iconSet: "mci",
    iconName: "spray",
    color: "#DC2626",
    pale: "#FEE2E2",
  },
  {
    value: "Labour",
    label: "મજૂરી",
    iconSet: "ionicons",
    iconName: "people-outline",
    color: "#D97706",
    pale: "#FEF3C7",
  },
  {
    value: "Machinery",
    label: "ટ્રેક્ટર/મશીન",
    iconSet: "mci",
    iconName: "tractor-variant",
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
  { value: "BhagmaMajuri", label: "ભાગમા આપેલ પાક ની મજૂરી માટે" },
  { value: "Other", label: "અન્ય" },
];
const MACHINERY_IMPLEMENTS: { value: MachineryImplement; label: string }[] = [
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

// ખર્ચનો પ્રકાર / વિવરણ — અન્ય ખર્ચ માટે ડ્રોપડાઉન
const OTHER_EXPENSE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "light_bill", label: "લાઇટ બિલ" },
  { value: "sadhan_kharidi", label: "સાધન ખરીદી" },
  { value: "repairing", label: "મરામત" },
  { value: "maintenance", label: "જાળવણી / માંજણ" },
  { value: "other", label: "અન્ય" },
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
  Chomasu: "☔ ચોમાસું",
  Siyalo: "❄️ શિયાળો",
  Unalo: "☀️ ઉનાળો",
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
  const capitalized =
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  if (CROP_NAME_GUJ[capitalized]) return CROP_NAME_GUJ[capitalized];
  return trimmed;
}
function getCropDropdownLabel(c: Crop): string {
  const emoji = c.cropEmoji ?? "🌱";
  const name = cropDisplayNameGuj(c.cropName ?? "");
  const season = SEASON_DISPLAY[c.season ?? ""] ?? c.season ?? "—";
  const area = c.area != null ? String(Math.round(Number(c.area))) : "—";
  const unit = AREA_UNIT_GUJ[(c.areaUnit ?? "Bigha") as string] ?? "વીઘા";
  const bhagma =
    c.landType === "bhagma" && c.bhagmaPercentage != null
      ? ` · ભાગમા ${c.bhagmaPercentage}%`
      : "";
  return `${emoji} ${name} · ${season} · ${area} ${unit}${bhagma}`;
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
    Keyboard.dismiss();
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

// ─── NumericInput with forwardRef so parent can measure its exact position ────
const NumericInput = React.forwardRef<
  View,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    prefix?: string;
    suffix?: string;
    onFocus?: () => void;
  }
>(({ value, onChange, placeholder, prefix, suffix, onFocus }, ref) => {
  return (
    <View ref={ref} style={styles.numRow}>
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
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddExpense() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    cropId?: string;
    general?: string;
    year?: string;
    bhagyaUpad?: string;
  }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = !!editId;
  const paramCropId = Array.isArray(params.cropId)
    ? params.cropId[0]
    : params.cropId;
  const paramYear = Array.isArray(params.year) ? params.year[0] : params.year;
  const isGeneralExpense =
    (Array.isArray(params.general) ? params.general[0] : params.general) ===
    "1";
  const isBhagyaUpad =
    (Array.isArray(params.bhagyaUpad)
      ? params.bhagyaUpad[0]
      : params.bhagyaUpad) === "1";
  const { profile } = useProfile();
  const { refreshTransactions } = useRefresh();

  const yearOptions = getYearOptions();
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(
    () =>
      paramYear && yearOptions.includes(paramYear)
        ? paramYear
        : getCurrentFinancialYear(),
  );
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string | "">("");
  const [generalDescription, setGeneralDescription] = useState("");
  const [generalExpenseType, setGeneralExpenseType] = useState("");
  const [generalAmount, setGeneralAmount] = useState("");
  const cropId = selectedCropId || paramCropId || undefined;

  const selectedCrop = crops.find((c) => c._id === cropId);
  const isCropExpense = !isGeneralExpense && !!cropId;
  const isBhagmaCrop = selectedCrop?.landType === "bhagma";

  // ભાગ્યા નો ઉપાડ with bhagma crop: બિયારણ, ખાતર, જંતુનાશક, મજૂરી (exclude Machinery). Normal bhagma add expense: Seed, Fertilizer, Pesticide, Machinery (ટ્રેક્ટર), Irrigation, Other — only Labour excluded (મજૂરી ભાગ્યાના ખર્ચમાં).
  const visibleCategories = (() => {
    if (isGeneralExpense) return CATEGORIES;
    if (isBhagyaUpad)
      return isBhagmaCrop
        ? CATEGORIES.filter((c) => c.value !== "Machinery")
        : [];
    if (isBhagmaCrop)
      return CATEGORIES.filter((c) => c.value !== "Labour");
    return CATEGORIES;
  })();

  // Default date of entry (today). No date picker shown.
  const effectiveExpenseDate = new Date();

  // Order: Active (live) first, then Harvested, then Closed
  const cropStatusOrder = (s: string | undefined) =>
    s === "Active" ? 0 : s === "Harvested" ? 1 : s === "Closed" ? 2 : 0;
  useEffect(() => {
    if (!isGeneralExpense) {
      getCrops()
        .then((r) => {
          const list = [...(r.data ?? [])];
          list.sort(
            (a, b) => cropStatusOrder(a.status) - cropStatusOrder(b.status),
          );
          setCrops(list);
        })
        .catch(() => setCrops([]));
    }
  }, [isGeneralExpense]);

  useEffect(() => {
    if (paramCropId && !isGeneralExpense) setSelectedCropId(paramCropId);
  }, [paramCropId, isGeneralExpense]);

  const [fetchingEdit, setFetchingEdit] = useState(isEdit);

  // When editing: fetch expense and pre-fill form so user lands on the right screen without crop selection
  useEffect(() => {
    if (!isEdit || !editId) return;
    (async () => {
      try {
        const doc = await getExpenseById(editId);
        setCategory(doc.category as ExpenseCategory);
        if (!doc.cropId) {
          const notes = doc.notes ?? "";
          setGeneralDescription(notes);
          const match = OTHER_EXPENSE_TYPE_OPTIONS.find((o) => o.label === notes);
          setGeneralExpenseType(match ? match.value : (notes ? "other" : ""));
          setGeneralAmount(
            String(doc.labourContract?.amountGiven ?? doc.amount ?? ""),
          );
        } else {
          if (doc.seed) {
            setSeedType((doc.seed.seedType as SeedType) ?? "");
            setSeedQty(String(doc.seed.quantityKg ?? ""));
            setSeedUnitRate(
              doc.seed.quantityKg && doc.seed.totalCost
                ? String(Math.round(doc.seed.totalCost / doc.seed.quantityKg))
                : "",
            );
          }
          if (doc.fertilizer) {
            setFertProduct(
              (doc.fertilizer.productName as FertilizerProduct) ?? "",
            );
            setFertBags(String(doc.fertilizer.numberOfBags ?? ""));
            setFertUnitCost(
              doc.fertilizer.numberOfBags && doc.fertilizer.totalCost
                ? String(
                    (
                      doc.fertilizer.totalCost / doc.fertilizer.numberOfBags
                    ).toFixed(0),
                  )
                : "",
            );
          }
          if (doc.pesticide) {
            setPestCategory(
              (doc.pesticide.category as PesticideCategory) ?? "",
            );
            setPestDosage(String(doc.pesticide.dosageML ?? ""));
            setPestCost(String(doc.pesticide.cost ?? ""));
          }
          if (doc.labourDaily) {
            setLabourMode("Daily");
            setLabourTask((doc.labourDaily.task as LabourTask) ?? "");
            setLabourPeople(String(doc.labourDaily.numberOfPeople ?? ""));
            setLabourDays(String(doc.labourDaily.days ?? ""));
            setLabourRate(String(doc.labourDaily.dailyRate ?? ""));
          }
          if (doc.labourContract) {
            setLabourMode("Contract");
            setAdvanceReason(
              (doc.labourContract.advanceReason as AdvanceReason) ?? "",
            );
            setAdvanceAmount(String(doc.labourContract.amountGiven ?? ""));
            if (doc.labourContract.sharingType)
              setSharingType(doc.labourContract.sharingType as SharingOption);
            if (doc.labourContract.sharingCustom != null)
              setSharingCustom(String(doc.labourContract.sharingCustom));
          }
          if (doc.machinery) {
            setMachineImpl(
              (doc.machinery.implement as MachineryImplement) ?? "",
            );
            setMachineQty(String(doc.machinery.hoursOrAcres ?? ""));
            setMachineRate(String(doc.machinery.rate ?? ""));
          }
          if (doc.irrigation?.amount != null)
            setIrrigationAmount(String(doc.irrigation.amount));
          if (doc.other) {
            setOtherAmount(String(doc.other.totalAmount ?? ""));
            const desc = doc.other.description ?? "";
            const match = OTHER_EXPENSE_TYPE_OPTIONS.find((o) => o.label === desc);
            setOtherExpenseType(match ? match.value : (desc ? "other" : ""));
            setOtherDescription(desc);
          }
        }
      } catch (e) {
        Alert.alert("ભૂલ", (e as Error).message ?? "ડેટા લોડ ન થઈ શક્યો");
        router.back();
      } finally {
        setFetchingEdit(false);
      }
    })();
  }, [isEdit, editId]);

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
    fertBags &&
    fertUnitCost &&
    Number(fertBags) > 0 &&
    Number(fertUnitCost) >= 0
      ? Number(fertBags) * Number(fertUnitCost)
      : null;
  const [pestCategory, setPestCategory] = useState<PesticideCategory | "">("");
  const [pestDosage, setPestDosage] = useState("");
  const [pestCost, setPestCost] = useState("");
  const [labourMode, setLabourMode] = useState<"Daily" | "Contract">("Daily");

  // Labour form follows crop: bhagma → ભાગમા (advance/medical); non-bhagma → દૈનિક મજૂર (daily labour cost)
  useEffect(() => {
    if (category === "Labour") {
      setLabourMode(isBhagmaCrop ? "Contract" : "Daily");
    }
  }, [category, isBhagmaCrop]);

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
  const persistSharing = useCallback(
    (type: SharingOption | "", custom: string) => {
      if (!type) return;
      AsyncStorage.setItem(
        BHAGMA_SHARING_KEY,
        JSON.stringify({
          sharingType: type,
          ...(type === "custom" && custom !== ""
            ? { sharingCustom: custom }
            : {}),
        }),
      );
    },
    [],
  );
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
  const [machineUnitType, setMachineUnitType] = useState<"hour" | "vigha">(
    "vigha",
  );
  const [machineQty, setMachineQty] = useState("");
  const [machineRate, setMachineRate] = useState("");
  const [irrigationAmount, setIrrigationAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [otherExpenseType, setOtherExpenseType] = useState<string>("");
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
      ? String(Math.round(Number(seedCost) / seedQuantityKg))
      : null;

  // ─── Keyboard-aware scroll ─────────────────────────────────────────────────
  // Each input gets its own ref. On focus we use measureLayout (relative to the
  // ScrollView) to find the exact field position and scroll it into view above
  // the keyboard — no hardcoded offsets, works on every screen size.
  const scrollRef = useRef<ScrollView>(null);
  const needScrollToCategoryRef = useRef(!!paramCropId && !isGeneralExpense && !isEdit);
  const categorySectionLayoutY = useRef(0);
  const keyboardHeight = useKeyboardHeight();
  const keyboardHeightRef = useRef(keyboardHeight);
  useEffect(() => {
    keyboardHeightRef.current = keyboardHeight;
  }, [keyboardHeight]);

  const makeOnFocus = useCallback(
    (fieldRef: React.RefObject<View | null>) => () => {
      if (!fieldRef.current || !scrollRef.current) return;
      setTimeout(() => {
        fieldRef.current?.measureLayout(
          // @ts-ignore
          scrollRef.current,
          (_left: number, top: number, _width: number, height: number) => {
            const kbH = keyboardHeightRef.current || 300;
            const windowH = Dimensions.get("window").height;
            // Visible height above keyboard minus the bottom save bar (~80 px)
            const visibleH = windowH - kbH - 80;
            // Place the focused field at 40% from the top of the visible area
            const targetScroll = Math.max(0, top - visibleH * 0.4);
            scrollRef.current?.scrollTo({ y: targetScroll, animated: true });
          },
          () => {
            scrollRef.current?.scrollToEnd({ animated: true });
          },
        );
      }, 300);
    },
    [],
  );

  // ── Per-field refs ──────────────────────────────────────────────────────────
  const seedQtyRef = useRef<View>(null);
  const seedRateRef = useRef<View>(null);
  const fertBagsRef = useRef<View>(null);
  const fertUnitCostRef = useRef<View>(null);
  const pestDosageRef = useRef<View>(null);
  const pestCostRef = useRef<View>(null);
  const labourPeopleRef = useRef<View>(null);
  const labourDaysRef = useRef<View>(null);
  const labourRateRef = useRef<View>(null);
  const advanceAmountRef = useRef<View>(null);
  const sharingCustomRef = useRef<View>(null);
  const machineQtyRef = useRef<View>(null);
  const machineRateRef = useRef<View>(null);
  const irrigationRef = useRef<View>(null);
  const otherAmountRef = useRef<View>(null);
  const otherDescRef = useRef<View>(null);
  const generalAmountRef = useRef<View>(null);
  const generalDescRef = useRef<View>(null);

  const validate = (): string | null => {
    if (isGeneralExpense) {
      if (!generalExpenseType && !generalDescription.trim())
        return "ખર્ચનો પ્રકાર પસંદ કરો અથવા વિવરણ લખો.";
      if (!generalAmount || Number(generalAmount) <= 0)
        return "ખર્ચની રકમ દાખલ કરો.";
      return null;
    }
    if (!cropId)
      return "કૃપા કરીને પાક પસંદ કરો અથવા સામાન્ય ખર્ચ માટે કોઈ પાક પસંદ કરો.";
    if (!category) return "કૃપા કરીને ખર્ચ પ્રકાર પસંદ કરો.";
    if (category === "Seed") {
      if (!seedType) return "બિયારણ પ્રકાર જરૂરી છે.";
      if (!seedQty || Number(seedQty) <= 0) return "જથ્થો દાખલ કરો.";
      if (!seedUnitRate || Number(seedUnitRate) < 0)
        return "દર (પ્રતિ એકમ) દાખલ કરો.";
    }
    if (category === "Fertilizer") {
      if (!fertProduct) return "ઉત્પાદનનું નામ જરૂરી છે.";
      if (!fertBags || Number(fertBags) <= 0) return "બૅગ સંખ્યા દાખલ કરો.";
      if (!fertUnitCost || Number(fertUnitCost) < 0)
        return "દર દર બૅગ દાખલ કરો.";
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
      if (!irrigationAmount || Number(irrigationAmount) <= 0)
        return "સિંચાઈ ખર્ચની રકમ દાખલ કરો.";
    }
    if (category === "Other") {
      if (!otherAmount || Number(otherAmount) <= 0)
        return "ખર્ચની રકમ દાખલ કરો.";
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
      const generalPayload = {
        cropId: null,
        category: "Labour" as const,
        expenseSource: "generalExpense" as const,
        date: effectiveExpenseDate.toISOString(),
        notes:
          generalExpenseType === "other"
            ? generalDescription.trim()
            : (OTHER_EXPENSE_TYPE_OPTIONS.find((o) => o.value === generalExpenseType)?.label ??
              generalDescription.trim()),
        labourContract: {
          advanceReason: "Other" as const,
          amountGiven: Number(generalAmount),
          sourceTag: "generalExpense" as const,
        },
      };
      const cropPayload = {
        cropId: cropId as string,
        category: category as ExpenseCategory,
        expenseSource: isBhagyaUpad
          ? ("bhagyaUpad" as const)
          : ("cropExpense" as const),
        date: effectiveExpenseDate.toISOString(),
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
                ...(sharingType === "custom" &&
                  sharingCustom !== "" && {
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
          other: {
            totalAmount: Number(otherAmount),
            description:
              otherExpenseType === "other"
                ? (otherDescription.trim() || undefined)
                : (OTHER_EXPENSE_TYPE_OPTIONS.find((o) => o.value === otherExpenseType)?.label ?? (otherDescription.trim() || undefined)),
          },
        }),
      };

      if (isGeneralExpense) {
        if (isEdit) await updateExpense(editId!, generalPayload);
        else await createExpense(generalPayload);
        refreshTransactions();
        Toast.show({
          type: "success",
          text1: "સફળ!",
          text2: isEdit ? "ફેરફાર સાચવ્યો." : "સામાન્ય ખર્ચ સાચવ્યો.",
        });
        if (isEdit) router.back();
        if (!isEdit) {
          setGeneralDescription("");
          setGeneralExpenseType("");
          setGeneralAmount("");
        }
        return;
      }
      if (isEdit) await updateExpense(editId!, cropPayload);
      else await createExpense(cropPayload);
      refreshTransactions();
      Toast.show({
        type: "success",
        text1: "સફળ!",
        text2: isEdit ? "ખર્ચમાં ફેરફાર સાચવ્યો!" : "ખર્ચ સફળતાપૂર્વક ઉમેરાયો!",
      });
      if (isEdit) router.back();
      if (!isEdit) {
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
        setIrrigationAmount("");
        setOtherAmount("");
        setOtherDescription("");
      }
    } catch (error: any) {
      Alert.alert("❌ ભૂલ", error?.message ?? "કંઈક ખોટું થયું.");
    } finally {
      setSaving(false);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.value === category);
  const paddingTop = HEADER_PADDING_TOP;

  if (fetchingEdit) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.green700} />
        <Text style={{ marginTop: 12, fontSize: 16, color: C.textMuted }}>
          લોડ થઈ રહ્યું છે...
        </Text>
      </View>
    );
  }

  return (
    // FIX 1: behavior="padding" on both platforms shrinks the scroll area
    // correctly when the keyboard appears (instead of "height" which is buggy
    // on Android and doesn't account for the bottom save bar).
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
          <AppBackButton
            onPress={() => router.back()}
            iconColor={C.green700}
            backgroundColor={C.surface}
            borderColor={C.green100}
          />
          <View style={{ alignItems: "center" }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {isGeneralExpense ? (
                <Text style={styles.headerTitle}>સામાન્ય ખર્ચ</Text>
              ) : isBhagyaUpad ? (
                <Text style={styles.headerTitle}>ભાગ્યા નો ઉપાડ</Text>
              ) : activeCat ? (
                <>
                  <View
                    style={[
                      styles.headerIconWrap,
                      { backgroundColor: activeCat.pale },
                    ]}
                  >
                    {activeCat.iconSet === "mci" ? (
                      <MaterialCommunityIcons
                        name={activeCat.iconName as any}
                        size={20}
                        color={activeCat.color}
                      />
                    ) : (
                      <Ionicons
                        name={activeCat.iconName as any}
                        size={20}
                        color={activeCat.color}
                      />
                    )}
                  </View>
                  <Text style={styles.headerTitle}>{activeCat.label} ખર્ચ</Text>
                </>
              ) : (
                <Text style={styles.headerTitle}>ખર્ચ ઉમેરો</Text>
              )}
            </View>
            {selectedCrop?.landType === "bhagma" &&
              selectedCrop?.bhagmaPercentage != null && (
                <View
                  style={[
                    styles.bhagmaBadge,
                    { backgroundColor: C.expensePale },
                  ]}
                >
                  <Text style={[styles.bhagmaBadgeText, { color: C.expense }]}>
                    ભાગમા {selectedCrop.bhagmaPercentage}%
                  </Text>
                </View>
              )}
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: C.bg }}
        // FIX 2: static 140px bottom padding — enough room for the save bar.
        // No longer driven by keyboardHeight (that caused fields to jump).
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* ── Financial year selector only for general expense; for crop expense year comes from crop ── */}
        {isGeneralExpense ? (
          <View style={styles.yearCard}>
            <Text style={styles.yearLabel}>વર્ષ પસંદ કરો (જૂન–મે)</Text>
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
                    <Text
                      style={[
                        styles.yearPillText,
                        active && styles.yearPillTextActive,
                      ]}
                    >
                      {fy}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : isCropExpense && selectedCrop?.year ? (
          <View style={styles.yearCard}>
            <Text style={styles.yearLabel}>પાકનું વર્ષ (જૂન–મે)</Text>
            <Text style={styles.cropYearText}>{selectedCrop.year}</Text>
          </View>
        ) : null}

        {/* ── General expense: description + amount — not linked to any crop; no crop required ── */}
        {isGeneralExpense ? (
          <View style={styles.card}>
            <View style={styles.generalExpenseInfo}>
              <Ionicons
                name="information-circle"
                size={18}
                color={C.green700}
              />
              <Text style={styles.generalExpenseInfoText}>
                આ ખર્ચ કોઈ પાક સાથે લિંક નથી. વાર્ષિક ફાર્મ વિકાસ, સાધન ખરીદી
                વગેરે — અહેવાલમાં કુલ ખર્ચમાં ગણાશે.
              </Text>
            </View>
            <SectionLabel text="ખર્ચનો પ્રકાર / વિવરણ" />
            <SelectPicker
              options={OTHER_EXPENSE_TYPE_OPTIONS}
              selected={generalExpenseType}
              onSelect={(v) => {
                setGeneralExpenseType(v);
                if (v !== "other") {
                  const opt = OTHER_EXPENSE_TYPE_OPTIONS.find((o) => o.value === v);
                  setGeneralDescription(opt?.label ?? "");
                } else {
                  setGeneralDescription("");
                }
              }}
              placeholder="પસંદ કરો..."
            />
            <Text style={styles.optionalNote}>
              નોંધ: દરેક પ્રકાર માટે વિવરણ દાખલ કરવું ઐચ્છિક છે (જરૂરી નથી).
            </Text>
            {generalExpenseType === "other" ? (
              <View ref={generalDescRef}>
                <Text style={styles.label}>વિવરણ (ઐચ્છિક)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={generalDescription}
                  onChangeText={setGeneralDescription}
                  placeholder="દા.ત. ફાર્મ વિકાસ, ભાડું..."
                  placeholderTextColor="#5B6570"
                  multiline
                  onFocus={makeOnFocus(generalDescRef)}
                />
              </View>
            ) : null}
            <SectionLabel text="ખર્ચ રકમ" />
            <NumericInput
              ref={generalAmountRef}
              value={generalAmount}
              onChange={setGeneralAmount}
              placeholder="0"
              prefix=""
              onFocus={makeOnFocus(generalAmountRef)}
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={
                saving ||
                (!generalExpenseType && !generalDescription.trim()) ||
                !generalAmount ||
                Number(generalAmount) <= 0
              }
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
            {/* ── Crop dropdown: hidden in edit mode (only change data entry: bags, amount, etc.) ── */}
            {!isEdit && (
              <View style={styles.cropSelectCard}>
                <SectionLabel
                  text={isBhagyaUpad ? "ભાગમા પાક પસંદ કરો" : "પાક પસંદ કરો"}
                />
                {(isBhagyaUpad
                  ? crops.filter((c) => c.landType === "bhagma")
                  : crops
                ).length > 0 ? (
                  <SelectPicker
                    options={(isBhagyaUpad
                      ? crops.filter((c) => c.landType === "bhagma")
                      : crops
                    ).map((c) => ({
                      value: c._id,
                      label: getCropDropdownLabel(c),
                    }))}
                    selected={cropId ?? ""}
                    onSelect={(id) => setSelectedCropId(id)}
                    placeholder={
                      isBhagyaUpad
                        ? "ભાગમા પાક પસંદ કરો..."
                        : "આ ખર્ચ કયા પાક માટે?"
                    }
                  />
                ) : (
                  <Text style={styles.generalExpenseNote}>
                    {isBhagyaUpad
                      ? "કોઈ ભાગમા પાક નથી — પહેલા ડેશબોર્ડથી ભાગમા પાક ઉમેરો."
                      : "કોઈ પાક નથી — પહેલા ડેશબોર્ડથી પાક ઉમેરો."}
                  </Text>
                )}
              </View>
            )}

            {/* ── Category: hidden in edit mode; when edit only show data form (bags, amount, etc.) ── */}
            {!isEdit && category === "" ? (
              <>
                {visibleCategories.length > 0 && (
                  <View
                    onLayout={(e) => {
                      const { y } = e.nativeEvent.layout;
                      categorySectionLayoutY.current = y;
                      if (
                        needScrollToCategoryRef.current &&
                        scrollRef.current &&
                        isCropExpense &&
                        cropId
                      ) {
                        needScrollToCategoryRef.current = false;
                        setTimeout(() => {
                          scrollRef.current?.scrollTo({
                            y: Math.max(0, y - 24),
                            animated: true,
                          });
                        }, 100);
                      }
                    }}
                  >
                    <Text style={styles.sectionTitle}>ખર્ચ પ્રકાર પસંદ કરો</Text>
                  </View>
                )}
                {isBhagyaUpad && !isBhagmaCrop && (
                  <View
                    style={[
                      styles.card,
                      {
                        marginBottom: 16,
                        backgroundColor: "#FFF8E1",
                        borderColor: "#F9A825",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.generalExpenseInfoText,
                        { color: "#92400E" },
                      ]}
                    >
                      ભાગ્યા નો ઉપાડ ફક્ત ભાગમા પાક માટે છે. ઉપરથી ભાગમા પાક
                      પસંદ કરો.
                    </Text>
                  </View>
                )}
                {visibleCategories.length > 0 && (
                  <View style={styles.catGrid}>
                    {visibleCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.value}
                        onPress={() => setCategory(cat.value)}
                        activeOpacity={0.85}
                        style={styles.catGridItem}
                      >
                        <View
                          style={[
                            styles.catCard,
                            { borderColor: C.borderLight },
                          ]}
                        >
                          <View
                            style={[
                              styles.catCardIconWrap,
                              { backgroundColor: cat.pale },
                            ]}
                          >
                            {cat.iconSet === "mci" ? (
                              <MaterialCommunityIcons
                                name={cat.iconName as any}
                                size={28}
                                color={cat.color}
                              />
                            ) : (
                              <Ionicons
                                name={cat.iconName as any}
                                size={28}
                                color={cat.color}
                              />
                            )}
                          </View>
                          <Text style={styles.catCardLabel} numberOfLines={2}>
                            {cat.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {isBhagmaCrop && !isBhagyaUpad && (
                  <View
                    style={[
                      styles.card,
                      {
                        marginTop: 12,
                        marginBottom: 8,
                        backgroundColor: "#FFF8E1",
                        borderColor: "#F59E0B",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.generalExpenseInfoText,
                        { color: "#92400E", fontSize: 14 },
                      ]}
                    >
                      આ પાક ભાગમા આપેલો હોવાથી બધી મજૂરી ભાગ્યા ને ભોગવણી છે એટલે મજૂરી ખર્ચ તમારે ભાગ્યાના ઉપાડ માં એન્ટ્રી મારવાની.{"\n"}
                      અહીં ઉમેરેલ બધા ખર્ચ તમારામાં ગણાશે.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              !isEdit && (
                <View style={styles.catStrip}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.catStripContent}
                  >
                    {visibleCategories.map((cat) => {
                      const active = category === cat.value;
                      return (
                        <TouchableOpacity
                          key={cat.value}
                          onPress={() => setCategory(cat.value)}
                          activeOpacity={0.8}
                          style={[
                            styles.catStripChip,
                            active && {
                              backgroundColor: cat.pale,
                              borderColor: cat.color,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catStripLabel,
                              active && { color: cat.color, fontWeight: "800" },
                            ]}
                            numberOfLines={1}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )
            )}

            {/* ── SEED ── */}
            {category === "Seed" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#16A34A" }]}
                >
                  <Text style={styles.cardTitle}>🌱 બિયારણ ખર્ચ</Text>
                </View>
                <SectionLabel text="બિયારણ પ્રકાર" />
                <SelectPicker
                  options={SEED_TYPES}
                  selected={seedType}
                  onSelect={setSeedType}
                  placeholder="પ્રકાર પસંદ કરો..."
                />
                <SectionLabel text="જથ્થો (૧ મણ = ૨૦ કિ.ગ્રા.)" />
                <View style={styles.seedQtyRow}>
                  <View style={{ flex: 1 }}>
                    <NumericInput
                      ref={seedQtyRef}
                      value={seedQty}
                      onChange={setSeedQty}
                      placeholder="0"
                      onFocus={makeOnFocus(seedQtyRef)}
                    />
                  </View>

                  <View style={styles.unitToggle}>
                    <TouchableOpacity
                      style={[
                        styles.unitToggleBtn,
                        seedQtyUnit === "man" && styles.unitToggleBtnActive,
                      ]}
                      onPress={() => setSeedQtyUnit("man")}
                    >
                      <Text
                        style={[
                          styles.unitToggleText,
                          seedQtyUnit === "man" && styles.unitToggleTextActive,
                        ]}
                      >
                        મણ
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitToggleBtn,
                        seedQtyUnit === "kg" && styles.unitToggleBtnActive,
                      ]}
                      onPress={() => setSeedQtyUnit("kg")}
                    >
                      <Text
                        style={[
                          styles.unitToggleText,
                          seedQtyUnit === "kg" && styles.unitToggleTextActive,
                        ]}
                      >
                        કિ.ગ્રા.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <SectionLabel
                  text={`દર (પ્રતિ ${seedQtyUnit === "man" ? "મણ" : "કિ.ગ્રા."})`}
                />
                <NumericInput
                  ref={seedRateRef}
                  value={seedUnitRate}
                  onChange={setSeedUnitRate}
                  placeholder="0"
                  prefix=""
                  onFocus={makeOnFocus(seedRateRef)}
                />
                {Number(seedQty) > 0 && Number(seedUnitRate) >= 0 && (
                  <View style={styles.derivedBox}>
                    <Ionicons name="calculator" size={16} color={C.green700} />
                    <Text style={styles.derivedText}>
                      કુલ ખર્ચ:{" "}
                      {Math.round(Number(seedCost)).toLocaleString("en-IN")}
                      {seedRatePerKg &&
                        ` · દર ${Math.round(Number(seedRatePerKg))}/કિ.ગ્રા.`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── FERTILIZER ── */}
            {category === "Fertilizer" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#0891B2" }]}
                >
                  <Text style={styles.cardTitle}>🧪 ખાતર ખર્ચ</Text>
                </View>
                <SectionLabel text="ઉત્પાદન" />
                <SelectPicker
                  options={FERTILIZER_PRODUCTS}
                  selected={fertProduct}
                  onSelect={setFertProduct}
                  placeholder="ખાતર પસંદ કરો..."
                />
                <SectionLabel text="બૅગ સંખ્યા" />
                <NumericInput
                  ref={fertBagsRef}
                  value={fertBags}
                  onChange={setFertBags}
                  placeholder="0"
                  suffix="બૅગ"
                  onFocus={makeOnFocus(fertBagsRef)}
                />
                <SectionLabel text="દર દર બૅગ" />
                <NumericInput
                  ref={fertUnitCostRef}
                  value={fertUnitCost}
                  onChange={setFertUnitCost}
                  placeholder="0"
                  prefix=""
                  onFocus={makeOnFocus(fertUnitCostRef)}
                />
                {fertTotal !== null && fertTotal >= 0 && (
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>કુલ = બૅગ × દર</Text>
                    <Text style={styles.totalValue}>
                      {Math.round(fertTotal).toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── PESTICIDE ── */}
            {category === "Pesticide" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#DC2626" }]}
                >
                  <Text style={styles.cardTitle}>🧴 જંતુનાશક ખર્ચ</Text>
                </View>
                <View style={styles.infoNote}>
                  <Ionicons
                    name="information-circle"
                    size={14}
                    color="#0891B2"
                  />
                  <Text style={styles.infoNoteText}>
                    અહીં ફક્ત આર્થિક માહિતી નોંધો.
                  </Text>
                </View>
                <SectionLabel text="પ્રકાર" />
                <SelectPicker
                  options={PESTICIDE_CATEGORIES}
                  selected={pestCategory}
                  onSelect={setPestCategory}
                  placeholder="પ્રકાર પસંદ કરો..."
                />
                <SectionLabel text="જથ્થો (ml/લિ.)" />
                <NumericInput
                  ref={pestDosageRef}
                  value={pestDosage}
                  onChange={setPestDosage}
                  placeholder="0"
                  suffix="ml"
                  onFocus={makeOnFocus(pestDosageRef)}
                />
                <SectionLabel text="ખર્ચ" />
                <NumericInput
                  ref={pestCostRef}
                  value={pestCost}
                  onChange={setPestCost}
                  placeholder="0"
                  prefix=""
                  onFocus={makeOnFocus(pestCostRef)}
                />
              </View>
            )}

            {/* ── LABOUR (મજૂરી): bhagma crop → ભાગમા (advance/medical). Non-bhagma → દૈનિક મજૂર (daily labour cost). ── */}
            {category === "Labour" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#D97706" }]}
                >
                  <Text style={styles.cardTitle}>
                    👷 મજૂરી ખર્ચ{" "}
                    {isBhagmaCrop ? "(ભાગમા / અગ્રિમ)" : "(દૈનિક મજૂર)"}
                  </Text>
                </View>
                {isBhagmaCrop ? (
                  <>
                    <SectionLabel text="શેરિંગ (ભાગમા વિભાજન)" />
                    <SelectPicker
                      options={SHARING_OPTIONS}
                      selected={sharingType}
                      onSelect={(v) =>
                        handleSharingSelect(v as SharingOption | "")
                      }
                      placeholder="શેરિંગ પસંદ કરો..."
                    />
                    {sharingType === "custom" && (
                      <>
                        <SectionLabel text="ટકા દાખલ કરો (0–100)" />
                        <NumericInput
                          ref={sharingCustomRef}
                          value={sharingCustom}
                          onChange={handleSharingCustomChange}
                          placeholder="ઉદા. 40"
                          onFocus={makeOnFocus(sharingCustomRef)}
                        />
                      </>
                    )}
                    <View style={styles.warnNote}>
                      <Ionicons name="warning" size={14} color="#D97706" />
                      <Text style={styles.warnNoteText}>
                        આ રકમ ખેત ખર્ચ નથી — ભવિષ્યની જવાબદારી સામે ડેબિટ છે.
                      </Text>
                    </View>
                    <SectionLabel text="ઍડ્વાન્સ કારણ" />
                    <SelectPicker
                      options={ADVANCE_REASONS}
                      selected={advanceReason}
                      onSelect={setAdvanceReason}
                      placeholder="કારણ પસંદ કરો..."
                    />
                    <SectionLabel text="આપેલ રકમ" />
                    <NumericInput
                      ref={advanceAmountRef}
                      value={advanceAmount}
                      onChange={setAdvanceAmount}
                      placeholder="0"
                      prefix=""
                      onFocus={makeOnFocus(advanceAmountRef)}
                    />
                  </>
                ) : (
                  <>
                    <SectionLabel text="કામ પ્રકાર" />
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
                          ref={labourPeopleRef}
                          value={labourPeople}
                          onChange={setLabourPeople}
                          placeholder="લોકો"
                          onFocus={makeOnFocus(labourPeopleRef)}
                        />
                      </View>
                      <Text style={styles.multiX}>×</Text>
                      <View style={{ flex: 1 }}>
                        <NumericInput
                          ref={labourDaysRef}
                          value={labourDays}
                          onChange={setLabourDays}
                          placeholder="દિવસ"
                          onFocus={makeOnFocus(labourDaysRef)}
                        />
                      </View>
                    </View>
                    <SectionLabel text="દૈનિક દર" />
                    <NumericInput
                      ref={labourRateRef}
                      value={labourRate}
                      onChange={setLabourRate}
                      placeholder="0"
                      prefix=""
                      onFocus={makeOnFocus(labourRateRef)}
                    />
                    {labourTotal !== null && (
                      <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>કુલ =</Text>
                        <Text style={styles.totalValue}>
                          {Math.round(labourTotal).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* ── MACHINERY ── */}
            {category === "Machinery" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#7C3AED" }]}
                >
                  <Text style={styles.cardTitle}>🚜 ટ્રેક્ટર ભાડું</Text>
                </View>
                <SectionLabel text="ઓજાર / હળ" />
                <SelectPicker
                  options={MACHINERY_IMPLEMENTS}
                  selected={machineImpl}
                  onSelect={setMachineImpl}
                  placeholder="હળ અથવા ઓજાર પસંદ કરો..."
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
                <SectionLabel
                  text={machineUnitType === "vigha" ? "વીઘા" : "કલાક"}
                />
                <NumericInput
                  ref={machineQtyRef}
                  value={machineQty}
                  onChange={setMachineQty}
                  placeholder="0"
                  suffix={machineUnitType === "vigha" ? "વીઘા" : "કલાક"}
                  onFocus={makeOnFocus(machineQtyRef)}
                />
                <SectionLabel text="દર" />
                <NumericInput
                  ref={machineRateRef}
                  value={machineRate}
                  onChange={setMachineRate}
                  placeholder="0"
                  prefix=""
                  onFocus={makeOnFocus(machineRateRef)}
                />
                {machineTotal !== null && (
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>
                      કુલ = {machineUnitType === "vigha" ? "વીઘા" : "કલાક"} × દર
                    </Text>
                    <Text style={styles.totalValue}>
                      {Math.round(machineTotal).toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── IRRIGATION ── */}
            {category === "Irrigation" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#0284C7" }]}
                >
                  <Text style={styles.cardTitle}>💧 સિંચાઈ ખર્ચ</Text>
                </View>
                <SectionLabel text="રકમ" />
                <NumericInput
                  ref={irrigationRef}
                  value={irrigationAmount}
                  onChange={setIrrigationAmount}
                  placeholder="0"
                  onFocus={makeOnFocus(irrigationRef)}
                />
              </View>
            )}

            {/* ── OTHER ── */}
            {category === "Other" && (
              <View style={styles.card}>
                <View
                  style={[styles.cardTitleRow, { borderLeftColor: "#64748B" }]}
                >
                  <Text style={styles.cardTitle}>📦 અન્ય ખર્ચ</Text>
                </View>
                <SectionLabel text="ખર્ચનો પ્રકાર / વિવરણ" />
                <SelectPicker
                  options={OTHER_EXPENSE_TYPE_OPTIONS}
                  selected={otherExpenseType}
                  onSelect={(v) => {
                    setOtherExpenseType(v);
                    if (v !== "other") {
                      const opt = OTHER_EXPENSE_TYPE_OPTIONS.find((o) => o.value === v);
                      setOtherDescription(opt?.label ?? "");
                    } else {
                      setOtherDescription("");
                    }
                  }}
                  placeholder="પસંદ કરો..."
                />
                <Text style={styles.optionalNote}>
                  નોંધ: દરેક પ્રકાર માટે વિવરણ દાખલ કરવું ઐચ્છિક છે (જરૂરી નથી).
                </Text>
                <SectionLabel text="રકમ" />
                <NumericInput
                  ref={otherAmountRef}
                  value={otherAmount}
                  onChange={setOtherAmount}
                  placeholder="0"
                  onFocus={makeOnFocus(otherAmountRef)}
                />
                {otherExpenseType === "other" ? (
                  <>
                    <SectionLabel text="વિવરણ (ઐચ્છિક)" />
                    <View ref={otherDescRef}>
                      <TextInput
                        style={styles.notesInput}
                        value={otherDescription}
                        onChangeText={setOtherDescription}
                        placeholder="દા.ત. ઘર બાંધકામ..."
                        placeholderTextColor="#5B6570"
                        onFocus={makeOnFocus(otherDescRef)}
                      />
                    </View>
                  </>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Bottom bar (hidden for general expense) ── */}
      {!isGeneralExpense && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: (Platform.OS === "ios" ? 24 : 16) + insets.bottom },
          ]}
        >
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={
                saving ? ["#9CA3AF", "#6B7280"] : [C.green700, C.green500]
              }
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
  headerTitle: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 16, color: C.textSecondary, marginTop: 2 },
  bhagmaBadge: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: "center",
  },
  bhagmaBadgeText: { fontSize: 13, fontWeight: "700" },

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
    fontSize: 19,
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
    fontSize: 19,
    fontWeight: "700",
    color: C.textSecondary,
  },
  yearPillTextActive: {
    color: C.green700,
  },
  cropYearText: {
    fontSize: 20,
    fontWeight: "800",
    color: C.green700,
  },
  yearRowWithDate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInCorner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateValue: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPrimary,
  },
  calendarIconBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
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
  optionalNote: {
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 16,
    fontStyle: "italic",
  },
  sectionTitle: {
    fontSize: 22,
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
    fontSize: 18,
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
  cardTitle: { fontSize: 21, fontWeight: "800", color: C.textPrimary },

  label: {
    fontSize: 20,
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
  selectText: { fontSize: 20, color: C.textPrimary, fontWeight: "600" },
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
  dropItemText: { fontSize: 19, color: C.textPrimary, fontWeight: "600" },
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
  numAffix: {
    fontSize: 20,
    color: C.textSecondary,
    marginHorizontal: 6,
    fontWeight: "700",
  },
  numInput: {
    flex: 1,
    fontSize: 22,
    color: C.textPrimary,
    paddingVertical: 16,
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
  infoNoteText: {
    fontSize: 16,
    color: "#0C4A6E",
    flex: 1,
    lineHeight: 22,
    fontWeight: "600",
  },
  warnNote: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  warnNoteText: {
    fontSize: 16,
    color: "#78350F",
    flex: 1,
    lineHeight: 22,
    fontWeight: "600",
  },

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
    fontSize: 19,
    color: C.textPrimary,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 56,
    marginTop: 6,
    backgroundColor: C.surfaceGreen,
  },

  // Bottom bar — normal flow (not absolute) so KeyboardAvoidingView works correctly
  bottomBar: {
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

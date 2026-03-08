/**
 * FILE: app/income/add-income.tsx  (Expo Router)
 *
 * ✅ Gujarati UI — consistent with add-expense screen
 * ✅ Uses API from @/utils/api (axios, token auto-attached)
 * ✅ cropId from route params → no crop name field
 * ✅ Add + Edit mode
 * ✅ All labels, errors, placeholders in Gujarati
 */

import {
  createIncome,
  getCrops,
  getCurrentFinancialYear,
  getFinancialYearOptions,
  getIncomeById,
  updateIncome,
  type Crop,
  type IncomeCategory,
  type IncomePayload,
} from "@/utils/api";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";

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
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Design tokens  (same as expense screen)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  bg: "#F5F7F2",
  surface: "#FFFFFF",
  green700: "#2E7D32",
  green500: "#4CAF50",
  green100: "#C8E6C9",
  green50: "#E8F5E9",
  greenMid: "#43A047",
  red: "#C62828",
  redPale: "#FFEBEE",
  border: "#D8E8D8",
  borderLight: "#EAF4EA",
  textPrimary: "#1A2E1C",
  textSecondary: "#3D5C40",
  textMuted: "#7A9B7E",
  gold: "#F9A825",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 Local Types  (IncomeCategory imported from api.ts)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CropSaleData {
  quantityKg: string;
  pricePerKg: string;
  buyerName: string;
  marketName: string;
}
interface SubsidyData {
  schemeType: string;
  amount: string;
  referenceNumber: string;
}
interface RentalIncomeData {
  assetType: string;
  rentedToName: string;
  hoursOrDays: string;
  ratePerUnit: string;
}
interface OtherIncomeData {
  source: string;
  amount: string;
  description: string;
}

type SubFormData =
  | CropSaleData
  | SubsidyData
  | RentalIncomeData
  | OtherIncomeData;

interface IncomeDocument {
  _id: string;
  category: IncomeCategory;
  date: string;
  notes: string;
  cropId?: string;
  cropSale?: Omit<CropSaleData, "quantityKg" | "pricePerKg"> & {
    quantityKg: number;
    pricePerKg: number;
    totalAmount?: number;
  };
  subsidy?: Omit<SubsidyData, "amount"> & { amount: number };
  rentalIncome?: Omit<RentalIncomeData, "hoursOrDays" | "ratePerUnit"> & {
    hoursOrDays: number;
    ratePerUnit: number;
    totalAmount?: number;
  };
  otherIncome?: Omit<OtherIncomeData, "amount"> & { amount: number };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🗂️ Static data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CATEGORIES: { value: IncomeCategory; label: string; emoji: string }[] = [
  { value: "Crop Sale", label: "પાક વેચાણ", emoji: "🌾" },
  { value: "Subsidy", label: "સબસિડી", emoji: "🏛️" },
  { value: "Rental Income", label: "ભાડાની આવક", emoji: "🚜" },
  { value: "Other", label: "અન્ય", emoji: "💼" },
];

const CATEGORY_FIELD_MAP: Record<IncomeCategory, string> = {
  "Crop Sale": "cropSale",
  Subsidy: "subsidy",
  "Rental Income": "rentalIncome",
  Other: "otherIncome",
};

const SCHEME_TYPES = [
  "PM-KISAN",
  "ફસલ વીમો (Fasal Bima)",
  "બીજ સબસિડી",
  "ખાતર સબસિડી",
  "સિંચાઈ સબસિડી",
  "ઉપકરણ સબસિડી",
  "અન્ય સરકારી યોજના",
];

const ASSET_TYPES = [
  "ટ્રેક્ટર",
  "રોટાવેટર",
  "થ્રેશર",
  "જમીન",
  "પાણીની મોટર",
  "અન્ય ઉપકરણ",
];

const OTHER_SOURCES = [
  "મજૂરી",
  "પશુ-પાલન",
  "ડેરી",
  "અંશ-સમય કામ",
  "લોન",
  "અન્ય",
];

const DEFAULT_DATA: Record<IncomeCategory, SubFormData> = {
  "Crop Sale": {
    quantityKg: "",
    pricePerKg: "",
    buyerName: "",
    marketName: "",
  } as CropSaleData,
  Subsidy: { schemeType: "", amount: "", referenceNumber: "" } as SubsidyData,
  "Rental Income": {
    assetType: "",
    rentedToName: "",
    hoursOrDays: "",
    ratePerUnit: "",
  } as RentalIncomeData,
  Other: { source: "", amount: "", description: "" } as OtherIncomeData,
};

// Crop dropdown label (same as expense screen)
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
const AREA_UNIT_GUJ: Record<string, string> = { Bigha: "વીઘા", Acre: "એકર", Hectare: "હેક્ટર" };
function getCropDropdownLabel(c: Crop): string {
  const emoji = c.cropEmoji ?? "🌱";
  const name = CROP_NAME_GUJ[c.cropName ?? ""] ?? (c.cropName ?? "—");
  const season = SEASON_DISPLAY[c.season ?? ""] ?? (c.season ?? "—");
  const area = c.area != null ? String(c.area) : "—";
  const unit = AREA_UNIT_GUJ[(c.areaUnit ?? "Bigha") as string] ?? "વીઘા";
  return `${emoji} ${name} · ${season} · ${area} ${unit}`;
}

function SelectPicker({
  options,
  selected,
  onSelect,
  placeholder,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === selected)?.label;
  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        style={[styles.selectBtn, open && styles.selectBtnOpen]}
        onPress={() => setOpen((p) => !p)}
        activeOpacity={0.8}
      >
        <Text style={[styles.selectBtnText, !selectedLabel && { color: C.textMuted }]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={C.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropList}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.dropItem, selected === o.value && styles.dropItemActive]}
              onPress={() => { onSelect(o.value); setOpen(false); }}
            >
              <Text style={[styles.dropItemText, selected === o.value && styles.dropItemTextActive]}>{o.label}</Text>
              {selected === o.value && <Ionicons name="checkmark" size={20} color={C.green700} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧩 Reusable field components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function ChipPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => onChange(opt)}
          activeOpacity={0.75}
        >
          <Text
            style={[styles.chipText, value === opt && styles.chipTextActive]}
          >
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel text={label} />
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, suffix ? { flex: 1 } : null]}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? "0"}
          placeholderTextColor={C.textMuted}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function TxtField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel text={label} />
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ""}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

function DerivedCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.derived}>
      <View style={styles.derivedLeft}>
        <Text style={styles.derivedEmoji}>🧮</Text>
        <Text style={styles.derivedLabel}>{label}</Text>
      </View>
      <Text style={styles.derivedValue}>{value}</Text>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📝 Sub-forms
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CropSaleForm({
  data,
  onChange,
}: {
  data: CropSaleData;
  onChange: (d: CropSaleData) => void;
}) {
  const set = (k: keyof CropSaleData, v: string) =>
    onChange({ ...data, [k]: v });
  const qty = parseFloat(data.quantityKg) || 0;
  const price = parseFloat(data.pricePerKg) || 0;
  const total = qty * price;

  return (
    <>
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <NumField
            label="જથ્થો (kg) *"
            value={data.quantityKg}
            onChange={(v) => set("quantityKg", v)}
            suffix="kg"
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumField
            label="ભાવ / kg *"
            value={data.pricePerKg}
            onChange={(v) => set("pricePerKg", v)}
            suffix=""
          />
        </View>
      </View>

      {qty > 0 && price > 0 && (
        <DerivedCard
          label="કુલ રકમ"
          value={total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        />
      )}

      <TxtField
        label="ખરીદનારનું નામ"
        value={data.buyerName}
        onChange={(v) => set("buyerName", v)}
        placeholder="વૈકલ્પિક"
      />
      <TxtField
        label="બજાર / મંડી"
        value={data.marketName}
        onChange={(v) => set("marketName", v)}
        placeholder="વૈકલ્પિક"
      />
    </>
  );
}

function SubsidyForm({
  data,
  onChange,
}: {
  data: SubsidyData;
  onChange: (d: SubsidyData) => void;
}) {
  const set = (k: keyof SubsidyData, v: string) =>
    onChange({ ...data, [k]: v });
  return (
    <>
      <View style={styles.fieldWrap}>
        <FieldLabel text="યોજનાનો પ્રકાર *" />
        <ChipPicker
          options={SCHEME_TYPES}
          value={data.schemeType}
          onChange={(v) => set("schemeType", v)}
        />
      </View>
      <NumField
        label="રકમ *"
        value={data.amount}
        onChange={(v) => set("amount", v)}
        suffix=""
      />
      <TxtField
        label="સંદર્ભ નંબર"
        value={data.referenceNumber}
        onChange={(v) => set("referenceNumber", v)}
        placeholder="વૈકલ્પિક"
      />
    </>
  );
}

function RentalIncomeForm({
  data,
  onChange,
}: {
  data: RentalIncomeData;
  onChange: (d: RentalIncomeData) => void;
}) {
  const set = (k: keyof RentalIncomeData, v: string) =>
    onChange({ ...data, [k]: v });
  const hrs = parseFloat(data.hoursOrDays) || 0;
  const rate = parseFloat(data.ratePerUnit) || 0;
  const total = hrs * rate;

  return (
    <>
      <View style={styles.fieldWrap}>
        <FieldLabel text="ઉપકરણનો પ્રકાર *" />
        <ChipPicker
          options={ASSET_TYPES}
          value={data.assetType}
          onChange={(v) => set("assetType", v)}
        />
      </View>
      <TxtField
        label="ભાડે લેનારનું નામ"
        value={data.rentedToName}
        onChange={(v) => set("rentedToName", v)}
        placeholder="વૈકલ્પિક"
      />
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <NumField
            label="કલાક / દિવસ *"
            value={data.hoursOrDays}
            onChange={(v) => set("hoursOrDays", v)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumField
            label="દર *"
            value={data.ratePerUnit}
            onChange={(v) => set("ratePerUnit", v)}
            suffix=""
          />
        </View>
      </View>
      {hrs > 0 && rate > 0 && (
        <DerivedCard
          label="કુલ રકમ"
          value={total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        />
      )}
    </>
  );
}

function OtherIncomeForm({
  data,
  onChange,
}: {
  data: OtherIncomeData;
  onChange: (d: OtherIncomeData) => void;
}) {
  const set = (k: keyof OtherIncomeData, v: string) =>
    onChange({ ...data, [k]: v });
  return (
    <>
      <View style={styles.fieldWrap}>
        <FieldLabel text="સ્રોત *" />
        <ChipPicker
          options={OTHER_SOURCES}
          value={data.source}
          onChange={(v) => set("source", v)}
        />
      </View>
      <NumField
        label="રકમ *"
        value={data.amount}
        onChange={(v) => set("amount", v)}
        suffix=""
      />
      <TxtField
        label="વિગત"
        value={data.description}
        onChange={(v) => set("description", v)}
        placeholder="વૈકલ્પિક"
      />
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏠 Main Screen
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AddIncomeScreen() {
  // Expo Router params: ?cropId=xxx  OR  ?id=xxx (edit)  OR  ?general=1 (no crop)  OR  ?year=2025-26
  const params = useLocalSearchParams<{ cropId?: string; id?: string; general?: string; year?: string }>();
  const cropIdParam = params.cropId ?? null;
  const editId = params.id ?? null;
  const isGeneralIncome = (Array.isArray(params.general) ? params.general[0] : params.general) === "1";
  const paramYear = Array.isArray(params.year) ? params.year[0] : params.year;
  const isEdit = !!editId;

  const yearOptions = getYearOptions();
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(
    () => (paramYear && yearOptions.includes(paramYear) ? paramYear : getCurrentFinancialYear()),
  );

  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string>("");

  // Visible categories: general = only Subsidy, Other; crop from dashboard = hide Rental Income; else all
  const visibleCategories = useMemo(() => {
    if (isGeneralIncome) return CATEGORIES.filter((c) => c.value === "Subsidy" || c.value === "Other");
    if (cropIdParam) return CATEGORIES.filter((c) => c.value !== "Rental Income");
    return CATEGORIES;
  }, [isGeneralIncome, cropIdParam]);

  const [category, setCategory] = useState<IncomeCategory>("Crop Sale");
  const [subData, setSubData] = useState<SubFormData>(
    DEFAULT_DATA["Crop Sale"],
  );
  const [date, setDate] = useState<Date>(() =>
    financialYearToStartDate(paramYear && yearOptions.includes(paramYear) ? paramYear : getCurrentFinancialYear()),
  );
  useEffect(() => {
    if (!isEdit) setDate(financialYearToStartDate(selectedFinancialYear));
  }, [selectedFinancialYear, isEdit]);

  // Fetch crops when adding income linked to a crop (not general, not edit)
  useEffect(() => {
    if (isGeneralIncome || isEdit) return;
    getCrops()
      .then((r) => setCrops(r.data ?? []))
      .catch(() => setCrops([]));
  }, [isGeneralIncome, isEdit]);

  useEffect(() => {
    if (cropIdParam) setSelectedCropId(cropIdParam);
  }, [cropIdParam]);

  // Default category: general → Subsidy only; when crop selected hide Rental so switch if needed
  useEffect(() => {
    if (isGeneralIncome) {
      if (category !== "Subsidy") {
        setCategory("Subsidy");
        setSubData(DEFAULT_DATA["Subsidy"]);
      }
      return;
    }
    if (!visibleCategories.some((c) => c.value === category)) {
      const first = visibleCategories[0];
      if (first) {
        setCategory(first.value);
        setSubData(DEFAULT_DATA[first.value]);
      }
    }
  }, [isGeneralIncome, visibleCategories, category]);

  const [showPicker, setShowPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingEdit, setFetchingEdit] = useState(isEdit);

  // ── Fetch existing income when editing ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !editId) return;

    (async () => {
      try {
        const doc = await getIncomeById(editId);

        setCategory(doc.category);
        setDate(new Date(doc.date));
        setNotes(doc.notes ?? "");

        const fieldKey = CATEGORY_FIELD_MAP[
          doc.category
        ] as keyof IncomeDocument;
        const raw = (doc[fieldKey] ?? {}) as Record<string, unknown>;

        // Convert numbers → strings for TextInput
        const stringified = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, v != null ? String(v) : ""]),
        ) as unknown as SubFormData;

        setSubData(stringified);
      } catch (err) {
        Alert.alert("ભૂલ", (err as Error).message ?? "ડેટા લોડ ન થઈ શક્યો");
        router.back();
      } finally {
        setFetchingEdit(false);
      }
    })();
  }, []);

  // ── Category change ─────────────────────────────────────────────────────────
  const handleCategoryChange = (cat: IncomeCategory) => {
    setCategory(cat);
    setSubData({ ...DEFAULT_DATA[cat] });
  };

  // ── Date picker ─────────────────────────────────────────────────────────────
  const handleDateChange = (_e: DateTimePickerEvent, d?: Date) => {
    setShowPicker(false);
    if (d) setDate(d);
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (category === "Crop Sale") {
      const effectiveCropId = selectedCropId || cropIdParam;
      if (!effectiveCropId) return "પાક પસંદ કરો.";
      const d = subData as CropSaleData;
      if (!d.quantityKg || parseFloat(d.quantityKg) <= 0)
        return "માન્ય જથ્થો દાખલ કરો";
      if (!d.pricePerKg || parseFloat(d.pricePerKg) <= 0)
        return "માન્ય ભાવ દાખલ કરો";
    }
    if (category === "Subsidy") {
      const d = subData as SubsidyData;
      if (!d.schemeType) return "યોજનાનો પ્રકાર પસંદ કરો";
      if (!d.amount || parseFloat(d.amount) <= 0) return "માન્ય રકમ દાખલ કરો";
    }
    if (category === "Rental Income") {
      const d = subData as RentalIncomeData;
      if (!d.assetType) return "ઉપકરણ પ્રકાર પસંદ કરો";
      if (!d.hoursOrDays || parseFloat(d.hoursOrDays) <= 0)
        return "કલાક/દિવસ દાખલ કરો";
      if (!d.ratePerUnit || parseFloat(d.ratePerUnit) <= 0)
        return "માન્ય દર દાખલ કરો";
    }
    if (category === "Other") {
      const d = subData as OtherIncomeData;
      if (!d.source) return "સ્રોત પસંદ કરો";
      if (!d.amount || parseFloat(d.amount) <= 0) return "માન્ય રકમ દાખલ કરો";
    }
    return null;
  };

  // ── Build payload ───────────────────────────────────────────────────────────
  const buildPayload = () => {
    const fieldKey = CATEGORY_FIELD_MAP[category];

    const numericKeys: Record<string, string[]> = {
      cropSale: ["quantityKg", "pricePerKg"],
      subsidy: ["amount"],
      rentalIncome: ["hoursOrDays", "ratePerUnit"],
      otherIncome: ["amount"],
    };

    const raw = { ...(subData as unknown as Record<string, string>) };
    const parsed: Record<string, string | number> = { ...raw };
    (numericKeys[fieldKey] ?? []).forEach((f) => {
      if (parsed[f] !== undefined) parsed[f] = parseFloat(raw[f]) || 0;
    });

    const effectiveCropId = isGeneralIncome ? undefined : (selectedCropId || cropIdParam || undefined);
    return {
      category,
      date: date.toISOString(),
      notes,
      ...(effectiveCropId ? { cropId: effectiveCropId } : {}),
      [fieldKey]: parsed,
    };
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert("ચકાસણી ભૂલ", err);
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload() as IncomePayload;
      if (isEdit) {
        await updateIncome(editId!, payload);
      } else {
        await createIncome(payload);
      }
      Alert.alert("સફળ", isEdit ? "આવક અપડેટ થઈ !" : "આવક સેવ થઈ !", [
        { text: "ઠીક", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("ભૂલ", (e as Error).message ?? "કંઈક ખોટું થયું");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading skeleton while fetching edit data ───────────────────────────────
  if (fetchingEdit) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={C.green500} />
        <Text style={styles.loadingText}>ડેટા લોડ થઈ રહ્યો છે...</Text>
      </View>
    );
  }

  // ── Active category meta ────────────────────────────────────────────────────
  const activeCat = CATEGORIES.find((c) => c.value === category)!;

  const headerPaddingTop = Platform.OS === "ios" ? 52 : 40;
  const headerTitle = isEdit ? "આવક સુધારો" : isGeneralIncome ? "સામાન્ય આવક" : activeCat ? `${activeCat.label} આવક` : "આવક ઉમેરો";
  const headerSub = isEdit ? "" : isGeneralIncome ? "કોઈ પાક સંલગ્ન નહીં — અહેવાલમાં ગણાશે" : cropIdParam ? "પાક સાથે જોડાઈ" : "આવક પ્રકાર પસંદ કરો";

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header (same as add-expense: gradient, back, title, subtitle, top space) ── */}
      <LinearGradient
        colors={["#E8F5E9", "#EEF6EE", "#F5F7F2"]}
        style={[styles.header, { paddingTop: headerPaddingTop }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={C.green700} />
          </TouchableOpacity>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            {headerSub ? <Text style={styles.headerSub}>{headerSub}</Text> : null}
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      {/* ── Financial year selector (before add) ── */}
      {!isEdit && (
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
      )}

      {/* ── Crop select (same as expense): when adding income linked to a crop ── */}
      {!isGeneralIncome && !isEdit && (
        <View style={styles.cropSelectCard}>
          <SectionLabel text="પાક પસંદ કરો *" />
          {crops.length > 0 ? (
            <SelectPicker
              options={crops.map((c) => ({ value: c._id, label: getCropDropdownLabel(c) }))}
              selected={selectedCropId || cropIdParam || ""}
              onSelect={setSelectedCropId}
              placeholder="આ આવક કયા પાક માટે?"
            />
          ) : (
            <Text style={styles.generalExpenseNote}>કોઈ પાક નથી — પહેલા ડેશબોર્ડથી પાક ઉમેરો.</Text>
          )}
        </View>
      )}

      {/* ── Category (filtered: general = Subsidy+Other; crop from dashboard = hide ભાડાની આવક) ── */}
      <View style={styles.card}>
        <SectionLabel text="📂 આવકનો પ્રકાર" />
        <View style={styles.catGrid}>
          {visibleCategories.map((cat) => {
            const active = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catCard, active && styles.catCardActive]}
                onPress={() => handleCategoryChange(cat.value)}
                activeOpacity={0.75}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text
                  style={[styles.catLabel, active && styles.catLabelActive]}
                >
                  {cat.label}
                </Text>
                {active && <View style={styles.catDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Date ── */}
      <View style={styles.card}>
        <SectionLabel text="📅 તારીખ" />
        <TouchableOpacity
          style={styles.dateTile}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.8}
        >
          <View style={styles.dateTileLeft}>
            <View style={styles.dateIconWrap}>
              <Text style={{ fontSize: 20 }}>📅</Text>
            </View>
            <View>
              <Text style={styles.dateDay}>
                {date.toLocaleDateString("en-IN", { weekday: "long" })}
              </Text>
              <Text style={styles.dateValue}>
                {date.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
          <Text style={styles.dateEdit}>બદલો</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={handleDateChange}
          />
        )}
      </View>

      {/* ── Dynamic sub-form ── */}
      <View style={styles.card}>
        <SectionLabel text={`${activeCat.emoji} ${activeCat.label} વિગત`} />
        {category === "Crop Sale" && (
          <CropSaleForm
            data={subData as CropSaleData}
            onChange={(d) => setSubData(d)}
          />
        )}
        {category === "Subsidy" && (
          <SubsidyForm
            data={subData as SubsidyData}
            onChange={(d) => setSubData(d)}
          />
        )}
        {category === "Rental Income" && (
          <RentalIncomeForm
            data={subData as RentalIncomeData}
            onChange={(d) => setSubData(d)}
          />
        )}
        {category === "Other" && (
          <OtherIncomeForm
            data={subData as OtherIncomeData}
            onChange={(d) => setSubData(d)}
          />
        )}
      </View>

      {/* ── Notes ── */}
      <View style={styles.card}>
        <SectionLabel text="📝 નોંધ" />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={notes}
          onChangeText={setNotes}
          placeholder="વધારાની માહિતી (વૈકલ્પિક)..."
          placeholderTextColor={C.textMuted}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* ── Submit ── */}
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.submitBtnText}>
              {isEdit ? "💾  અપડેટ કરો" : "✅  આવક સેવ કરો"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 Styles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },

  // Header (same as add-expense)
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
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green100,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary },
  headerSub: { fontSize: 15, color: C.textSecondary, marginTop: 2 },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.bg,
    gap: 14,
  },
  loadingText: { fontSize: 15, color: C.textMuted, fontWeight: "500" },

  // Page header
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  backArrow: { fontSize: 20, color: C.textPrimary, fontWeight: "700" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  pageSubtitle: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.green50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.green100,
  },
  catBadgeEmoji: { fontSize: 16 },
  catBadgeText: { fontSize: 12, fontWeight: "700", color: C.green700 },

  // Year selector
  yearCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
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

  // Crop select (same as expense)
  cropSelectCard: {
    backgroundColor: C.green50,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: C.green100,
  },
  selectBtn: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectBtnOpen: {
    borderColor: C.green500,
  },
  selectBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPrimary,
    flex: 1,
  },
  dropList: {
    marginTop: 4,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    maxHeight: 220,
  },
  dropItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  dropItemActive: {
    backgroundColor: C.green50,
  },
  dropItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textSecondary,
    flex: 1,
  },
  dropItemTextActive: {
    color: C.green700,
  },
  generalExpenseNote: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 22,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  // Category grid
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catCard: {
    width: "47%",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  catCardActive: {
    backgroundColor: C.green50,
    borderColor: C.green500,
  },
  catEmoji: { fontSize: 26 },
  catLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSecondary,
    textAlign: "center",
  },
  catLabelActive: { color: C.green700, fontWeight: "800" },
  catDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green500,
  },

  // Date tile
  dateTile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  dateTileLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.green50,
    justifyContent: "center",
    alignItems: "center",
  },
  dateDay: { fontSize: 12, color: C.textMuted, fontWeight: "500" },
  dateValue: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPrimary,
    marginTop: 2,
  },
  dateEdit: { fontSize: 13, color: C.green700, fontWeight: "700" },

  // Fields
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSecondary,
    marginBottom: 7,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPrimary,
    fontWeight: "500",
  },
  inputMulti: {
    height: 90,
    paddingTop: 12,
  },
  inputSuffix: {
    backgroundColor: C.green50,
    borderWidth: 1.5,
    borderColor: C.border,
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: C.green700,
  },

  // Row of 2 fields
  row2: { flexDirection: "row", gap: 10 },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  chipActive: { backgroundColor: C.green50, borderColor: C.greenMid },
  chipText: { fontSize: 13, color: C.textSecondary, fontWeight: "500" },
  chipTextActive: { color: C.green700, fontWeight: "700" },

  // Derived total
  derived: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.green50,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: C.green500,
    borderWidth: 1,
    borderColor: C.green100,
  },
  derivedLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  derivedEmoji: { fontSize: 18 },
  derivedLabel: { fontSize: 13, color: C.green700, fontWeight: "600" },
  derivedValue: { fontSize: 20, fontWeight: "900", color: C.green700 },

  // Submit
  submitBtn: {
    backgroundColor: C.green700,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
    shadowColor: C.green700,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});

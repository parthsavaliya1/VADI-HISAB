/**
 * Full farmer profile card — for viewing, downloading and sharing.
 * Shows name, location, land, water, labour, tractor and services (if any), farms.
 */
import type { FarmerProfile } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const WATER: Record<string, string> = { Rain: "વરસાદ", Borewell: "બોરવેલ", Canal: "નહેર" };
const LABOUR: Record<string, string> = { Family: "પારિવારિક", Hired: "ભાડે", Mixed: "મિશ્ર" };
const TRACTOR_SERVICES: Record<string, string> = { Rotavator: "રોટાવેટર", RAP: "RAP", Bagi: "બગી", Savda: "સવડા" };

function toList(map: Record<string, string>, keys: string[]): string {
  if (!keys?.length) return "—";
  return keys.map((k) => map[k] ?? k).join(", ");
}

export interface FarmerProfileCardProps {
  profile: FarmerProfile;
  /** Resolved location labels (Gujarati) */
  districtLabel: string;
  talukaLabel: string;
  villageLabel: string;
  /** Optional: card width for consistent layout (e.g. for capture) */
  cardWidth?: number;
}

export function FarmerProfileCard({
  profile,
  districtLabel,
  talukaLabel,
  villageLabel,
  cardWidth = 340,
}: FarmerProfileCardProps) {
  const p = profile as Record<string, unknown>;
  const waterSources = (Array.isArray(p.waterSources) ? p.waterSources : p.waterSource != null ? [p.waterSource] : []) as string[];
  const labourTypes = (Array.isArray(p.labourTypes) ? p.labourTypes : p.labourType != null ? [p.labourType] : []) as string[];
  const implementsAvailable = (Array.isArray(p.implementsAvailable) ? p.implementsAvailable : []) as string[];
  const farms = Array.isArray(p.farms) ? p.farms : [];
  const totalLand = profile.totalLand?.value ?? 0;
  const landUnit = profile.totalLand?.unit === "bigha" ? "વીઘા" : "એકર";
  const landText = totalLand ? `${totalLand} ${landUnit}` : "—";
  const waterText = toList(WATER, waterSources);
  const labourText = toList(LABOUR, labourTypes);
  const tractorServicesText = implementsAvailable.length > 0 ? toList(TRACTOR_SERVICES, implementsAvailable) : null;

  const section = (title: string, icon: keyof typeof Ionicons.glyphMap, content: string | React.ReactNode) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={22} color={C.sectionIcon} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>
        {typeof content === "string" ? <Text style={styles.sectionText}>{content}</Text> : content}
      </View>
    </View>
  );

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <View style={styles.brand}>
        <Text style={styles.brandName}>VADI-Hisaab</Text>
        <Text style={styles.brandSub}>ખેડૂત પ્રોફાઇલ કાર્ડ</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile.name || "—"}</Text>
        <Text style={styles.role}>🌾 ખેડૂત</Text>
      </View>

      {section("સ્થળ (જિલ્લો · તાલુકો · ગામ)", "location-outline", `${districtLabel} · ${talukaLabel} · ${villageLabel}`)}
      {section("કુલ જમીન", "leaf-outline", landText)}

      {farms.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="grid-outline" size={22} color={C.sectionIcon} />
            <Text style={styles.sectionTitle}>ફાર્મ / જમીન વિગત</Text>
          </View>
          <View style={styles.sectionBody}>
            {farms.map((f: { name?: string; area?: number }, i: number) => (
              <Text key={i} style={styles.sectionText}>
                {(f as any).name || "ફાર્મ"} — {(f as any).area ?? 0} વીઘા
              </Text>
            ))}
          </View>
        </View>
      )}

      {section("પાણીનો સ્ત્રોત", "water-outline", waterText)}
      {section("મજૂર પ્રકાર", "people-outline", labourText)}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car-outline" size={22} color={C.sectionIcon} />
          <Text style={styles.sectionTitle}>ટ્રેક્ટર</Text>
        </View>
        <View style={styles.sectionBody}>
          <Text style={styles.sectionText}>{profile.tractorAvailable ? "હા — ટ્રેક્ટર ઉપલબ્ધ" : "ના"}</Text>
          {profile.tractorAvailable && tractorServicesText && (
            <Text style={[styles.sectionText, styles.serviceList]}>સેવાઓ: {tractorServicesText}</Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>આ કાર્ડ VADI-Hisaab એપથી શેર કર્યું</Text>
      </View>
    </View>
  );
}

const C = {
  brand: "#0D5C4A",
  brandBg: "#0D5C4A",
  accent: "#0D5C4A",
  accentLight: "#14B8A6",
  sectionIcon: "#0D5C4A",
  text: "#0F172A",
  textMuted: "#334155",
  border: "#0D5C4A",
  footerBorder: "#94A3B8",
  footerText: "#64748B",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 0,
    borderWidth: 3,
    borderColor: C.border,
    shadowColor: "#0D5C4A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  brand: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: C.brandBg,
  },
  brandName: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 },
  brandSub: { fontSize: 17, fontWeight: "700", color: "#99F6E4", marginTop: 6 },
  hero: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#CCFBF1",
    borderWidth: 3,
    borderColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: C.accent },
  name: { fontSize: 28, fontWeight: "800", color: C.text, textAlign: "center" },
  role: { fontSize: 18, fontWeight: "700", color: C.textMuted, marginTop: 4 },
  section: {
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  sectionBody: { paddingLeft: 30 },
  sectionText: { fontSize: 17, fontWeight: "600", color: C.text, lineHeight: 26 },
  serviceList: { marginTop: 6, fontSize: 16, color: C.textMuted, lineHeight: 24 },
  footer: {
    marginTop: 12,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderTopWidth: 2,
    borderTopColor: C.footerBorder,
    alignItems: "center",
  },
  footerText: { fontSize: 14, fontWeight: "700", color: C.footerText },
});

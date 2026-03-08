/**
 * Landscape farmer profile card — for viewing, downloading and sharing.
 * Branded with logo, colorful section icons, landscape layout.
 */
import type { FarmerProfile } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const WATER: Record<string, string> = { Rain: "વરસાદ", Borewell: "બોરવેલ", Canal: "નહેર" };
const LABOUR: Record<string, string> = { Family: "પારિવારિક", Hired: "ભાડે", Mixed: "મિશ્ર" };
const TRACTOR_SERVICES: Record<string, string> = { Rotavator: "રોટાવેટર", RAP: "RAP", Bagi: "બગી", Savda: "સવડા" };

function toList(map: Record<string, string>, keys: string[]): string {
  if (!keys?.length) return "—";
  return keys.map((k) => map[k] ?? k).join(", ");
}

// Colorful icon config: [iconName, bgColor, iconColor]
const SECTION_COLORS: Record<string, [string, string, string]> = {
  location: ["#3B82F6", "#EFF6FF", "#1D4ED8"],      // blue
  land:     ["#22C55E", "#ECFDF5", "#15803D"],      // green
  water:   ["#06B6D4", "#ECFEFF", "#0891B2"],       // cyan
  labour:  ["#F59E0B", "#FFFBEB", "#B45309"],      // amber
  tractor: ["#EA580C", "#FFF7ED", "#C2410C"],      // orange
  farms:   ["#8B5CF6", "#F5F3FF", "#6D28D9"],      // violet
};

export interface FarmerProfileCardProps {
  profile: FarmerProfile;
  districtLabel: string;
  talukaLabel: string;
  villageLabel: string;
  cardWidth?: number;
  /** Landscape height (default 320 for more content) */
  cardHeight?: number;
  /** Optional VADI score 0–100 to show at top right */
  vadiScore?: number | null;
}

export function FarmerProfileCard({
  profile,
  districtLabel,
  talukaLabel,
  villageLabel,
  cardWidth = 440,
  cardHeight,
  vadiScore = null,
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

  const h = cardHeight ?? 320;

  const iconBox = (key: keyof typeof SECTION_COLORS, icon: keyof typeof Ionicons.glyphMap, label: string, value: string | React.ReactNode) => {
    const [bg, _light, iconColor] = SECTION_COLORS[key] ?? ["#64748B", "#F1F5F9", "#475569"];
    return (
      <View style={styles.iconRow}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.iconRowText}>
          <Text style={styles.iconLabel}>{label}</Text>
          {typeof value === "string" ? <Text style={styles.iconValue} numberOfLines={1}>{value}</Text> : value}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, { width: cardWidth, height: h }]}>
      {/* Top brand bar: logo + VADI + VADI Score (top right) */}
      <View style={styles.brandBar}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/vadi-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandName}>VADI</Text>
          <Text style={styles.brandSub}>ખેડૂત પ્રોફાઇલ કાર્ડ</Text>
        </View>
        {vadiScore != null && (
          <View style={styles.vadiScoreBadge}>
            <Text style={styles.vadiScoreLabel}>VADI Score</Text>
            <Text style={styles.vadiScoreValue}>{Math.min(100, Math.max(0, vadiScore))}</Text>
          </View>
        )}
      </View>

      {/* Landscape body: left = avatar + name, right = info grid */}
      <View style={styles.body}>
        <View style={styles.leftBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>{profile.name || "—"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleEmoji}>🌾</Text>
            <Text style={styles.roleText}>ખેડૂત</Text>
          </View>
        </View>

        <View style={styles.rightBlock}>
          {iconBox("location", "location", "સ્થળ", `${districtLabel} · ${talukaLabel} · ${villageLabel}`)}
          {iconBox("land", "leaf", "જમીન", landText)}
          {iconBox("water", "water", "પાણી", waterText)}
          {iconBox("labour", "people", "મજૂર", labourText)}
          <View style={styles.iconRow}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.tractor[0] }]}>
              <Ionicons name="car" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.iconRowText}>
              <Text style={styles.iconLabel}>ટ્રેક્ટર</Text>
              <Text style={styles.iconValue} numberOfLines={1}>
                {profile.tractorAvailable ? "હા — ઉપલબ્ધ" : "ના"}
              </Text>
            </View>
          </View>
          {profile.tractorAvailable && tractorServicesText && (
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: "#B45309" }]}>
                <Ionicons name="construct" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.iconRowText}>
                <Text style={styles.iconLabel}>ટ્રેક્ટર સેવાઓ</Text>
                <Text style={styles.iconValue} numberOfLines={2}>{tractorServicesText}</Text>
              </View>
            </View>
          )}
          {farms.length > 0 && (
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.farms[0] }]}>
                <Ionicons name="grid" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.iconRowText}>
                <Text style={styles.iconLabel}>ફાર્મ</Text>
                <Text style={styles.iconValue} numberOfLines={2}>
                  {farms.map((f: { name?: string; area?: number }, i: number) => `${(f as any).name || "ફાર્મ"} ${(f as any).area ?? 0} વીઘા`).join(", ")}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Footer with small logo + tagline */}
      <View style={styles.footer}>
        <Image source={require("../assets/vadi-logo.png")} style={styles.footerLogo} contentFit="contain" />
        <Text style={styles.footerText}>આ કાર્ડ VADI એપથી શેર કર્યું</Text>
      </View>
    </View>
  );
}

const C = {
  brand: "#0D5C4A",
  brandLight: "#CCFBF1",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#0D5C4A",
  footerBg: "#F8FAFC",
  footerBorder: "#E2E8F0",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 3,
    borderColor: C.border,
    shadowColor: "#0D5C4A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.brand,
    gap: 14,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logo: { width: 36, height: 36 },
  brandTextWrap: { flex: 1 },
  brandName: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 },
  brandSub: { fontSize: 13, fontWeight: "700", color: C.brandLight, marginTop: 2 },
  vadiScoreBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 72,
  },
  vadiScoreLabel: { fontSize: 11, fontWeight: "700", color: C.brandLight },
  vadiScoreValue: { fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  body: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 20,
  },
  leftBlock: {
    alignItems: "center",
    width: 120,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.brandLight,
    borderWidth: 2,
    borderColor: C.brand,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 26, fontWeight: "800", color: C.brand },
  name: { fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center" },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  roleEmoji: { fontSize: 14 },
  roleText: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  rightBlock: { flex: 1, justifyContent: "flex-start", gap: 4 },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconRowText: { flex: 1, minWidth: 0 },
  iconLabel: { fontSize: 12, fontWeight: "700", color: C.textMuted, marginBottom: 1 },
  iconValue: { fontSize: 14, fontWeight: "600", color: C.text, lineHeight: 20 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: C.footerBg,
    borderTopWidth: 2,
    borderTopColor: C.footerBorder,
  },
  footerLogo: { width: 24, height: 24 },
  footerText: { fontSize: 13, fontWeight: "700", color: C.textMuted },
});

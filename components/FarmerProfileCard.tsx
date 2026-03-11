/**
 * Portrait farmer profile card — for viewing, downloading and sharing.
 * Uses VADI logo only (no extra VADI text) and soft, modern colors.
 */
import type { FarmerProfile } from "@/utils/api";
import { formatArea, formatWholeNumber } from "@/utils/format";
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
  /** Portrait height (default 360 for more content) */
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
  const landText = totalLand ? `${profile.totalLand?.unit === "bigha" ? formatArea(totalLand) : formatWholeNumber(totalLand)} ${landUnit}` : "—";
  const waterText = toList(WATER, waterSources);
  const labourText = toList(LABOUR, labourTypes);
  const tractorServicesText = implementsAvailable.length > 0 ? toList(TRACTOR_SERVICES, implementsAvailable) : null;

  const h = cardHeight ?? 360;

  const iconBox = (key: keyof typeof SECTION_COLORS, icon: keyof typeof Ionicons.glyphMap, label: string, value: string | React.ReactNode) => {
    const [bg, light, iconColor] = SECTION_COLORS[key] ?? ["#64748B", "#F1F5F9", "#475569"];
    return (
      <View style={styles.iconRow}>
        <View style={[styles.iconCircle, { backgroundColor: light }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.iconRowText}>
          <Text style={styles.iconLabel}>{label}</Text>
          {typeof value === "string" ? (
            <Text style={styles.iconValue} numberOfLines={1}>
              {value}
            </Text>
          ) : (
            value
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, { width: cardWidth, height: h }]}>
      {/* Top logo + optional score badge */}
      <View style={styles.headerRow}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/vadi-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        {vadiScore != null && (
          <View style={styles.vadiScoreBadge}>
            <Text style={styles.vadiScoreLabel}>Score</Text>
            <Text style={styles.vadiScoreValue}>
              {Math.min(100, Math.max(0, vadiScore))}
            </Text>
          </View>
        )}
      </View>

      {/* Portrait body */}
      <View style={styles.body}>
        {/* Avatar + name + location */}
        <View style={styles.heroBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile.name ?? "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {profile.name || "—"}
          </Text>
          <Text style={styles.roleTextHero}>🌾 ખેડૂત</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={C.textMuted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {villageLabel} · {talukaLabel} · {districtLabel}
            </Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={styles.infoGrid}>
          {iconBox("land", "leaf-outline", "જમીન", landText)}
          {iconBox("water", "water-outline", "પાણીનું સ્રોત", waterText)}
          {iconBox("labour", "people-outline", "મજૂર વ્યવસ્થા", labourText)}
          <View style={styles.iconRow}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.tractor[1] }]}>
              <Ionicons name="car-outline" size={18} color={SECTION_COLORS.tractor[2]} />
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
              <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.tractor[1] }]}>
                <Ionicons name="construct-outline" size={18} color={SECTION_COLORS.tractor[2]} />
              </View>
              <View style={styles.iconRowText}>
                <Text style={styles.iconLabel}>ટ્રેક્ટર સેવાઓ</Text>
                <Text style={styles.iconValue} numberOfLines={2}>
                  {tractorServicesText}
                </Text>
              </View>
            </View>
          )}
          {farms.length > 0 && (
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.farms[1] }]}>
                <Ionicons name="grid-outline" size={18} color={SECTION_COLORS.farms[2]} />
              </View>
              <View style={styles.iconRowText}>
                <Text style={styles.iconLabel}>ફાર્મ</Text>
                <Text style={styles.iconValue} numberOfLines={2}>
                  {farms
                    .map(
                      (f: { name?: string; area?: number }) =>
                        `${(f as any).name || "ફાર્મ"} ${(f as any).area ?? 0} વીઘા`
                    )
                    .join(", ")}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const C = {
  brand: "#166534",
  brandLight: "#DCFCE7",
  text: "#022C22",
  textMuted: "#4B5563",
  border: "#86EFAC",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.border,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  logoWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  logo: { width: 72, height: 26, resizeMode: "contain" },
  vadiScoreBadge: {
    backgroundColor: C.brandLight,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "flex-end",
    minWidth: 70,
  },
  vadiScoreLabel: { fontSize: 10, fontWeight: "700", color: C.textMuted },
  vadiScoreValue: { fontSize: 20, fontWeight: "900", color: C.brand },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 6,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: C.brandLight,
    borderWidth: 2,
    borderColor: C.brand,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 26, fontWeight: "800", color: C.brand },
  heroBlock: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 2 },
  roleTextHero: { fontSize: 13, fontWeight: "700", color: C.textMuted, marginBottom: 6 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: C.textMuted,
  },
  infoGrid: {
    marginTop: 6,
    gap: 6,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  iconRowText: { flex: 1, minWidth: 0 },
  iconLabel: { fontSize: 12, fontWeight: "700", color: C.textMuted, marginBottom: 1 },
  iconValue: { fontSize: 13, fontWeight: "600", color: C.text, lineHeight: 18 },
});

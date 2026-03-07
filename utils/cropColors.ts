/**
 * Same crop colors everywhere: dashboard, crop summary list, and chart.
 * Very light, soft shades – easy on eyes.
 */
export const CROP_COLORS: [string, string][] = [
  ["#F0F7FF", "#B3D7F7"],   // 0 Cotton – very light sky blue
  ["#F0FAFB", "#A8E4EA"],   // 1 Groundnut – very light cyan
  ["#FFF8F0", "#F5D4A8"],   // 2 Jeera – very light orange
  ["#FAF5FB", "#E4C4E8"],   // 3 Garlic – very light lavender
  ["#F2F3F9", "#C5C8E0"],   // 4 Onion – very light indigo
  ["#F0FAF9", "#B0D9D6"],   // 5 Chana – very light teal
  ["#F2F9F2", "#C5E6C5"],   // 6 Wheat – very light mint
  ["#FDF2F6", "#F5C6D6"],   // 7 Bajra – very light pink
  ["#F8F6F5", "#D4CFCA"],   // 8 Maize – very light grey
];

/** Each crop → unique color index. */
export const CROP_NAME_TO_COLOR_INDEX: Record<string, number> = {
  Cotton: 0,
  Groundnut: 1,
  Jeera: 2,
  Garlic: 3,
  Onion: 4,
  Chana: 5,
  Wheat: 6,
  Bajra: 7,
  Maize: 8,
};

export function getCropColorIndex(cropName: string): number {
  return CROP_NAME_TO_COLOR_INDEX[cropName] ?? 0;
}

/** Returns [light, dark] for cards/gradients. */
export function getCropColors(cropName: string): [string, string] {
  const i = getCropColorIndex(cropName);
  return CROP_COLORS[i % CROP_COLORS.length];
}

/** Returns single color (darker shade) for pie chart slice. */
export function getCropColorForChart(cropName: string): string {
  const [_, dark] = getCropColors(cropName);
  return dark;
}

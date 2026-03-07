/**
 * Same crop colors everywhere: dashboard, crop summary list, and chart.
 * Cool, light, friendly palette – easy on eyes.
 */
export const CROP_COLORS: [string, string][] = [
  ["#E8F4FD", "#9EC8ED"],   // 0 Cotton – cool sky blue
  ["#E6F6F8", "#8DD4E0"],   // 1 Groundnut – cool aqua
  ["#FDF6ED", "#E8C9A0"],   // 2 Jeera – soft sand
  ["#F5EEFA", "#D4B8E4"],   // 3 Garlic – cool lavender
  ["#EEEEF8", "#B8B8D8"],   // 4 Onion – cool lilac
  ["#E8F6F5", "#9DD5D2"],   // 5 Chana – cool mint teal
  ["#EEF8EE", "#B0DDB0"],   // 6 Wheat – cool sage
  ["#FCE8F0", "#E8B8CC"],   // 7 Bajra – cool rose
  ["#F2F0EE", "#C8C4BE"],   // 8 Maize – cool stone
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

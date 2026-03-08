/**
 * Format area (વીઘા) for display: no trailing zeros, one decimal only when needed.
 * e.g. 5 → "5", 1.5 → "1.5", 2.50 → "2.5"
 */
export function formatArea(area: number | undefined | null): string {
  const v = Number(area);
  if (isNaN(v) || v < 0) return "—";
  if (v % 1 === 0) return String(Math.round(v));
  const one = Math.round(v * 10) / 10;
  return String(one);
}

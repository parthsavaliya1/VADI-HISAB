import { CROPSWITHIMAGE } from "../app/constants";

/**
 * Returns the static crop image (from `CROPSWITHIMAGE`) for a given crop name.
 * Matches both the English `value` and Gujarati `label` (in case backend sends either).
 */
export function getCropImageSource(cropName: string | undefined | null): any | undefined {
  const normalized = (cropName ?? "").trim().toLowerCase();
  if (!normalized) return undefined;

  return (
    CROPSWITHIMAGE.find(
      (c) =>
        (c.value ?? "").trim().toLowerCase() === normalized ||
        (c.label ?? "").trim().toLowerCase() === normalized,
    )?.image ?? undefined
  );
}


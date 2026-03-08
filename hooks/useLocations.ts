/**
 * useLocations — fetches district/taluka/village from API with caching and loading states.
 * Cascading: taluka resets when district changes, village resets when taluka changes.
 */
import {
  getLocationsDistricts,
  getLocationsTalukas,
  getLocationsVillages,
  type DropdownItem,
  type VillageItem,
} from "@/utils/api";
import { useEffect, useRef, useState } from "react";

const FALLBACK_ERROR = "માહિતી લોડ થઈ શકી નથી";

type CacheMap<T> = Record<string, T>;

export function useLocations(district: string, taluka: string) {
  const [districtItems, setDistrictItems] = useState<DropdownItem[]>([]);
  const [talukaItems, setTalukaItems] = useState<DropdownItem[]>([]);
  const [villageItems, setVillageItems] = useState<VillageItem[]>([]);

  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [talukasLoading, setTalukasLoading] = useState(false);
  const [villagesLoading, setVillagesLoading] = useState(false);

  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [talukasError, setTalukasError] = useState<string | null>(null);
  const [villagesError, setVillagesError] = useState<string | null>(null);

  const distCache = useRef<DropdownItem[] | null>(null);
  const talukaCache = useRef<CacheMap<DropdownItem[]>>({});
  const villageCache = useRef<CacheMap<VillageItem[]>>({});

  // ── Districts on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (distCache.current) {
      setDistrictItems(distCache.current);
      setDistrictsLoading(false);
      return;
    }
    setDistrictsLoading(true);
    setDistrictsError(null);
    getLocationsDistricts()
      .then((data) => {
        distCache.current = data;
        setDistrictItems(data);
      })
      .catch((err) => {
        setDistrictsError(err?.message ?? FALLBACK_ERROR);
        setDistrictItems([]);
      })
      .finally(() => setDistrictsLoading(false));
  }, []);

  // ── Talukas when district changes ─────────────────────────────────────────
  useEffect(() => {
    if (!district) {
      setTalukaItems([]);
      setTalukasLoading(false);
      setTalukasError(null);
      return;
    }
    const key = district;
    if (talukaCache.current[key]) {
      setTalukaItems(talukaCache.current[key]);
      setTalukasLoading(false);
      setTalukasError(null);
      return;
    }
    setTalukasLoading(true);
    setTalukasError(null);
    getLocationsTalukas(district)
      .then((data) => {
        talukaCache.current[key] = data;
        setTalukaItems(data);
      })
      .catch((err) => {
        setTalukasError(err?.message ?? FALLBACK_ERROR);
        setTalukaItems([]);
      })
      .finally(() => setTalukasLoading(false));
  }, [district]);

  // ── Villages when taluka changes ───────────────────────────────────────────
  useEffect(() => {
    if (!district || !taluka) {
      setVillageItems([]);
      setVillagesLoading(false);
      setVillagesError(null);
      return;
    }
    const key = `${district}:${taluka}`;
    if (villageCache.current[key]) {
      setVillageItems(villageCache.current[key]);
      setVillagesLoading(false);
      setVillagesError(null);
      return;
    }
    setVillagesLoading(true);
    setVillagesError(null);
    getLocationsVillages(district, taluka)
      .then((data) => {
        villageCache.current[key] = data;
        setVillageItems(data);
      })
      .catch((err) => {
        setVillagesError(err?.message ?? FALLBACK_ERROR);
        setVillageItems([]);
      })
      .finally(() => setVillagesLoading(false));
  }, [district, taluka]);

  const districtLabel = districtItems.find((d) => d.value === district)?.label ?? "";
  const talukaLabel = talukaItems.find((t) => t.value === taluka)?.label ?? "";

  return {
    districtItems,
    talukaItems,
    villageItems,
    districtsLoading,
    talukasLoading,
    villagesLoading,
    districtsError,
    talukasError,
    villagesError,
    districtLabel,
    talukaLabel,
  };
}

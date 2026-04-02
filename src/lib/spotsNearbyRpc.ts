import { SPOT_TYPE_CODES } from '../constants/spotTypes';
import { supabase } from './supabase';

export type NearbySpotRow = Record<string, unknown>;

export type FetchNearbyParams = {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  /** Si la RPC le supporte (ex. LIMIT SQL), réduit le volume renvoyé */
  limit?: number;
  /** Sous-ensemble de types ; `null` / tous les codes = pas de filtre */
  types?: string[] | null;
};

function isSpotTypeCode(value: string): value is (typeof SPOT_TYPE_CODES)[number] {
  return (SPOT_TYPE_CODES as readonly string[]).includes(value);
}

/**
 * Appelle `spots_nearby` puis applique un filtre par type côté client si nécessaire.
 */
export async function fetchSpotsNearby({
  latitude,
  longitude,
  radiusKm = 50,
  limit,
  types,
}: FetchNearbyParams): Promise<NearbySpotRow[]> {
  const typeList = (types ?? []).filter(isSpotTypeCode);
  const allTypes = typeList.length === 0 || typeList.length === SPOT_TYPE_CODES.length;
  const hasFilter = !allTypes && typeList.length > 0;

  const bases = [
    { p_lat: latitude, p_lng: longitude, p_radius_km: radiusKm },
    { lat: latitude, lng: longitude, radius_km: radiusKm },
    { latitude, longitude, radius_km: radiusKm },
  ];

  const filterAdds: Record<string, unknown>[] = hasFilter
    ? [{ p_types: typeList }, { types: typeList }, { spot_types: typeList }, { p_type: typeList[0] }, {}]
    : [{}];

  const limitAdds: Record<string, unknown>[] =
    limit != null && Number.isFinite(limit) && limit > 0
      ? [{ p_limit: limit }, { limit }, { max_results: limit }, { max_spots: limit }, {}]
      : [{}];

  let lastError = '';
  for (const base of bases) {
    for (const add of filterAdds) {
      for (const lim of limitAdds) {
        const payload = { ...base, ...add, ...lim };
        const { data, error } = await supabase.rpc('spots_nearby', payload);
        if (error) {
          lastError = error.message;
          continue;
        }
        let rows = (data as NearbySpotRow[]) ?? [];
        if (hasFilter) {
          const serverMayHaveFiltered = Object.keys(add).length > 0;
          const rowType = (r: NearbySpotRow) => String(r.type ?? r.spot_type ?? '');
          const inFilter = (r: NearbySpotRow) => {
            const t = rowType(r);
            return isSpotTypeCode(t) && typeList.includes(t);
          };
          const needsClient = !serverMayHaveFiltered || rows.some((r) => !inFilter(r));
          if (needsClient) {
            rows = rows.filter(inFilter);
          }
        }
        return rows;
      }
    }
  }

  throw new Error(lastError || 'spots_nearby indisponible');
}

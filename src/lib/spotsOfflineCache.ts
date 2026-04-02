import AsyncStorage from '@react-native-async-storage/async-storage';
import { pointInBounds, type MapBounds } from './mapRegionBounds';
import type { NearbySpotRow } from './spotsNearbyRpc';

const STORAGE_KEY = 'airgo.spots.offline.v1';
const MAX_ENTRIES = 20;
/** Anciennes entrées sans rayon explicite : repli “proche du centre”. */
const LEGACY_MAX_DISTANCE_KM = 85;

export type OfflineSnapshotMeta = {
  /** Rectangle exactement visible lors du téléchargement. */
  bounds?: MapBounds;
  /** Rayon utilisé pour la requête RPC (cercle englobant le viewport). */
  coverageRadiusKm?: number;
  /** Remplacer l’id (ex. téléchargement manuel d’une zone). */
  id?: string;
};

type CacheEntry = {
  id: string;
  latitude: number;
  longitude: number;
  filterKey: string;
  rows: NearbySpotRow[];
  savedAt: number;
  bounds?: MapBounds;
  coverageRadiusKm?: number;
};

type StoreShape = {
  entries: CacheEntry[];
};

function filterTypesKey(types: string[] | null): string {
  if (!types || types.length === 0) return 'all';
  return [...types].sort().join(',');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Identifiant de bucket (région ~0,1° + filtre) — requêtes auto 50 km. */
export function offlineCacheBucketId(latitude: number, longitude: number, types: string[] | null): string {
  return `auto_${round1(latitude)}_${round1(longitude)}_${filterTypesKey(types)}`;
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Le point (requête carte / liste) est couvert par ce snapshot ? */
function entryCoversPoint(entry: CacheEntry, latitude: number, longitude: number): boolean {
  if (entry.bounds) {
    return pointInBounds(latitude, longitude, entry.bounds);
  }
  const r = entry.coverageRadiusKm;
  const d = haversineKm({ latitude, longitude }, { latitude: entry.latitude, longitude: entry.longitude });
  if (r != null && r > 0) {
    return d <= r * 1.02;
  }
  return d <= LEGACY_MAX_DISTANCE_KM;
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as StoreShape;
    return Array.isArray(parsed.entries) ? parsed : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

async function writeStore(entries: CacheEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries }));
}

/**
 * Enregistre un snapshot pour le mode hors ligne.
 * Requête “auto” typique : `meta: { coverageRadiusKm: 50 }` sans bounds.
 */
export async function saveSpotsOfflineSnapshot(
  latitude: number,
  longitude: number,
  types: string[] | null,
  rows: NearbySpotRow[],
  meta?: OfflineSnapshotMeta,
): Promise<void> {
  const filterKey = filterTypesKey(types);
  const id = meta?.id ?? offlineCacheBucketId(latitude, longitude, types);
  const coverageRadiusKm = meta?.coverageRadiusKm ?? 50;
  const { entries } = await readStore();
  const next = entries.filter((e) => e.id !== id);
  next.unshift({
    id,
    latitude,
    longitude,
    filterKey,
    rows,
    savedAt: Date.now(),
    bounds: meta?.bounds,
    coverageRadiusKm,
  });
  await writeStore(next.slice(0, MAX_ENTRIES));
}

/**
 * Fusionne tous les snapshots qui couvrent le point, même filtre de types (union des spots par id).
 */
export async function loadSpotsOfflineSnapshot(
  latitude: number,
  longitude: number,
  types: string[] | null,
): Promise<NearbySpotRow[] | null> {
  const wantKey = filterTypesKey(types);
  const { entries } = await readStore();
  const matching = entries.filter((e) => e.filterKey === wantKey && entryCoversPoint(e, latitude, longitude));
  if (matching.length === 0) return null;

  const byId = new Map<string, NearbySpotRow>();
  for (const e of matching) {
    for (const r of e.rows) {
      const rowId = String(r.id ?? '');
      if (rowId && !byId.has(rowId)) {
        byId.set(rowId, r);
      }
    }
  }
  const merged = Array.from(byId.values());
  return merged.length > 0 ? merged : null;
}

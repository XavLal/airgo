import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NearbySpotRow } from './spotsNearbyRpc';

const STORAGE_KEY = 'airgo.spots.offline.v1';
const MAX_ENTRIES = 14;
/** Réutiliser un jeu de résultats si le centre de requête est assez proche du snapshot. */
const MAX_DISTANCE_KM = 85;

type CacheEntry = {
  id: string;
  latitude: number;
  longitude: number;
  filterKey: string;
  rows: NearbySpotRow[];
  savedAt: number;
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

/** Identifiant de bucket (région ~0,1° + filtre). */
export function offlineCacheBucketId(latitude: number, longitude: number, types: string[] | null): string {
  return `${round1(latitude)}_${round1(longitude)}_${filterTypesKey(types)}`;
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
 * Enregistre le résultat d’une requête réussie pour réutilisation hors ligne.
 */
export async function saveSpotsOfflineSnapshot(
  latitude: number,
  longitude: number,
  types: string[] | null,
  rows: NearbySpotRow[],
): Promise<void> {
  const filterKey = filterTypesKey(types);
  const id = offlineCacheBucketId(latitude, longitude, types);
  const { entries } = await readStore();
  const next = entries.filter((e) => e.id !== id);
  next.unshift({
    id,
    latitude,
    longitude,
    filterKey,
    rows,
    savedAt: Date.now(),
  });
  await writeStore(next.slice(0, MAX_ENTRIES));
}

/**
 * Retourne le snapshot le plus pertinent : même filtre de types, centre géographique proche.
 */
export async function loadSpotsOfflineSnapshot(
  latitude: number,
  longitude: number,
  types: string[] | null,
): Promise<NearbySpotRow[] | null> {
  const wantKey = filterTypesKey(types);
  const { entries } = await readStore();
  let best: CacheEntry | null = null;
  let bestDist = Infinity;
  for (const e of entries) {
    if (e.filterKey !== wantKey) continue;
    const d = haversineKm({ latitude, longitude }, { latitude: e.latitude, longitude: e.longitude });
    if (d <= MAX_DISTANCE_KM && d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best && best.rows.length > 0 ? best.rows : null;
}

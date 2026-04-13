import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Region } from 'react-native-maps';
import { haversineKm, regionToBounds } from './mapRegionBounds';
import type { NearbySpotRow } from './spotsNearbyRpc';

const STORAGE_KEY = 'airgocc.map.viewport.v1';
const TTL_MS = 48 * 60 * 60 * 1000;
const MAX_ENTRIES = 16;
const COVERAGE_SLACK = 1.02;

type CacheEntry = {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
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

function roundCoord(n: number): number {
  return Math.round(n * 10_000) / 10_000;
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

/** Les coins du viewport sont dans le disque (centre, radiusKm) utilisé pour le fetch ? */
function regionCoveredByFetchCircle(region: Region, centerLat: number, centerLng: number, radiusKm: number): boolean {
  const b = regionToBounds(region);
  const center = { latitude: centerLat, longitude: centerLng };
  const corners: { latitude: number; longitude: number }[] = [
    { latitude: b.north, longitude: b.east },
    { latitude: b.north, longitude: b.west },
    { latitude: b.south, longitude: b.east },
    { latitude: b.south, longitude: b.west },
  ];
  const limit = radiusKm * COVERAGE_SLACK;
  return corners.every((c) => haversineKm(center, c) <= limit);
}

export async function loadViewportCacheRows(region: Region, types: string[] | null): Promise<NearbySpotRow[] | null> {
  const wantKey = filterTypesKey(types);
  const now = Date.now();
  const { entries } = await readStore();

  for (const e of entries) {
    if (e.filterKey !== wantKey) continue;
    if (now - e.savedAt > TTL_MS) continue;
    if (regionCoveredByFetchCircle(region, e.centerLat, e.centerLng, e.radiusKm)) {
      return e.rows;
    }
  }
  return null;
}

export async function saveViewportCache(
  region: Region,
  types: string[] | null,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  rows: NearbySpotRow[],
): Promise<void> {
  const filterKey = filterTypesKey(types);
  const id = `vp_${filterKey}_${roundCoord(centerLat)}_${roundCoord(centerLng)}_${Math.round(radiusKm)}`;

  const { entries } = await readStore();
  const pruned = entries.filter((e) => e.id !== id);
  pruned.unshift({
    id,
    centerLat,
    centerLng,
    radiusKm,
    filterKey,
    rows,
    savedAt: Date.now(),
  });
  await writeStore(pruned.slice(0, MAX_ENTRIES));
}

import type { MapBounds } from '../mapRegionBounds';
import { haversineKm, regionToBounds } from '../mapRegionBounds';
import type { Region } from 'react-native-maps';
import { getSpotsDatabase, isRtreeEnabled } from './client';
import type { SpotPackRow } from './spotTypes';

/** Max de points issus de SQLite pour alimenter supercluster (hors state global du catalogue). */
export const VIEWPORT_QUERY_HARD_CAP = 8000;

type RawSpot = {
  spot_id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  is_verified: number;
  city: string | null;
  postal_code: string | null;
  description: string | null;
  created_by: string | null;
  updated_at: string;
};

function toRow(r: RawSpot): SpotPackRow {
  return {
    spotId: r.spot_id,
    name: r.name,
    type: r.type,
    lat: r.lat,
    lng: r.lng,
    isVerified: r.is_verified,
    city: r.city,
    postalCode: r.postal_code,
    description: r.description,
    createdBy: r.created_by,
    updatedAt: r.updated_at,
  };
}

function typeFilterClause(filterTypes: string[] | null): { sql: string; params: string[] } {
  if (!filterTypes || filterTypes.length === 0) {
    return { sql: '', params: [] };
  }
  const placeholders = filterTypes.map(() => '?').join(', ');
  return { sql: ` AND p.type IN (${placeholders})`, params: filterTypes };
}

/**
 * Rectangle visible + filtres ; tri par distance au centre ; limite `maxRows` (après tri).
 */
export async function querySpotsInViewport(
  bounds: MapBounds,
  filterTypes: string[] | null,
  maxRows: number,
): Promise<SpotPackRow[]> {
  const db = await getSpotsDatabase();
  const finalCap = Math.min(Math.max(1, maxRows), VIEWPORT_QUERY_HARD_CAP);
  const { west, east, south, north, centerLat, centerLng } = bounds;
  const { sql: typeSql, params: typeParams } = typeFilterClause(filterTypes);

  const useRtree = await isRtreeEnabled();

  /** Même bbox + ORDER BY → sous-ensemble stable ; distance² grossière au centre puis spot_id. */
  const orderAndLimit = ` ORDER BY ((p.lat - ?) * (p.lat - ?) + (p.lng - ?) * (p.lng - ?)) ASC, p.spot_id ASC LIMIT ?`;
  const orderParams = [centerLat, centerLat, centerLng, centerLng, finalCap];

  let raw: RawSpot[];

  if (useRtree) {
    raw =
      (await db.getAllAsync<RawSpot>(
        `SELECT spot_id, name, type, lat, lng, is_verified, city, postal_code, description, created_by, updated_at
         FROM spots_pack p
         JOIN spots_rtree r ON p.pk = r.id
         WHERE r.minX <= ? AND r.maxX >= ? AND r.minY <= ? AND r.maxY >= ?
         ${typeSql}${orderAndLimit}`,
        [east, west, north, south, ...typeParams, ...orderParams],
      )) ?? [];
  } else {
    raw =
      (await db.getAllAsync<RawSpot>(
        `SELECT spot_id, name, type, lat, lng, is_verified, city, postal_code, description, created_by, updated_at
         FROM spots_pack p
         WHERE p.lng >= ? AND p.lng <= ? AND p.lat >= ? AND p.lat <= ?
         ${typeSql}${orderAndLimit}`,
        [west, east, south, north, ...typeParams, ...orderParams],
      )) ?? [];
  }

  return raw.map(toRow);
}

/**
 * Liste / rayon autour d’un point (approximation par bbox puis filtre Haversine).
 */
export async function querySpotsWithinRadiusKm(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  filterTypes: string[] | null,
  maxRows: number,
): Promise<SpotPackRow[]> {
  const dLat = radiusKm / 111;
  const cos = Math.cos((centerLat * Math.PI) / 180);
  const dLng = radiusKm / (111 * Math.max(0.2, Math.abs(cos)));
  const fakeRegion: Region = {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: dLat * 2,
    longitudeDelta: dLng * 2,
  };
  const bounds = regionToBounds(fakeRegion);
  const rows = await querySpotsInViewport(bounds, filterTypes, VIEWPORT_QUERY_HARD_CAP);
  const center = { latitude: centerLat, longitude: centerLng };
  return rows
    .filter((r) => haversineKm(center, { latitude: r.lat, longitude: r.lng }) <= radiusKm * 1.05)
    .sort(
      (a, b) =>
        haversineKm(center, { latitude: a.lat, longitude: a.lng }) -
        haversineKm(center, { latitude: b.lat, longitude: b.lng }),
    )
    .slice(0, maxRows);
}

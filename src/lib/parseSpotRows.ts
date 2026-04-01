import type { NearbySpotRow } from './spotsNearbyRpc';

export type ParsedSpotBase = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  isVerified: boolean;
};

export function parseSpotsFromNearbyRows(rows: NearbySpotRow[]): ParsedSpotBase[] {
  return rows
    .map((row) => {
      const latitude = Number(row.latitude ?? row.lat);
      const longitude = Number(row.longitude ?? row.lng);
      const id = String(row.id ?? '');

      if (!id || Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

      return {
        id,
        name: String(row.name ?? 'Aire'),
        type: String(row.type ?? 'OTHER'),
        latitude,
        longitude,
        isVerified: row.is_verified == null ? true : Boolean(row.is_verified),
      } satisfies ParsedSpotBase;
    })
    .filter((v): v is ParsedSpotBase => v !== null);
}

import type { Region } from 'react-native-maps';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
}

/**
 * Boîte englobante de la carte visible (viewport MapView).
 */
export function regionToBounds(region: Region): MapBounds {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return {
    north: region.latitude + halfLat,
    south: region.latitude - halfLat,
    east: region.longitude + halfLng,
    west: region.longitude - halfLng,
    centerLat: region.latitude,
    centerLng: region.longitude,
  };
}

export function haversineKm(
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

/**
 * Rayon (km) du cercle centré sur la carte qui couvre tout le rectangle visible,
 * avec une petite marge.
 */
export function coverageRadiusKmForRegion(region: Region): number {
  const b = regionToBounds(region);
  const center = { latitude: b.centerLat, longitude: b.centerLng };
  const corners = [
    { latitude: b.north, longitude: b.east },
    { latitude: b.north, longitude: b.west },
    { latitude: b.south, longitude: b.east },
    { latitude: b.south, longitude: b.west },
  ];
  let max = 0;
  for (const c of corners) {
    const d = haversineKm(center, c);
    if (d > max) max = d;
  }
  return max * 1.08;
}

/** Point dans le rectangle géographique (hors chevauchement méridien / pôle). */
export function pointInBounds(latitude: number, longitude: number, b: MapBounds): boolean {
  if (latitude < b.south || latitude > b.north) return false;
  if (b.west <= b.east) {
    return longitude >= b.west && longitude <= b.east;
  }
  return longitude >= b.west || longitude <= b.east;
}

/** Limite côté client (la RPC doit accepter ce rayon ; ajuster si besoin côté Supabase). */
export function clampDownloadRadiusKm(raw: number): number {
  return Math.min(200, Math.max(5, Math.ceil(raw)));
}

import type { Region } from 'react-native-maps';
import { haversineKm, pointInBounds, regionToBounds } from './mapRegionBounds';
import { parseSpotsFromNearbyRows, type ParsedSpotBase } from './parseSpotRows';
import type { NearbySpotRow } from './spotsNearbyRpc';

export const MAP_VIEW_MAX_MARKERS = 50;

/**
 * Filtre strictement au rectangle visible, trie du plus proche au plus lointain (centre carte), limite.
 */
export function prepareMapSpotsFromRows(rows: NearbySpotRow[], region: Region, maxResults: number): ParsedSpotBase[] {
  const bounds = regionToBounds(region);
  const center = { latitude: bounds.centerLat, longitude: bounds.centerLng };

  const parsed = parseSpotsFromNearbyRows(rows);
  const inView = parsed.filter((p) => pointInBounds(p.latitude, p.longitude, bounds));

  inView.sort(
    (a, b) =>
      haversineKm(center, { latitude: a.latitude, longitude: a.longitude }) -
      haversineKm(center, { latitude: b.latitude, longitude: b.longitude }),
  );

  return inView.slice(0, maxResults);
}

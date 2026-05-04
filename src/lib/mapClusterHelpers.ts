import type { Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import type { Feature, Point } from 'geojson';
import type { SpotPackRow } from './localDb/spotTypes';

/** Zoom approximatif pour supercluster (Web Mercator). */
export function zoomFromRegion(region: Region): number {
  const { longitudeDelta } = region;
  const angle = longitudeDelta > 0 ? longitudeDelta : 360;
  const z = Math.log2(360 / angle);
  return Math.min(22, Math.max(0, z));
}

export type SpotFeatureProps = {
  cluster?: boolean;
  spotId: string;
  name: string;
  type: string;
  isVerified: boolean;
};

/**
 * Une seule entrée par coordonnées arrondies (6 décimales) : évite un cluster superposé
 * impossible à ouvrir quand deux aires partagent exactement le même point.
 */
export function collapseCoincidentSpotsForMap(rows: SpotPackRow[]): SpotPackRow[] {
  const byKey = new Map<string, SpotPackRow>();
  for (const r of rows) {
    const k = `${r.lat.toFixed(6)},${r.lng.toFixed(6)}`;
    const ex = byKey.get(k);
    if (!ex) {
      byKey.set(k, r);
      continue;
    }
    const tEx = ex.createdAt ?? ex.updatedAt;
    const tR = r.createdAt ?? r.updatedAt;
    const keep = tEx < tR || (tEx === tR && ex.spotId < r.spotId) ? ex : r;
    byKey.set(k, keep);
  }
  return Array.from(byKey.values());
}

export function spotsToFeatures(rows: SpotPackRow[]): Feature<Point, SpotFeatureProps>[] {
  return rows.map((r) => ({
    type: 'Feature',
    properties: {
      cluster: false,
      spotId: r.spotId,
      name: r.name,
      type: r.type,
      isVerified: Boolean(r.isVerified),
    },
    geometry: {
      type: 'Point',
      coordinates: [r.lng, r.lat],
    },
  }));
}

export function buildClusterIndex(features: Feature<Point, SpotFeatureProps>[]) {
  return new Supercluster<SpotFeatureProps>({
    radius: 72,
    maxZoom: 22,
    minPoints: 2,
  }).load(features);
}

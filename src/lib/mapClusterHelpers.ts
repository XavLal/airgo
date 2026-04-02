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
    maxZoom: 18,
    minPoints: 2,
  }).load(features);
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { TypeFilterBar } from '../../src/components/TypeFilterBar';
import { Badge, Button, Card } from '../../src/components/ui';
import SpotIcon, { type SpotType } from '../../src/components/SpotIcon';
import { SPOT_TYPE_CODES } from '../../src/constants/spotTypes';
import { countLocalSpots } from '../../src/lib/localDb/client';
import { querySpotsInViewport, VIEWPORT_QUERY_HARD_CAP } from '../../src/lib/localDb/spotQueries';
import { onSpotsLocalDbChanged } from '../../src/lib/localDb/spotSyncEvents';
import { runDeltaSpotSyncFromSupabase, runFullSpotSyncFromSupabase } from '../../src/lib/localDb/spotSync';
import { buildClusterIndex, spotsToFeatures, zoomFromRegion } from '../../src/lib/mapClusterHelpers';
import type { Feature, Point } from 'geojson';
import { regionToBounds } from '../../src/lib/mapRegionBounds';
import { getIsOnline } from '../../src/lib/networkStatus';
import type { ParsedSpotBase } from '../../src/lib/parseSpotRows';
import { DarkColors, Radius, Spacing, Typography, useTheme } from '../../src/theme';

const DEFAULT_REGION: Region = {
  latitude: 46.2276,
  longitude: 2.2137,
  latitudeDelta: 7.5,
  longitudeDelta: 7.5,
};

/** Évite une bbox dégénérée (delta 0) que Google Maps envoie parfois sur Android : requête SQLite vide. */
const MIN_DELTA = 0.005;

function withMinimumDeltas(r: Region): Region {
  return {
    ...r,
    latitudeDelta: Math.max(r.latitudeDelta, MIN_DELTA),
    longitudeDelta: Math.max(r.longitudeDelta, MIN_DELTA),
  };
}

type SpotMarker = ParsedSpotBase;

function packToMarker(spotId: string, name: string, type: string, lat: number, lng: number, isVerified: boolean): SpotMarker {
  return {
    id: spotId,
    name,
    type,
    latitude: lat,
    longitude: lng,
    isVerified,
  };
}

const MapSpotMarker = React.memo(function MapSpotMarker({
  spotId,
  latitude,
  longitude,
  name,
  typeCode,
  isVerified,
  spotType,
  pinBg,
  unverifiedColor,
  onOpen,
}: {
  spotId: string;
  latitude: number;
  longitude: number;
  name: string;
  typeCode: string;
  isVerified: boolean;
  spotType: SpotType;
  pinBg: string;
  unverifiedColor: string;
  onOpen: (id: string) => void;
}) {
  const handlePress = useCallback(() => onOpen(spotId), [onOpen, spotId]);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      title={name}
      description={typeCode}
      tracksViewChanges={false}
      onPress={handlePress}
    >
      <View
        style={[
          mapMarkerStyles.wrap,
          !isVerified
            ? { borderWidth: 2, borderColor: unverifiedColor, borderRadius: 999, padding: 2 }
            : null,
        ]}
      >
        <SpotIcon type={spotType} variant="pin" size={34} pinBackgroundColor={pinBg} />
      </View>
    </Marker>
  );
});

const mapMarkerStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function MapScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const clusterIndexRef = useRef<ReturnType<typeof buildClusterIndex> | null>(null);
  const viewportGenRef = useRef(0);
  const spotsRef = useRef<ParsedSpotBase[]>([]);
  const regionRef = useRef<Region>(DEFAULT_REGION);

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [clusters, setClusters] = useState<Feature<Point>[]>([]);
  const [viewportRowCount, setViewportRowCount] = useState(0);
  const [localSpotCount, setLocalSpotCount] = useState<number | null>(null);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  regionRef.current = region;

  const onRegionChangeComplete = useCallback((r: Region) => {
    setRegion(withMinimumDeltas(r));
  }, []);

  const hasLocationAccess = permissionStatus === 'granted';

  const mapPinFill = useMemo(
    () => (colors.background === DarkColors.background ? '#F0F7F2' : colors.surface),
    [colors.background, colors.surface],
  );

  const normalizeSpotType = useCallback((type: string): SpotType => {
    const hasKnownCode = (SPOT_TYPE_CODES as readonly string[]).includes(type);
    return (hasKnownCode ? type : 'OTHER') as SpotType;
  }, []);

  const handleOpenSpot = useCallback(
    (id: string) => {
      const spot = spotsRef.current.find((s) => s.id === id);
      if (!spot) return;
      router.push({
        pathname: '/spot/[id]',
        params: {
          id: spot.id,
          name: spot.name,
          type: spot.type,
          lat: String(spot.latitude),
          lng: String(spot.longitude),
          verified: spot.isVerified ? '1' : '0',
        },
      });
    },
    [router],
  );

  const refreshViewport = useCallback(
    async (targetRegion: Region) => {
      if (Platform.OS === 'web') {
        setClusters([]);
        setViewportRowCount(0);
        return;
      }

      const gen = ++viewportGenRef.current;
      setLoadingSpots(true);

      try {
        const total = await countLocalSpots();
        if (gen === viewportGenRef.current) setLocalSpotCount(total);

        if (total === 0) {
          if (gen === viewportGenRef.current) {
            setClusters([]);
            setViewportRowCount(0);
            spotsRef.current = [];
          }
          return;
        }

        const safeRegion = withMinimumDeltas(targetRegion);
        const bounds = regionToBounds(safeRegion);
        const z = Math.floor(zoomFromRegion(safeRegion));
        const rows = await querySpotsInViewport(bounds, filterTypes, VIEWPORT_QUERY_HARD_CAP);
        if (gen !== viewportGenRef.current) return;

        setViewportRowCount(rows.length);
        spotsRef.current = rows.map((r) =>
          packToMarker(r.spotId, r.name, r.type, r.lat, r.lng, Boolean(r.isVerified)),
        );

        const index = buildClusterIndex(spotsToFeatures(rows));
        clusterIndexRef.current = index;
        const bbox: [number, number, number, number] = [bounds.west, bounds.south, bounds.east, bounds.north];
        setClusters(index.getClusters(bbox, z) as Feature<Point>[]);
      } finally {
        if (gen === viewportGenRef.current) setLoadingSpots(false);
      }
    },
    [filterTypes],
  );

  const requestAndLocate = useCallback(async () => {
    setLoadingLocation(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);

    if (status !== 'granted') {
      setLoadingLocation(false);
      Alert.alert(t('map.geoDisabledTitle'), t('map.geoDisabledMessage'));
      return;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const nextRegion = withMinimumDeltas({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    });

    setUserLocation({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    });
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 450);
    setLoadingLocation(false);
  }, [t]);

  const onSyncFromServer = useCallback(async () => {
    const online = await getIsOnline();
    if (!online) {
      Alert.alert(t('offline.noCacheTitle'), t('map.downloadNeedNetwork'));
      return;
    }
    setSyncing(true);
    try {
      const nBefore = await countLocalSpots();
      if (nBefore === 0) {
        await runFullSpotSyncFromSupabase();
      } else {
        await runDeltaSpotSyncFromSupabase();
      }
      await refreshViewport(region);
      const n = await countLocalSpots();
      setLocalSpotCount(n);
      if (n === 0) {
        Alert.alert(t('common.error'), t('map.syncZeroRowsHint'));
      } else {
        Alert.alert(t('common.refresh'), t('map.syncDone'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), message);
    } finally {
      setSyncing(false);
    }
  }, [refreshViewport, region, t]);

  const onClusterPress = useCallback(
    (feature: Feature<Point>) => {
      const props = feature.properties as { cluster_id?: number };
      const [lng, lat] = feature.geometry.coordinates;
      const idx = clusterIndexRef.current;
      if (!idx || props.cluster_id == null || !mapRef.current) return;
      const z = idx.getClusterExpansionZoom(props.cluster_id);
      const longitudeDelta = 360 / Math.pow(2, Math.min(22, Math.max(z, 1)));
      const latitudeDelta = longitudeDelta;
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta,
          longitudeDelta,
        },
        280,
      );
    },
    [],
  );

  useEffect(() => {
    requestAndLocate().catch(() => {
      setLoadingLocation(false);
      Alert.alert(t('map.geoErrorTitle'), t('map.geoErrorMessage'));
    });
  }, [requestAndLocate, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshViewport(region).catch(() => setLoadingSpots(false));
    }, 480);
    return () => clearTimeout(timer);
  }, [refreshViewport, region]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    return onSpotsLocalDbChanged(() => {
      void refreshViewport(regionRef.current).catch(() => setLoadingSpots(false));
    });
  }, [refreshViewport]);

  const displayedSpotCount = useMemo(() => {
    return clusters.filter((c) => {
      const p = c.properties as { cluster?: boolean };
      return p.cluster !== true;
    }).length;
  }, [clusters]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={hasLocationAccess}
        showsMyLocationButton={hasLocationAccess}
      >
        {userLocation ? (
          <Marker coordinate={userLocation} title={t('map.youAreHere')} pinColor={colors.primary} />
        ) : null}
        {clusters.map((f, i) => {
          const [lng, lat] = f.geometry.coordinates;
          const props = f.properties as {
            cluster?: boolean;
            cluster_id?: number;
            point_count?: number;
            spotId?: string;
            name?: string;
            type?: string;
            isVerified?: boolean;
          };

          if (props.cluster) {
            const count = props.point_count ?? 0;
            return (
              <Marker
                key={`c-${props.cluster_id ?? i}`}
                coordinate={{ latitude: lat, longitude: lng }}
                onPress={() => onClusterPress(f)}
              >
                <View style={[styles.clusterBubble, { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}>
                  <Text style={styles.clusterText}>{count}</Text>
                </View>
              </Marker>
            );
          }

          if (!props.spotId || !props.name || !props.type) return null;

          return (
            <MapSpotMarker
              key={props.spotId}
              spotId={props.spotId}
              latitude={lat}
              longitude={lng}
              name={props.name}
              typeCode={props.type}
              isVerified={Boolean(props.isVerified)}
              spotType={normalizeSpotType(props.type)}
              pinBg={mapPinFill}
              unverifiedColor={colors.unverified}
              onOpen={handleOpenSpot}
            />
          );
        })}
      </MapView>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.controlsRow} pointerEvents="auto">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.title')}
            onPress={() => setIsInfoOpen((v) => !v)}
            style={[styles.roundButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {loadingSpots ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.burger}>
                <View style={[styles.burgerLine, { backgroundColor: colors.textPrimary }]} />
                <View style={[styles.burgerLine, { backgroundColor: colors.textPrimary }]} />
                <View style={[styles.burgerLine, { backgroundColor: colors.textPrimary }]} />
              </View>
            )}
          </Pressable>

          {isInfoOpen ? (
            <View style={styles.headerRightRow}>
              <Button
                label={loadingLocation ? t('map.locating') : t('map.recenter')}
                onPress={requestAndLocate}
                disabled={loadingLocation}
                variant="secondary"
                size="md"
                style={styles.recenterHeaderButton}
              />
              <Button
                label="+"
                size="md"
                variant="secondary"
                onPress={() => router.push('/add-spot')}
                accessibilityLabel={t('map.addSpot')}
                style={styles.headerAddButton}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('map.recenter')}
              onPress={requestAndLocate}
              disabled={loadingLocation}
              style={[styles.recenterButtonRound, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.recenterButtonText, { color: colors.textPrimary }]}>{'⌖'}</Text>
            </Pressable>
          )}
        </View>

        {isInfoOpen ? (
          <Card elevated style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.primary }]}>{t('map.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('map.subtitle')}</Text>

            <View style={styles.row}>
              <Badge
                label={t('map.spotsInRadius', { count: localSpotCount != null ? displayedSpotCount : 0 })}
                variant="service"
              />
              <Badge label={t('map.legendUnverified')} variant="warning" />
            </View>
            {localSpotCount != null && localSpotCount > 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {t('map.localIndexHint', { total: localSpotCount, inView: viewportRowCount })}
              </Text>
            ) : (
              <Text style={[styles.meta, { color: colors.textMuted }]}>{t('map.localIndexEmpty')}</Text>
            )}

            {loadingSpots ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.service} />
              </View>
            ) : null}

            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('map.filtersTitle')}</Text>
            <TypeFilterBar value={filterTypes} onChange={setFilterTypes} />

            <Button
              label={syncing ? t('map.syncRunning') : t('map.syncFromServer')}
              variant="secondary"
              onPress={onSyncFromServer}
              disabled={syncing || loadingSpots}
              fullWidth
            />
          </Card>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: Spacing.xxl + Spacing.md,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burger: {
    width: 20,
    gap: 4,
  },
  burgerLine: {
    height: 2.2,
    borderRadius: 2,
    width: '100%',
  },
  recenterButtonRound: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButtonText: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerAddButton: {
    width: 44,
    paddingHorizontal: 0,
    borderRadius: Radius.pill,
    height: 44,
  },
  recenterHeaderButton: {
    height: 44,
    alignSelf: 'center',
  },
  panel: {
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    width: '100%',
    marginTop: Spacing.sm,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  meta: { ...Typography.caption },
  filterLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  clusterBubble: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clusterText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

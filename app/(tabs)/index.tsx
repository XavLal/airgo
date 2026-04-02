import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import MapView from 'react-native-map-clustering';
import { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { TypeFilterBar } from '../../src/components/TypeFilterBar';
import { Badge, Button, Card } from '../../src/components/ui';
import SpotIcon, { type SpotType } from '../../src/components/SpotIcon';
import { SPOT_TYPE_CODES } from '../../src/constants/spotTypes';
import { clampDownloadRadiusKm, coverageRadiusKmForRegion, regionToBounds } from '../../src/lib/mapRegionBounds';
import { getIsOnline } from '../../src/lib/networkStatus';
import { MAP_VIEW_MAX_MARKERS, prepareMapSpotsFromRows } from '../../src/lib/mapSpotsViewport';
import { loadViewportCacheRows, saveViewportCache } from '../../src/lib/mapViewportCache';
import type { ParsedSpotBase } from '../../src/lib/parseSpotRows';
import { loadSpotsOfflineSnapshot, saveSpotsOfflineSnapshot } from '../../src/lib/spotsOfflineCache';
import { fetchSpotsNearby, type NearbySpotRow } from '../../src/lib/spotsNearbyRpc';
import { DarkColors, Radius, Spacing, Typography, useTheme } from '../../src/theme';

const DEFAULT_REGION: Region = {
  latitude: 46.2276,
  longitude: 2.2137,
  latitudeDelta: 7.5,
  longitudeDelta: 7.5,
};

/** Marqueurs carte : filtrés au viewport, triés par distance (voir mapSpotsViewport). */
type SpotMarker = ParsedSpotBase;

const MAP_RPC_FETCH_LIMIT = 400;

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
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [spots, setSpots] = useState<SpotMarker[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[] | null>(null);
  const [downloadingZone, setDownloadingZone] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const spotsFetchGenRef = useRef(0);
  const spotsRef = useRef<SpotMarker[]>([]);
  spotsRef.current = spots;

  const hasLocationAccess = permissionStatus === 'granted';

  /** Fond d’épingle clair pour contraster avec la carte (surface blanche en thème clair, quasi-blanc en sombre). */
  const mapPinFill = useMemo(
    () => (colors.background === DarkColors.background ? '#F0F7F2' : colors.surface),
    [colors.background, colors.surface],
  );

  const normalizeSpotType = useCallback((type: string): SpotType => {
    const hasKnownCode = (SPOT_TYPE_CODES as readonly string[]).includes(type);
    return (hasKnownCode ? type : 'OTHER') as SpotType;
  }, []);

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

    const nextRegion: Region = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };

    setUserLocation({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    });
    setRegion(nextRegion);
    setLoadingLocation(false);
  }, [t]);

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

  const fetchNearbySpots = useCallback(
    async (targetRegion: Region) => {
      const fetchId = ++spotsFetchGenRef.current;
      setLoadingSpots(true);

      try {
        const lat = targetRegion.latitude;
        const lng = targetRegion.longitude;
        let rows: NearbySpotRow[] = [];

        const online = await getIsOnline();

        const radiusKm = clampDownloadRadiusKm(coverageRadiusKmForRegion(targetRegion));

        try {
          if (online) {
            const viewportCached = await loadViewportCacheRows(targetRegion, filterTypes);
            if (viewportCached != null) {
              rows = viewportCached;
            } else {
              rows = await fetchSpotsNearby({
                latitude: lat,
                longitude: lng,
                radiusKm,
                types: filterTypes,
                limit: MAP_RPC_FETCH_LIMIT,
              });
              await saveViewportCache(targetRegion, filterTypes, lat, lng, radiusKm, rows);
              if (rows.length > 0) {
                await saveSpotsOfflineSnapshot(lat, lng, filterTypes, rows, { coverageRadiusKm: radiusKm });
              }
            }
          } else {
            const cached = await loadSpotsOfflineSnapshot(lat, lng, filterTypes);
            if (cached) {
              rows = cached;
            }
          }
        } catch (err) {
          const cached = await loadSpotsOfflineSnapshot(lat, lng, filterTypes);
          if (cached) {
            rows = cached;
          } else if (online) {
            const message = err instanceof Error ? err.message : String(err);
            if (fetchId === spotsFetchGenRef.current) {
              Alert.alert(t('map.spotsLoadErrorTitle'), `${message}\n${t('offline.networkErrorNoCache')}`);
            }
          }
        }

        if (!online && rows.length === 0) {
          if (fetchId === spotsFetchGenRef.current) {
            Alert.alert(t('offline.noCacheTitle'), t('offline.noCacheMessage'));
          }
        }

        if (fetchId !== spotsFetchGenRef.current) {
          return;
        }

        setSpots(prepareMapSpotsFromRows(rows, targetRegion, MAP_VIEW_MAX_MARKERS));
      } finally {
        if (fetchId === spotsFetchGenRef.current) {
          setLoadingSpots(false);
        }
      }
    },
    [filterTypes, t],
  );

  const downloadVisibleZoneForOffline = useCallback(async () => {
    const online = await getIsOnline();
    if (!online) {
      Alert.alert(t('offline.noCacheTitle'), t('map.downloadNeedNetwork'));
      return;
    }

    const bounds = regionToBounds(region);
    const radiusKm = clampDownloadRadiusKm(coverageRadiusKmForRegion(region));
    const fk = !filterTypes || filterTypes.length === 0 ? 'all' : [...filterTypes].sort().join(',');
    const id = `zone_${fk}_${radiusKm}_${[bounds.north, bounds.south, bounds.east, bounds.west].map((x) => Math.round(x * 10000)).join('_')}`;

    setDownloadingZone(true);
    try {
      const rows = await fetchSpotsNearby({
        latitude: region.latitude,
        longitude: region.longitude,
        radiusKm,
        types: filterTypes,
        limit: MAP_RPC_FETCH_LIMIT,
      });
      if (rows.length === 0) {
        Alert.alert(t('common.error'), t('map.downloadZoneEmpty'));
        return;
      }
      await saveSpotsOfflineSnapshot(region.latitude, region.longitude, filterTypes, rows, {
        bounds,
        coverageRadiusKm: radiusKm,
        id,
      });
      Alert.alert(
        t('map.downloadZoneSuccessTitle'),
        t('map.downloadZoneSuccessMessage', { count: rows.length, radius: radiusKm }),
      );
      await saveViewportCache(region, filterTypes, region.latitude, region.longitude, radiusKm, rows);
      setSpots(prepareMapSpotsFromRows(rows, region, MAP_VIEW_MAX_MARKERS));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('map.downloadZoneErrorTitle'), message);
    } finally {
      setDownloadingZone(false);
    }
  }, [filterTypes, region, t]);

  useEffect(() => {
    requestAndLocate().catch(() => {
      setLoadingLocation(false);
      Alert.alert(t('map.geoErrorTitle'), t('map.geoErrorMessage'));
    });
  }, [requestAndLocate, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNearbySpots(region).catch(() => {
        setLoadingSpots(false);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [fetchNearbySpots, region]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={hasLocationAccess}
        showsMyLocationButton={hasLocationAccess}
        radius={40}
        clusterColor={colors.primary}
        spiralEnabled
        animationEnabled
      >
        {userLocation ? (
          <Marker coordinate={userLocation} title={t('map.youAreHere')} pinColor={colors.primary} />
        ) : null}
        {spots.map((spot) => (
          <MapSpotMarker
            key={spot.id}
            spotId={spot.id}
            latitude={spot.latitude}
            longitude={spot.longitude}
            name={spot.name}
            typeCode={spot.type}
            isVerified={spot.isVerified}
            spotType={normalizeSpotType(spot.type)}
            pinBg={mapPinFill}
            unverifiedColor={colors.unverified}
            onOpen={handleOpenSpot}
          />
        ))}
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
              <Badge label={t('map.spotsInRadius', { count: spots.length })} variant="service" />
              <Badge label={t('map.legendUnverified')} variant="warning" />
            </View>

            {loadingSpots ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.service} />
              </View>
            ) : null}

            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('map.filtersTitle')}</Text>
            <TypeFilterBar value={filterTypes} onChange={setFilterTypes} />

            <Button
              label={downloadingZone ? t('map.downloadZoneWorking') : t('map.downloadZone')}
              variant="secondary"
              onPress={() => downloadVisibleZoneForOffline()}
              disabled={downloadingZone || loadingSpots}
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
});

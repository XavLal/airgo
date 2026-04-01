import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import MapView from 'react-native-map-clustering';
import { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { TypeFilterBar } from '../../src/components/TypeFilterBar';
import { Badge, Button, Card } from '../../src/components/ui';
import { fetchSpotsNearby } from '../../src/lib/spotsNearbyRpc';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

const DEFAULT_REGION: Region = {
  latitude: 46.2276,
  longitude: 2.2137,
  latitudeDelta: 7.5,
  longitudeDelta: 7.5,
};

type SpotMarker = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  isVerified: boolean;
};

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

  const hasLocationAccess = permissionStatus === 'granted';
  const permissionLabel = useMemo(() => {
    if (permissionStatus === null) return t('map.permissionPending');
    if (permissionStatus === 'granted') return t('map.permissionGranted');
    return t('map.permissionDenied');
  }, [permissionStatus, t]);

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

  const fetchNearbySpots = useCallback(
    async (targetRegion: Region) => {
      setLoadingSpots(true);

      try {
        const rows = await fetchSpotsNearby({
          latitude: targetRegion.latitude,
          longitude: targetRegion.longitude,
          radiusKm: 50,
          types: filterTypes,
        });

        const parsed = rows
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
            } satisfies SpotMarker;
          })
          .filter((value): value is SpotMarker => value !== null);

        setSpots(parsed);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(t('map.spotsLoadErrorTitle'), message);
      } finally {
        setLoadingSpots(false);
      }
    },
    [filterTypes, t],
  );

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
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            title={spot.name}
            description={spot.type}
            pinColor={spot.isVerified ? colors.service : colors.unverified}
            onCalloutPress={() =>
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
              })
            }
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        <Card style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]} elevated>
          <Text style={[styles.title, { color: colors.primary }]}>{t('map.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('map.subtitle')}</Text>

          <View style={styles.row}>
            <Badge label={permissionLabel} variant={hasLocationAccess ? 'success' : 'warning'} />
            {loadingLocation ? <ActivityIndicator color={colors.primary} /> : null}
            {loadingSpots ? <ActivityIndicator color={colors.service} /> : null}
          </View>
          <Badge label={t('map.spotsInRadius', { count: spots.length })} variant="service" />
          <Badge label={t('map.legendUnverified')} variant="warning" />

          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('map.filtersTitle')}</Text>
          <TypeFilterBar value={filterTypes} onChange={setFilterTypes} />

          <Button
            label={loadingLocation ? t('map.locating') : t('map.recenter')}
            onPress={requestAndLocate}
            disabled={loadingLocation}
            fullWidth
          />
          <Button label={t('map.addSpot')} variant="secondary" onPress={() => router.push('/add-spot')} fullWidth />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: Spacing.xxl + Spacing.sm,
    left: Spacing.lg,
    right: Spacing.lg,
    maxHeight: '55%',
  },
  panel: {
    gap: Spacing.sm,
    borderRadius: Radius.lg,
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

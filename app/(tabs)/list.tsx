import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { TypeFilterBar } from '../../src/components/TypeFilterBar';
import { Badge, Button, Card, ScreenContainer } from '../../src/components/ui';
import { fetchSpotsNearby } from '../../src/lib/spotsNearbyRpc';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

type SpotRow = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isVerified: boolean;
};

function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export default function ListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[] | null>(null);

  const permissionLabel = useMemo(() => {
    if (permissionStatus === null) return t('map.permissionPending');
    if (permissionStatus === 'granted') return t('map.permissionGranted');
    return t('map.permissionDenied');
  }, [permissionStatus, t]);

  const loadNearbyList = useCallback(async () => {
    setLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status !== 'granted') {
      setLoading(false);
      Alert.alert(t('list.permissionNeededTitle'), t('list.permissionNeededMessage'));
      return;
    }

    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const center = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
    setUserLocation(center);

    try {
      const rows = await fetchSpotsNearby({
        latitude: center.latitude,
        longitude: center.longitude,
        radiusKm: 50,
        types: filterTypes,
      });

      const parsed = rows
        .map((row) => {
          const latitude = Number(row.latitude ?? row.lat);
          const longitude = Number(row.longitude ?? row.lng);
          const id = String(row.id ?? '');
          if (!id || Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

          const distanceKm = haversineDistanceKm(center, { latitude, longitude });
          return {
            id,
            name: String(row.name ?? 'Aire'),
            type: String(row.type ?? 'OTHER'),
            latitude,
            longitude,
            distanceKm,
            isVerified: row.is_verified == null ? true : Boolean(row.is_verified),
          } satisfies SpotRow;
        })
        .filter((item): item is SpotRow => item !== null)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      setSpots(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('list.loadErrorTitle'), message);
    } finally {
      setLoading(false);
    }
  }, [filterTypes, t]);

  useEffect(() => {
    loadNearbyList().catch(() => {
      setLoading(false);
      Alert.alert(t('common.error'), t('list.genericError'));
    });
  }, [loadNearbyList, t]);

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>{t('list.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('list.subtitle')}</Text>
        <View style={styles.row}>
          <Badge label={permissionLabel} variant={permissionStatus === 'granted' ? 'success' : 'warning'} />
          <Badge label={t('list.results', { count: spots.length })} variant="service" />
          {userLocation ? (
            <Badge label={`${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`} variant="default" />
          ) : null}
        </View>

        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('map.filtersTitle')}</Text>
        <TypeFilterBar value={filterTypes} onChange={setFilterTypes} />

        <Button
          label={loading ? t('list.refreshing') : t('list.refresh')}
          onPress={loadNearbyList}
          disabled={loading}
          fullWidth
        />
        <Button label={t('list.addSpot')} variant="secondary" onPress={() => router.push('/add-spot')} fullWidth />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('list.loadingSpots')}</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Card style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.itemTop}>
                <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
                <Badge label={`#${index + 1}`} variant="default" />
              </View>
              <View style={styles.row}>
                <Badge label={item.type} variant="service" />
                <Badge label={`${item.distanceKm.toFixed(1)} km`} variant="parking" />
                {!item.isVerified ? <Badge label={t('list.unverified')} variant="warning" /> : null}
              </View>
              <Button
                label={t('list.seeDetail')}
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/spot/[id]',
                    params: {
                      id: item.id,
                      name: item.name,
                      type: item.type,
                      lat: String(item.latitude),
                      lng: String(item.longitude),
                      verified: item.isVerified ? '1' : '0',
                    },
                  })
                }
              />
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.loadingWrap}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('list.empty')}</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  filterLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  listContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  itemCard: {
    borderRadius: Radius.md,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemName: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
});

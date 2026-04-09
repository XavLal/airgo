import { useCallback, useEffect, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { TypeFilterBar } from '../../src/components/TypeFilterBar';
import SpotIcon, { toSpotIconType } from '../../src/components/SpotIcon';
import { Badge, Button, Card, ScreenContainer } from '../../src/components/ui';
import { countLocalSpots } from '../../src/lib/localDb/client';
import { querySpotsWithinRadiusKm } from '../../src/lib/localDb/spotQueries';
import { getIsOnline } from '../../src/lib/networkStatus';
import { loadSpotsOfflineSnapshot } from '../../src/lib/spotsOfflineCache';
import { fetchSpotsNearby, type NearbySpotRow } from '../../src/lib/spotsNearbyRpc';
import { parseSpotsFromNearbyRows } from '../../src/lib/parseSpotRows';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';
import { getSpotTypeLabel } from '../../src/constants/spotTypes';
import { supabase } from '../../src/lib/supabase';

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

const LIST_RADIUS_KM = 50;
const LIST_MAX = 200;

export default function ListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[] | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsLoggedIn(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadNearbyList = useCallback(async () => {
    setLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
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

    try {
      if (Platform.OS !== 'web') {
        const n = await countLocalSpots();
        if (n > 0) {
          const packs = await querySpotsWithinRadiusKm(
            center.latitude,
            center.longitude,
            LIST_RADIUS_KM,
            filterTypes,
            LIST_MAX,
          );
          const parsed: SpotRow[] = packs.map((p) => ({
            id: p.spotId,
            name: p.name,
            type: p.type,
            latitude: p.lat,
            longitude: p.lng,
            isVerified: Boolean(p.isVerified),
            distanceKm: haversineDistanceKm(center, { latitude: p.lat, longitude: p.lng }),
          }));
          setSpots(parsed);
          setLoading(false);
          return;
        }
      }

      let rows: NearbySpotRow[] = [];
      const online = await getIsOnline();

      try {
        if (online) {
          rows = await fetchSpotsNearby({
            latitude: center.latitude,
            longitude: center.longitude,
            radiusKm: LIST_RADIUS_KM,
            types: filterTypes,
          });
        } else {
          const cached = await loadSpotsOfflineSnapshot(center.latitude, center.longitude, filterTypes);
          if (cached) rows = cached;
        }
      } catch (err) {
        const cached = await loadSpotsOfflineSnapshot(center.latitude, center.longitude, filterTypes);
        if (cached) {
          rows = cached;
        } else if (online) {
          const message = err instanceof Error ? err.message : String(err);
          Alert.alert(t('list.loadErrorTitle'), `${message}\n${t('offline.networkErrorNoCache')}`);
        }
      }

      if (!online && rows.length === 0) {
        Alert.alert(t('offline.noCacheTitle'), t('offline.noCacheMessage'));
      }

      const base = parseSpotsFromNearbyRows(rows);
      const parsed = base
        .map((b) => ({
          ...b,
          distanceKm: haversineDistanceKm(center, { latitude: b.latitude, longitude: b.longitude }),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      setSpots(parsed);
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
        <View style={styles.filterHeaderRow}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('map.filtersTitle')}</Text>
          <Text style={[styles.filterMeta, { color: colors.textMuted }]}>rayon {LIST_RADIUS_KM} km</Text>
          <Badge label={`${spots.length} résultats`} variant="service" />
        </View>
        <TypeFilterBar value={filterTypes} onChange={setFilterTypes} />

        <View style={styles.actionRow}>
          <Button
            label={loading ? t('list.refreshing') : t('list.refresh')}
            onPress={loadNearbyList}
            disabled={loading}
            style={styles.refreshButton}
          />
          {isLoggedIn ? (
            <Button
              label="+"
              size="md"
              variant="secondary"
              onPress={() => router.push('/add-spot')}
              disabled={loading}
              accessibilityLabel={t('list.addSpot')}
              style={styles.iconAddButton}
            />
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('list.loadingSpots')}</Text>
        </View>
      ) : (
        <FlashList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Card style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.itemTop}>
                <SpotIcon type={toSpotIconType(item.type)} variant="icon" size={44} />
                <View style={styles.itemTitleBlock}>
                  <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.itemTypeLabel, { color: colors.textSecondary }]}>
                    {getSpotTypeLabel(item.type)}
                  </Text>
                  <Text style={[styles.itemDistance, { color: colors.textMuted }]}>
                    {item.distanceKm.toFixed(1)} km
                  </Text>
                </View>
                <Badge label={`#${index + 1}`} variant="default" />
              </View>
              {!item.isVerified ? (
                <Badge label={t('list.unverified')} variant="warning" />
              ) : null}
              <Button
                label={t('list.seeDetail')}
                size="sm"
                variant="secondary"
                style={styles.detailButton}
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
  subtitle: { ...Typography.subtitle },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  filterLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  filterMeta: {
    ...Typography.caption,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  refreshButton: {
    flex: 1,
  },
  iconAddButton: {
    width: 48,
    paddingHorizontal: 0,
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
    gap: Spacing.sm,
  },
  itemTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...Typography.body,
    fontWeight: '600',
  },
  itemTypeLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  itemDistance: {
    ...Typography.caption,
    marginTop: 1,
  },
  detailButton: {
    marginTop: Spacing.sm,
  },
});

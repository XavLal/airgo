import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Badge, Button, Card, ScreenContainer } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

type SpotRow = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

const DEFAULT_CENTER = {
  latitude: 46.2276,
  longitude: 2.2137,
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
  const { colors } = useTheme();
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [spots, setSpots] = useState<SpotRow[]>([]);

  const permissionLabel = useMemo(() => {
    if (permissionStatus === null) return 'Permission en attente';
    if (permissionStatus === 'granted') return 'Permission accordee';
    return 'Permission refusee';
  }, [permissionStatus]);

  const loadNearbyList = useCallback(async () => {
    setLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status !== 'granted') {
      setLoading(false);
      Alert.alert('Geolocalisation', 'Permission requise pour trier par proximite.');
      return;
    }

    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const center = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
    setUserLocation(center);

    const payloads = [
      { p_lat: center.latitude, p_lng: center.longitude, p_radius_km: 50 },
      { lat: center.latitude, lng: center.longitude, radius_km: 50 },
      { latitude: center.latitude, longitude: center.longitude, radius_km: 50 },
    ];

    let data: unknown[] | null = null;
    let lastError = '';
    for (const payload of payloads) {
      const { data: res, error } = await supabase.rpc('spots_nearby', payload);
      if (!error) {
        data = (res as unknown[]) ?? [];
        break;
      }
      lastError = error.message;
    }

    if (!data) {
      setLoading(false);
      Alert.alert('Liste des aires', `RPC spots_nearby indisponible: ${lastError}`);
      return;
    }

    const parsed = data
      .map((item) => {
        const row = item as Record<string, unknown>;
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
        } satisfies SpotRow;
      })
      .filter((item): item is SpotRow => item !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    setSpots(parsed);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNearbyList().catch(() => {
      setLoading(false);
      Alert.alert('Erreur', 'Impossible de charger la liste des aires.');
    });
  }, [loadNearbyList]);

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>Liste des aires</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Triee par proximite (rayon 50 km)</Text>
        <View style={styles.row}>
          <Badge label={permissionLabel} variant={permissionStatus === 'granted' ? 'success' : 'warning'} />
          <Badge label={`${spots.length} resultats`} variant="service" />
          {userLocation ? (
            <Badge label={`${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`} variant="default" />
          ) : null}
        </View>
        <Button
          label={loading ? 'Actualisation...' : 'Actualiser la liste'}
          onPress={loadNearbyList}
          disabled={loading}
          fullWidth
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Chargement des aires...</Text>
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
              </View>
              <Button
                label="Voir la fiche"
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
                    },
                  })
                }
              />
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.loadingWrap}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucune aire trouvee dans 50 km.</Text>
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

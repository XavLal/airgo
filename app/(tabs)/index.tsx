import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Badge, Button, Card } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
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
};

export default function MapScreen() {
  const { colors } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [spots, setSpots] = useState<SpotMarker[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);

  const hasLocationAccess = permissionStatus === 'granted';
  const permissionLabel = useMemo(() => {
    if (permissionStatus === null) return 'En attente de permission';
    if (permissionStatus === 'granted') return 'Permission accordee';
    return 'Permission refusee';
  }, [permissionStatus]);

  const requestAndLocate = useCallback(async () => {
    setLoadingLocation(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);

    if (status !== 'granted') {
      setLoadingLocation(false);
      Alert.alert(
        'Geolocalisation desactivee',
        "Active la localisation pour centrer la carte sur ta position."
      );
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
  }, []);

  const fetchNearbySpots = useCallback(async (targetRegion: Region) => {
    setLoadingSpots(true);

    const payloads = [
      { p_lat: targetRegion.latitude, p_lng: targetRegion.longitude, p_radius_km: 50 },
      { lat: targetRegion.latitude, lng: targetRegion.longitude, radius_km: 50 },
      { latitude: targetRegion.latitude, longitude: targetRegion.longitude, radius_km: 50 },
    ];

    let data: unknown[] | null = null;
    let lastErrorMessage = '';

    for (const payload of payloads) {
      const { data: res, error } = await supabase.rpc('spots_nearby', payload);
      if (!error) {
        data = (res as unknown[]) ?? [];
        break;
      }
      lastErrorMessage = error.message;
    }

    if (!data) {
      setLoadingSpots(false);
      Alert.alert('Chargement des aires', `RPC spots_nearby indisponible: ${lastErrorMessage}`);
      return;
    }

    const parsed = data
      .map((item) => {
        const row = item as Record<string, unknown>;
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
        } satisfies SpotMarker;
      })
      .filter((value): value is SpotMarker => value !== null);

    setSpots(parsed);
    setLoadingSpots(false);
  }, []);

  useEffect(() => {
    requestAndLocate().catch(() => {
      setLoadingLocation(false);
      Alert.alert('Erreur localisation', 'Impossible de recuperer votre position.');
    });
  }, [requestAndLocate]);

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
          <Marker coordinate={userLocation} title="Vous etes ici" pinColor={colors.primary} />
        ) : null}
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            title={spot.name}
            description={spot.type}
            pinColor={colors.service}
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        <Card style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]} elevated>
          <Text style={[styles.title, { color: colors.primary }]}>Carte des aires</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Phase 4: react-native-maps + geolocalisation
          </Text>

          <View style={styles.row}>
            <Badge label={permissionLabel} variant={hasLocationAccess ? 'success' : 'warning'} />
            {loadingLocation ? <ActivityIndicator color={colors.primary} /> : null}
            {loadingSpots ? <ActivityIndicator color={colors.service} /> : null}
          </View>
          <Badge label={`${spots.length} aires dans 50 km`} variant="service" />

          <Button
            label={loadingLocation ? 'Localisation...' : 'Recentrer sur ma position'}
            onPress={requestAndLocate}
            disabled={loadingLocation}
            fullWidth
          />
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
  },
  panel: {
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});

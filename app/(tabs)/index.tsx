import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Badge, Button, Card } from '../../src/components/ui';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

const DEFAULT_REGION: Region = {
  latitude: 46.2276,
  longitude: 2.2137,
  latitudeDelta: 7.5,
  longitudeDelta: 7.5,
};

export default function MapScreen() {
  const { colors } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

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

  useEffect(() => {
    requestAndLocate().catch(() => {
      setLoadingLocation(false);
      Alert.alert('Erreur localisation', 'Impossible de recuperer votre position.');
    });
  }, [requestAndLocate]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={hasLocationAccess}
        showsMyLocationButton={hasLocationAccess}
      >
        {userLocation ? (
          <Marker coordinate={userLocation} title="Vous etes ici" pinColor={colors.primary} />
        ) : null}
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
          </View>

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

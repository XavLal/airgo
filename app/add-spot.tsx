import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, Card, Input, ScreenContainer } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../src/theme';

export default function AddSpotScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('APN');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);

  const fillCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Active la geolocalisation pour pre-remplir les coordonnees.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLatitude(String(pos.coords.latitude));
    setLongitude(String(pos.coords.longitude));
  };

  const submitSpot = async () => {
    if (!name.trim() || !type.trim() || !latitude.trim() || !longitude.trim()) {
      Alert.alert('Champs manquants', 'Nom, type, latitude et longitude sont requis.');
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert('Coordonnees invalides', 'Latitude/Longitude doivent etre numeriques.');
      return;
    }

    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    const { error } = await supabase.from('spots').insert({
      name: name.trim(),
      city: city.trim() || null,
      postal_code: postalCode.trim() || null,
      description: description.trim() || null,
      type: type.trim(),
      is_verified: false,
      created_by: userId,
      location: `POINT(${lng} ${lat})`,
    });

    setLoading(false);
    if (error) {
      Alert.alert('Ajout impossible', error.message);
      return;
    }

    Alert.alert('Aire envoyee', "L'aire a ete creee en non verifiee.");
    setName('');
    setCity('');
    setPostalCode('');
    setDescription('');
    setType('APN');
  };

  return (
    <ScreenContainer>
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Ajouter une aire</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          L'aire sera creee avec le statut non verifie.
        </Text>
        <Input label="Nom" value={name} onChangeText={setName} />
        <Input label="Ville" value={city} onChangeText={setCity} />
        <Input label="Code postal" value={postalCode} onChangeText={setPostalCode} />
        <Input label="Description" value={description} onChangeText={setDescription} />
        <Input label="Type (AA, AC, APN...)" value={type} onChangeText={setType} autoCapitalize="characters" />

        <View style={styles.row}>
          <Input
            label="Latitude"
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="decimal-pad"
            style={styles.half}
          />
          <Input
            label="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="decimal-pad"
            style={styles.half}
          />
        </View>
        <Button label="Utiliser ma position" variant="secondary" onPress={fillCurrentLocation} />
        <Button label={loading ? 'Envoi...' : "Publier l'aire"} onPress={submitSpot} disabled={loading} fullWidth />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  half: {
    flex: 1,
  },
});

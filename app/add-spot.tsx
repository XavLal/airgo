import { useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { Button, Card, Input, ScreenContainer } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../src/theme';

export default function AddSpotScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('APN');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('addSpot.title') });
  }, [navigation, t]);

  const fillCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('addSpot.permissionTitle'), t('addSpot.permissionMessage'));
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLatitude(String(pos.coords.latitude));
    setLongitude(String(pos.coords.longitude));
  };

  const submitSpot = async () => {
    if (!name.trim() || !type.trim() || !latitude.trim() || !longitude.trim()) {
      Alert.alert(t('addSpot.missingFieldsTitle'), t('addSpot.missingFieldsMessage'));
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert(t('addSpot.invalidCoordsTitle'), t('addSpot.invalidCoordsMessage'));
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
      Alert.alert(t('addSpot.errorTitle'), error.message);
      return;
    }

    Alert.alert(t('addSpot.successTitle'), t('addSpot.successMessage'));
    setName('');
    setCity('');
    setPostalCode('');
    setDescription('');
    setType('APN');
    setLatitude('');
    setLongitude('');
  };

  return (
    <ScreenContainer>
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>{t('addSpot.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('addSpot.subtitle')}</Text>
        <Input label={t('addSpot.name')} value={name} onChangeText={setName} />
        <Input label={t('addSpot.city')} value={city} onChangeText={setCity} />
        <Input label={t('addSpot.postalCode')} value={postalCode} onChangeText={setPostalCode} />
        <Input label={t('addSpot.description')} value={description} onChangeText={setDescription} />
        <Input label={t('addSpot.type')} value={type} onChangeText={setType} autoCapitalize="characters" />

        <View style={styles.row}>
          <Input
            label={t('addSpot.latitude')}
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="decimal-pad"
            style={styles.half}
          />
          <Input
            label={t('addSpot.longitude')}
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="decimal-pad"
            style={styles.half}
          />
        </View>
        <Button label={t('addSpot.useMyLocation')} variant="secondary" onPress={fillCurrentLocation} />
        <Button label={loading ? t('addSpot.submitting') : t('addSpot.submit')} onPress={submitSpot} disabled={loading} fullWidth />
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

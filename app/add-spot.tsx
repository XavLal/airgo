import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { Button, Card, Input, Select } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { SPOT_TYPE_CODES, SPOT_TYPE_LABELS } from '../src/constants/spotTypes';
import { Radius, Spacing, Typography, useTheme } from '../src/theme';

const TYPE_OPTIONS = SPOT_TYPE_CODES.map((code) => ({
  value: code,
  label: SPOT_TYPE_LABELS[code],
}));

export default function AddSpotScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('APN');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('addSpot.title') });
  }, [navigation, t]);

  /** Nom généré automatiquement : "[Type complet] · [Ville]" ou "[Type complet]". */
  const generatedName = useMemo(() => {
    const typeLabel = SPOT_TYPE_LABELS[type as keyof typeof SPOT_TYPE_LABELS] ?? type;
    return city.trim() ? `${typeLabel} · ${city.trim()}` : typeLabel;
  }, [type, city]);

  /** Demande la permission, récupère la position et fait le géocodage inverse. */
  const fillLocationFields = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('addSpot.permissionTitle'), t('addSpot.permissionMessage'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;

      setLatitude(String(lat));
      setLongitude(String(lng));

      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (place) {
        if (place.city) setCity(place.city);
        else if (place.subregion) setCity(place.subregion);
        if (place.postalCode) setPostalCode(place.postalCode);
      }
    } catch {
      // Coordonnées non disponibles, champs laissés vides
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    fillLocationFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitSpot = async () => {
    if (!type.trim() || !latitude.trim() || !longitude.trim()) {
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
      name: generatedName,
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
    setCity('');
    setPostalCode('');
    setDescription('');
    setType('APN');
    setLatitude('');
    setLongitude('');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.primary }]}>{t('addSpot.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('addSpot.subtitle')}</Text>

            <Select
              label={t('addSpot.type')}
              value={type}
              options={TYPE_OPTIONS}
              onChange={setType}
            />

            {/* Nom généré en aperçu */}
            <View style={[styles.namePreview, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.namePreviewLabel, { color: colors.textMuted }]}>
                Nom généré automatiquement
              </Text>
              <Text style={[styles.namePreviewValue, { color: colors.textPrimary }]}>
                {generatedName}
              </Text>
            </View>

            <Input label={t('addSpot.city')} value={city} onChangeText={setCity} />
            <Input
              label={t('addSpot.postalCode')}
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="number-pad"
            />
            <Input label={t('addSpot.description')} value={description} onChangeText={setDescription} />

            <Input
              label={t('addSpot.latitude')}
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="decimal-pad"
              hint={locating ? 'Localisation en cours…' : undefined}
            />
            <Input
              label={t('addSpot.longitude')}
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="decimal-pad"
            />

            <Button
              label={locating ? 'Localisation en cours…' : t('addSpot.useMyLocation')}
              variant="secondary"
              onPress={fillLocationFields}
              disabled={locating}
              fullWidth
            />
            <Button
              label={loading ? t('addSpot.submitting') : t('addSpot.submit')}
              onPress={submitSpot}
              disabled={loading}
              fullWidth
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  card: {
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  namePreview: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: 2,
  },
  namePreviewLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  namePreviewValue: {
    ...Typography.body,
    fontStyle: 'italic',
  },
});

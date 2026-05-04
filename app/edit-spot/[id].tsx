import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { Button, Card, Input, Select } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { extractLatLng, isSoftDeletedRow } from '../../src/lib/localDb/spotSync';
import { SPOT_TYPE_CODES, SPOT_TYPE_LABELS } from '../../src/constants/spotTypes';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

const TYPE_OPTIONS = SPOT_TYPE_CODES.map((code) => ({
  value: code,
  label: SPOT_TYPE_LABELS[code],
}));

export default function EditSpotScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loadingSpot, setLoadingSpot] = useState(true);
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('APN');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('editSpot.title') });
  }, [navigation, t]);

  const generatedName = useMemo(() => {
    const typeLabel = SPOT_TYPE_LABELS[type as keyof typeof SPOT_TYPE_LABELS] ?? type;
    return city.trim() ? `${typeLabel} · ${city.trim()}` : typeLabel;
  }, [type, city]);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoadingSpot(true);
      try {
        const [{ data: auth }, { data, error }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from('spots')
            .select('id, name, type, city, postal_code, description, created_by, is_verified, location, deleted_at')
            .eq('id', id)
            .maybeSingle(),
        ]);

        if (error) {
          Alert.alert(t('editSpot.loadErrorTitle'), error.message);
          router.back();
          return;
        }

        if (!data) {
          Alert.alert(t('spotDetail.unavailableTitle'), t('spotDetail.unavailableMessage'));
          router.back();
          return;
        }

        const row = data as Record<string, unknown>;
        if (isSoftDeletedRow(row)) {
          Alert.alert(t('spotDetail.unavailableTitle'), t('spotDetail.unavailableMessage'));
          router.back();
          return;
        }

        const userId = auth.user?.id;
        const ownerId = data.created_by != null ? String(data.created_by) : null;
        if (!userId || ownerId !== userId) {
          Alert.alert(t('editSpot.forbiddenTitle'), t('editSpot.forbiddenMessage'));
          router.back();
          return;
        }
        if (Boolean(data.is_verified)) {
          Alert.alert(t('editSpot.forbiddenTitle'), t('editSpot.forbiddenMessage'));
          router.back();
          return;
        }

        const coords = extractLatLng(row);
        setCity(data.city ?? '');
        setPostalCode(data.postal_code ?? '');
        setDescription(data.description != null ? String(data.description) : '');
        setType(String(data.type ?? 'APN'));
        if (coords) {
          setLatitude(String(coords.lat));
          setLongitude(String(coords.lng));
        }
      } finally {
        setLoadingSpot(false);
      }
    })();
  }, [id, router, t]);

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
      /* ignore */
    } finally {
      setLocating(false);
    }
  };

  const submitUpdate = async () => {
    if (!id) return;
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
    const userId = auth.user?.id;
    if (!userId) {
      setLoading(false);
      Alert.alert(t('editSpot.forbiddenTitle'), t('editSpot.forbiddenMessage'));
      return;
    }

    const { error } = await supabase
      .from('spots')
      .update({
        name: generatedName,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        description: description.trim() || null,
        type: type.trim(),
        location: `POINT(${lng} ${lat})`,
      })
      .eq('id', id)
      .eq('created_by', userId)
      .eq('is_verified', false);

    setLoading(false);
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('SPOT_TOO_CLOSE')) {
        Alert.alert(t('editSpot.errorTitle'), t('addSpot.tooCloseMessage'));
        return;
      }
      Alert.alert(t('editSpot.errorTitle'), msg);
      return;
    }

    Alert.alert(t('editSpot.successTitle'), t('editSpot.successMessage'));
    router.back();
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
          {loadingSpot ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('common.loading')}</Text>
            </View>
          ) : (
            <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{t('editSpot.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('editSpot.subtitle')}</Text>

              <Select label={t('addSpot.type')} value={type} options={TYPE_OPTIONS} onChange={setType} />

              <View style={[styles.namePreview, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.namePreviewLabel, { color: colors.textMuted }]}>Nom généré automatiquement</Text>
                <Text style={[styles.namePreviewValue, { color: colors.textPrimary }]}>{generatedName}</Text>
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
                label={loading ? t('editSpot.submitting') : t('editSpot.submit')}
                onPress={submitUpdate}
                disabled={loading}
                fullWidth
              />
            </Card>
          )}
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
  loadingWrap: {
    paddingTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
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

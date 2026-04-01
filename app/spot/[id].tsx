import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, ScreenContainer } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

type SpotDetail = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type SpotReview = {
  id: string;
  rating: number | null;
  comment: string | null;
  createdAt: string | null;
};

type SpotPhoto = {
  id: string;
  url: string;
};

export default function SpotDetailScreen() {
  const { colors } = useTheme();
  const { id, name, type, lat, lng } = useLocalSearchParams<{
    id: string;
    name?: string;
    type?: string;
    lat?: string;
    lng?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [reviews, setReviews] = useState<SpotReview[]>([]);
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);

  useEffect(() => {
    if (!id) return;

    const latitude = lat ? Number(lat) : null;
    const longitude = lng ? Number(lng) : null;
    const hasRoutePayload = !!name || !!type || (!Number.isNaN(latitude) && !Number.isNaN(longitude));

    if (hasRoutePayload) {
      setSpot({
        id,
        name: name ?? 'Aire',
        type: type ?? 'OTHER',
        city: null,
        latitude: Number.isNaN(latitude) ? null : latitude,
        longitude: Number.isNaN(longitude) ? null : longitude,
      });
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('spots')
          .select('id, name, type, city')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          Alert.alert('Fiche aire', `Impossible de charger les details: ${error.message}`);
          return;
        }

        if (!data) return;
        setSpot({
          id: String(data.id),
          name: String(data.name ?? 'Aire'),
          type: String(data.type ?? 'OTHER'),
          city: data.city ?? null,
          latitude: null,
          longitude: null,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, lat, lng, name, type]);

  useEffect(() => {
    if (!id) return;
    setLoadingRelated(true);

    (async () => {
      try {
        const [reviewsRes, photosRes] = await Promise.all([
          supabase.from('reviews').select('*').eq('spot_id', id).order('created_at', { ascending: false }).limit(20),
          supabase.from('photos').select('*').eq('spot_id', id).order('created_at', { ascending: false }).limit(20),
        ]);

        if (reviewsRes.error) {
          Alert.alert('Avis', `Impossible de charger les avis: ${reviewsRes.error.message}`);
        } else {
          const parsedReviews = (reviewsRes.data ?? []).map((row: Record<string, unknown>) => ({
            id: String(row.id ?? Math.random()),
            rating: row.rating != null ? Number(row.rating) : row.note != null ? Number(row.note) : null,
            comment: row.comment != null ? String(row.comment) : row.content != null ? String(row.content) : null,
            createdAt: row.created_at != null ? String(row.created_at) : null,
          }));
          setReviews(parsedReviews);
        }

        if (photosRes.error) {
          Alert.alert('Photos', `Impossible de charger les photos: ${photosRes.error.message}`);
        } else {
          const parsedPhotos = (photosRes.data ?? [])
            .map((row: Record<string, unknown>) => {
              const urlValue = row.url ?? row.image_url ?? row.photo_url;
              if (!urlValue) return null;
              return {
                id: String(row.id ?? Math.random()),
                url: String(urlValue),
              } satisfies SpotPhoto;
            })
            .filter((item): item is SpotPhoto => item !== null);
          setPhotos(parsedPhotos);
        }
      } finally {
        setLoadingRelated(false);
      }
    })();
  }, [id]);

  const openGoogleMaps = async () => {
    if (spot?.latitude == null || spot?.longitude == null) {
      Alert.alert('Navigation', 'Coordonnees indisponibles pour cette aire.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Navigation', "Impossible d'ouvrir Google Maps.");
    }
  };

  const openWaze = async () => {
    if (spot?.latitude == null || spot?.longitude == null) {
      Alert.alert('Navigation', 'Coordonnees indisponibles pour cette aire.');
      return;
    }
    const url = `https://waze.com/ul?ll=${spot.latitude},${spot.longitude}&navigate=yes`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Navigation', "Impossible d'ouvrir Waze.");
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.primary }]}>Fiche Aire</Text>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Chargement...</Text>
            </View>
          ) : null}

          {spot ? (
            <>
              <Text style={[styles.name, { color: colors.textPrimary }]}>{spot.name}</Text>
              <View style={styles.row}>
                <Badge label={spot.type} variant="service" />
                {spot.city ? <Badge label={spot.city} variant="default" /> : null}
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>ID: {spot.id}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Coordonnees: {spot.latitude?.toFixed(6) ?? 'N/A'}, {spot.longitude?.toFixed(6) ?? 'N/A'}
              </Text>

              <View style={styles.row}>
                <Button label="S'y rendre (Google Maps)" onPress={openGoogleMaps} />
                <Button label="S'y rendre (Waze)" variant="secondary" onPress={openWaze} />
              </View>
            </>
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucune donnee disponible pour cette aire.</Text>
          )}
        </Card>

        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Avis</Text>
          {loadingRelated ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Chargement des avis...</Text>
            </View>
          ) : reviews.length === 0 ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucun avis pour le moment.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewItem, { borderColor: colors.border }]}>
                <View style={styles.row}>
                  <Badge label={review.rating != null ? `${review.rating}/5` : 'N/A'} variant="parking" />
                  {review.createdAt ? (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {review.comment || 'Avis sans commentaire.'}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Photos</Text>
          {loadingRelated ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Chargement des photos...</Text>
            </View>
          ) : photos.length === 0 ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucune photo disponible.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((photo) => (
                <Image key={photo.id} source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" />
              ))}
            </ScrollView>
          )}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  card: {
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  title: {
    ...Typography.title,
  },
  name: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 20,
  },
  subtitle: {
    ...Typography.subtitle,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '700',
  },
  reviewItem: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  meta: {
    ...Typography.caption,
  },
  photoRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  photo: {
    width: 180,
    height: 120,
    borderRadius: Radius.md,
    backgroundColor: '#D1D5DB',
  },
});

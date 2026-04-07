import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Badge, Button, Card, ScreenContainer } from '../../src/components/ui';
import SpotIcon, { toSpotIconType } from '../../src/components/SpotIcon';
import { supabase } from '../../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';
import { Input } from '../../src/components/ui';

type SpotDetail = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
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
  const { id, name, type, lat, lng, verified } = useLocalSearchParams<{
    id: string;
    name?: string;
    type?: string;
    lat?: string;
    lng?: string;
    verified?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [reviews, setReviews] = useState<SpotReview[]>([]);
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);
  const [voteLoading, setVoteLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

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
        isVerified: verified === '0' ? false : true,
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
          isVerified: true,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, lat, lng, name, type, verified]);

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

  const refreshRelated = async () => {
    if (!id) return;
    setLoadingRelated(true);
    const [reviewsRes, photosRes] = await Promise.all([
      supabase.from('reviews').select('*').eq('spot_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('photos').select('*').eq('spot_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!reviewsRes.error) {
      const parsedReviews = (reviewsRes.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id ?? Math.random()),
        rating: row.rating != null ? Number(row.rating) : row.note != null ? Number(row.note) : null,
        comment: row.comment != null ? String(row.comment) : row.content != null ? String(row.content) : null,
        createdAt: row.created_at != null ? String(row.created_at) : null,
      }));
      setReviews(parsedReviews);
    }
    if (!photosRes.error) {
      const parsedPhotos = (photosRes.data ?? [])
        .map((row: Record<string, unknown>) => {
          const urlValue = row.url ?? row.image_url ?? row.photo_url;
          if (!urlValue) return null;
          return { id: String(row.id ?? Math.random()), url: String(urlValue) } satisfies SpotPhoto;
        })
        .filter((item): item is SpotPhoto => item !== null);
      setPhotos(parsedPhotos);
    }
    setLoadingRelated(false);
  };

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

  const submitValidationVote = async () => {
    if (!id) return;
    setVoteLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setVoteLoading(false);
      Alert.alert('Connexion requise', 'Connecte-toi pour valider une aire.');
      return;
    }

    const payloads = [
      { spot_id: id, user_id: userId, vote: 1 },
      { spot_id: id, created_by: userId, vote: 1 },
    ];
    let success = false;
    let lastError = '';
    for (const payload of payloads) {
      const { error } = await supabase.from('spot_validations').insert(payload);
      if (!error) {
        success = true;
        break;
      }
      lastError = error.message;
    }
    setVoteLoading(false);
    if (!success) {
      Alert.alert('Vote impossible', lastError || 'Erreur inconnue.');
      return;
    }
    setSpot((prev) => (prev ? { ...prev, isVerified: true } : prev));
    Alert.alert('Merci', "Votre vote a ete enregistre.");
  };

  const submitReview = async () => {
    if (!id) return;
    const rating = Number(reviewRating);
    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      Alert.alert('Note invalide', 'La note doit etre comprise entre 1 et 5.');
      return;
    }
    setReviewLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setReviewLoading(false);
      Alert.alert('Connexion requise', 'Connecte-toi pour laisser un avis.');
      return;
    }

    const payloads = [
      { spot_id: id, user_id: userId, rating, comment: reviewComment.trim() || null },
      { spot_id: id, created_by: userId, note: rating, content: reviewComment.trim() || null },
    ];
    let success = false;
    let lastError = '';
    for (const payload of payloads) {
      const { error } = await supabase.from('reviews').insert(payload);
      if (!error) {
        success = true;
        break;
      }
      lastError = error.message;
    }
    setReviewLoading(false);
    if (!success) {
      Alert.alert('Avis impossible', lastError || 'Erreur inconnue.');
      return;
    }
    setReviewComment('');
    setReviewRating('5');
    await refreshRelated();
  };

  const uploadPhoto = async () => {
    if (!id) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      Alert.alert('Connexion requise', 'Connecte-toi pour envoyer une photo.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorise la galerie pour choisir une photo.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]) return;

    setPhotoUploading(true);
    const asset = picked.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = asset.mimeType?.split('/')[1] ?? 'jpg';
    const path = `${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('spot-photos').upload(path, blob, {
      contentType: asset.mimeType ?? 'image/jpeg',
      upsert: false,
    });
    if (uploadError) {
      setPhotoUploading(false);
      Alert.alert('Upload impossible', uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('spot-photos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const photoPayloads = [
      { spot_id: id, user_id: userId, url: publicUrl },
      { spot_id: id, created_by: userId, image_url: publicUrl },
    ];
    let photoSaved = false;
    for (const payload of photoPayloads) {
      const { error } = await supabase.from('photos').insert(payload);
      if (!error) {
        photoSaved = true;
        break;
      }
    }

    setPhotoUploading(false);
    if (!photoSaved) {
      Alert.alert('Photo', "Image envoyee mais enregistrement base echoue.");
      return;
    }
    await refreshRelated();
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
              <View style={[styles.row, styles.typeIconRow]}>
                <SpotIcon type={toSpotIconType(spot.type)} variant="icon" size={48} />
                <Badge label={spot.type} variant="service" />
                {spot.city ? <Badge label={spot.city} variant="default" /> : null}
                <Badge label={spot.isVerified ? 'Verifiee' : 'Non verifiee'} variant={spot.isVerified ? 'success' : 'warning'} />
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>ID: {spot.id}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Coordonnees: {spot.latitude?.toFixed(6) ?? 'N/A'}, {spot.longitude?.toFixed(6) ?? 'N/A'}
              </Text>

              <View style={styles.row}>
                <Button label="S'y rendre (Google Maps)" onPress={openGoogleMaps} />
                <Button label="S'y rendre (Waze)" variant="secondary" onPress={openWaze} />
              </View>
              {!spot.isVerified ? (
                <Button
                  label={voteLoading ? 'Validation...' : "Je valide l'existence de cette aire"}
                  onPress={submitValidationVote}
                  disabled={voteLoading}
                  fullWidth
                />
              ) : null}
            </>
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucune donnee disponible pour cette aire.</Text>
          )}
        </Card>

        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Avis</Text>
          <Input label="Note (1-5)" value={reviewRating} onChangeText={setReviewRating} keyboardType="number-pad" />
          <Input label="Commentaire" value={reviewComment} onChangeText={setReviewComment} />
          <Button label={reviewLoading ? 'Publication...' : "Publier mon avis"} onPress={submitReview} disabled={reviewLoading} />
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
          <Button
            label={photoUploading ? 'Upload...' : 'Ajouter une photo'}
            variant="secondary"
            onPress={uploadPhoto}
            disabled={photoUploading}
          />
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
  typeIconRow: {
    alignItems: 'center',
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

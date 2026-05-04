import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Badge, Button, Card, ScreenContainer } from '../../src/components/ui';
import SpotIcon, { toSpotIconType } from '../../src/components/SpotIcon';
import { supabase } from '../../src/lib/supabase';
import { extractLatLng, isSoftDeletedRow } from '../../src/lib/localDb/spotSync';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';
import { Input } from '../../src/components/ui';
import { getSpotTypeLabel } from '../../src/constants/spotTypes';

type SpotDetail = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  postalCode: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
  createdBy: string | null;
};

type SpotReview = {
  id: string;
  rating: number | null;
  comment: string | null;
  createdAt: string | null;
  userPseudo: string | null;
};

type SpotPhoto = {
  id: string;
  url: string;
};

interface SpotGoogleMedia {
  source: 'places' | 'street_view';
  imageUrl: string;
  fetchedAt: string;
}

export default function SpotDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [reviews, setReviews] = useState<SpotReview[]>([]);
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);
  const [googleMedia, setGoogleMedia] = useState<SpotGoogleMedia | null>(null);
  const [googleMediaLoading, setGoogleMediaLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [myReviewId, setMyReviewId] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [spotDeleting, setSpotDeleting] = useState(false);

  const hydrateReviewsWithPseudo = async (reviewRows: Array<Record<string, unknown>>): Promise<SpotReview[]> => {
    const baseParsed = reviewRows.map((row) => {
      const reviewId = row.id != null ? String(row.id) : String(Math.random());

      const ratingValue = row.rating;
      const rating = ratingValue != null ? Number(ratingValue) : null;

      const commentValue = row.comment;
      const comment = commentValue != null ? String(commentValue) : null;

      const createdAtValue = row.created_at;
      const createdAt = createdAtValue != null ? String(createdAtValue) : null;

      const userIdValue = row.user_id ?? row.created_by;
      const userId = userIdValue != null ? String(userIdValue) : null;

      return {
        id: reviewId,
        rating: rating != null && !Number.isNaN(rating) ? rating : null,
        comment,
        createdAt,
        userId,
      };
    });

    const userIds = Array.from(
      new Set(
        baseParsed
          .map((r) => r.userId)
          .filter((uid): uid is string => uid != null && uid.length > 0),
      ),
    );
    if (userIds.length === 0) {
      return baseParsed.map((r) => ({ ...r, userPseudo: null }));
    }

    const { data: profilesRes } = await supabase.from('profiles').select('id, pseudo').in('id', userIds);
    const pseudoById = new Map<string, string>();
    for (const p of (profilesRes ?? []) as Array<Record<string, unknown>>) {
      const idValue = p.id;
      const pseudoValue = p.pseudo;
      if (idValue != null && pseudoValue != null) {
        pseudoById.set(String(idValue), String(pseudoValue));
      }
    }

    return baseParsed.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      userPseudo: r.userId != null ? (pseudoById.get(r.userId) ?? null) : null,
    }));
  };

  useEffect(() => {
    const refreshAuthUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setIsLoggedIn(false);
        setCurrentUserId(null);
        return;
      }
      setIsLoggedIn(true);
      setCurrentUserId(data.user.id);
    };

    void refreshAuthUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      setCurrentUserId(session?.user?.id ?? null);
      if (session?.user) {
        void refreshAuthUser();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('spots')
          .select('id, name, type, city, postal_code, description, is_verified, created_by, location, deleted_at')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          Alert.alert(t('spotDetail.loadErrorTitle'), error.message);
          setSpot(null);
          return;
        }

        if (!data) {
          setSpot(null);
          return;
        }

        const row = data as Record<string, unknown>;
        if (isSoftDeletedRow(row)) {
          setSpot(null);
          Alert.alert(t('spotDetail.unavailableTitle'), t('spotDetail.unavailableMessage'));
          return;
        }

        const coords = extractLatLng(row);
        setSpot({
          id: String(data.id),
          name: String(data.name ?? 'Aire'),
          type: String(data.type ?? 'OTHER'),
          city: data.city ?? null,
          postalCode: data.postal_code != null ? String(data.postal_code) : null,
          description: data.description != null ? String(data.description) : null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          isVerified: Boolean(data.is_verified),
          createdBy: data.created_by != null ? String(data.created_by) : null,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

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
          Alert.alert(t('spotDetail.reviewsLoadErrorTitle'), t('spotDetail.reviewsLoadErrorMessage', { message: reviewsRes.error.message }));
        } else {
          const reviewRows = (reviewsRes.data ?? []) as Array<Record<string, unknown>>;
          const parsedReviews = await hydrateReviewsWithPseudo(reviewRows);
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
  }, [id, t]);

  // Pré-remplit le formulaire avec l'avis actuel de l'utilisateur connecté (si présent).
  useEffect(() => {
    if (!id) return;
    if (!isLoggedIn) return;
    if (!currentUserId) return;

    (async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment')
        .eq('spot_id', id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (error) {
        // Non bloquant : l'affichage des avis reste géré ailleurs.
        console.error('[SpotDetailScreen] loadMyReview', error);
        return;
      }

      if (!data) {
        setMyReviewId(null);
        return;
      }

      const ratingValue = data.rating;
      const rating = ratingValue != null ? Number(ratingValue) : null;
      setMyReviewId(String(data.id));
      setReviewRating(rating != null && !Number.isNaN(rating) ? String(rating) : '5');
      setReviewComment(data.comment != null ? String(data.comment) : '');
    })();
  }, [id, isLoggedIn, currentUserId]);

  useEffect(() => {
    if (isLoggedIn) return;
    setMyReviewId(null);
    setReviewRating('5');
    setReviewComment('');
  }, [isLoggedIn]);

  useEffect(() => {
    if (!id) return;
    if (spot?.latitude == null || spot?.longitude == null) return;

    setGoogleMediaLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('spot-google-media', {
          body: {
            spotId: id,
            latitude: spot.latitude,
            longitude: spot.longitude,
            name: spot.name,
          },
        });

        if (error) {
          if (!error.message.includes('404')) {
            Alert.alert('Photos Google', `Impossible de charger la photo Google: ${error.message}`);
          }
          return;
        }

        const payload = data as {
          source?: 'places' | 'street_view';
          imageUrl?: string;
          fetchedAt?: string;
        } | null;

        if (!payload?.source || !payload.imageUrl || !payload.fetchedAt) {
          setGoogleMedia(null);
          return;
        }

        setGoogleMedia({
          source: payload.source,
          imageUrl: payload.imageUrl,
          fetchedAt: payload.fetchedAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert('Photos Google', `Erreur inattendue: ${message}`);
      } finally {
        setGoogleMediaLoading(false);
      }
    })();
  }, [id, spot?.latitude, spot?.longitude, spot?.name]);

  const refreshRelated = async () => {
    if (!id) return;
    setLoadingRelated(true);
    const [reviewsRes, photosRes] = await Promise.all([
      supabase.from('reviews').select('*').eq('spot_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('photos').select('*').eq('spot_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!reviewsRes.error) {
      const reviewRows = (reviewsRes.data ?? []) as Array<Record<string, unknown>>;
      const parsedReviews = await hydrateReviewsWithPseudo(reviewRows);
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

  const normalizedCurrentUserId = currentUserId?.trim().toLowerCase() ?? null;
  const normalizedCreatedBy = spot?.createdBy?.trim().toLowerCase() ?? null;
  const isOwner = normalizedCurrentUserId != null && normalizedCreatedBy != null && normalizedCreatedBy === normalizedCurrentUserId;
  const canManagePendingSpot = isOwner && spot != null && !spot.isVerified;
  const canVotePendingSpot = isLoggedIn && spot != null && !spot.isVerified && !isOwner;

  const deleteSpot = async () => {
    if (!id) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    setSpotDeleting(true);
    if (spot?.isVerified) {
      setSpotDeleting(false);
      Alert.alert(t('spotDetail.deleteErrorTitle'), t('spotDetail.unavailableMessage'));
      return;
    }

    const { error } = await supabase
      .from('spots')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', uid)
      .eq('is_verified', false);
    setSpotDeleting(false);

    if (error) {
      Alert.alert(t('spotDetail.deleteErrorTitle'), error.message);
      return;
    }
    Alert.alert(t('spotDetail.deletedTitle'), t('spotDetail.deletedMessage'));
    router.back();
  };

  const confirmDeleteSpot = () => {
    Alert.alert(t('spotDetail.deleteConfirmTitle'), t('spotDetail.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('spotDetail.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteSpot();
        },
      },
    ]);
  };

  const submitValidationVote = async () => {
    if (!id) return;
    if (isOwner) {
      Alert.alert('Vote impossible', "Vous ne pouvez pas valider une aire que vous avez créée.");
      return;
    }
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
      Alert.alert(t('spotDetail.reviewInvalidRatingTitle'), t('spotDetail.reviewInvalidRatingMessage'));
      return;
    }

    const trimmedComment = reviewComment.trim() || null;
    setReviewLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authErr || !userId) {
        Alert.alert(t('spotDetail.reviewLoginTitle'), t('spotDetail.reviewLoginMessage'));
        return;
      }

      // Une seule review par utilisateur et par aire (contrainte DB) :
      // - si elle existe : update
      // - sinon : insert
      const { data: existing, error: existingErr } = await supabase
        .from('reviews')
        .select('id')
        .eq('spot_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingErr) {
        Alert.alert(t('spotDetail.reviewErrorTitle'), existingErr.message);
        return;
      }

      if (existing) {
        const { error: updateErr } = await supabase
          .from('reviews')
          .update({ rating, comment: trimmedComment })
          .eq('id', String(existing.id))
          .eq('user_id', userId);
        if (updateErr) {
          Alert.alert(t('spotDetail.reviewErrorTitle'), updateErr.message);
          return;
        }
        setMyReviewId(String(existing.id));
        Alert.alert(t('spotDetail.reviewThanksTitle'), t('spotDetail.reviewThanksUpdatedMessage'));
        await refreshRelated();
        return;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('reviews')
        .insert({
          spot_id: id,
          user_id: userId,
          rating,
          comment: trimmedComment,
        })
        .select('id')
        .single();

      if (insertErr) {
        // Contrainte unique (course entre deux envois) : basculer en mise à jour.
        if (insertErr.code === '23505') {
          const { data: raced, error: racedErr } = await supabase
            .from('reviews')
            .select('id')
            .eq('spot_id', id)
            .eq('user_id', userId)
            .maybeSingle();
          if (racedErr || !raced) {
            Alert.alert(t('spotDetail.reviewErrorTitle'), insertErr.message);
            return;
          }
          const { error: updateAfterRaceErr } = await supabase
            .from('reviews')
            .update({ rating, comment: trimmedComment })
            .eq('id', String(raced.id))
            .eq('user_id', userId);
          if (updateAfterRaceErr) {
            Alert.alert(t('spotDetail.reviewErrorTitle'), updateAfterRaceErr.message);
            return;
          }
          setMyReviewId(String(raced.id));
          Alert.alert(t('spotDetail.reviewThanksTitle'), t('spotDetail.reviewThanksUpdatedMessage'));
          await refreshRelated();
          return;
        }
        Alert.alert(t('spotDetail.reviewErrorTitle'), insertErr.message);
        return;
      }

      if (inserted?.id) {
        setMyReviewId(String(inserted.id));
      } else {
        const { data: refetched } = await supabase
          .from('reviews')
          .select('id')
          .eq('spot_id', id)
          .eq('user_id', userId)
          .maybeSingle();
        if (refetched?.id) {
          setMyReviewId(String(refetched.id));
        }
      }
      Alert.alert(t('spotDetail.reviewThanksTitle'), t('spotDetail.reviewThanksCreatedMessage'));
      await refreshRelated();
    } finally {
      setReviewLoading(false);
    }
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

    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[uploadPhoto] launchImageLibraryAsync', e);
      Alert.alert(
        'Galerie indisponible',
        message.includes('getServices')
          ? 'Installe la dernière build (expo run:android) et désinstalle l’app avant de réinstaller — versions natives incohérentes.'
          : message,
      );
      return;
    }
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

  const allCarouselPhotos: Array<{ id: string; url: string; badge?: string }> = [
    ...(googleMedia
      ? [
          {
            id: 'google',
            url: googleMedia.imageUrl,
            badge: googleMedia.source === 'places' ? 'Google Places' : 'Google Street View',
          },
        ]
      : []),
    ...photos.map((p) => ({ id: p.id, url: p.url })),
  ];

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Fiche principale ── */}
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
                <Badge label={getSpotTypeLabel(spot.type)} variant="service" />
                {spot.city ? <Badge label={spot.city} variant="default" /> : null}
                {!spot.isVerified ? <Badge label="À valider" variant="warning" /> : null}
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Coordonnées : {spot.latitude?.toFixed(6) ?? 'N/A'}, {spot.longitude?.toFixed(6) ?? 'N/A'}
              </Text>

              <View style={styles.row}>
                <Button label="S'y rendre (Google Maps)" onPress={openGoogleMaps} />
                <Button label="S'y rendre (Waze)" variant="secondary" onPress={openWaze} />
              </View>

              {spot.description ? (
                <View style={styles.descriptionWrap}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('addSpot.description')}</Text>
                  <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                    {spot.description}
                  </Text>
                </View>
              ) : null}

              {canManagePendingSpot ? (
                <View style={styles.row}>
                  <Button
                    label={t('spotDetail.edit')}
                    variant="secondary"
                    onPress={() => router.push({ pathname: '/edit-spot/[id]', params: { id: spot.id } })}
                  />
                  <Button
                    label={t('spotDetail.delete')}
                    variant="secondary"
                    onPress={confirmDeleteSpot}
                    disabled={spotDeleting}
                  />
                </View>
              ) : null}
              {canVotePendingSpot ? (
                <Button
                  label={voteLoading ? 'Validation...' : "Je valide l'existence de cette aire"}
                  onPress={submitValidationVote}
                  disabled={voteLoading}
                  fullWidth
                />
              ) : null}
            </>
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucune donnée disponible pour cette aire.</Text>
          )}
        </Card>

        {/* ── Carousel photos (Google + utilisateurs) ── */}
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Photos</Text>

          {googleMediaLoading || loadingRelated ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Chargement des photos...</Text>
            </View>
          ) : allCarouselPhotos.length === 0 ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aucune photo disponible.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {allCarouselPhotos.map((photo) => (
                <View key={photo.id} style={styles.carouselItem}>
                  <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" />
                  {photo.badge ? (
                    <View style={styles.photoBadgeWrap}>
                      <Badge label={photo.badge} variant="default" />
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Ajout d'une photo — grisé si non connecté */}
          <View style={!isLoggedIn ? styles.lockedSection : undefined}>
            {!isLoggedIn ? (
              <Text style={[styles.lockedHint, { color: colors.textMuted }]}>
                Connectez-vous pour ajouter une photo.
              </Text>
            ) : null}
            <View pointerEvents={isLoggedIn ? 'auto' : 'none'}>
              <Button
                label={photoUploading ? 'Upload...' : 'Ajouter une photo'}
                variant="secondary"
                onPress={uploadPhoto}
                disabled={photoUploading}
              />
            </View>
          </View>
        </Card>

        {/* ── Avis ── */}
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('spotDetail.reviewsTitle')}</Text>

          {/* Formulaire — grisé si non connecté */}
          <View style={!isLoggedIn ? styles.lockedSection : undefined}>
            {!isLoggedIn ? (
              <Text style={[styles.lockedHint, { color: colors.textMuted }]}>{t('spotDetail.reviewLoginHint')}</Text>
            ) : null}
            <View pointerEvents={isLoggedIn ? 'auto' : 'none'}>
              <Input
                label={t('spotDetail.reviewRatingLabel')}
                value={reviewRating}
                onChangeText={setReviewRating}
                keyboardType="number-pad"
              />
              <Input label={t('spotDetail.reviewCommentLabel')} value={reviewComment} onChangeText={setReviewComment} />
              <Button
                label={
                  reviewLoading
                    ? t('spotDetail.reviewSubmitting')
                    : myReviewId
                      ? t('spotDetail.reviewSubmitUpdate')
                      : t('spotDetail.reviewSubmitCreate')
                }
                onPress={submitReview}
                disabled={reviewLoading}
              />
            </View>
          </View>

          {/* Liste des avis existants */}
          {loadingRelated ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('spotDetail.reviewsLoading')}</Text>
            </View>
          ) : reviews.length === 0 ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('spotDetail.reviewsEmpty')}</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewItem, { borderColor: colors.border }]}>
                <Text style={[styles.reviewAuthor, { color: colors.textPrimary }]}>
                  {review.userPseudo ?? t('spotDetail.reviewPseudoUnknown')}
                </Text>
                <View style={styles.row}>
                  <Badge label={review.rating != null ? `${review.rating}/5` : 'N/A'} variant="parking" />
                  {review.createdAt ? (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {new Date(review.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {review.comment != null && review.comment.trim() !== ''
                    ? review.comment
                    : t('spotDetail.reviewNoComment')}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 0 },
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
  reviewAuthor: {
    ...Typography.body,
    fontWeight: '600',
  },
  photoRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  carouselItem: {
    position: 'relative',
  },
  photo: {
    width: 220,
    height: 150,
    borderRadius: Radius.md,
    backgroundColor: '#D1D5DB',
  },
  photoBadgeWrap: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
  },
  lockedSection: {
    opacity: 0.45,
    gap: Spacing.xs,
  },
  lockedHint: {
    ...Typography.caption,
    fontStyle: 'italic',
    marginBottom: Spacing.xs,
  },
  descriptionWrap: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  descriptionText: {
    ...Typography.subtitle,
  },
});

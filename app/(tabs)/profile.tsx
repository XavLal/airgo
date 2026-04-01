import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { Badge, Button, Card, Input, ScreenContainer, Separator } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<{ pseudo: string | null; trust_points: number | null; created_at: string | null } | null>(null);
  const [contributions, setContributions] = useState({ spots: 0, reviews: 0, photos: 0 });

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        Alert.alert('Erreur session', error.message);
      }

      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoadingInit(false);
    }

    bootstrapAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      if (nextSession) {
        setOtpSent(false);
        setOtpCode('');
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const emailIsValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setContributions({ spots: 0, reviews: 0, photos: 0 });
      return;
    }
    loadProfileAndContributions(user.id);
  }, [user?.id]);

  async function countFromTable(table: 'spots' | 'reviews' | 'photos', columnCandidates: string[], userId: string) {
    for (const column of columnCandidates) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(column, userId);

      if (!error) return count ?? 0;
    }
    return 0;
  }

  async function loadProfileAndContributions(userId: string) {
    setLoadingProfile(true);

    const profileReq = supabase
      .from('profiles')
      .select('pseudo, trust_points, created_at')
      .eq('id', userId)
      .maybeSingle();

    const spotsReq = countFromTable('spots', ['created_by'], userId);
    const reviewsReq = countFromTable('reviews', ['user_id', 'created_by'], userId);
    const photosReq = countFromTable('photos', ['user_id', 'created_by'], userId);

    const [profileRes, spots, reviews, photos] = await Promise.all([profileReq, spotsReq, reviewsReq, photosReq]);

    if (profileRes.error) {
      Alert.alert('Profil', `Impossible de charger le profil: ${profileRes.error.message}`);
    } else {
      setProfile(profileRes.data ?? null);
    }

    setContributions({
      spots,
      reviews,
      photos,
    });

    setLoadingProfile(false);
  }

  async function handleSendOtp() {
    if (!emailIsValid) {
      Alert.alert('Email invalide', 'Entre une adresse email valide.');
      return;
    }

    setLoadingSend(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true },
    });
    setLoadingSend(false);

    if (error) {
      Alert.alert('Envoi impossible', error.message);
      return;
    }

    setOtpSent(true);
    Alert.alert('Code envoyé', 'Vérifie ta boîte mail puis saisis le code OTP.');
  }

  async function handleVerifyOtp() {
    const token = otpCode.trim();
    if (!token) {
      Alert.alert('Code manquant', 'Saisis le code reçu par email.');
      return;
    }

    setLoadingVerify(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    setLoadingVerify(false);

    if (error) {
      Alert.alert('Code invalide', error.message);
      return;
    }

    Alert.alert('Connecté', 'Connexion réussie.');
  }

  async function handleSignOut() {
    setLoadingLogout(true);
    const { error } = await supabase.auth.signOut();
    setLoadingLogout(false);

    if (error) {
      Alert.alert('Déconnexion impossible', error.message);
      return;
    }

    setOtpSent(false);
    setOtpCode('');
  }

  return (
    <ScreenContainer style={styles.container}>
      <Card style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Profil & Authentification</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Connexion par email OTP avec Supabase Auth
        </Text>

        {loadingInit ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.meta, { color: colors.textSecondary }]}>Chargement de la session...</Text>
          </View>
        ) : null}

        {!loadingInit && session && user ? (
          <>
            <View style={styles.row}>
              <Badge label="connecté" variant="success" />
              <Badge label={user.email ?? 'email inconnu'} variant="default" />
            </View>
            <Separator />
            {loadingProfile ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.meta, { color: colors.textSecondary }]}>Chargement du profil...</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  Pseudo: {profile?.pseudo || 'Non défini'}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  Points de confiance: {profile?.trust_points ?? 0}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  Inscrit le: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '—'}
                </Text>
                <View style={styles.row}>
                  <Badge label={`Aires: ${contributions.spots}`} variant="service" />
                  <Badge label={`Avis: ${contributions.reviews}`} variant="parking" />
                  <Badge label={`Photos: ${contributions.photos}`} variant="farm" />
                </View>
                <Button
                  label="Rafraîchir contributions"
                  size="sm"
                  variant="ghost"
                  onPress={() => loadProfileAndContributions(user.id)}
                />
              </>
            )}
            <Text style={[styles.meta, { color: colors.textSecondary }]}>UID: {user.id}</Text>
            <Button
              label={loadingLogout ? 'Déconnexion...' : 'Se déconnecter'}
              variant="secondary"
              onPress={handleSignOut}
              disabled={loadingLogout}
              fullWidth
            />
          </>
        ) : null}

        {!loadingInit && !session ? (
          <>
            <Separator />
            <Input
              label="Email"
              placeholder="toi@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              hint="Un code à usage unique va être envoyé."
            />
            <Button
              label={loadingSend ? 'Envoi...' : 'Envoyer le code OTP'}
              onPress={handleSendOtp}
              disabled={loadingSend || !emailIsValid}
              fullWidth
            />

            {otpSent ? (
              <>
                <Input
                  label="Code OTP"
                  placeholder="123456"
                  keyboardType="number-pad"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  hint="Saisis le code reçu par email."
                />
                <Button
                  label={loadingVerify ? 'Validation...' : 'Valider le code'}
                  variant="secondary"
                  onPress={handleVerifyOtp}
                  disabled={loadingVerify || !otpCode.trim()}
                  fullWidth
                />
              </>
            ) : (
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Après envoi, le champ de validation du code apparaîtra ici.
              </Text>
            )}
          </>
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    ...Typography.caption,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});

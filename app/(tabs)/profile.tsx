import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Session, User } from '@supabase/supabase-js';
import { Badge, Button, Card, Input, ScreenContainer, Separator } from '../../src/components/ui';
import i18n, { persistLanguage, type AppLanguage } from '../../src/lib/i18n';
import { supabase } from '../../src/lib/supabase';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

export default function ProfileScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
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
        Alert.alert(t('profile.sessionErrorTitle'), error.message);
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

  async function switchLanguage(lng: AppLanguage) {
    await persistLanguage(lng);
    await i18n.changeLanguage(lng);
  }

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
      Alert.alert(t('profile.profileLoadErrorTitle'), profileRes.error.message);
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
      Alert.alert(t('profile.invalidEmailTitle'), t('profile.invalidEmailMessage'));
      return;
    }

    setLoadingSend(true);
    const cleanEmail = email.trim().toLowerCase();
    let error: Error | null = null;

    try {
      const first = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true },
      });
      error = first.error;

      // Sometimes user creation fails at DB level (ex: profiles trigger).
      // Fallback: try again without forcing user creation; this can succeed if auth user already exists.
      if (
        error &&
        error.message.toLowerCase().includes('database error saving user')
      ) {
        console.warn('OTP send failed with database-saving error; retrying without shouldCreateUser.', error);
        const second = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: false },
        });
        error = second.error;
      }
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    } finally {
      setLoadingSend(false);
    }

    if (error) {
      console.error('OTP send error:', error);
      const msg = error.message ?? String(error);
      if (msg.toLowerCase().includes('database error saving user')) {
        Alert.alert(t('profile.sendFailedTitle'), t('profile.sendFailedDatabaseHint'));
        return;
      }
      Alert.alert(t('profile.sendFailedTitle'), msg);
      return;
    }

    setOtpSent(true);
    Alert.alert(t('profile.otpSentTitle'), t('profile.otpSentMessage'));
  }

  async function handleVerifyOtp() {
    const token = otpCode.trim();
    if (!token) {
      Alert.alert(t('profile.missingCodeTitle'), t('profile.missingCodeMessage'));
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
      Alert.alert(t('profile.invalidCodeTitle'), error.message);
      return;
    }

    Alert.alert(t('profile.connectedTitle'), t('profile.connectedMessage'));
  }

  async function handleSignOut() {
    setLoadingLogout(true);
    const { error } = await supabase.auth.signOut();
    setLoadingLogout(false);

    if (error) {
      Alert.alert(t('profile.signOutFailedTitle'), error.message);
      return;
    }

    setOtpSent(false);
    setOtpCode('');
  }

  return (
    <ScreenContainer style={styles.container}>
      <Card style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>{t('profile.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('profile.subtitle')}</Text>

        {loadingInit ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.meta, { color: colors.textSecondary }]}>{t('profile.sessionLoad')}</Text>
          </View>
        ) : null}

        {!loadingInit && session && user ? (
          <>
            <View style={styles.row}>
              <Badge label={t('profile.connected')} variant="success" />
              <Badge label={user.email ?? t('profile.unknownEmail')} variant="default" />
            </View>
            <Separator />
            {loadingProfile ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{t('profile.loadingProfile')}</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {t('profile.pseudo')}: {profile?.pseudo || t('profile.pseudoUndefined')}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {t('profile.trustPoints')}: {profile?.trust_points ?? 0}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {t('profile.memberSince')}:{' '}
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(
                        i18nInstance.language.startsWith('en') ? 'en-GB' : 'fr-FR',
                      )
                    : '—'}
                </Text>
                <View style={styles.row}>
                  <Badge label={t('profile.badgeSpots', { count: contributions.spots })} variant="service" />
                  <Badge label={t('profile.badgeReviews', { count: contributions.reviews })} variant="parking" />
                  <Badge label={t('profile.badgePhotos', { count: contributions.photos })} variant="farm" />
                </View>
                <Button
                  label={t('profile.refreshContributions')}
                  size="sm"
                  variant="ghost"
                  onPress={() => loadProfileAndContributions(user.id)}
                />
              </>
            )}
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {t('profile.uid')}: {user.id}
            </Text>
            <Button
              label={loadingLogout ? t('profile.signingOut') : t('profile.signOut')}
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
              label={t('profile.email')}
              placeholder={t('profile.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              hint={t('profile.emailHint')}
            />
            <Button
              label={loadingSend ? t('profile.sending') : t('profile.sendOtp')}
              onPress={handleSendOtp}
              disabled={loadingSend || !emailIsValid}
              fullWidth
            />

            {otpSent ? (
              <>
                <Input
                  label={t('profile.otpLabel')}
                  placeholder={t('profile.otpPlaceholder')}
                  keyboardType="number-pad"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  hint={t('profile.otpHint')}
                />
                <Button
                  label={loadingVerify ? t('profile.verifying') : t('profile.verify')}
                  variant="secondary"
                  onPress={handleVerifyOtp}
                  disabled={loadingVerify || !otpCode.trim()}
                  fullWidth
                />
              </>
            ) : (
              <Text style={[styles.meta, { color: colors.textMuted }]}>{t('profile.otpPendingHint')}</Text>
            )}
          </>
        ) : null}

        <Separator />
        <Text style={[styles.subtitle, { color: colors.textPrimary }]}>{t('language.title')}</Text>
        <View style={styles.row}>
          <Button label={t('language.fr')} size="sm" variant="secondary" onPress={() => switchLanguage('fr')} />
          <Button label={t('language.en')} size="sm" variant="secondary" onPress={() => switchLanguage('en')} />
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t('language.hint')}</Text>
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

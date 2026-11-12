import * as AppleAuthentication from 'expo-apple-authentication';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Headline } from '@/onboarding/frame';
import { CapLogo } from '@/onboarding/logo';
import { useDark } from '@/settings/appearance';
import { fonts, useColors } from '@/theme';
import { TextField } from '@/ui/controls';
import { Grain } from '@/ui/grain';
import { useWide } from '@/ui/layout';
import { Button, RoundButton } from '@/ui/primitives';

const MAP = {
  day: require('../../assets/images/onboarding/welcome-day.jpg'),
  night: require('../../assets/images/onboarding/welcome-night.jpg'),
  wideDay: require('../../assets/images/onboarding/welcome-wide-day.jpg'),
  wideNight: require('../../assets/images/onboarding/welcome-wide-night.jpg'),
};

type Mode = 'welcome' | 'register' | 'login';

/** Step 1 of the onboarding: Apple, e-mail sign-up, or sign in for returning walkers. */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const dark = useDark();
  const { login, register, signInWithApple } = useAuth();
  const [mode, setMode] = useState<Mode>('welcome');
  const [form, setForm] = useState({ firstName: '', username: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError)
        setError(t(`errors.${e.code}`, { defaultValue: t('errors.generic') }));
      else if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED')
        setError(t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const apple = () =>
    run(async () => {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('no identity token');
      await signInWithApple(credential.identityToken, credential.fullName?.givenName ?? null);
    });

  const submit = () =>
    run(() =>
      mode === 'login'
        ? login(form.email.trim(), form.password)
        : register({
            ...form,
            email: form.email.trim(),
            firstName: form.firstName.trim(),
            username: form.username.trim().toLowerCase(),
          }),
    );

  const open = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChangeText: (value: string) => setForm((f) => ({ ...f, [key]: value })),
    label: t(`welcome.${key}`),
  });

  const hero = (
    <View style={[styles.hero, wide && styles.heroWide]}>
      <CapLogo size={wide ? 72 : 64} />
      <Text
        style={[wide ? styles.titleWide : styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        {t('welcome.title')}
        {'\n'}
        <Text style={{ color: colors.accentText }}>{t('welcome.titleAccent')}</Text>
      </Text>
      <Text style={[wide ? styles.subtitleWide : styles.subtitle, { color: colors.textSecondary }]}>
        {t('welcome.subtitle')}
      </Text>
      <View style={[styles.buttons, wide && styles.buttonsWide]}>
        <Button
          tone="dark"
          title={t('welcome.apple')}
          icon={<AppleLogo color={colors.onInverse} />}
          onPress={apple}
          loading={busy}
        />
        <Button tone="light" title={t('welcome.withEmail')} onPress={() => open('register')} />
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <Text
        style={[styles.already, wide && styles.alreadyWide, { color: colors.textMuted }]}
        onPress={() => open('login')}
      >
        {t('welcome.already')}{' '}
        <Text style={[styles.link, { color: colors.blueText }]}>{t('welcome.signIn')}</Text>
      </Text>
    </View>
  );

  const register_ = mode === 'register';
  const emailForm = (
    <View style={[styles.form, wide && styles.formWide]}>
      <RoundButton
        icon={<ChevronLeft size={22} color={colors.text} strokeWidth={2} />}
        onPress={() => open('welcome')}
        label={t('common.back')}
        plain={!wide}
      />
      <Headline
        kicker={t('welcome.formKicker')}
        title={t(register_ ? 'welcome.registerTitle' : 'welcome.loginTitle')}
        text={t(register_ ? 'welcome.registerText' : 'welcome.loginText')}
      />
      {register_ ? (
        <>
          <TextField {...field('firstName')} autoComplete="given-name" />
          <TextField
            {...field('username')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
          />
        </>
      ) : null}
      <TextField
        {...field('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        {...field('password')}
        secureTextEntry
        autoComplete={register_ ? 'new-password' : 'current-password'}
        textContentType={register_ ? 'newPassword' : 'password'}
        onSubmitEditing={submit}
        placeholder={register_ ? t('welcome.passwordHint') : undefined}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <Button
        tone="dark"
        title={t(register_ ? 'welcome.register' : 'welcome.login')}
        onPress={submit}
        loading={busy}
      />
      <Pressable
        onPress={() => open(register_ ? 'login' : 'register')}
        accessibilityRole="button"
        style={styles.switch}
      >
        <Text style={[styles.link, { color: colors.blueText }]}>
          {t(register_ ? 'welcome.toLogin' : 'welcome.toRegister')}
        </Text>
      </Pressable>
    </View>
  );

  const map = wide ? (dark ? MAP.wideNight : MAP.wideDay) : dark ? MAP.night : MAP.day;
  const fade = wide
    ? `linear-gradient(90deg, ${colors.background} 0%, ${colors.background} 36%, ${colors.background}00 62%)`
    : `linear-gradient(180deg, ${colors.background}00 0%, ${colors.background} 38%)`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {mode === 'welcome' || wide ? (
        <>
          <Image
            source={map}
            style={wide ? StyleSheet.absoluteFill : styles.map}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View
            pointerEvents="none"
            style={[wide ? StyleSheet.absoluteFill : styles.fade, { backgroundImage: fade }]}
          />
        </>
      ) : null}
      <Grain />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            mode === 'welcome' && !wide && styles.bottom,
            wide && styles.contentWide,
            {
              paddingTop: insets.top + (mode === 'welcome' ? 24 : 6),
              paddingBottom: Math.max(insets.bottom, 20) + (wide ? 24 : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === 'welcome' ? hero : emailForm}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Apple's logo, as drawn on "Continuer avec Apple". */
function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={18} height={20} viewBox="0 0 17 20" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.2ZM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 520 },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  bottom: { justifyContent: 'flex-end' },
  contentWide: { justifyContent: 'center', paddingHorizontal: 72 },
  hero: { gap: 16 },
  heroWide: { width: 480, gap: 18 },
  title: { fontFamily: fonts.display, fontSize: 42, lineHeight: 43, letterSpacing: -1.68 },
  titleWide: { fontFamily: fonts.display, fontSize: 60, lineHeight: 60, letterSpacing: -2.7 },
  subtitle: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24 },
  subtitleWide: { fontFamily: fonts.text, fontSize: 18, lineHeight: 27 },
  buttons: { gap: 10, marginTop: 8 },
  buttonsWide: { width: 400, marginTop: 10 },
  already: { fontFamily: fonts.text, fontSize: 12.5, textAlign: 'center' },
  alreadyWide: { fontSize: 13.5, textAlign: 'left' },
  link: { fontFamily: fonts.textSemiBold },
  error: { fontFamily: fonts.textMedium, fontSize: 14 },
  form: { gap: 16, paddingTop: 0 },
  formWide: { width: 420 },
  switch: { alignSelf: 'center', padding: 10 },
});

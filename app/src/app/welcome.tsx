import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { ApiError } from '@/api/client';
import { fonts, useColors } from '@/theme';
import { Button, Card } from '@/ui/primitives';

type Mode = 'login' | 'register';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { login, register, signInWithApple } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
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
        : register({ ...form, email: form.email.trim(), firstName: form.firstName.trim() }),
    );

  const field = (key: keyof typeof form, props: TextInputProps) => (
    <TextInput
      value={form[key]}
      onChangeText={(value) => setForm((f) => ({ ...f, [key]: value }))}
      placeholderTextColor={colors.textMuted}
      style={[
        styles.input,
        { color: colors.text, borderColor: colors.border, backgroundColor: colors.inset },
      ]}
      {...props}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <Text style={[styles.brand, { color: colors.accent }]}>Cap</Text>
            <Text style={[styles.title, { color: colors.text }]}>{t('welcome.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('welcome.subtitle')}
            </Text>

            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                colors.dark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={20}
              style={styles.apple}
              onPress={apple}
            />
            <Text style={[styles.or, { color: colors.textMuted }]}>{t('welcome.or')}</Text>

            <Card style={styles.form}>
              {mode === 'register' && (
                <>
                  {field('firstName', {
                    placeholder: t('welcome.firstName'),
                    autoComplete: 'given-name',
                  })}
                  {field('username', {
                    placeholder: t('welcome.username'),
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    autoComplete: 'username-new',
                  })}
                </>
              )}
              {field('email', {
                placeholder: t('welcome.email'),
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoComplete: 'email',
                textContentType: 'emailAddress',
              })}
              {field('password', {
                placeholder: t('welcome.password'),
                secureTextEntry: true,
                autoComplete: mode === 'login' ? 'current-password' : 'new-password',
                textContentType: mode === 'login' ? 'password' : 'newPassword',
                onSubmitEditing: submit,
              })}
              {mode === 'register' && (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  {t('welcome.passwordHint')}
                </Text>
              )}
              {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
              <Button
                title={t(mode === 'login' ? 'welcome.login' : 'welcome.register')}
                onPress={submit}
                loading={busy}
              />
            </Card>

            <Pressable
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
              style={styles.switch}
            >
              <Text style={[styles.switchText, { color: colors.blueText }]}>
                {t(mode === 'login' ? 'welcome.toRegister' : 'welcome.toLogin')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 },
  brand: { fontFamily: fonts.display, fontSize: 22 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -1 },
  subtitle: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 22, marginBottom: 12 },
  apple: { height: 56 },
  or: { textAlign: 'center', fontFamily: fonts.textMedium, fontSize: 13 },
  form: { padding: 16, gap: 10 },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.text,
  },
  hint: { fontFamily: fonts.text, fontSize: 12.5 },
  error: { fontFamily: fonts.textMedium, fontSize: 14 },
  switch: { alignSelf: 'center', padding: 10 },
  switchText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
});

import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toggle } from '@/ui/controls';
import { ActionMenu, type MenuItem } from '@/ui/action-menu';
import { countryName } from '@/i18n/countries';
import { useAuth } from '@/api/auth';
import { api, API_URL, ApiError } from '@/api/client';
import { useUpdateProfile, type ProfilePatch } from '@/api/profile';
import { musicEnabled, musicSupported, setMusicEnabled } from '@/music/use-music';
import type { UserProfile } from '@/api/types';
import { SettingsWide } from '@/account/settings-wide';
import { fonts, useColors } from '@/theme';
import { useWide } from '@/ui/layout';
import { Avatar, GlassButton } from '@/ui/primitives';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setUser, signOut, deleteAccount } = useAuth();
  const update = useUpdateProfile();
  const [busy, setBusy] = useState(false);
  const [music, setMusic] = useState(musicEnabled);
  const wide = useWide();
  if (!user) return null;

  const failed = (error: unknown) => {
    const code = error instanceof ApiError ? error.code : 'generic';
    Alert.alert(i18n.exists(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic'));
  };
  const save = (patch: ProfilePatch) => update.mutate(patch, { onError: failed });

  /** iOS text prompt for one field. */
  const ask = (
    title: string,
    value: string,
    apply: (text: string) => ProfilePatch | null,
    keyboard?: 'email-address' | 'number-pad',
  ) =>
    Alert.prompt(
      title,
      undefined,
      [
        { text: t('journeys.cancel'), style: 'cancel' },
        {
          text: t('account.save'),
          onPress: (text?: string) => {
            const patch = text === undefined ? null : apply(text.trim());
            if (patch) save(patch);
          },
        },
      ],
      'plain-text',
      value,
      keyboard ?? 'default',
    );

  /** Native menu on a row to pick one value; the current one is ticked. */
  const choose = <T extends string>(
    title: string,
    options: { value: T; label: string }[],
    current: T,
    pick: (value: T) => void,
  ) => ({
    title,
    items: options.map((o) => ({
      label: o.label,
      checked: o.value === current,
      onPress: () => pick(o.value),
    })),
  });

  const changePhoto = async () => {
    // The picker is a native module: older builds of the app do not have it yet.
    let picker: typeof import('expo-image-picker');
    let manipulator: typeof import('expo-image-manipulator');
    try {
      picker = await import('expo-image-picker');
      manipulator = await import('expo-image-manipulator');
    } catch {
      Alert.alert(t('account.needsUpdate'));
      return;
    }
    const result = await picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setBusy(true);
    try {
      const small = await manipulator.manipulateAsync(asset.uri, [{ resize: { width: 512 } }], {
        compress: 0.8,
        format: manipulator.SaveFormat.JPEG,
      });
      const image = await (await fetch(small.uri)).arrayBuffer();
      setUser(
        await api<UserProfile>('/me/avatar', {
          method: 'PUT',
          raw: image,
          contentType: 'image/jpeg',
        }),
      );
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api<unknown>('/me/export');
      // A JSON file the walker can keep in Files, AirDrop or e-mail (GDPR portability).
      const day = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `tapiroute-${t('account.exportFile')}-${day}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data, null, 2));
      await Share.share({ url: file.uri });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };

  /** A password lets an account made with Apple sign in with its e-mail elsewhere. */
  const setPassword = (current?: string) =>
    Alert.prompt(
      t(user.has_password ? 'account.passwordNew' : 'account.passwordCreate'),
      t('account.passwordHint', { email: user.email ?? '' }),
      [
        { text: t('journeys.cancel'), style: 'cancel' },
        {
          text: t('account.save'),
          onPress: async (password?: string) => {
            if (!password) return;
            setBusy(true);
            try {
              await api('/me/password', {
                method: 'PUT',
                body: { password, current_password: current },
              });
              setUser(await api<UserProfile>('/me'));
              Alert.alert(t('account.passwordSaved'));
            } catch (error) {
              failed(error);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
      'secure-text',
    );
  const passwordRow = (
    <Row
      label={t(user.has_password ? 'account.passwordChange' : 'account.passwordCreate')}
      onPress={() => {
        if (!user.email) Alert.alert(t('errors.email_required'));
        else if (!user.has_password) setPassword();
        else
          Alert.prompt(
            t('account.passwordCurrent'),
            undefined,
            [
              { text: t('journeys.cancel'), style: 'cancel' },
              {
                text: t('common.next'),
                onPress: (current?: string) => current && setPassword(current),
              },
            ],
            'secure-text',
          );
      }}
    />
  );

  const openPrivacy = () =>
    Linking.openURL(`${API_URL}/privacy?lang=${i18n.language.startsWith('en') ? 'en' : 'fr'}`);

  const confirmDelete = () =>
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('journeys.cancel'), style: 'cancel' },
      {
        text: t('account.delete'),
        style: 'destructive',
        onPress: () => deleteAccount().catch(failed),
      },
    ]);

  const removePhoto = async () => {
    setBusy(true);
    try {
      setUser(await api<UserProfile>('/me/avatar', { method: 'DELETE' }));
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };

  const number = (text: string, min: number, max: number) => {
    const value = Number.parseInt(text, 10);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };

  const languageRow = (
    <Row
      label={t('account.language')}
      value={t(`account.languages.${user.language}`)}
      menu={choose(
        t('account.language'),
        (['fr', 'en'] as const).map((l) => ({ value: l, label: t(`account.languages.${l}`) })),
        user.language,
        (language) => save({ language }),
      )}
    />
  );
  const unitsRow = (
    <Row
      label={t('account.units')}
      value={t(`account.unitNames.${user.units}`)}
      menu={choose(
        t('account.units'),
        (['km', 'mi'] as const).map((u) => ({ value: u, label: t(`account.unitNames.${u}`) })),
        user.units,
        (units) => save({ units }),
      )}
    />
  );
  const notificationsRow = (
    <Row label={t('account.notifications')}>
      <Toggle
        value={user.notifications}
        onChange={(on) => save({ notifications: on })}
        label={t('account.notifications')}
      />
    </Row>
  );
  // Per device: the player during a session (iPhone pill, iPad card).
  const musicRow = musicSupported ? (
    <Row label={t('account.musicInSession')}>
      <Toggle
        value={music}
        onChange={(on) => {
          setMusicEnabled(on);
          setMusic(on);
        }}
        label={t('account.musicInSession')}
      />
    </Row>
  ) : null;
  const visibilityRow = (
    <Row
      label={t('account.visibility')}
      value={t(`account.visibilities.${user.visibility}`)}
      menu={choose(
        t('account.visibilityHint'),
        (['everyone', 'friends'] as const).map((v) => ({
          value: v,
          label: t(`account.visibilities.${v}`),
        })),
        user.visibility,
        (visibility) => save({ visibility }),
      )}
    />
  );

  if (wide) {
    return (
      <SettingsWide
        user={user}
        busy={busy}
        onPhoto={changePhoto}
        onRemovePhoto={removePhoto}
        onCountry={() => router.push('/country')}
        onSave={save}
        onSignOut={signOut}
        onDelete={confirmDelete}
        sections={{
          appearance: (
            <Group>
              {languageRow}
              {unitsRow}
            </Group>
          ),
          treadmill: (
            <Group>
              <Row label={t('settings.treadmills')} onPress={() => router.push('/treadmill')} />
            </Group>
          ),
          notifications: (
            <Group>
              {notificationsRow}
              {musicRow}
              {musicRow}
            </Group>
          ),
          privacy: (
            <Group>
              {visibilityRow}
              {passwordRow}
              <Row label={t('account.export')} onPress={exportData} />
              <Row label={t('account.privacyPolicy')} onPress={openPrivacy} />
            </Group>
          ),
        }}
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('account.title')}</Text>
          <View style={{ width: 48 }} />
        </View>

        <Pressable onPress={changePhoto} accessibilityRole="button" style={styles.photo}>
          <View>
            <Avatar name={user.first_name} size={88} photo={user.avatar_url} />
            <View
              style={[
                styles.camera,
                { backgroundColor: colors.text, borderColor: colors.background },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Camera size={15} color={colors.background} />
              )}
            </View>
          </View>
          <Text style={[styles.link, { color: colors.blueText }]}>{t('account.changePhoto')}</Text>
        </Pressable>

        <Group title={t('account.profile')}>
          <Row
            label={t('account.firstName')}
            value={user.first_name}
            onPress={() =>
              ask(t('account.firstName'), user.first_name, (v) => (v ? { first_name: v } : null))
            }
          />
          <Row
            label={t('profile.username')}
            value={`@${user.username}`}
            onPress={() =>
              ask(t('profile.username'), user.username, (v) =>
                v ? { username: v.replace(/^@/, '') } : null,
              )
            }
          />
          <Row
            label={t('profile.email')}
            value={user.email ?? '-'}
            onPress={() =>
              ask(
                t('profile.email'),
                user.email ?? '',
                (v) => (v ? { email: v } : null),
                'email-address',
              )
            }
          />
          <Row
            label={t('account.country')}
            value={countryName(user.country)}
            onPress={() => router.push('/country')}
          />
          <Row
            label={t('account.homeCity')}
            value={user.home_city ?? '-'}
            onPress={() =>
              ask(t('account.homeCity'), user.home_city ?? '', (v) => (v ? { home_city: v } : null))
            }
          />
          <Row
            label={t('account.height')}
            value={user.height_cm ? `${user.height_cm} cm` : '-'}
            onPress={() =>
              ask(
                t('account.heightPrompt'),
                user.height_cm ? String(user.height_cm) : '',
                (v) => {
                  const height = number(v, 80, 250);
                  return height ? { height_cm: height } : null;
                },
                'number-pad',
              )
            }
          />
        </Group>

        <Group title={t('account.preferences')}>
          {languageRow}
          {unitsRow}
          {notificationsRow}
          {visibilityRow}
        </Group>

        <Group>
          <Row label={t('settings.treadmills')} onPress={() => router.push('/treadmill')} />
        </Group>

        <Group>
          {passwordRow}
          <Row label={t('account.export')} onPress={exportData} />
          <Row label={t('account.privacyPolicy')} onPress={openPrivacy} />
        </Group>
        <Group>
          <Row label={t('profile.signOut')} onPress={signOut} tone="link" />
          <Row label={t('account.delete')} onPress={confirmDelete} tone="danger" />
        </Group>
      </View>
    </ScrollView>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      {title && <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{title}</Text>}
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  menu,
  tone,
  children,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  /** A native menu opening from the row, to pick a value. */
  menu?: { title?: string; items: MenuItem[] };
  tone?: 'link' | 'danger';
  children?: ReactNode;
}) {
  const colors = useColors();
  const color = tone === 'link' ? colors.blueText : tone === 'danger' ? colors.danger : colors.text;
  if (menu) {
    return (
      <ActionMenu full title={menu.title} items={menu.items} label={label}>
        <View style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.label, { color }]}>{label}</Text>
          {value !== undefined && (
            <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>
              {value}
            </Text>
          )}
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </ActionMenu>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <Text style={[styles.label, { color }, tone && { fontFamily: fonts.textSemiBold }]}>
        {label}
      </Text>
      {value !== undefined && (
        <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      )}
      {children}
      {onPress && !tone && <ChevronRight size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 20 },
  photo: { alignItems: 'center', gap: 10 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 99,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  groupTitle: { fontFamily: fonts.textSemiBold, fontSize: 13, marginLeft: 6 },
  group: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: -StyleSheet.hairlineWidth,
  },
  label: { flex: 1, fontFamily: fonts.textMedium, fontSize: 15.5 },
  value: { fontFamily: fonts.text, fontSize: 15, flexShrink: 1, maxWidth: '55%' },
});

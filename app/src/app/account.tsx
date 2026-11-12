import { router } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { api, ApiError } from '@/api/client';
import { useUpdateProfile, type ProfilePatch } from '@/api/profile';
import type { UserProfile } from '@/api/types';
import { fonts, useColors } from '@/theme';
import { Avatar, GlassButton } from '@/ui/primitives';

const COUNTRIES = ['FR', 'BE', 'CH', 'LU', 'CA'] as const;

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setUser, signOut, deleteAccount } = useAuth();
  const update = useUpdateProfile();
  const [busy, setBusy] = useState(false);
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

  /** iOS menu to pick one value. */
  const choose = <T extends string>(
    title: string,
    options: { value: T; label: string }[],
    pick: (value: T) => void,
  ) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...options.map((o) => o.label), t('journeys.cancel')],
        cancelButtonIndex: options.length,
      },
      (index) => {
        if (index < options.length) pick(options[index].value);
      },
    );

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
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('journeys.cancel'), style: 'cancel' },
      {
        text: t('account.delete'),
        style: 'destructive',
        onPress: () => deleteAccount().catch(failed),
      },
    ]);

  const number = (text: string, min: number, max: number) => {
    const value = Number.parseInt(text, 10);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };

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
            value={t(`account.countries.${user.country}`, { defaultValue: user.country })}
            onPress={() =>
              choose(
                t('account.country'),
                COUNTRIES.map((c) => ({ value: c, label: t(`account.countries.${c}`) })),
                (country) => save({ country }),
              )
            }
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
          <Row
            label={t('account.language')}
            value={t(`account.languages.${user.language}`)}
            onPress={() =>
              choose(
                t('account.language'),
                (['fr', 'en'] as const).map((l) => ({
                  value: l,
                  label: t(`account.languages.${l}`),
                })),
                (language) => save({ language }),
              )
            }
          />
          <Row
            label={t('account.units')}
            value={t(`account.unitNames.${user.units}`)}
            onPress={() =>
              choose(
                t('account.units'),
                (['km', 'mi'] as const).map((u) => ({
                  value: u,
                  label: t(`account.unitNames.${u}`),
                })),
                (units) => save({ units }),
              )
            }
          />
          <Row label={t('account.notifications')}>
            <Switch
              value={user.notifications}
              onValueChange={(on) => save({ notifications: on })}
            />
          </Row>
          <Row
            label={t('account.visibility')}
            value={t(`account.visibilities.${user.visibility}`)}
            onPress={() =>
              choose(
                t('account.visibilityHint'),
                (['everyone', 'friends'] as const).map((v) => ({
                  value: v,
                  label: t(`account.visibilities.${v}`),
                })),
                (visibility) => save({ visibility }),
              )
            }
          />
        </Group>

        <Group>
          <Row label={t('account.export')} onPress={exportData} />
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
  tone,
  children,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'link' | 'danger';
  children?: ReactNode;
}) {
  const colors = useColors();
  const color = tone === 'link' ? colors.blueText : tone === 'danger' ? colors.danger : colors.text;
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

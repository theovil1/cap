import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Bell,
  Bluetooth,
  ChevronLeft,
  Globe,
  ImageIcon,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProfilePatch } from '@/api/profile';
import type { UserProfile } from '@/api/types';
import { fonts, useColors } from '@/theme';
import { TextField } from '@/ui/controls';
import { InfoBanner } from '@/ui/pills';
import { Avatar, Button, Card, GlassButton } from '@/ui/primitives';

export type Section = 'account' | 'appearance' | 'treadmill' | 'notifications' | 'privacy';

const SECTIONS: { key: Section; icon: LucideIcon }[] = [
  { key: 'account', icon: UserRound },
  { key: 'appearance', icon: Sparkles },
  { key: 'treadmill', icon: Bluetooth },
  { key: 'notifications', icon: Bell },
  { key: 'privacy', icon: ShieldCheck },
];

/**
 * iPad settings: sections on the left, the chosen one on the right. The
 * account form saves all its fields at once; other sections reuse the rows
 * of the phone screen, passed in `sections`.
 */
export function SettingsWide({
  user,
  busy,
  onPhoto,
  onRemovePhoto,
  onCountry,
  onSave,
  onSignOut,
  onDelete,
  sections,
}: {
  user: UserProfile;
  busy: boolean;
  onPhoto: () => void;
  onRemovePhoto: () => void;
  onCountry: (pick: (country: string) => void) => void;
  onSave: (patch: ProfilePatch) => void;
  onSignOut: () => void;
  onDelete: () => void;
  sections: Record<Exclude<Section, 'account'>, ReactNode>;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('account');
  const [draft, setDraft] = useState<ProfilePatch>({});
  const field = <K extends keyof ProfilePatch>(key: K, fallback: string) =>
    draft[key] !== undefined ? String(draft[key]) : fallback;
  const set = (patch: ProfilePatch) => setDraft((d) => ({ ...d, ...patch }));
  const changed = Object.keys(draft).length > 0;
  const save = () => {
    onSave(draft);
    setDraft({});
  };
  const country = field('country', user.country);

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}
    >
      <View style={styles.header}>
        <GlassButton
          icon={<ChevronLeft size={22} color={colors.text} />}
          onPress={() => router.back()}
          label={t('common.back')}
        />
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
        <Card style={styles.sidebar}>
          {SECTIONS.map(({ key, icon: Icon }) => {
            const on = key === section;
            return (
              <Pressable
                key={key}
                onPress={() => setSection(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.item, on && { backgroundColor: colors.inset }]}
              >
                <Icon size={18} color={on ? colors.accentText : colors.textSecondary} />
                <Text style={[styles.itemText, { color: colors.text }]}>
                  {t(`settings.sections.${key}`)}
                </Text>
              </Pressable>
            );
          })}
          <View style={styles.flex} />
          <Text style={[styles.version, { color: colors.textMuted }]}>
            {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
          </Text>
        </Card>

        <Card style={styles.panel}>
          {section === 'account' ? (
            <>
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.identity}>
                  <Avatar name={user.first_name} size={88} photo={user.avatar_url} />
                  <View style={{ gap: 10 }}>
                    <Text style={[styles.panelTitle, { color: colors.text }]}>
                      {t('settings.sections.account')}
                    </Text>
                    <View style={styles.row}>
                      <Pressable
                        onPress={onPhoto}
                        disabled={busy}
                        accessibilityRole="button"
                        style={[styles.chip, { backgroundColor: colors.inset }]}
                      >
                        <ImageIcon size={16} color={colors.text} />
                        <Text style={[styles.chipText, { color: colors.text }]}>
                          {t('account.changePhoto')}
                        </Text>
                      </Pressable>
                      {user.avatar_url ? (
                        <Pressable onPress={onRemovePhoto} accessibilityRole="button" hitSlop={8}>
                          <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                            {t('settings.removePhoto')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <TextField
                      label={t('account.firstName')}
                      value={field('first_name', user.first_name)}
                      onChangeText={(v) => set({ first_name: v })}
                    />
                  </View>
                  <View style={styles.cell}>
                    <TextField
                      label={t('profile.username')}
                      value={field('username', user.username)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={(v) => set({ username: v.replace(/^@/, '') })}
                    />
                  </View>
                  <View style={styles.cell}>
                    <TextField
                      label={t('profile.email')}
                      value={field('email', user.email ?? '')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={(v) => set({ email: v })}
                    />
                  </View>
                  <View style={styles.cell}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('account.country')}
                    </Text>
                    <Pressable
                      onPress={() => onCountry((c) => set({ country: c }))}
                      accessibilityRole="button"
                      style={[
                        styles.picker,
                        { backgroundColor: colors.surface, borderColor: colors.track },
                      ]}
                    >
                      <Globe size={17} color={colors.textSecondary} />
                      <Text style={[styles.pickerText, { color: colors.text }]}>
                        {t(`account.countries.${country}`, { defaultValue: country })}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.cell}>
                    <TextField
                      label={t('account.homeCity')}
                      value={field('home_city', user.home_city ?? '')}
                      onChangeText={(v) => set({ home_city: v })}
                    />
                  </View>
                  <View style={styles.cell}>
                    <TextField
                      label={t('account.height')}
                      value={field('height_cm', user.height_cm ? String(user.height_cm) : '')}
                      keyboardType="number-pad"
                      onChangeText={(v) => {
                        const cm = Number.parseInt(v, 10);
                        if (cm >= 80 && cm <= 250) set({ height_cm: cm });
                      }}
                    />
                  </View>
                </View>
                <InfoBanner icon={MapPin}>{t('settings.placeNote')}</InfoBanner>
              </ScrollView>
              <View style={styles.footer}>
                <Button
                  tone="light"
                  size="medium"
                  title={t('profile.signOut')}
                  onPress={onSignOut}
                />
                <Pressable onPress={onDelete} accessibilityRole="button" hitSlop={8}>
                  <Text style={[styles.chipText, { color: colors.danger }]}>
                    {t('account.delete')}
                  </Text>
                </Pressable>
                <View style={styles.flex} />
                <Button
                  tone="dark"
                  size="medium"
                  title={t('account.save')}
                  onPress={save}
                  disabled={!changed}
                  style={styles.saveButton}
                />
              </View>
            </>
          ) : (
            <ScrollView contentContainerStyle={styles.form}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>
                {t(`settings.sections.${section}`)}
              </Text>
              {sections[section]}
            </ScrollView>
          )}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 32 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  title: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.9 },
  body: { flex: 1, flexDirection: 'row', gap: 20 },
  sidebar: { width: 280, padding: 10, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  itemText: { fontFamily: fonts.textMedium, fontSize: 15 },
  version: { fontFamily: fonts.text, fontSize: 12.5, padding: 14 },
  panel: { flex: 1, overflow: 'hidden' },
  form: { padding: 32, gap: 18 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  panelTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipText: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { width: '48%', flexGrow: 1, gap: 6 },
  fieldLabel: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  pickerText: { fontFamily: fonts.textSemiBold, fontSize: 15.5 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 28, paddingTop: 12 },
  saveButton: { minWidth: 220 },
});

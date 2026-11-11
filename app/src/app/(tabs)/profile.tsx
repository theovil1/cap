import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { formatNumber } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { TabScreen } from '@/ui/layout';
import { Avatar, Card } from '@/ui/primitives';

/** Minimal profile; the full "Mon compte" screen comes with the profile step. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user, signOut } = useAuth();
  if (!user) return null;

  const rows: [string, string][] = [
    [t('profile.username'), `@${user.username}`],
    [t('profile.email'), user.email ?? '-'],
    [t('profile.stepGoal'), formatNumber(user.daily_step_goal)],
    [t('profile.rhythm'), t('profile.perWeek', { count: user.sessions_per_week })],
  ];

  return (
    <TabScreen>
      <View style={styles.header}>
        <Avatar name={user.first_name} size={96} />
        <Text style={[styles.name, { color: colors.text }]}>{user.first_name}</Text>
      </View>
      <Card style={styles.list}>
        {rows.map(([label, value], i) => (
          <View
            key={label}
            style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
          >
            <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>
              {value}
            </Text>
          </View>
        ))}
      </Card>
      <Card style={styles.list}>
        <Pressable onPress={signOut} style={styles.row}>
          <Text style={[styles.label, { color: colors.blueText }]}>{t('profile.signOut')}</Text>
        </Pressable>
      </Card>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 10, marginBottom: 8 },
  name: { fontFamily: fonts.display, fontSize: 26 },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
    gap: 12,
  },
  label: { fontFamily: fonts.textMedium, fontSize: 15.5 },
  value: { fontFamily: fonts.text, fontSize: 15, flexShrink: 1 },
});

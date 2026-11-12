import { router } from 'expo-router';
import { ChevronLeft, CloudOff, Hand, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeleteSessions, useSessions } from '@/api/queries';
import { formatDate, formatDuration, formatKm, formatSpeed } from '@/i18n/format';
import { pendingSessions } from '@/session/store';
import { fonts, useColors } from '@/theme';
import { GlassButton } from '@/ui/primitives';

type Item = {
  id: string;
  startedAt: number;
  distanceM: number;
  durationS: number;
  manual: boolean;
  pending: boolean;
};

/** Every session, newest first, with those still waiting to be sent. */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: remote = [] } = useSessions();
  const remove = useDeleteSessions();
  const failed = () => Alert.alert(t('journeys.failed'));
  const confirm = (title: string, body: string, run: () => void) =>
    Alert.alert(title, body, [
      { text: t('journeys.cancel'), style: 'cancel' },
      { text: t('history.delete'), style: 'destructive', onPress: run },
    ]);
  const openMenu = (localId: string) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t('history.deleteOne'), t('journeys.cancel')],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) {
          confirm(t('history.deleteOneTitle'), t('history.deleteOneBody'), () =>
            remove.mutate(localId, { onError: failed }),
          );
        }
      },
    );
  const clearAll = () =>
    confirm(t('history.deleteAllTitle'), t('history.deleteAllBody'), () =>
      remove.mutate(null, { onError: failed }),
    );
  const synced = new Set(remote.map((s) => s.local_id));
  const items: Item[] = [
    ...pendingSessions()
      .filter((s) => !synced.has(s.localId))
      .map((s) => ({
        id: s.localId,
        startedAt: s.startedAt,
        distanceM: s.distanceM,
        durationS: s.durationS,
        manual: !!s.manual,
        pending: true,
      })),
    ...remote.map((s) => ({
      id: s.local_id,
      startedAt: Date.parse(s.started_at),
      distanceM: s.distance_m,
      durationS: s.duration_s,
      manual: s.source === 'manual',
      pending: false,
    })),
  ].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('history.title')}</Text>
          <GlassButton
            icon={<Plus size={22} color={colors.text} />}
            onPress={() => router.push('/manual-session')}
            label={t('history.add')}
          />
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('history.empty')}</Text>
      }
      ListFooterComponent={
        items.length > 0 ? (
          <Pressable onPress={clearAll} accessibilityRole="button" style={styles.clear} hitSlop={8}>
            <Text style={[styles.clearText, { color: colors.danger }]}>
              {t('history.deleteAll')}
            </Text>
          </Pressable>
        ) : undefined
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openMenu(item.id)}
          accessibilityRole="button"
          accessibilityHint={t('history.deleteOne')}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.date, { color: colors.text }]}>
              {formatDate(new Date(item.startedAt), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <View style={styles.inline}>
              <Text style={[styles.detail, { color: colors.textSecondary }]}>
                {formatDuration(item.durationS)} ·{' '}
                {formatSpeed((item.distanceM / item.durationS) * 3.6)} {t('units.kmh')}
              </Text>
              {item.manual && <Hand size={13} color={colors.textMuted} />}
              {item.pending && <CloudOff size={13} color={colors.textMuted} />}
            </View>
          </View>
          <Text style={[styles.km, { color: colors.text }]}>
            {formatKm(item.distanceM, 2)}
            <Text style={[styles.unit, { color: colors.textSecondary }]}> {t('units.km')}</Text>
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19, gap: 8, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontFamily: fonts.display, fontSize: 20 },
  empty: { fontFamily: fonts.text, fontSize: 15, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  clear: { alignSelf: 'center', paddingVertical: 18 },
  clearText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  date: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detail: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  km: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: fonts.textSemiBold, fontSize: 12, letterSpacing: 0 },
});

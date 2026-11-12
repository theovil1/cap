import { router } from 'expo-router';
import { CalendarDays, ChevronRight, Ellipsis, Flag, Swords } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDeleteJourney, useJourneys, useResetJourney } from '@/api/queries';
import type { JourneySummary } from '@/api/types';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { fonts, useColors } from '@/theme';
import { SectionHeader } from '@/ui/controls';
import { Card, ProgressBar } from '@/ui/primitives';

/** My journeys on the home screen: invitations, races to start, under way, finished. */
export function MyJourneys() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: journeys = [] } = useJourneys();
  const invitations = journeys.filter((j) => j.status === 'waiting' && !j.joined);
  const waiting = journeys.filter((j) => j.status === 'waiting' && j.joined && j.kind === 'race');
  const scheduled = journeys.filter((j) => j.status === 'waiting' && j.kind === 'event');
  const active = journeys.filter((j) => j.status === 'active' && j.joined);
  const finished = journeys.filter((j) => j.status === 'finished');

  return (
    <View style={styles.list}>
      <SectionHeader
        title={t('journeys.title')}
        action={t('journeys.new')}
        onAction={() => router.push('/new-journey')}
      />
      {invitations.length > 0 && (
        <Section title={t('journeys.invitations')} journeys={invitations} />
      )}
      {waiting.length > 0 && <Section title={t('journeys.waiting')} journeys={waiting} />}
      {scheduled.length > 0 && <Section title={t('journeys.scheduled')} journeys={scheduled} />}
      {active.length > 0 && <Section title={t('journeys.active')} journeys={active} />}
      {finished.length > 0 && <Section title={t('journeys.history')} journeys={finished} />}
      {journeys.length === 0 && (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('journeys.empty')}</Text>
      )}
    </View>
  );
}

function Section({ title, journeys }: { title: string; journeys: JourneySummary[] }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      {journeys.map((j) => (
        <JourneyRow key={j.id} journey={j} />
      ))}
    </View>
  );
}

/** Native menu, then a confirmation: start again or delete for good. */
function useJourneyMenu(journey: JourneySummary) {
  const { t } = useTranslation();
  const reset = useResetJourney();
  const remove = useDeleteJourney();
  const failed = () => Alert.alert(t('journeys.failed'));
  const confirm = (title: string, body: string, action: string, run: () => void) =>
    Alert.alert(title, body, [
      { text: t('journeys.cancel'), style: 'cancel' },
      { text: action, style: 'destructive', onPress: run },
    ]);
  return () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: journeyTitle(journey),
        options: [t('journeys.restart'), t('journeys.delete'), t('journeys.cancel')],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) {
          confirm(
            t('journeys.restartTitle'),
            t('journeys.restartBody'),
            t('journeys.restart'),
            () => reset.mutate(journey.id, { onError: failed }),
          );
        } else if (index === 1) {
          confirm(t('journeys.deleteTitle'), t('journeys.deleteBody'), t('journeys.delete'), () =>
            remove.mutate(journey.id, { onError: failed }),
          );
        }
      },
    );
}

function JourneyRow({ journey }: { journey: JourneySummary }) {
  const { t } = useTranslation();
  const colors = useColors();
  const openMenu = useJourneyMenu(journey);
  const ratio = journey.distance_m / journey.route_distance_m;
  const race = journey.kind === 'race';
  const event = journey.kind === 'event';
  return (
    <Pressable
      disabled={!race && !event}
      onPress={() =>
        router.push(
          event
            ? { pathname: '/event/[id]', params: { id: journey.id } }
            : { pathname: '/race/[id]', params: { id: journey.id } },
        )
      }
      accessibilityRole={race || event ? 'button' : undefined}
    >
      <Card style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {journeyTitle(journey)}
          </Text>
          {journey.arrived_at ? (
            <Flag size={18} color={colors.accent} />
          ) : (
            <Text style={[styles.percent, { color: colors.accentText }]}>
              {formatNumber(Math.floor(ratio * 100))} %
            </Text>
          )}
          {race || event ? (
            <ChevronRight size={20} color={colors.textMuted} />
          ) : (
            <Pressable
              onPress={openMenu}
              accessibilityRole="button"
              accessibilityLabel={t('journeys.options')}
              hitSlop={10}
              style={[styles.more, { backgroundColor: colors.inset }]}
            >
              <Ellipsis size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        {event && (
          <View style={styles.raceTag}>
            <CalendarDays size={14} color={colors.blueText} />
            <Text style={[styles.detail, { color: colors.blueText }]}>
              {journey.status === 'waiting'
                ? t('journeys.eventWaiting', {
                    date: formatDate(new Date(journey.starts_at ?? journey.created_at), {
                      day: 'numeric',
                      month: 'long',
                    }),
                  })
                : t('journeys.eventPlayers', { count: journey.players })}
            </Text>
          </View>
        )}
        {race && (
          <View style={styles.raceTag}>
            <Swords size={14} color={colors.blueText} />
            <Text style={[styles.detail, { color: colors.blueText }]}>
              {journey.status === 'waiting'
                ? journey.joined
                  ? t('journeys.raceWaiting')
                  : t('journeys.raceInvited')
                : t('journeys.racePlayers', { count: journey.players })}
            </Text>
          </View>
        )}
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          {journey.arrived_at
            ? t('journeys.arrivedOn', {
                km: formatKm(journey.route_distance_m, 0),
                date: formatDate(new Date(journey.arrived_at), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })
            : t('journeys.progress', {
                walked: formatKm(journey.distance_m),
                total: formatKm(journey.route_distance_m, 0),
              })}
        </Text>
        {!journey.arrived_at && <ProgressBar ratio={ratio} />}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 10 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  empty: { fontFamily: fonts.text, fontSize: 15, textAlign: 'center', marginTop: 8 },
  row: { padding: 16, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 18 },
  percent: { fontFamily: fonts.display, fontSize: 18, fontVariant: ['tabular-nums'] },
  raceTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  more: { width: 32, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  detail: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
});

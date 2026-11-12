import { router } from 'expo-router';
import { Ellipsis, Flag, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDeleteJourney, useJourneys, useResetJourney } from '@/api/queries';
import type { JourneySummary } from '@/api/types';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { fonts, useColors } from '@/theme';
import { TabScreen } from '@/ui/layout';
import { Button, Card, ProgressBar } from '@/ui/primitives';

export default function JourneysScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: journeys = [] } = useJourneys();
  const active = journeys.filter((j) => j.status === 'active');
  const finished = journeys.filter((j) => j.status === 'finished');

  return (
    <TabScreen>
      <Text style={[styles.title, { color: colors.text }]}>{t('journeys.title')}</Text>
      <Button
        title={t('journeys.new')}
        icon={<Plus size={20} color="#FFFFFF" />}
        onPress={() => router.push('/new-journey')}
      />
      {active.length > 0 && <Section title={t('journeys.active')} journeys={active} />}
      {finished.length > 0 && <Section title={t('journeys.history')} journeys={finished} />}
      {journeys.length === 0 && (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('journeys.empty')}</Text>
      )}
    </TabScreen>
  );
}

function Section({ title, journeys }: { title: string; journeys: JourneySummary[] }) {
  const colors = useColors();
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Text style={[styles.section, { color: colors.textSecondary }]}>{title}</Text>
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
  return (
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
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t('journeys.options')}
          hitSlop={10}
          style={[styles.more, { backgroundColor: colors.inset }]}
        >
          <Ellipsis size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
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
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.9, marginBottom: 4 },
  section: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  empty: { fontFamily: fonts.text, fontSize: 15, textAlign: 'center', marginTop: 24 },
  row: { padding: 16, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 18 },
  percent: { fontFamily: fonts.display, fontSize: 18, fontVariant: ['tabular-nums'] },
  more: { width: 32, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  detail: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
});

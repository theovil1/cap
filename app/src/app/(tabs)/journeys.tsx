import { router } from 'expo-router';
import { Flag, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useJourneys } from '@/api/queries';
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

function JourneyRow({ journey }: { journey: JourneySummary }) {
  const { t } = useTranslation();
  const colors = useColors();
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
  detail: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
});

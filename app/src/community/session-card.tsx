import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { SessionPostData } from '@/api/types';
import { formatDuration, formatKm, formatPace } from '@/i18n/format';
import { paceMinPerKm } from '@/journey/progress';
import { fonts, useColors } from '@/theme';
import { TIGHT_TEXT_SCALE } from '@/tokens';

import { SessionMap } from './session-map';

/**
 * A posted session: its stretch of route seen from above, then distance, time
 * and pace. Also the preview before posting.
 */
export function SessionCardBody({ data }: { data: SessionPostData }) {
  const { t } = useTranslation();
  const colors = useColors();
  const km = data.distance_m / 1000;
  const speed = data.duration_s > 0 ? (data.distance_m / data.duration_s) * 3.6 : 0;
  const facts: [string, string][] = [
    [t('sessionPost.distance'), `${formatKm(data.distance_m, 2)} ${t('units.km')}`],
    [t('sessionPost.duration'), formatDuration(data.duration_s)],
    [t('sessionPost.pace'), km > 0 ? `${formatPace(paceMinPerKm(speed))} ${t('units.pace')}` : '-'],
  ];
  return (
    <View style={[styles.box, { backgroundColor: colors.inset }]}>
      {data.journey && data.journey.walked.length > 1 ? (
        <SessionMap walked={data.journey.walked} ahead={data.journey.ahead} />
      ) : null}
      {data.journey ? (
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {data.journey.title}
        </Text>
      ) : null}
      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <Text
              style={[styles.label, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
            >
              {label}
            </Text>
            <Text
              style={[styles.value, { color: colors.text }]}
              numberOfLines={1}
              maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 18, overflow: 'hidden' },
  title: { fontFamily: fonts.textSemiBold, fontSize: 14, paddingHorizontal: 14, paddingTop: 12 },
  facts: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, gap: 8 },
  fact: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.textMedium, fontSize: 12 },
  value: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.3 },
});

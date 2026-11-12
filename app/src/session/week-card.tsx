import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatDate, formatKm } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { Card, Figure, Label } from '@/ui/primitives';

/** iPad: kilometres of each day of the week as bars, Monday first. */
export function WeekCard({ metres }: { metres: number[] }) {
  const { t } = useTranslation();
  const colors = useColors();
  const top = Math.max(...metres, 1);
  // Monday 7 December 2026 starts the reference week for the day initials.
  const initials = metres.map((_, i) =>
    formatDate(new Date(2026, 11, 7 + i, 12), { weekday: 'narrow' }).toUpperCase(),
  );
  return (
    <Card style={[styles.week, styles.grow]}>
      <View style={styles.weekHeader}>
        <Label style={styles.weekLabel}>{t('home.thisWeek')}</Label>
        <Figure
          value={formatKm(metres.reduce((a, b) => a + b, 0))}
          unit={t('units.km')}
          size={26}
        />
      </View>
      <View style={styles.bars}>
        {metres.map((m, i) => (
          <View key={i} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                m > 0
                  ? { height: `${Math.max(8, (85 * m) / top)}%`, backgroundColor: colors.accent }
                  : { height: 6, backgroundColor: colors.inset },
              ]}
            />
            <Text style={[styles.barDay, { color: colors.textMuted }]}>{initials[i]}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  week: { padding: 18, gap: 12, minHeight: 200, borderRadius: 26 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  weekLabel: { fontSize: 14 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 8 },
  barDay: { fontFamily: fonts.textSemiBold, fontSize: 11.5 },
});

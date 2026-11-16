import { Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { heartFromHealth } from '@/health/health';
import { fonts, useColors, type Colors } from '@/theme';
import { Figure } from '@/ui/primitives';

import { ZONE_KEYS, heartSummary, zoneOf } from './heart-rate';
import { useHeart } from './monitor';

/** Older than this, a value is stale and the tile hides. */
const FRESH_MS = 10_000;

function zoneColor(zone: number, colors: Colors): string {
  return [colors.textMuted, colors.blue, colors.gold, colors.accent, colors.danger][zone - 1];
}

/** Live heart rate, only while a sensor sends values. */
export function HeartTile({ wide, style }: { wide: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { bpm, at, sensor } = useHeart();
  // Re-render now and then so a silent sensor makes the tile go away.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  if (bpm === null || Math.max(now, at) - at > FRESH_MS) return null;

  const zone = zoneOf(bpm);
  const color = zoneColor(zone, colors);
  const label = `${t('heart.zone', { zone })} · ${t(`heart.zones.${ZONE_KEYS[zone - 1]}`)}`;
  return (
    <View
      style={[styles.tile, wide && styles.tileWide, { backgroundColor: colors.inset }, style]}
      accessible
      accessibilityLabel={`${t('heart.title')} ${bpm} ${t('heart.bpm')}, ${label}`}
    >
      <View style={styles.left}>
        <View style={styles.inline}>
          <Heart size={14} color={colors.heart} fill={colors.heart} />
          <Text style={[styles.label, wide && styles.labelWide, { color: colors.textSecondary }]}>
            {t('heart.title')}
          </Text>
        </View>
        <Figure value={String(bpm)} unit={t('heart.bpm')} size={wide ? 30 : 22} />
      </View>
      <View style={styles.right}>
        <Text style={[styles.zone, { color }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.bar}>
          {ZONE_KEYS.map((key, i) => (
            <View
              key={key}
              style={[
                styles.segment,
                { backgroundColor: i < zone ? zoneColor(i + 1, colors) : colors.trackIdle },
              ]}
            />
          ))}
        </View>
        {sensor?.name ? (
          <Text style={[styles.device, { color: colors.textMuted }]} numberOfLines={1}>
            {sensor.name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  tileWide: { padding: 18, borderRadius: 22 },
  left: { flex: 0, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.textMedium, fontSize: 13 },
  labelWide: { fontSize: 14 },
  right: { flex: 1, gap: 6 },
  zone: { fontFamily: fonts.textSemiBold, fontSize: 12.5, textAlign: 'right' },
  bar: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  device: { fontFamily: fonts.text, fontSize: 11.5, textAlign: 'right' },
  max: { fontFamily: fonts.text, fontSize: 11.5 },
});

/** Average and highest heart rate of a finished session: from its sensor, else from Health. */
export function useSessionHeart(
  session: { startedAt: number; endedAt: number; heartRates?: [number, number][] } | null,
) {
  const fromSensor = heartSummary(session?.heartRates);
  const [fromHealth, setFromHealth] = useState<{ average: number; max: number } | null>(null);
  const start = session?.startedAt;
  const end = session?.endedAt;
  const needed = !fromSensor && start !== undefined && end !== undefined;
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    // A watch may sync its heart rate to Health a little after the session.
    const read = () =>
      heartFromHealth(start, end).then((found) => alive && found && setFromHealth(found));
    void read();
    const timer = setTimeout(read, 15_000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [needed, start, end]);
  return fromSensor ?? fromHealth;
}

/** The summary's Cardio tile: average in big, highest under it. */
export function SummaryHeartTile({
  heart,
  size,
  unitSize,
  style,
  labelStyle,
}: {
  heart: { average: number; max: number };
  size: number;
  unitSize?: number;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[{ backgroundColor: colors.inset }, style]}>
      <View style={styles.inline}>
        <Heart size={12} color={colors.heart} fill={colors.heart} />
        <Text style={[labelStyle, { color: colors.textSecondary }]}>{t('summary.cardio')}</Text>
      </View>
      <Figure
        value={String(heart.average)}
        unit={t('summary.cardioAvg')}
        size={size}
        unitSize={unitSize}
      />
      <Text style={[styles.max, { color: colors.textMuted }]}>
        {t('summary.cardioMax', { bpm: heart.max })}
      </Text>
    </View>
  );
}

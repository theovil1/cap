import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { JourneyDetail } from '@/api/types';
import { formatKm, formatRank } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { StatusLabel } from '@/ui/pills';
import { Avatar, Card } from '@/ui/primitives';

import { trackWindow } from './race';
import { useRacers } from './use-racers';

/** Avatar with its 3 point ring: 30 inside, 36 outside. */
const PAWN = 36;

/**
 * Home card of the race under way: my place, who walks right now, and the
 * walkers on a stretch of road framed around them.
 */
export function RaceCard({ detail, myDistanceM }: { detail: JourneyDetail; myDistanceM: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const list = useRacers(detail, myDistanceM);
  const me = list.find((r) => r.me);
  if (!me || list.length < 2) return null;

  const { startM, endM } = trackWindow(list.map((r) => r.distanceM));
  const at = (m: number) => `${(100 * (m - startM)) / (endM - startM)}%` as const;
  const walking = list.find((r) => !r.me && (r.speedKmh ?? 0) > 0);
  const leader = list[0];
  const second = list[1];
  const gapM = me.place === 1 ? me.distanceM - second.distanceM : leader.distanceM - me.distanceM;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/race/[id]', params: { id: detail.id } })}
      accessibilityRole="button"
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('home.race')}{' '}
            <Text style={{ color: colors.accentText }}>{formatRank(me.place)}</Text>{' '}
            {t('home.raceOf', { count: list.length })}
          </Text>
          {walking ? <StatusLabel label={t('home.walking', { name: walking.firstName })} /> : null}
        </View>
        <View style={styles.track}>
          <View style={[styles.line, { backgroundColor: colors.inset }]} />
          <View
            style={[styles.fill, { width: at(me.distanceM), backgroundColor: colors.accent }]}
          />
          {list.map((r) => (
            <View
              key={r.userId}
              style={[styles.tick, { left: at(r.distanceM), backgroundColor: colors.textMuted }]}
            />
          ))}
          {[...list].reverse().map((r) => (
            <View
              key={r.userId}
              style={[styles.pawn, { left: at(r.distanceM), top: r.me ? -3 : 33 }]}
            >
              <Avatar
                name={r.firstName}
                size={PAWN}
                ring={colors.surface}
                tone={r.me ? 'accent' : r.distanceM > me.distanceM ? 'blue' : 'plain'}
              />
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.small, { color: colors.textMuted }]}>
            {formatKm(startM, 0)} {t('units.km')}
          </Text>
          {gapM > 0 ? (
            <Text style={[styles.small, { color: colors.textMuted }]}>
              {t(me.place === 1 ? 'home.raceAhead' : 'home.raceToLead', { km: formatKm(gapM) })}
            </Text>
          ) : null}
          <Text style={[styles.small, { color: colors.textMuted }]}>
            {formatKm(endM, 0)} {t('units.km')}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  track: { height: 66, marginHorizontal: 6 },
  line: { position: 'absolute', left: 0, right: 0, top: 32, height: 4, borderRadius: 99 },
  fill: { position: 'absolute', left: 0, top: 32, height: 4, borderRadius: 99 },
  tick: { position: 'absolute', top: 31, width: 2, height: 6, marginLeft: -1 },
  pawn: { position: 'absolute', marginLeft: -PAWN / 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontFamily: fonts.text, fontSize: 11.5, fontVariant: ['tabular-nums'] },
});

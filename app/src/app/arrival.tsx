import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Route as RouteIcon, Share as ShareIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJourney, useSessions } from '@/api/queries';
import { formatKm, formatNumber, formatRank, shortPlace } from '@/i18n/format';
import { fonts, useColors, useShadows } from '@/theme';
import { Grain } from '@/ui/grain';
import { Medal } from '@/ui/medal';
import { HOME } from '@/ui/routes';
import { Button, RoundButton } from '@/ui/primitives';

const DAY_MS = 86_400_000;
const CONFETTI_COLORS = ['#FF5A1F', '#2952FF', '#16894A', '#E8A317'];

/** Small coloured pieces scattered over the top of the screen, always the same. */
const PIECES = (() => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 34 }, (_, i) => ({
    left: `${rand() * 100}%` as const,
    top: `${rand() * 52}%` as const,
    rotate: `${Math.round(rand() * 180)}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    long: rand() > 0.5,
  }));
})();

function Confetti() {
  const pieces = PIECES;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <View
          key={i}
          style={[
            styles.piece,
            p.long && styles.pieceLong,
            {
              left: p.left,
              top: p.top,
              backgroundColor: p.color,
              transform: [{ rotate: p.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** A journey just finished: the medal, the welcome and what it took. */
export default function ArrivalScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: journey } = useJourney(id);
  const { data: sessions = [] } = useSessions();
  const [openedAt] = useState(() => Date.now());

  if (!id) return <Redirect href={HOME} />;
  if (!journey) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const startMs = Date.parse(journey.starts_at ?? journey.created_at);
  const endMs = journey.arrived_at ? Date.parse(journey.arrived_at) : openedAt;
  const days = Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
  // Sessions walked while this journey was under way.
  const count = sessions.filter((s) => {
    const at = Date.parse(s.started_at);
    return at >= startMs && at <= endMs;
  }).length;
  const from = journey.start_town ?? shortPlace(journey.start.label);
  const to = journey.end_town ?? shortPlace(journey.end.label);
  const race = journey.kind === 'race' && journey.rank !== null;

  const share = () =>
    Share.share({
      message: t('arrival.shareText', { from, to, km: formatKm(journey.route_distance_m, 0) }),
    });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Grain />
      <Confetti />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.close}>
            <RoundButton
              icon={<X size={20} color={colors.text} />}
              onPress={() => router.dismissTo(HOME)}
              label={t('common.close')}
            />
          </View>
          <View style={styles.medal}>
            <Medal
              metal="gold"
              ribbon="cap"
              width={168}
              face={{ kind: 'number', value: formatKm(journey.route_distance_m, 0), unit: 'KM' }}
              label={t('arrival.medal', { place: to })}
            />
          </View>
          <Text style={[styles.kicker, { color: colors.accentText }]}>
            {race
              ? t('arrival.doneRace', { place: formatRank(journey.rank ?? 1) })
              : t('arrival.done')}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('arrival.welcome', { place: to })}
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {t('arrival.lead', { from, to })}
          </Text>
          <View style={styles.tiles}>
            {[
              [formatKm(journey.route_distance_m, 0), t('units.km')],
              [formatNumber(count), t('arrival.sessions', { count })],
              [formatNumber(days), t('arrival.days', { count: days })],
            ].map(([value, label]) => (
              <View
                key={label}
                style={[styles.tile, { backgroundColor: colors.surface }, shadows.card]}
              >
                <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
                <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.column, { gap: 10 }]}>
          <Button
            tone="accent"
            title={t('arrival.next')}
            icon={<RouteIcon size={20} color={colors.onAccent} />}
            onPress={() => {
              router.dismissTo(HOME);
              router.push('/new-journey');
            }}
          />
          <Button
            tone="light"
            title={t('arrival.share')}
            icon={<ShareIcon size={19} color={colors.text} />}
            onPress={share}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  close: { alignItems: 'flex-end' },
  medal: { alignItems: 'center', marginTop: -10, marginBottom: 6 },
  kicker: { fontFamily: fonts.textSemiBold, fontSize: 14, textAlign: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -1.4,
    textAlign: 'center',
  },
  text: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 23, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 6 },
  tile: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 18 },
  tileValue: { fontFamily: fonts.display, fontSize: 24, fontVariant: ['tabular-nums'] },
  tileLabel: { fontFamily: fonts.textMedium, fontSize: 12.5 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  piece: { position: 'absolute', width: 7, height: 5, borderRadius: 1.5, opacity: 0.9 },
  pieceLong: { width: 9, height: 4 },
});

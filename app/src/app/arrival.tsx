import { Camera, Map } from '@maplibre/maplibre-react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Route as RouteIcon, Share as ShareIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJourney, useSessions } from '@/api/queries';
import type { JourneyDetail } from '@/api/types';
import { formatKm, formatNumber, formatRank, shortPlace } from '@/i18n/format';
import { ArrivalMedal } from '@/journey/arrival-medal';
import { useMapStyle } from '@/map/style';
import { fonts, useColors, useShadows } from '@/theme';
import { Confetti } from '@/ui/confetti';
import { Grain } from '@/ui/grain';
import { useWide } from '@/ui/layout';
import { Button, Glass, GlassButton, RoundButton } from '@/ui/primitives';
import { HOME } from '@/ui/routes';

const DAY_MS = 86_400_000;

/** A journey just finished: the medal, the welcome and what it took. */
export default function ArrivalScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: journey } = useJourney(id);
  const { data: sessions = [] } = useSessions();
  const [openedAt] = useState(() => Date.now());
  const colors = useColors();
  const wide = useWide();

  if (!id) return <Redirect href={HOME} />;
  if (!journey) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const startMs = Date.parse(journey.starts_at ?? journey.created_at);
  const endMs = journey.arrived_at ? Date.parse(journey.arrived_at) : openedAt;
  const days = Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
  // The API counts the sessions of the journey; an older server leaves the
  // sessions walked while it was under way.
  const count =
    journey.sessions ??
    sessions.filter((s) => {
      const at = Date.parse(s.started_at);
      return at >= startMs && at <= endMs;
    }).length;
  const from = journey.start_town ?? shortPlace(journey.start.label);
  const to = journey.end_town ?? shortPlace(journey.end.label);
  const km = formatKm(journey.route_distance_m, 0);
  const facts = {
    from,
    to,
    km,
    days,
    count,
    race: journey.kind === 'race' && journey.rank !== null ? formatRank(journey.rank) : null,
  };
  const share = () => Share.share({ message: t('arrival.shareText', { from, to, km }) });
  const next = () => {
    router.dismissTo(HOME);
    router.push('/new-journey');
  };

  return wide ? (
    <WideArrival journey={journey} facts={facts} onShare={share} onNext={next} />
  ) : (
    <PhoneArrival journey={journey} facts={facts} onShare={share} onNext={next} />
  );
}

type Facts = {
  from: string;
  to: string;
  km: string;
  days: number;
  count: number;
  /** My place when the journey was a race. */
  race: string | null;
};

type Props = { journey: JourneyDetail; facts: Facts; onShare: () => void; onNext: () => void };

function PhoneArrival({ journey, facts, onShare, onNext }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
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
        <View style={styles.close}>
          <RoundButton
            icon={<X size={20} color={colors.text} />}
            onPress={() => router.dismissTo(HOME)}
            label={t('common.close')}
          />
        </View>
        <View style={styles.medal}>
          <ArrivalMedal
            lat={journey.end.lat}
            lon={journey.end.lon}
            distance={`${facts.km} KM`}
            width={168}
            label={t('arrival.medal', { place: facts.to })}
          />
        </View>
        <Text style={[styles.kicker, { color: colors.accentText }]}>
          {facts.race ? t('arrival.doneRace', { place: facts.race }) : t('arrival.done')}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('arrival.welcome', { place: facts.to })}
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {t('arrival.lead', { from: facts.from, to: facts.to })}
        </Text>
        <View style={styles.tiles}>
          {[
            [facts.km, t('units.km')],
            [formatNumber(facts.count), t('arrival.sessions', { count: facts.count })],
            [formatNumber(facts.days), t('arrival.days', { count: facts.days })],
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
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          tone="accent"
          title={t('arrival.next')}
          icon={<RouteIcon size={20} color={colors.onAccent} />}
          onPress={onNext}
        />
        <Button
          tone="light"
          title={t('arrival.share')}
          icon={<ShareIcon size={19} color={colors.text} />}
          onPress={onShare}
        />
      </View>
    </View>
  );
}

/** iPad: the destination in 3D behind, the words on the left, the medal on the right. */
function WideArrival({ journey, facts, onShare, onNext }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapStyle = useMapStyle();
  const kicker = [
    `${facts.km} ${t('units.km')}`,
    t('arrival.done'),
    facts.race ? t('arrival.racePlace', { place: facts.race }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.screen, styles.night]}>
      {mapStyle && (
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          compass={false}
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          dragPan={false}
          touchZoom={false}
          touchRotate={false}
          touchPitch={false}
        >
          <Camera
            center={[journey.end.lon, journey.end.lat]}
            zoom={15.6}
            pitch={62}
            bearing={20}
            padding={{ top: 0, bottom: 0, left: 420, right: 0 }}
          />
        </Map>
      )}
      <View style={[StyleSheet.absoluteFill, styles.veil]} pointerEvents="none" />
      <Confetti />

      <View style={[styles.wideClose, { top: insets.top + 20 }]}>
        <GlassButton
          icon={<X size={22} color={colors.text} />}
          onPress={() => router.dismissTo(HOME)}
          label={t('common.close')}
        />
      </View>

      <View style={styles.wideText}>
        <View style={styles.widePill}>
          <Text style={styles.widePillText}>{kicker.toUpperCase()}</Text>
        </View>
        <Text style={styles.wideTitle}>{t('arrival.welcome', { place: facts.to })}</Text>
        <Text style={styles.wideLead}>
          {t('arrival.lead', { from: facts.from, to: facts.to })}{' '}
          {t('arrival.summary', {
            sessions: t('arrival.sessionsCount', { count: facts.count }),
            days: t('arrival.daysCount', { count: facts.days }),
          })}
        </Text>
        <View style={styles.wideButtons}>
          <Pressable onPress={onShare} accessibilityRole="button" style={styles.ghost}>
            <ShareIcon size={18} color="#FFFFFF" />
            <Text style={styles.ghostText}>{t('summary.share')}</Text>
          </Pressable>
          <Button
            tone="accent"
            size="medium"
            title={t('arrival.newJourney')}
            icon={<RouteIcon size={18} color={colors.onAccent} />}
            onPress={onNext}
            style={styles.wideNext}
          />
        </View>
      </View>

      <View style={styles.wideMedal}>
        <ArrivalMedal
          lat={journey.end.lat}
          lon={journey.end.lon}
          distance={`${facts.km} KM`}
          width={170}
          label={t('arrival.medal', { place: facts.to })}
        />
        <Glass style={styles.medalCard}>
          <Text style={[styles.medalTitle, { color: colors.text }]}>{t('arrival.newMedal')}</Text>
          <Text style={[styles.medalText, { color: colors.textSecondary }]}>
            {t('arrival.medalOf', { from: facts.from, to: facts.to })}
          </Text>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 20, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  night: { backgroundColor: '#1B1D2E' },
  veil: {
    backgroundImage:
      'linear-gradient(90deg, rgba(14,15,24,0.88) 0%, rgba(14,15,24,0.62) 42%, rgba(14,15,24,0.18) 100%)',
  },
  wideClose: { position: 'absolute', right: 28 },
  wideText: {
    position: 'absolute',
    left: 64,
    top: 0,
    bottom: 0,
    width: 520,
    justifyContent: 'center',
    gap: 22,
  },
  widePill: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  widePillText: { fontFamily: fonts.textBold, fontSize: 13, letterSpacing: 0.8, color: '#FFFFFF' },
  wideTitle: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: -2.5,
    color: '#FFFFFF',
  },
  wideLead: {
    fontFamily: fonts.text,
    fontSize: 17,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.86)',
  },
  wideButtons: { flexDirection: 'row', gap: 12, marginTop: 6 },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  ghostText: { fontFamily: fonts.textSemiBold, fontSize: 16, color: '#FFFFFF' },
  wideNext: { height: 56, borderRadius: 18, paddingHorizontal: 28 },
  wideMedal: { position: 'absolute', right: 80, top: 110, alignItems: 'center', gap: 18 },
  medalCard: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 18,
  },
  medalTitle: { fontFamily: fonts.display, fontSize: 21 },
  medalText: { fontFamily: fonts.text, fontSize: 13 },
});

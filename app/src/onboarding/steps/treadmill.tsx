import { router } from 'expo-router';
import { Bluetooth, Check, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatSpeed } from '@/i18n/format';
import { useSession } from '@/session/session-context';
import { fonts, useColors, useShadows } from '@/theme';
import { Button, Figure } from '@/ui/primitives';

import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { GroupLabel } from '../parts';

const BARS = 30;

/** Étape 6: the treadmill found over Bluetooth, live, before the first walk. */
export function TreadmillStep({ nav, next }: { nav: FrameNav; next: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const { connection, data } = useSession();
  const connected = connection.status === 'connected';
  const blocked = connection.status === 'unauthorized' || connection.status === 'bluetoothOff';

  // Each frame received adds a bar: the signal is alive (taller when the belt moves).
  const [bars, setBars] = useState<number[]>([]);
  const [seen, setSeen] = useState(data);
  if (data && data !== seen) {
    setSeen(data);
    const level =
      data.speedKmh > 0.3
        ? Math.min(1, 0.3 + data.speedKmh / 8)
        : 0.2 + ((bars.length * 37) % 80) / 100;
    setBars((list) => [...list.slice(-(BARS - 1)), level]);
  }

  const card = connected ? (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.success },
        shadows.card,
      ]}
    >
      <View style={styles.device}>
        <View style={[styles.deviceIcon, { backgroundColor: colors.successSoft }]}>
          <Bluetooth size={28} color={colors.success} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {connection.deviceName ?? t('treadmill.unknownName')}
          </Text>
          <Text style={[styles.status, { color: colors.success }]}>
            {t('onboarding.treadmill.connected')}
          </Text>
        </View>
        <Check size={24} color={colors.success} strokeWidth={2.6} />
      </View>
      <View style={styles.bars}>
        {Array.from({ length: BARS }, (_, i) => {
          const level = bars[bars.length - BARS + i];
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: level === undefined ? 4 : Math.max(6, 28 * level),
                  backgroundColor: colors.success,
                  opacity: 0.35 + (0.63 * i) / (BARS - 1),
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.tiles}>
        <Tile label={t('onboarding.treadmill.speed')}>
          <Figure
            value={formatSpeed(data?.speedKmh ?? 0)}
            unit={t('onboarding.treadmill.speedUnit')}
            size={20}
          />
        </Tile>
        <Tile label={t('onboarding.treadmill.distance')}>
          <Figure value={yesNo(t, data, data?.distanceM)} size={20} />
        </Tile>
        <Tile label={t('onboarding.treadmill.incline')}>
          <Figure value={yesNo(t, data, data?.inclinePct)} size={20} />
        </Tile>
      </View>
    </View>
  ) : (
    <View
      style={[
        styles.card,
        styles.waiting,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadows.card,
      ]}
    >
      {blocked ? null : <ActivityIndicator color={colors.textMuted} />}
      <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
        {t(`treadmill.status.${connection.status}`, { name: connection.deviceName ?? '' })}
      </Text>
      {connection.status === 'unauthorized' ? (
        <Button
          tone="light"
          size="medium"
          title={t('onboarding.treadmill.settings')}
          onPress={() => Linking.openSettings()}
        />
      ) : null}
    </View>
  );

  return (
    <OnboardingFrame
      {...nav}
      footer={
        <Button tone="blue" title={t('onboarding.continue')} onPress={next} disabled={!connected} />
      }
    >
      <Headline
        kicker={t('onboarding.treadmill.kicker')}
        title={t(connected ? 'onboarding.treadmill.found' : 'onboarding.treadmill.looking')}
        text={t('onboarding.treadmill.text')}
      />
      {card}
      {connected ? (
        <>
          <GroupLabel>{t('onboarding.treadmill.notYours')}</GroupLabel>
          <Pressable
            onPress={() => router.push('/treadmill')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.other,
              { borderColor: colors.track, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.otherIcon, { backgroundColor: colors.inset }]}>
              <Bluetooth size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.otherName, { color: colors.text }]} numberOfLines={1}>
                {connection.hardwareName ?? connection.deviceName ?? ''}
              </Text>
              <Text style={[styles.otherText, { color: colors.textSecondary }]}>
                {t('onboarding.treadmill.setUp')}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        </>
      ) : null}
    </OnboardingFrame>
  );
}

/** "Oui" once the treadmill sent that field, a dash while waiting for it. */
function yesNo(t: (key: string) => string, data: unknown, field: number | undefined): string {
  if (!data) return '-';
  return field === undefined ? t('onboarding.treadmill.no') : t('onboarding.treadmill.yes');
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.inset }]}>
      <Text style={[styles.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 26, borderWidth: 2, padding: 17, gap: 16 },
  waiting: { borderWidth: 1, padding: 24, alignItems: 'center', gap: 12 },
  waitingText: { fontFamily: fonts.textMedium, fontSize: 14.5, textAlign: 'center' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  deviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.textSemiBold, fontSize: 17 },
  status: { fontFamily: fonts.textSemiBold, fontSize: 13, marginTop: 3 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 28 },
  bar: { flex: 1, borderRadius: 3 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'space-between',
  },
  tileLabel: { fontFamily: fonts.textMedium, fontSize: 12 },
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  otherIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherName: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  otherText: { fontFamily: fonts.text, fontSize: 12.5, marginTop: 2 },
});

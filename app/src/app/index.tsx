import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, useColors, type Colors } from '@/theme';
import type { ConnectionStatus } from '@/treadmill/connection';
import { useTreadmill } from '@/treadmill/use-treadmill';

function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function statusColor(status: ConnectionStatus, colors: Colors): string {
  if (status === 'connected') return colors.success;
  if (status === 'bluetoothOff' || status === 'unauthorized' || status === 'unsupported') {
    return colors.accent;
  }
  return colors.textMuted;
}

export default function SessionScreen() {
  useKeepAwake();
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const wide = width > height && width >= 700;
  const { connection, data, session, resetSession } = useTreadmill();

  const number = (value: number, digits: number) =>
    value.toLocaleString(i18n.language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const name = connection.deviceName ?? t('treadmill.unknownName');
  const durationS = data?.elapsedS ?? 0;
  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.content, wide && styles.contentWide]}>
        <View style={styles.main}>
          <View style={styles.statusRow}>
            <View
              style={[styles.dot, { backgroundColor: statusColor(connection.status, colors) }]}
            />
            <Text style={styles.status}>
              {t(`treadmill.status.${connection.status}`, { name })}
            </Text>
          </View>

          <Text style={styles.label}>{t('session.today')}</Text>
          <View style={styles.bigRow}>
            <Text style={styles.big} adjustsFontSizeToFit numberOfLines={1}>
              {number(session.distanceM / 1000, 2)}
            </Text>
            <Text style={styles.bigUnit}>{t('units.km')}</Text>
          </View>
          {!session.active && <Text style={styles.hint}>{t('session.waiting')}</Text>}
        </View>

        <View style={[styles.side, wide && styles.sideWide]}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('session.speed')}</Text>
            <Text style={[styles.cardValue, styles.speed]}>
              {number(data?.speedKmh ?? 0, 1)}
              <Text style={styles.cardUnit}> {t('units.kmh')}</Text>
            </Text>
          </View>
          <View style={styles.grid}>
            <View style={[styles.card, styles.gridCard]}>
              <Text style={styles.cardLabel}>{t('session.incline')}</Text>
              <Text style={styles.cardValue}>
                {number(data?.inclinePct ?? 0, 0)}
                <Text style={styles.cardUnit}> {t('units.percent')}</Text>
              </Text>
            </View>
            <View style={[styles.card, styles.gridCard]}>
              <Text style={styles.cardLabel}>{t('session.duration')}</Text>
              <Text style={styles.cardValue}>{formatDuration(durationS)}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('session.counter')}</Text>
            <Text style={styles.cardValue}>
              {number(data?.distanceM ?? 0, 0)}
              <Text style={styles.cardUnit}> {t('units.m')}</Text>
            </Text>
          </View>
          {session.active && (
            <Pressable
              accessibilityRole="button"
              onPress={resetSession}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.buttonText}>{t('session.newSession')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { flex: 1, padding: 20, gap: 24 },
    contentWide: { flexDirection: 'row', padding: 32, gap: 32 },
    main: { flex: 1, justifyContent: 'center' },
    side: { gap: 12 },
    sideWide: { width: 360, justifyContent: 'center' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    status: { fontFamily: fonts.textMedium, fontSize: 15, color: c.textSecondary },
    label: { fontFamily: fonts.textSemiBold, fontSize: 17, color: c.text },
    bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    big: {
      fontFamily: fonts.display,
      fontSize: 120,
      letterSpacing: -4,
      color: c.text,
      fontVariant: ['tabular-nums'],
      flexShrink: 1,
    },
    bigUnit: { fontFamily: fonts.displayMedium, fontSize: 32, color: c.textSecondary },
    hint: { fontFamily: fonts.text, fontSize: 15, color: c.textSecondary, marginTop: 8 },
    grid: { flexDirection: 'row', gap: 12 },
    gridCard: { flex: 1 },
    card: { backgroundColor: c.card, borderRadius: 20, padding: 16, gap: 4 },
    cardLabel: { fontFamily: fonts.textMedium, fontSize: 14, color: c.textSecondary },
    cardValue: {
      fontFamily: fonts.display,
      fontSize: 32,
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    speed: { color: c.accentText },
    cardUnit: { fontFamily: fonts.displayMedium, fontSize: 16, color: c.textSecondary },
    button: {
      backgroundColor: c.blue,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: { fontFamily: fonts.textSemiBold, fontSize: 17, color: '#FFFFFF' },
  });
}

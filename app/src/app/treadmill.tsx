import { router } from 'expo-router';
import { Bluetooth, Check, Power, RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatSpeed } from '@/i18n/format';
import { useSession } from '@/session/session-context';
import { fonts, useColors, useShadows } from '@/theme';
import { correction, factorFor, saveTreadmill, useSavedTreadmill } from '@/treadmill/calibration';
import { StepProgress, TextField } from '@/ui/controls';
import { useWide } from '@/ui/layout';
import { Button, Card, RoundButton } from '@/ui/primitives';

const STEPS = 5;
/** Speed the walker sets on the console for the check. */
const CHECK_KMH = 4;
const BARS = 32;

/**
 * Adds a treadmill in five steps: switch it on, find its signal, read its
 * data, check the speed against the console (a correction is saved when they
 * differ), give it a name.
 */
export default function TreadmillScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { connection, data } = useSession();
  const saved = useSavedTreadmill();
  const [step, setStep] = useState(1);
  const [factor, setFactor] = useState<number | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [speeds, setSpeeds] = useState<number[]>([]);
  const hardware = connection.hardwareName ?? null;
  const connected = connection.status === 'connected';
  // What the treadmill sends, before any saved correction.
  const rawKmh = data ? data.speedKmh / factorFor(hardware) : 0;

  // A short history of the speed for the signal bars.
  // Each new frame adds a bar (state adjusted while rendering, React's way for this).
  const [seen, setSeen] = useState(data);
  if (data && data !== seen) {
    setSeen(data);
    setSpeeds((list) => [...list.slice(-(BARS - 1)), rawKmh]);
  }

  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const back = () => (step > 1 ? setStep(step - 1) : router.back());
  const disagree = () =>
    Alert.prompt(
      t('treadmillSetup.consoleTitle'),
      t('treadmillSetup.consoleHint'),
      [
        { text: t('journeys.cancel'), style: 'cancel' },
        {
          text: t('account.save'),
          onPress: (text?: string) => {
            const kmh = Number.parseFloat((text ?? '').replace(',', '.'));
            const value = correction(kmh, rawKmh);
            if (value === null) Alert.alert(t('treadmillSetup.odd'));
            else {
              setFactor(value);
              next();
            }
          },
        },
      ],
      'plain-text',
      '',
      'decimal-pad',
    );
  const finish = () => {
    if (!hardware) return;
    saveTreadmill({
      deviceName: hardware,
      label: (label ?? saved?.label ?? hardware).trim() || hardware,
      factor: factor ?? 1,
    });
    router.back();
  };

  const device = (
    <View style={styles.device}>
      <View style={[styles.deviceIcon, { backgroundColor: colors.blueSoft }]}>
        <Bluetooth size={20} color={colors.blueText} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.deviceName, { color: colors.text }]}>
          {hardware ?? t('treadmillSetup.searching')}
        </Text>
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {hardware?.startsWith('FS-') ? t('treadmillSetup.fitshow') : t('treadmillSetup.ftms')}
        </Text>
      </View>
      {data ? (
        <View style={styles.receiving}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={[styles.receivingText, { color: colors.success }]}>
            {t('treadmillSetup.receiving')}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const bars = (
    <View style={styles.bars}>
      {Array.from({ length: BARS }, (_, i) => {
        const v = speeds[speeds.length - BARS + i];
        const level = v === undefined ? 0.15 : Math.min(1, 0.25 + v / 8);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: 34 * level,
                backgroundColor: colors.blue,
                opacity: v === undefined ? 0.25 : 0.4 + level * 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );

  const body = (() => {
    switch (step) {
      case 1:
        return (
          <Card style={[styles.card, styles.center]}>
            <View style={[styles.bigIcon, { backgroundColor: colors.accentSoft }]}>
              <Power size={30} color={colors.accentText} />
            </View>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {t('treadmillSetup.onText')}
            </Text>
          </Card>
        );
      case 2:
        return (
          <Card style={styles.card}>
            {connected ? (
              device
            ) : (
              <View style={[styles.center, { gap: 12 }]}>
                {connection.status === 'bluetoothOff' ||
                connection.status === 'unauthorized' ? null : (
                  <ActivityIndicator color={colors.textMuted} />
                )}
                <Text style={[styles.text, { color: colors.textSecondary }]}>
                  {t(`treadmill.status.${connection.status}`, { name: hardware ?? '' })}
                </Text>
              </View>
            )}
          </Card>
        );
      case 3:
        return (
          <Card style={styles.card}>
            {device}
            {bars}
            <View style={styles.checks}>
              {[
                [!!data, t('treadmillSetup.speedFound')],
                [data?.distanceM !== undefined, t('treadmillSetup.distanceFound')],
                [data?.inclinePct !== undefined, t('treadmillSetup.inclineFound')],
              ].map(([ok, text]) => (
                <View
                  key={String(text)}
                  style={[
                    styles.check,
                    { backgroundColor: ok ? colors.successSoft : colors.inset },
                  ]}
                >
                  {ok ? (
                    <Check size={14} color={colors.success} strokeWidth={2.6} />
                  ) : (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  )}
                  <Text
                    style={[
                      styles.checkText,
                      { color: ok ? colors.success : colors.textSecondary },
                    ]}
                  >
                    {text}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        );
      case 4:
        return (
          <Card style={styles.card}>
            {device}
            {bars}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('treadmillSetup.detected')}
            </Text>
            <Text style={[styles.speed, { color: colors.text }]}>
              {formatSpeed(rawKmh)}
              <Text style={[styles.speedUnit, { color: colors.textSecondary }]}>
                {' '}
                {t('units.kmh')}
              </Text>
            </Text>
          </Card>
        );
      default:
        return (
          <Card style={styles.card}>
            {device}
            <TextField
              label={t('treadmillSetup.nameLabel')}
              value={label ?? saved?.label ?? ''}
              placeholder={t('treadmillSetup.namePlaceholder')}
              onChangeText={setLabel}
              autoFocus
            />
            {factor !== null && factor !== 1 ? (
              <Text style={[styles.small, { color: colors.textSecondary }]}>
                {t('treadmillSetup.corrected', {
                  percent: formatSpeed(Math.abs(factor - 1) * 100),
                })}
              </Text>
            ) : null}
          </Card>
        );
    }
  })();

  const question =
    step === 4 ? (
      <View style={{ gap: 12 }}>
        <Text style={[styles.question, { color: colors.text }]}>
          {t('treadmillSetup.question', { speed: formatSpeed(rawKmh) })}
        </Text>
        <View style={styles.row}>
          <Button
            tone="light"
            title={t('treadmillSetup.no')}
            icon={<RefreshCw size={18} color={colors.text} />}
            onPress={disagree}
            disabled={!data}
            style={styles.flex}
          />
          <Button
            tone="blue"
            title={t('treadmillSetup.yes')}
            icon={<Check size={18} color="#FFFFFF" />}
            onPress={() => {
              setFactor(1);
              next();
            }}
            disabled={!data || rawKmh <= 0}
            style={styles.flexWide}
          />
        </View>
      </View>
    ) : (
      <Button
        tone={step === STEPS ? 'accent' : 'dark'}
        title={step === STEPS ? t('treadmillSetup.done') : t('treadmillSetup.continue')}
        onPress={step === STEPS ? finish : next}
        disabled={
          (step === 2 && !connected) || (step === 3 && !data) || (step === STEPS && !hardware)
        }
      />
    );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.column, wide && styles.columnWide]}>
          <View style={styles.header}>
            <RoundButton
              icon={<X size={20} color={colors.text} />}
              onPress={() => router.back()}
              label={t('common.close')}
            />
            <StepProgress
              step={step}
              total={STEPS}
              label={t('treadmillSetup.progress', { step, total: STEPS })}
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t(`treadmillSetup.steps.${step}.title`, { speed: formatSpeed(CHECK_KMH) })}
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {t(`treadmillSetup.steps.${step}.text`, { speed: formatSpeed(CHECK_KMH) })}
          </Text>
          <View style={wide ? styles.wideBody : styles.phoneBody}>
            <View style={styles.flex}>{body}</View>
            {wide ? (
              <Card style={[styles.card, styles.stepsCard, shadows.card]}>
                {Array.from({ length: STEPS }, (_, i) => i + 1).map((n) => (
                  <View key={n} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor:
                            n < step ? colors.success : n === step ? colors.accent : colors.inset,
                        },
                      ]}
                    >
                      {n < step ? (
                        <Check size={13} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <Text
                          style={[
                            styles.stepNumber,
                            { color: n === step ? colors.onAccent : colors.textSecondary },
                          ]}
                        >
                          {n}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepName,
                        { color: n > step ? colors.textSecondary : colors.text },
                        n === step && { fontFamily: fonts.textSemiBold },
                      ]}
                    >
                      {t(`treadmillSetup.steps.${n}.short`)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </View>
          {question}
          {step > 1 ? (
            <Text onPress={back} style={[styles.back, { color: colors.textSecondary }]}>
              {t('common.back')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  flexWide: { flex: 1.5 },
  content: { paddingHorizontal: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16, flexGrow: 1 },
  columnWide: { maxWidth: 1100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 35, letterSpacing: -1.1 },
  text: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 23 },
  phoneBody: { gap: 16, flexGrow: 1 },
  wideBody: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  card: { padding: 20, gap: 16 },
  center: { alignItems: 'center' },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: { fontFamily: fonts.display, fontSize: 17 },
  small: { fontFamily: fonts.text, fontSize: 13 },
  receiving: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 99 },
  receivingText: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 },
  bar: { width: 4, borderRadius: 2 },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  checkText: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  label: { fontFamily: fonts.textSemiBold, fontSize: 14, textAlign: 'center' },
  speed: {
    fontFamily: fonts.display,
    fontSize: 96,
    lineHeight: 96,
    letterSpacing: -3.4,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  speedUnit: { fontFamily: fonts.textSemiBold, fontSize: 22, letterSpacing: 0 },
  question: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.4 },
  row: { flexDirection: 'row', gap: 12 },
  back: { fontFamily: fonts.textSemiBold, fontSize: 15, textAlign: 'center', paddingVertical: 6 },
  stepsCard: { width: 380 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontFamily: fonts.display, fontSize: 13 },
  stepName: { fontFamily: fonts.text, fontSize: 15 },
});

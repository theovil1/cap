import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useDark } from '@/settings/appearance';
import { fonts, useColors } from '@/theme';
import { Button } from '@/ui/primitives';

import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { CheckLine } from '../parts';

const PICTURE = {
  day: require('../../../assets/images/onboarding/bluetooth-day.jpg'),
  night: require('../../../assets/images/onboarding/bluetooth-night.jpg'),
};

/** Étape 5: why Cap needs Bluetooth, just before iOS asks for it. */
export function BluetoothStep({ nav, allow }: { nav: FrameNav; allow: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dark = useDark();
  return (
    <OnboardingFrame
      {...nav}
      footer={
        <>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {t('onboarding.bluetooth.note')}
          </Text>
          <Button tone="blue" title={t('onboarding.bluetooth.allow')} onPress={allow} />
        </>
      }
    >
      <Headline
        kicker={t('onboarding.bluetooth.kicker')}
        title={t('onboarding.bluetooth.title')}
        text={t('onboarding.bluetooth.text')}
      />
      <View style={[styles.picture, { borderColor: colors.track }]}>
        <Image
          source={dark ? PICTURE.night : PICTURE.day}
          style={styles.image}
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.lines}>
        <CheckLine>{t('onboarding.bluetooth.compatible')}</CheckLine>
        <CheckLine>{t('onboarding.bluetooth.noLocation')}</CheckLine>
        <CheckLine>{t('onboarding.bluetooth.together')}</CheckLine>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  picture: {
    alignSelf: 'center',
    width: 320,
    height: 250,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  lines: { gap: 10 },
  note: { fontFamily: fonts.text, fontSize: 12.5, textAlign: 'center' },
});

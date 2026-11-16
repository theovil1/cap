import { Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useDark } from '@/settings/appearance';
import { fonts, useColors } from '@/theme';
import { Button } from '@/ui/primitives';

import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { CheckLine } from '../parts';

/** Apple's ring colours, with their dim tracks for night and day. */
const RINGS = [
  { r: 70, color: '#FF2D55', night: '#3A0F1C', day: '#FFD6DF', dash: '330 440' },
  { r: 51, color: '#7BEA3E', night: '#123A10', day: '#DDF7CC', dash: '230 320' },
  { r: 32, color: '#2FD3EE', night: '#0B2E36', day: '#D2F4FA', dash: '150 201' },
];

/** Step after the treadmill: sessions saved in Apple Health, heart rate and steps read back. */
export function HealthStep({ nav, allow }: { nav: FrameNav; allow: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dark = useDark();
  return (
    <OnboardingFrame
      {...nav}
      footer={
        <>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {t('onboarding.health.note')}
          </Text>
          <Button
            tone="dark"
            icon={<Heart size={18} color="#FF2D55" fill="#FF2D55" />}
            title={t('onboarding.health.allow')}
            onPress={allow}
          />
        </>
      }
    >
      <Headline
        kicker={t('onboarding.health.kicker')}
        title={t('onboarding.health.title')}
        text={t('onboarding.health.text')}
      />
      <View style={[styles.picture, { borderColor: colors.track }]}>
        <Svg width={320} height={250} viewBox="0 0 320 250">
          <Defs>
            <RadialGradient id="glow" cx="30%" cy="20%" rx="120%" ry="90%">
              <Stop offset="0" stopColor={dark ? '#2E1218' : '#FFE4EA'} />
              <Stop offset="0.7" stopColor={colors.surface} />
            </RadialGradient>
          </Defs>
          <Rect width={320} height={250} fill="url(#glow)" />
          <Circle cx={40} cy={40} r={3} fill={colors.accent} />
          <Circle cx={296} cy={200} r={2.5} fill={colors.blue} />
          <Circle cx={24} cy={180} r={2} fill={colors.gold} />
          {RINGS.map((ring) => (
            <G key={ring.r}>
              <Circle
                cx={112}
                cy={128}
                r={ring.r}
                fill="none"
                stroke={dark ? ring.night : ring.day}
                strokeWidth={16}
              />
              <Circle
                cx={112}
                cy={128}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray={ring.dash}
                transform="rotate(-90 112 128)"
              />
            </G>
          ))}
          <G transform="translate(206 62)">
            <Rect width={88} height={112} rx={22} fill={colors.text} />
            <Rect x={5} y={5} width={78} height={102} rx={18} fill="#16171B" />
            <Path
              d="M44 74c-14-9-22-17-22-27 0-7 5-12 11-12 5 0 8 3 11 7 3-4 6-7 11-7 6 0 11 5 11 12 0 10-8 18-22 27z"
              fill="#FF2D55"
            />
            <SvgText
              x={44}
              y={96}
              textAnchor="middle"
              fontFamily={fonts.display}
              fontSize={14}
              fill="#F3F1EC"
            >
              128
            </SvgText>
          </G>
        </Svg>
      </View>
      <View style={styles.lines}>
        <CheckLine>{t('onboarding.health.workout')}</CheckLine>
        <CheckLine>{t('onboarding.health.watch')}</CheckLine>
        <CheckLine>{t('onboarding.health.private')}</CheckLine>
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
  lines: { gap: 10 },
  note: { fontFamily: fonts.text, fontSize: 12.5, textAlign: 'center' },
});

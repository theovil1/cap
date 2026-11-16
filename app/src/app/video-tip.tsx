import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fonts, useColors } from '@/theme';
import { GlassButton } from '@/ui/primitives';

const STEPS = ['settings', 'arrange', 'video'] as const;

/** iPad: how to put Tapiroute next to a video, a film or a series in another app. */
export default function VideoTipScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('videoTip.title')}
        </Text>
        <GlassButton
          icon={<X size={18} color={colors.text} />}
          onPress={() => router.back()}
          label={t('common.close')}
        />
      </View>
      <Text style={[styles.lead, { color: colors.textSecondary }]}>{t('videoTip.lead')}</Text>
      {STEPS.map((step, i) => (
        <View key={step} style={styles.step}>
          <View style={[styles.number, { backgroundColor: colors.inset }]}>
            <Text style={[styles.numberText, { color: colors.text }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.stepText, { color: colors.text }]}>{t(`videoTip.${step}`)}</Text>
        </View>
      ))}
      <View style={styles.picture} accessibilityElementsHidden>
        <Svg width={300} height={150} viewBox="0 0 300 150">
          <Rect
            x={2}
            y={2}
            width={296}
            height={146}
            rx={16}
            fill={colors.background}
            stroke={colors.border}
            strokeWidth={2}
          />
          <Rect x={12} y={12} width={176} height={126} rx={9} fill={colors.inset} />
          <Path d="M92 60v30l24-15z" fill={colors.textSecondary} />
          <Rect x={196} y={12} width={92} height={126} rx={9} fill={colors.inset} />
          <Path
            d="M216 120 C 230 100, 236 80, 246 60"
            stroke={colors.accent}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={246} cy={60} r={7} fill={colors.accent} stroke="#FFFFFF" strokeWidth={2} />
          <Rect x={200} y={96} width={84} height={38} rx={7} fill={colors.surface} />
        </Svg>
      </View>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('videoTip.narrow')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 28, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  lead: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  stepText: { flex: 1, fontFamily: fonts.text, fontSize: 15.5, lineHeight: 22 },
  picture: { alignItems: 'center', paddingVertical: 8 },
  note: { fontFamily: fonts.text, fontSize: 13, textAlign: 'center' },
});

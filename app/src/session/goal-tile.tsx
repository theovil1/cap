import { Target } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { formatNumber } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { TIGHT_TEXT_SCALE } from '@/tokens';
import { Figure } from '@/ui/primitives';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Wave length and height, in points. */
const WAVE_LENGTH = 70;
const WAVE_HEIGHT = 3.5;

/**
 * The daily step goal as water filling the tile: its level is the share of the
 * goal reached, its wave moves with the walker's cadence and rests when the
 * belt stops (or when iOS reduces motion).
 */
export function GoalTile({
  steps,
  goal,
  stepsPerMinute,
  wide,
  style,
}: {
  steps: number;
  goal: number;
  stepsPerMinute: number;
  wide: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const still = useReducedMotion();
  const ratio = goal > 0 ? steps / goal : 0;

  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const level = useSharedValue(Math.min(1, ratio));
  const cadence = useSharedValue(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    level.value = withTiming(Math.min(1, ratio), { duration: 800 });
  }, [ratio, level]);
  useEffect(() => {
    cadence.value = still ? 0 : stepsPerMinute / 60;
  }, [stepsPerMinute, still, cadence]);

  useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    phase.value += dt * cadence.value * 1.4;
  });

  const wave = useAnimatedProps(() => {
    const w = width.value;
    const h = height.value;
    if (w === 0) return { d: '' };
    const y = h * (1 - level.value);
    const amp = cadence.value > 0 ? WAVE_HEIGHT : 1;
    let d = `M0 ${h}`;
    for (let x = 0; x <= w + 6; x += 6) {
      d += ` L${x} ${y + Math.sin((x / WAVE_LENGTH) * Math.PI * 2 + phase.value) * amp}`;
    }
    return { d: `${d} L${w + 6} ${h} Z` };
  });

  return (
    <View
      style={[styles.tile, { backgroundColor: colors.inset }, style]}
      onLayout={(e) => {
        width.value = e.nativeEvent.layout.width;
        height.value = e.nativeEvent.layout.height;
      }}
      accessible
      accessibilityLabel={`${t('session.goal')}: ${formatNumber(Math.round(ratio * 100))} %, ${t(
        'session.goalSteps',
        { steps: formatNumber(steps), goal: formatNumber(goal) },
      )}`}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="goal-water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.4} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0.2} />
          </LinearGradient>
        </Defs>
        <AnimatedPath animatedProps={wave} fill="url(#goal-water)" />
      </Svg>
      <View style={styles.inline}>
        <Target size={15} color={colors.textSecondary} />
        <Text
          style={[styles.label, wide && styles.labelWide, { color: colors.textSecondary }]}
          maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        >
          {t('session.goal')}
        </Text>
      </View>
      <Figure
        value={formatNumber(Math.min(999, Math.floor(ratio * 100)))}
        unit="%"
        size={wide ? 30 : 24}
        unitSize={wide ? 16 : undefined}
      />
      <View>
        <Text
          style={[styles.sub, { color: colors.textSecondary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        >
          {t('session.goalSteps', { steps: formatNumber(steps), goal: formatNumber(goal) })}
        </Text>
        <Text
          style={[styles.sub, { color: colors.textSecondary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        >
          {t('session.cadence', { count: Math.round(stepsPerMinute) })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.textMedium, fontSize: 13 },
  labelWide: { fontSize: 14 },
  sub: { fontFamily: fonts.textMedium, fontSize: 12, fontVariant: ['tabular-nums'] },
});

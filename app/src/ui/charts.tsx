import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { fonts, useColors } from '@/theme';

/** Daily goal ring (home screen). */
export function Ring({ ratio, size = 66, label }: { ratio: number; size?: number; label: string }) {
  const colors = useColors();
  const stroke = 9;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.inset}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${length * shown} ${length}`}
          fill="none"
        />
      </Svg>
      <View
        style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        pointerEvents="none"
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 15,
            color: colors.text,
            fontVariant: ['tabular-nums'],
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Smoothed area chart of the speed during a session (summary screen). */
export function SpeedChart({
  speeds,
  width,
  height,
}: {
  speeds: number[];
  width: number;
  height: number;
}) {
  const colors = useColors();
  if (speeds.length < 2 || width <= 0) return <View style={{ width, height }} />;
  const max = Math.max(...speeds) * 1.1 || 1;
  const min = Math.max(0, Math.min(...speeds) * 0.8);
  const x = (i: number) => (i / (speeds.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * height;
  let line = `M ${x(0)} ${y(speeds[0])}`;
  for (let i = 1; i < speeds.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    line += ` C ${cx} ${y(speeds[i - 1])}, ${cx} ${y(speeds[i])}, ${x(i)} ${y(speeds[i])}`;
  }
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0.08} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#speedFill)" />
      <Path d={line} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

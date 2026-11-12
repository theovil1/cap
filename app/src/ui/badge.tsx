import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { fonts, useColors } from '@/theme';
import { badges, type BadgeKind } from '@/tokens';

/** The 12 scallop seal of every badge, in a 100 box. */
const SEAL = (() => {
  const points = Array.from({ length: 240 }, (_, i) => {
    const angle = ((-90 + i * 1.5) * Math.PI) / 180;
    const r = 44 + 3.08 * Math.cos(12 * (angle + Math.PI / 2));
    return `${(50 + r * Math.cos(angle)).toFixed(2)},${(50 + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join(' L')} Z`;
})();

/** Pictograms of the badge board, drawn on a 24 grid. */
const PICTOGRAMS: Record<BadgeKind, ReactNode> = {
  team: <Path d="M4 11.5 20 4l-7.5 16-2-6.5Z" />,
  certified: <Path d="m6.5 12.5 3.8 3.8 7.2-8" />,
  developer: <Path d="M8 7 3 12l5 5M16 7l5 5-5 5M13.5 4l-3 16" />,
  github: (
    <>
      <Circle cx={6} cy={5} r={2.2} />
      <Circle cx={6} cy={19} r={2.2} />
      <Circle cx={18} cy={12} r={2.2} />
      <Path d="M6 7.2v9.6M6 7.5c0 3 2.5 4.5 9.8 4.5" />
    </>
  ),
  supporter: <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  founder: <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8Z" />,
  beta: (
    <Path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-10V3M7.5 15h9" />
  ),
  organizer: (
    <>
      <Rect x={4} y={5} width={16} height={15} rx={3} />
      <Path d="M4 10h16M9 3v4M15 3v4m-5.5 7.5 1.8 1.8 3.5-3.6" />
    </>
  ),
  creator: (
    <>
      <Circle cx={6} cy={18} r={2.2} />
      <Circle cx={18} cy={6} r={2.2} />
      <Path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" />
    </>
  ),
  ambassador: (
    <Path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1ZM17 9a4 4 0 0 1 0 6M8 15l1.2 4" />
  ),
  moderator: <Path d="M12 3 5 6v5.5c0 4.4 3 7.8 7 9.5 4-1.7 7-5.1 7-9.5V6Zm-3 9 2.2 2.2L15.5 10" />,
  club: (
    <>
      <Circle cx={9} cy={8} r={3} />
      <Circle cx={16.5} cy={9.5} r={2.4} />
      <Path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M14.5 14.6c2.6-.4 5 1 5.8 4.4" />
    </>
  ),
};

/**
 * Profile badge: role or status (Certifié, Développeur, Soutien...). Readable
 * from 17 to 88 points; under 30 the pictogram grows and the shine goes.
 */
export function Badge({
  kind,
  size = 20,
  label,
}: {
  kind: BadgeKind;
  size?: number;
  label: string;
}) {
  const id = useId().replace(/:/g, '');
  const [from, to] = badges[kind];
  const small = size < 30;
  const box = small ? { at: 24, side: 52, stroke: 2.6 } : { at: 28, side: 44, stroke: 2.3 };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Defs>
        <LinearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <RadialGradient id={`${id}h`} cx="0.3" cy="0.22" r="0.7">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={SEAL} fill={`url(#${id}f)`} />
      {small ? null : (
        <>
          <Path d={SEAL} fill={`url(#${id}h)`} />
          <Circle
            cx={50}
            cy={50}
            r={33}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.35}
            strokeWidth={1.6}
          />
        </>
      )}
      <G
        transform={`translate(${box.at} ${box.at}) scale(${box.side / 24})`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={box.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PICTOGRAMS[kind]}
      </G>
    </Svg>
  );
}

/** Badge and its name on a soft pill, as under a profile name. */
export function BadgeChip({ kind, label }: { kind: BadgeKind; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.chip, { backgroundColor: colors.inset }]}>
      <Badge kind={kind} size={20} label={label} />
      <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 5,
    paddingRight: 11,
    borderRadius: 999,
  },
  chipText: { fontFamily: fonts.textSemiBold, fontSize: 12.5 },
});

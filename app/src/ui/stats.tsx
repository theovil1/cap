import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, useColors } from '@/theme';
import { TIGHT_TEXT_SCALE, radius, type } from '@/tokens';

import { Grain } from './grain';
import { DeltaPill } from './pills';
import { Avatar } from './primitives';

/** Number with a small unit, as in every tile and ranking of the mockups. */
export function Amount({
  value,
  unit,
  size = 20,
  color,
}: {
  value: string;
  unit?: string;
  size?: number;
  color?: string;
}) {
  const colors = useColors();
  return (
    <Text
      maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
      style={[
        styles.amount,
        { fontSize: size, letterSpacing: -size * 0.035, color: color ?? colors.text },
      ]}
      numberOfLines={1}
    >
      {value}
      {unit ? (
        <Text
          maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
          style={[styles.unit, { fontSize: size >= 20 ? 11 : 10, color: colors.textSecondary }]}
        >
          {' '}
          {unit}
        </Text>
      ) : null}
    </Text>
  );
}

/** Label over a figure on an inset tile: Distance 117 km, Série record 64 j. */
export function StatTile({
  label,
  value,
  unit,
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.inset }, style]}>
      <Text
        maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        style={[styles.tileLabel, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Amount value={value} unit={unit} />
    </View>
  );
}

/** Centred figure over a word: the countdown of a scheduled journey. */
export function CountTile({ value, label }: { value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.count, { backgroundColor: colors.inset }]}>
      <Amount value={value} size={30} />
      <Text
        maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        style={[type.caption, { color: colors.textSecondary }]}
      >
        {label}
      </Text>
    </View>
  );
}

export type StackWalker = { id: string; name: string; photo?: string | null };

/** Overlapping avatars with a ring in the colour behind them. */
export function AvatarStack({
  walkers,
  size = 32,
  ring,
}: {
  walkers: StackWalker[];
  size?: number;
  ring?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.stack}>
      {walkers.map((walker, index) => (
        <View key={walker.id} style={index > 0 && { marginLeft: -14 }}>
          <Avatar
            name={walker.name}
            seed={walker.id}
            photo={walker.photo}
            tone="walker"
            size={size + 6}
            ring={ring ?? colors.surface}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * One line of a ranking: rank, avatar, name and detail, value. `me` highlights
 * the walker in soft accent; the first place is gold.
 */
export function RankRow({
  rank,
  name,
  detail,
  detailIcon,
  value,
  unit,
  avatar,
  me,
  first,
  compact,
  onPress,
}: {
  rank: number | string;
  name: string;
  detail?: string;
  /** Before the detail, e.g. a flag. */
  detailIcon?: ReactNode;
  value: string;
  unit?: string;
  avatar: ReactNode;
  me?: boolean;
  /** Draws the separator above (every row but the first of a card). */
  first?: boolean;
  /** Tighter rows of the live sheet. */
  compact?: boolean;
  /** Opens the walker's profile. */
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[
        compact ? styles.rowCompact : styles.row,
        !first && !me && !compact && { borderTopWidth: 1, borderTopColor: colors.border },
        // In a list the highlight runs edge to edge; compact rows stand alone, rounded.
        me && { backgroundColor: colors.accentSoft },
        me && compact && { borderRadius: radius.button },
      ]}
    >
      <Text
        maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        style={[
          styles.rank,
          { width: compact ? 34 : 26 },
          { color: me ? colors.text : rank === 1 ? colors.gold : colors.textSecondary },
        ]}
      >
        {rank}
      </Text>
      {avatar}
      <View style={styles.rowText}>
        <Text
          maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
          style={[compact ? type.callout : styles.name, { color: colors.text }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {detail ? (
          <View style={styles.detailRow}>
            {detailIcon}
            <Text
              maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
              style={[styles.detail, styles.shrink, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {detail}
            </Text>
          </View>
        ) : null}
      </View>
      <Amount value={value} unit={unit} size={compact ? 16 : 17} />
    </Pressable>
  );
}

/** Orange card with my place: "Ta place dans le monde 12 408e". */
export function RankCard({
  label,
  place,
  suffix,
  detail,
  delta,
}: {
  label: string;
  place: string;
  suffix?: string;
  detail: string;
  delta?: string;
}) {
  const colors = useColors();
  const ink = { color: colors.onAccent };
  return (
    <View style={[styles.rankCard, { backgroundColor: colors.accent }]}>
      <Grain on="accent" />
      <View style={styles.rankCardText}>
        <Text maxFontSizeMultiplier={TIGHT_TEXT_SCALE} style={[styles.rankCardLabel, ink]}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={TIGHT_TEXT_SCALE} style={[styles.place, ink]}>
          {place}
          {suffix ? (
            <Text maxFontSizeMultiplier={TIGHT_TEXT_SCALE} style={styles.placeSuffix}>
              {' '}
              {suffix}
            </Text>
          ) : null}
        </Text>
        <Text maxFontSizeMultiplier={TIGHT_TEXT_SCALE} style={[styles.rankCardDetail, ink]}>
          {detail}
        </Text>
      </View>
      {delta ? <DeltaPill label={delta} style={styles.center} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  amount: { fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.textSemiBold, letterSpacing: 0 },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: radius.cta,
  },
  tileLabel: { fontFamily: fonts.textMedium, fontSize: 12 },
  count: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: radius.cta },
  stack: { flexDirection: 'row' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  rowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rank: { fontFamily: fonts.display, fontSize: 15, fontVariant: ['tabular-nums'] },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  detail: { fontFamily: fonts.text, fontSize: 12 },
  rankCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.card,
  },
  rankCardText: { flex: 1, gap: 4 },
  rankCardLabel: { fontFamily: fonts.textSemiBold, fontSize: 13, opacity: 0.8 },
  rankCardDetail: { fontFamily: fonts.textSemiBold, fontSize: 12.5, opacity: 0.8 },
  place: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  placeSuffix: { fontSize: 16 },
  center: { alignSelf: 'center' },
});

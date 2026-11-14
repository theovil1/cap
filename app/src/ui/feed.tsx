import { Heart, MessageCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fonts, useColors } from '@/theme';
import { radius, type } from '@/tokens';

import { Card } from './primitives';

/** A few hearts that fly off when a Bravo is given. */
const BURST = [-60, -25, 15, 50].map((deg, i) => ({ deg, rise: 22 + (i % 2) * 8 }));

function Spark({
  deg,
  rise,
  go,
  color,
}: {
  deg: number;
  rise: number;
  go: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const rad = (deg * Math.PI) / 180;
    return {
      opacity: go.value === 0 ? 0 : 1 - go.value,
      transform: [
        { translateX: Math.sin(rad) * rise * go.value },
        { translateY: -Math.cos(rad) * rise * go.value },
        { scale: 0.5 + go.value * 0.4 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.spark, style]} pointerEvents="none">
      <Heart size={9} color={color} fill={color} strokeWidth={0} />
    </Animated.View>
  );
}

/** Bravo button: the heart fills and pops once given. */
export function BravoButton({
  label,
  given,
  onPress,
}: {
  /** "Bravo · 48". */
  label: string;
  given: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const still = useReducedMotion();
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  const color = given ? colors.accentText : colors.text;
  const press = () => {
    if (!given && !still) {
      scale.value = withSequence(
        withTiming(0.7, { duration: 90 }),
        withSpring(1, { damping: 6, stiffness: 260 }),
      );
      burst.value = 0;
      burst.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityState={{ selected: given }}
      style={[styles.bravo, { backgroundColor: given ? colors.accentSoft : colors.inset }]}
    >
      <View>
        {BURST.map((b) => (
          <Spark key={b.deg} {...b} go={burst} color={colors.accent} />
        ))}
        <Animated.View style={heart}>
          <Heart
            size={17}
            color={given ? colors.accent : color}
            fill={given ? colors.accent : 'none'}
            strokeWidth={2}
          />
        </Animated.View>
      </View>
      <Text style={[type.label, styles.tnum, { color }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Activity of the feed: who, when, their words, what happened (a medal, a
 * stage) and the Bravo and comments line.
 */
export function FeedCard({
  avatar,
  name,
  badge,
  when,
  text,
  addText,
  attachment,
  bravo,
  comments,
  onComments,
}: {
  avatar: ReactNode;
  name: string;
  /** The rarest badge, 17 points, after the name. */
  badge?: ReactNode;
  /** "Il y a 2 h · 4,6 km sur le tapis". */
  when: string;
  text?: string;
  /** Shown instead of the text when there is none, e.g. "Ajouter un mot". */
  addText?: ReactNode;
  attachment?: ReactNode;
  bravo: ReactNode;
  comments?: string;
  onComments?: () => void;
}) {
  const colors = useColors();
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {avatar}
        <View style={styles.who}>
          <View style={styles.name}>
            <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            {badge}
          </View>
          <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
            {when}
          </Text>
        </View>
      </View>
      {text ? <Text style={[styles.text, { color: colors.text }]}>{text}</Text> : addText}
      {attachment}
      <View style={styles.actions}>
        {bravo}
        {comments ? (
          <Pressable
            onPress={onComments}
            accessibilityRole="button"
            style={styles.comments}
            hitSlop={8}
          >
            <MessageCircle size={17} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[type.label, styles.tnum, { color: colors.textSecondary }]}>
              {comments}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

/** Inset block of a feed card: medal or stage icon, title and facts. */
export function FeedAttachment({
  visual,
  title,
  detail,
}: {
  visual: ReactNode;
  title: string;
  detail: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.attachment, { backgroundColor: colors.inset }]}>
      {visual}
      <View style={styles.who}>
        <Text style={[styles.attachmentTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[type.footnote, styles.tnum, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, minWidth: 0, gap: 1 },
  name: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameText: { fontFamily: fonts.textSemiBold, fontSize: 15, flexShrink: 1 },
  text: { fontFamily: fonts.text, fontSize: 14.5, lineHeight: 21 },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.cta,
  },
  attachmentTitle: { fontFamily: fonts.display, fontSize: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  bravo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  spark: { position: 'absolute', left: 4, top: 4 },
  comments: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tnum: { fontVariant: ['tabular-nums'] },
});

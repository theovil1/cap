import { Heart, MessageCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';
import { radius, type } from '@/tokens';

import { Card } from './primitives';

/** Bravo button: soft accent once given. */
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
  const color = given ? colors.accentText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: given }}
      style={[styles.bravo, { backgroundColor: given ? colors.accentSoft : colors.inset }]}
    >
      <Heart size={17} color={color} strokeWidth={2} fill="none" />
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
      {text ? <Text style={[styles.text, { color: colors.text }]}>{text}</Text> : null}
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
  comments: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tnum: { fontVariant: ['tabular-nums'] },
});

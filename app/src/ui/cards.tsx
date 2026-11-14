import { ChevronRight, UsersRound, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useColors, useShadows } from '@/theme';
import { radius, type } from '@/tokens';

import { Grain } from './grain';
import { GlassTag, LivePill } from './pills';
import { AvatarStack, type StackWalker } from './stats';

/** Darkens the bottom of a photo so white text stays readable. */
function Shade({ from = 45 }: { from?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) ${from}%, rgba(20,10,6,0.55) 100%)`,
        },
      ]}
    />
  );
}

/** "117 km · 4 382 marcheurs" line of a route card. */
function RouteFacts({ distance, walkers }: { distance: string; walkers?: string }) {
  const colors = useColors();
  return (
    <View style={styles.facts}>
      <Text style={[styles.distance, { color: colors.text }]}>{distance}</Text>
      {walkers ? (
        <>
          <View style={[styles.bullet, { backgroundColor: colors.textMuted }]} />
          <UsersRound size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[type.footnote, styles.tnum, { color: colors.textSecondary }]}>
            {walkers}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** Big route card with its picture: "Trajet de la semaine" in Explorer. */
export function RouteCard({
  cover,
  tag,
  tagIcon,
  caption,
  captionIcon: CaptionIcon,
  title,
  subtitle,
  distance,
  walkers,
  onPress,
  fill,
  action,
}: {
  /** The picture, filling the 184 high top. */
  cover: ReactNode;
  tag?: string;
  tagIcon?: LucideIcon;
  /** White words at the bottom of the picture: "Arrivée · Tours". */
  caption?: string;
  captionIcon?: LucideIcon;
  title: string;
  subtitle: string;
  distance: string;
  walkers?: string;
  onPress: () => void;
  /** iPad: the card fills its place and the picture takes what the words leave. */
  fill?: boolean;
  /** iPad: a button next to the title ("Démarrer"). */
  action?: ReactNode;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.hero,
        fill && styles.heroFill,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadows.card,
      ]}
    >
      <View style={[styles.heroCover, fill && styles.coverFill]}>
        {cover}
        <Grain on="picture" />
        <Shade />
        {caption ? (
          <View style={[styles.caption, fill && styles.captionFill]}>
            {CaptionIcon ? <CaptionIcon size={14} color="#FFFFFF" strokeWidth={2.2} /> : null}
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        ) : null}
        {tag ? (
          <GlassTag
            label={tag}
            icon={tagIcon}
            style={[styles.heroTag, fill && styles.heroTagFill]}
          />
        ) : null}
      </View>
      <View style={[styles.heroBody, action ? styles.heroBodyAction : null]}>
        <View style={styles.rowBody}>
          <Text
            style={[styles.heroTitle, action ? styles.heroTitleWide : null, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
          <RouteFacts distance={distance} walkers={walkers} />
        </View>
        {action}
      </View>
    </Pressable>
  );
}

/** Route tile with its picture on top: the grid of "Les plus suivis" on iPad. */
export function RouteTile({
  cover,
  title,
  subtitle,
  distance,
  walkers,
  onPress,
  fill,
}: {
  cover: ReactNode;
  title: string;
  subtitle: string;
  distance: string;
  walkers?: string;
  onPress: () => void;
  /** Fills its cell, the picture taking what the words leave (120 at least). */
  fill?: boolean;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.hero,
        styles.tile,
        fill && styles.flex,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadows.card,
      ]}
    >
      <View style={[styles.tileCover, fill && styles.tileCoverFill]}>
        {cover}
        <Grain on="picture" />
      </View>
      <View style={styles.tileBody}>
        <Text style={[styles.rowTitle, styles.tileTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
        <RouteFacts distance={distance} walkers={walkers} />
      </View>
    </Pressable>
  );
}

/** Route line with a square picture: "Les plus suivis". */
export function RouteRow({
  cover,
  title,
  subtitle,
  distance,
  walkers,
  onPress,
}: {
  cover: ReactNode;
  title: string;
  subtitle: string;
  distance: string;
  walkers?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadows.card,
      ]}
    >
      <View style={styles.thumb}>
        {cover}
        <Grain on="picture" />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
        <RouteFacts distance={distance} walkers={walkers} />
      </View>
    </Pressable>
  );
}

/** Scheduled journey to come: date tile, title, facts, who is in. */
export function EventRow({
  day,
  month,
  title,
  subtitle,
  walkers,
  people,
  onPress,
  wide,
}: {
  day: string;
  month: string;
  title: string;
  subtitle: string;
  walkers?: StackWalker[];
  /** "248 inscrits · tu y es". */
  people?: string;
  onPress: () => void;
  /** iPad mockup: 60 by 66 date, 16 pt title, 22 round. */
  wide?: boolean;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.event,
        wide && styles.eventWide,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadows.card,
      ]}
    >
      <View style={[styles.date, wide && styles.dateWide, { backgroundColor: colors.inset }]}>
        <Text style={[styles.day, wide && styles.dayWide, { color: colors.text }]}>{day}</Text>
        <Text style={[type.overline, { color: colors.textSecondary }]}>{month}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.eventTitle, wide && styles.eventTitleWide, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {people ? (
          <View style={styles.people}>
            {walkers?.length ? <AvatarStack walkers={walkers} size={22} /> : null}
            <Text style={[type.footnoteStrong, styles.tnum, { color: colors.textSecondary }]}>
              {people}
            </Text>
          </View>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
    </Pressable>
  );
}

/** Scheduled journey under way: picture with EN DIRECT, title and a Rejoindre button. */
export function LiveEventCard({
  cover,
  live,
  walkers,
  walking,
  title,
  subtitle,
  action,
  onPress,
  fill,
}: {
  cover: ReactNode;
  live: string;
  walkers: StackWalker[];
  /** "1 248 marchent en ce moment". */
  walking: string;
  title: string;
  subtitle: string;
  action: string;
  /** iPad: fills its column, the picture taking what the words leave. */
  fill?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.hero,
        fill && styles.heroFill,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadows.card,
      ]}
    >
      <View style={[styles.heroCover, styles.liveCover, fill && styles.coverFill]}>
        {cover}
        <Grain on="picture" />
        <Shade from={40} />
        <LivePill label={live} style={styles.heroTag} />
        <View style={styles.caption}>
          <AvatarStack walkers={walkers} size={24} ring="#FFFFFF" />
          <Text style={styles.captionText}>{walking}</Text>
        </View>
      </View>
      <View style={[styles.liveBody, fill && styles.liveBodyFill]}>
        <View style={styles.rowBody}>
          <Text
            style={[styles.eventTitleLarge, fill && styles.liveTitleFill, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[type.footnote, styles.tnum, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        <View style={[styles.join, fill && styles.joinFill, { backgroundColor: colors.accent }]}>
          <Text style={[styles.joinText, { color: colors.onAccent }]}>{action}</Text>
          <ChevronRight size={15} color={colors.onAccent} strokeWidth={2.4} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, borderWidth: 1, overflow: 'hidden', borderCurve: 'continuous' },
  heroCover: { height: 184, overflow: 'hidden' },
  // iPad mockup: hero 30 round, tag 16 from the corner, tiles 24 round.
  heroFill: { flex: 1, borderRadius: 30 },
  coverFill: { flex: 1, height: undefined },
  captionFill: { left: 18, bottom: 14 },
  heroTagFill: { left: 16, top: 16, height: 32, paddingHorizontal: 13 },
  tile: { borderRadius: 24 },
  flex: { flex: 1 },
  tileCoverFill: { flex: 1, height: undefined, minHeight: 120 },
  heroBodyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },
  heroTitleWide: { fontSize: 25, lineHeight: 29, letterSpacing: -0.5 },
  tileCover: { height: 150, overflow: 'hidden' },
  tileBody: { gap: 4, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14 },
  liveCover: { height: 150 },
  heroTag: { position: 'absolute', left: 12, top: 12 },
  caption: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  captionText: {
    fontFamily: fonts.textSemiBold,
    fontSize: 12.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  heroBody: { gap: 4, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  heroTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, letterSpacing: -0.4 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  distance: { fontFamily: fonts.display, fontSize: 15, fontVariant: ['tabular-nums'] },
  bullet: { width: 3, height: 3, borderRadius: 9, marginRight: -5 },
  tnum: { fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
  },
  thumb: { width: 92, height: 92, borderRadius: radius.field, overflow: 'hidden' },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 18, letterSpacing: -0.32 },
  tileTitle: { fontSize: 17, lineHeight: 20, letterSpacing: -0.34 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
  },
  date: {
    width: 58,
    height: 64,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: { fontFamily: fonts.display, fontSize: 24, lineHeight: 24 },
  eventTitle: { fontFamily: fonts.textSemiBold, fontSize: 15.5 },
  eventTitleLarge: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.38,
  },
  people: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventWide: { borderRadius: 22 },
  dateWide: { width: 60, height: 66, borderRadius: 16 },
  dayWide: { fontSize: 25, lineHeight: 25 },
  eventTitleWide: { fontSize: 16 },
  liveBodyFill: { gap: 14, paddingTop: 18, paddingHorizontal: 22, paddingBottom: 20 },
  liveTitleFill: { fontSize: 24, lineHeight: 28, letterSpacing: -0.48 },
  joinFill: { height: 46, paddingHorizontal: 20 },
  liveBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  join: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  joinText: { fontFamily: fonts.textBold, fontSize: 14 },
});

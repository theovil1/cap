import type { LucideIcon } from 'lucide-react-native';
import { requireOptionalNativeModule } from 'expo';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, useColors, useShadows } from '@/theme';
import { blur, radius } from '@/tokens';

import { StatusDot } from './controls';
import { Glass } from './primitives';

type PillProps = { label: string; icon?: LucideIcon; style?: StyleProp<ViewStyle> };

/** Soft accent tag: "Trajet de la semaine" on a sheet. */
export function Tag({ label, icon: Icon, style }: PillProps) {
  const colors = useColors();
  return (
    <View style={[styles.pill, styles.tag, { backgroundColor: colors.accentSoft }, style]}>
      {Icon ? <Icon size={13} color={colors.accentText} strokeWidth={2.4} /> : null}
      <Text style={[styles.bold12, { color: colors.accentText }]}>{label}</Text>
    </View>
  );
}

/** Glass tag on a photo card (28). */
export function GlassTag({ label, icon: Icon, style }: PillProps) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Glass style={[styles.pill, styles.glassTag, shadows.floating, style]}>
      {Icon ? <Icon size={13} color={colors.accentText} strokeWidth={2.4} /> : null}
      <Text style={[styles.bold12, { color: colors.text }]}>{label}</Text>
    </Glass>
  );
}

/**
 * expo-blur needs a development build that includes it; older builds keep the
 * plain translucent chip instead of failing.
 */
const BlurView: typeof import('expo-blur').BlurView | null = requireOptionalNativeModule('ExpoBlur')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-blur').BlurView
  : null;

/** Translucent chip over a photo or the map, blurred behind: "Départ · Orléans" (30). */
export function PhotoChip({ label, icon: Icon, style }: PillProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.pill,
        styles.photoChip,
        { backgroundColor: colors.scrim, borderColor: colors.scrimBorder },
        style,
      ]}
    >
      {BlurView ? (
        <BlurView intensity={blur.chip * 2} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      {Icon ? <Icon size={14} color="#FFFFFF" strokeWidth={2.2} /> : null}
      <Text style={[styles.bold125, styles.onPhoto]}>{label}</Text>
    </View>
  );
}

/** Green "EN DIRECT" pill, or a live count in a header (`large`). */
export function LivePill({ label, large, style }: PillProps & { large?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.pill,
        large ? styles.liveLarge : styles.live,
        { backgroundColor: colors.success },
        style,
      ]}
    >
      <View style={styles.liveDot} />
      <Text style={[large ? styles.bold125 : styles.liveText, styles.tnum, { color: '#FFFFFF' }]}>
        {label}
      </Text>
    </View>
  );
}

/** Rank change on an orange card: ▲ 1 830. */
export function DeltaPill({ label, style }: PillProps) {
  const colors = useColors();
  return (
    <View style={[styles.pill, styles.delta, style]}>
      <Text style={[styles.bold125, styles.tnum, { color: colors.onAccent }]}>{label}</Text>
    </View>
  );
}

/** Coloured dot and words: "J2 marche". */
export function StatusLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.status}>
      <StatusDot />
      <Text style={[styles.semi125, { color: colors.success }]}>{label}</Text>
    </View>
  );
}

/** Soft blue pill under a value: "Ta foulée : 73 cm". */
export function InfoPill({ label, icon: Icon }: PillProps) {
  const colors = useColors();
  return (
    <View style={[styles.pill, styles.info, { backgroundColor: colors.blueSoft }]}>
      {Icon ? <Icon size={16} color={colors.blueText} strokeWidth={2} /> : null}
      <Text style={[styles.semi135, styles.tnum, { color: colors.blueText }]}>{label}</Text>
    </View>
  );
}

/** Soft blue box with an icon: "On te prévient la veille…". */
export function InfoBanner({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: colors.blueSoft }]}>
      <Icon size={18} color={colors.blueText} strokeWidth={2} />
      <Text style={[styles.bannerText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
  },
  tag: { height: 26, paddingHorizontal: 10, gap: 6 },
  glassTag: { height: 28, paddingHorizontal: 11, gap: 6 },
  photoChip: { height: 30, paddingHorizontal: 12, gap: 6, borderWidth: 1, overflow: 'hidden' },
  live: { height: 28, paddingHorizontal: 11, gap: 7 },
  liveLarge: { height: 32, paddingHorizontal: 11, gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#FFFFFF' },
  liveText: { fontFamily: fonts.textBold, fontSize: 12, letterSpacing: 0.48 },
  delta: { height: 30, paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.12)' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  info: { paddingVertical: 8, paddingHorizontal: 14, gap: 8, alignSelf: 'center' },
  banner: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bannerText: { flex: 1, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  bold12: { fontFamily: fonts.textBold, fontSize: 12 },
  bold125: { fontFamily: fonts.textBold, fontSize: 12.5 },
  semi125: { fontFamily: fonts.textSemiBold, fontSize: 12.5 },
  semi135: { fontFamily: fonts.textSemiBold, fontSize: 13.5 },
  onPhoto: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  tnum: { fontVariant: ['tabular-nums'] },
});

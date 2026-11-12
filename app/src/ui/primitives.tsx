import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { API_URL } from '@/api/client';
import { fonts, useColors, useShadows } from '@/theme';
import { avatarTones, radius, size as sizes } from '@/tokens';

export function Card({
  children,
  style,
  small,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** List cards (22) rather than the feed and home cards (24). */
  small?: boolean;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        small && { borderRadius: radius.cardSmall },
        shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Glass is kept for the floating bar and the buttons over the map (identity rules). */
export function Glass({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={[styles.glass, style]} glassEffectStyle="regular" isInteractive>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        styles.glass,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Round glass button over the map or a photo (48). */
export function GlassButton({
  icon,
  onPress,
  label,
}: {
  icon: ReactNode;
  onPress: () => void;
  label: string;
}) {
  const shadows = useShadows();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Glass style={[styles.glassButton, shadows.floating]}>{icon}</Glass>
    </Pressable>
  );
}

/** Round surface button of a screen header: +, back, share, notifications (44). */
export function RoundButton({
  icon,
  onPress,
  label,
  plain,
}: {
  icon: ReactNode;
  onPress: () => void;
  label: string;
  /** No background: the back arrow of the onboarding. */
  plain?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.roundButton,
        !plain && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
    </Pressable>
  );
}

/** One big figure with its unit, Space Grotesk with fixed-width digits. */
export function Figure({
  value,
  unit,
  size,
  color,
  style,
}: {
  value: string;
  unit?: string;
  size: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <Text
      style={[
        styles.figure,
        {
          fontSize: size,
          lineHeight: size * 1.02,
          color: color ?? colors.text,
          letterSpacing: -size * 0.035,
        },
        style,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
      {unit ? (
        <Text
          style={{
            fontFamily: fonts.textSemiBold,
            fontSize: Math.max(11, Math.round(size * 0.32)),
            color: color ?? colors.textSecondary,
            letterSpacing: 0,
          }}
        >
          {' '}
          {unit}
        </Text>
      ) : null}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: colors.textSecondary }, style]}>{children}</Text>;
}

type ButtonTone = 'blue' | 'accent' | 'dark' | 'light';
type ButtonSize = 'large' | 'medium' | 'small';

const BUTTON_SIZES = {
  large: { height: sizes.cta, borderRadius: radius.cta, fontSize: 16 },
  medium: { height: sizes.button, borderRadius: radius.button, fontSize: 15 },
  small: { height: sizes.smallButton, borderRadius: radius.small, fontSize: 14 },
};

/**
 * Call to action. `dark` is the inverted one (black by day, light at night),
 * `light` the white one with a border ("Continuer avec un e-mail", "Défier").
 */
export function Button({
  title,
  onPress,
  icon,
  tone = 'blue',
  size = 'large',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const [background, foreground, border] = {
    blue: [colors.blue, '#FFFFFF', colors.blue],
    accent: [colors.accent, colors.onAccent, colors.accent],
    dark: [colors.inverse, colors.onInverse, colors.inverse],
    light: [colors.surface, colors.text, colors.border],
  }[tone];
  const { fontSize, ...box } = BUTTON_SIZES[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        box,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon}
      <Text
        style={[
          styles.buttonText,
          { color: foreground, fontSize, letterSpacing: size === 'large' ? -0.16 : 0 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Progress bar with a dot per stage; passed stages turn dark. */
export function ProgressBar({
  ratio,
  marks = [],
  height = 8,
}: {
  ratio: number;
  marks?: number[];
  height?: number;
}) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, ratio));
  const dot = height - 2;
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: colors.inset }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${clamped * 100}%`,
          minWidth: clamped > 0 ? height : 0,
          borderRadius: 999,
          backgroundColor: colors.accent,
        }}
      />
      {marks.map((mark) => (
        <View
          key={mark}
          style={{
            position: 'absolute',
            left: `${mark * 100}%`,
            marginLeft: -dot / 2,
            top: 1,
            width: dot,
            height: dot,
            borderRadius: 99,
            backgroundColor: mark <= clamped ? colors.onAccent : colors.textMuted,
            opacity: mark <= clamped ? 0.55 : 0.6,
          }}
        />
      ))}
    </View>
  );
}

/** Stable avatar colour for a walker without a photo (blue, green, purple, pink, gold, ochre). */
export function avatarTone(seed: string): { background: string; foreground: string } {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const background = avatarTones[Math.abs(hash) % avatarTones.length];
  return { background, foreground: background === '#E8A317' ? '#2A1A00' : '#FFFFFF' };
}

export function Avatar({
  name,
  size = 44,
  tone = 'accent',
  seed,
  photo,
  ring,
}: {
  name: string;
  size?: number;
  /** `avatar_url` from the API: the photo replaces the initial. */
  photo?: string | null;
  /**
   * `accent` for me, `walker` for everyone else (a colour from `seed`),
   * `blue` and `plain` for the older screens.
   */
  tone?: 'accent' | 'blue' | 'plain' | 'walker';
  /** Usually the user id, so a walker keeps the same colour everywhere. */
  seed?: string;
  /** Colour of the 3 point ring that separates stacked avatars. */
  ring?: string;
}) {
  const colors = useColors();
  const walker = avatarTone(seed ?? name);
  const [background, foreground] = {
    accent: [colors.accent, colors.onAccent],
    blue: [colors.blue, '#FFFFFF'],
    plain: [colors.inset, colors.text],
    walker: [walker.background, walker.foreground],
  }[tone];
  const box = {
    width: size,
    height: size,
    borderRadius: 999,
    backgroundColor: background,
    ...(ring ? { borderWidth: 3, borderColor: ring } : {}),
  };
  if (photo) {
    return (
      <Image
        source={{ uri: /^(https?|file):/.test(photo) ? photo : `${API_URL}${photo}` }}
        style={box}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[box, styles.center]}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: Math.round((ring ? size - 6 : size) * 0.39),
          color: foreground,
        }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, borderCurve: 'continuous' },
  glass: { borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  glassButton: {
    width: sizes.roundButton,
    height: sizes.roundButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButton: {
    width: sizes.button,
    height: sizes.button,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  figure: { fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  label: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  buttonText: { fontFamily: fonts.textSemiBold },
});

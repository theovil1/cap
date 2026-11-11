import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
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

import { fonts, useColors } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.dark ? '#000' : '#15161A',
          shadowOpacity: colors.dark ? 0 : 0.06,
        },
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

export function GlassButton({
  icon,
  onPress,
  label,
}: {
  icon: ReactNode;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Glass style={styles.glassButton}>{icon}</Glass>
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
            fontSize: Math.max(12, size * 0.32),
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

type ButtonTone = 'blue' | 'accent' | 'dark';

export function Button({
  title,
  onPress,
  icon,
  tone = 'blue',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: ReactNode;
  tone?: ButtonTone;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const background = { blue: colors.blue, accent: colors.accent, dark: colors.text }[tone];
  const foreground = { blue: '#FFFFFF', accent: colors.onAccent, dark: colors.background }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon}
      <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
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

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.39, color: colors.onAccent }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    borderCurve: 'continuous',
  },
  glass: { borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  glassButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  figure: { fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  label: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  button: {
    height: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderCurve: 'continuous',
  },
  buttonText: { fontFamily: fonts.textSemiBold, fontSize: 16.5 },
});

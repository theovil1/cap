import { Minus, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated';

import { fonts, useColors, useShadows } from '@/theme';
import { radius, size, type } from '@/tokens';

import { Figure } from './primitives';

/** Two big tabs of a screen: Trajets / Planifiés, Fil / Classements, Tout le monde / Mes amis. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  height,
}: {
  options: { value: T; label: string; dot?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  /** iPad Explorer: 50, as high as the search bar next to it. */
  height?: number;
}) {
  const colors = useColors();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              styles.tab,
              height ? { height, borderRadius: 16 } : null,
              on
                ? { backgroundColor: colors.inverse, borderColor: colors.inverse }
                : { backgroundColor: colors.surface, borderColor: colors.track },
            ]}
          >
            <Text style={[styles.tabText, { color: on ? colors.onInverse : colors.text }]}>
              {option.label}
            </Text>
            {option.dot ? <StatusDot /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Green dot with a soft halo: something is live. */
export function StatusDot({ color, halo }: { color?: string; halo?: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: color ?? colors.success, borderColor: halo ?? colors.successSoft },
      ]}
    />
  );
}

/** Filter chip; black when on. */
export function Chip({
  label,
  on,
  onPress,
  small,
  disabled,
  icon,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
  /** Not available yet: dimmed, no touch. */
  disabled?: boolean;
  /** 32 high, for a second row of filters. */
  small?: boolean;
  /** Before the label, e.g. a flag. */
  icon?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      style={[
        styles.chip,
        disabled && styles.disabled,
        { height: small ? 32 : size.chip },
        on
          ? { backgroundColor: colors.inverse, borderColor: colors.inverse }
          : { backgroundColor: colors.surface, borderColor: colors.track },
      ]}
    >
      {icon}
      {/* Long names (countries) end with "…" instead of leaving the screen. */}
      <Text
        style={[type.label, styles.chipLabel, { color: on ? colors.onInverse : colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Row of chips that scrolls under the screen margins. */
export function ChipRow({ children, gutter = 19 }: { children: ReactNode; gutter?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -gutter, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}
    >
      {children}
    </ScrollView>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onFilters,
  filtersLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onFilters?: () => void;
  filtersLabel?: string;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <View
      style={[
        styles.search,
        {
          backgroundColor: colors.dark ? colors.inset : colors.surface,
          borderColor: colors.track,
        },
        shadows.field,
      ]}
    >
      <Search size={19} color={colors.text} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[styles.searchInput, { color: colors.text }]}
      />
      {onFilters ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.track }]} />
          <Pressable
            onPress={onFilters}
            accessibilityRole="button"
            accessibilityLabel={filtersLabel}
            hitSlop={10}
          >
            <SlidersHorizontal size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** Text field with its label above (Publier, onboarding). */
export function TextField({ label, multiline, ...input }: TextInputProps & { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <TextInput
        {...input}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          multiline ? styles.textArea : styles.input,
          { backgroundColor: colors.surface, borderColor: colors.track, color: colors.text },
        ]}
      />
    </View>
  );
}

/**
 * On/off switch drawn by the app: the iOS 26 native switch no longer fits the
 * frame React Native gives it, and sat off-centre in rows.
 */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const colors = useColors();
  const still = useReducedMotion();
  const on = useDerivedValue(() =>
    still ? (value ? 1 : 0) : withSpring(value ? 1 : 0, { damping: 18, stiffness: 260 }),
  );
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.track, colors.success]),
  }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * 20 }] }));
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Animated.View style={[styles.switchTrack, track]}>
        <Animated.View style={[styles.switchThumb, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

/** Big − value + picker (height, goal). */
export function Stepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  /** Under the value, usually a soft pill (Ta foulée : 73 cm). */
  children?: ReactNode;
}) {
  const colors = useColors();
  const step = (icon: ReactNode, onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.stepperRow}>
        {step(<Minus size={20} color={colors.text} strokeWidth={2} />, onMinus, minusLabel)}
        <Figure value={value} unit={unit} size={64} style={styles.stepperValue} />
        {step(<Plus size={20} color={colors.text} strokeWidth={2} />, onPlus, plusLabel)}
      </View>
      {children}
    </View>
  );
}

/** Onboarding progress: "Étape 2 sur 7" over one segment per step. */
export function StepProgress({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Text style={[type.footnoteStrong, styles.tnum, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: index < step ? colors.accent : colors.trackIdle },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** Section title with an optional "Tout voir" link. */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="link" hitSlop={8}>
          <Text style={[type.label, { color: colors.blueText }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchTrack: { width: 51, height: 31, borderRadius: 99, padding: 2 },
  switchThumb: {
    width: 27,
    height: 27,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  chipLabel: { flexShrink: 1 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    height: size.smallButton,
    paddingHorizontal: 14,
    borderRadius: radius.small,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabText: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  dot: { width: 13, height: 13, borderRadius: 99, borderWidth: 3 },
  chip: {
    flexDirection: 'row',
    gap: 7,
    maxWidth: 260,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: size.searchBar,
    paddingHorizontal: 16,
    borderRadius: radius.field,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: fonts.text, fontSize: 15.5, height: '100%' },
  divider: { width: 1, height: 22 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    borderWidth: 1,
    fontFamily: fonts.textSemiBold,
    fontSize: 15.5,
  },
  textArea: {
    height: 92,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.field,
    borderWidth: 1,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  stepper: { alignItems: 'center', gap: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  stepperValue: { lineHeight: 64, minWidth: 120, textAlign: 'center' },
  stepButton: {
    width: size.button,
    height: size.button,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1, gap: 7 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 99 },
  tnum: { fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.45 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.38 },
});

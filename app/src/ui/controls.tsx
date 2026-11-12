import { Minus, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { fonts, useColors, useShadows } from '@/theme';
import { radius, size, type } from '@/tokens';

import { Figure } from './primitives';

/** Two big tabs of a screen: Trajets / Planifiés, Fil / Classements, Tout le monde / Mes amis. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; dot?: boolean }[];
  value: T;
  onChange: (value: T) => void;
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
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
  /** 32 high, for a second row of filters. */
  small?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={[
        styles.chip,
        { height: small ? 32 : size.chip },
        on
          ? { backgroundColor: colors.inverse, borderColor: colors.inverse }
          : { backgroundColor: colors.surface, borderColor: colors.track },
      ]}
    >
      <Text style={[type.label, { color: on ? colors.onInverse : colors.text }]}>{label}</Text>
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
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      trackColor={{ true: colors.success, false: colors.track }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.track}
    />
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
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.38 },
});

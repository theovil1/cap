import { Check, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';

/** A choice of the onboarding (destination, goal): orange and ticked when picked. */
export function ChoiceCard({
  on,
  onPress,
  icon: Icon,
  children,
  label,
}: {
  on: boolean;
  onPress: () => void;
  /** Square icon on the left (destinations). */
  icon?: LucideIcon;
  children: ReactNode;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        on
          ? { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentSoft }
          : {
              borderWidth: 1,
              margin: 1,
              borderColor: colors.track,
              backgroundColor: colors.surface,
            },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {Icon ? (
        <View style={[styles.square, { backgroundColor: on ? colors.accent : colors.inset }]}>
          <Icon size={20} color={on ? colors.onAccent : colors.textSecondary} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.flex}>{children}</View>
      {on ? <Check size={20} color={colors.accentText} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

/** Title and line of a choice: "Paris", "201 km · ≈ 45 séances". */
export function ChoiceText({ title, detail }: { title: string; detail: string }) {
  const colors = useColors();
  return (
    <View style={styles.texts}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
        {detail}
      </Text>
    </View>
  );
}

/** Small label over a group: "Couleur de l'app", "Séances par semaine". */
export function GroupLabel({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.group, { color: colors.textSecondary }]}>{children}</Text>;
}

/** Green tick and a line (Bluetooth promises). */
export function CheckLine({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.checkLine}>
      <View style={[styles.checkBox, { backgroundColor: colors.successSoft }]}>
        <Check size={17} color={colors.success} strokeWidth={2.6} />
      </View>
      <Text style={[styles.checkText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

/** A line of the "Tout est prêt" summary. */
export function SummaryRow({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: 'accent' | 'blue' | 'green' | 'plain';
  label: string;
  value: string;
}) {
  const colors = useColors();
  const [background, foreground] = {
    accent: [colors.accentSoft, colors.accentText],
    blue: [colors.blueSoft, colors.blueText],
    green: [colors.successSoft, colors.success],
    plain: [colors.inset, colors.text],
  }[tone];
  return (
    <View style={[styles.summary, { borderTopColor: colors.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: background }]}>
        <Icon size={18} color={foreground} strokeWidth={2} />
      </View>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  square: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: 2 },
  title: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  detail: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  group: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { flex: 1, fontFamily: fonts.text, fontSize: 14.5, lineHeight: 20 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { flex: 1, fontFamily: fonts.text, fontSize: 14.5 },
  summaryValue: {
    fontFamily: fonts.textSemiBold,
    fontSize: 14.5,
    fontVariant: ['tabular-nums'],
    maxWidth: '60%',
  },
});

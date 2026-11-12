import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useColors, useShadows } from '@/theme';

/** Segmented control, as in the mockups (sessions per week, map mood...). */
export function Segment<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  const shadows = useShadows();
  return (
    <View
      style={[styles.segment, { backgroundColor: colors.inset }]}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[
              styles.segmentItem,
              on && { backgroundColor: colors.segmentThumb, ...shadows.card },
            ]}
          >
            <Text style={[styles.segmentText, { color: on ? colors.text : colors.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: 16, gap: 4 },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: fonts.textSemiBold, fontSize: 14 },
});

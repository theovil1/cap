import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme';

/** iPad in landscape (or any large screen): two columns and the nav bar on top. */
export function useWide(): boolean {
  const { width, height } = useWindowDimensions();
  return width >= 700 && width > height;
}

/** Room left for the floating nav bar. */
export function useNavSpace(): { top: number; bottom: number } {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  return wide
    ? { top: insets.top + 80, bottom: insets.bottom + 24 }
    : { top: insets.top + 12, bottom: insets.bottom + 110 };
}

/** Scrollable tab screen, centred and limited in width on iPad. */
export function TabScreen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const space = useNavSpace();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: space.top, paddingBottom: space.bottom },
      ]}
    >
      <View style={[styles.column, style]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
});

import type { ReactNode } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useColors } from '@/theme';

import { Grain } from './grain';

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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: space.top, paddingBottom: space.bottom },
        ]}
      >
        <View style={[styles.column, style]}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 19 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
});

/** Large title of a tab screen with its round buttons on the right. */
export function ScreenHeader({ title, children }: { title: string; children?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={headerStyles.header}>
      <Text
        style={[headerStyles.title, { color: colors.text }]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children ? <View style={headerStyles.actions}>{children}</View> : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 31, lineHeight: 34, letterSpacing: -0.93 },
  actions: { flexDirection: 'row', gap: 10 },
});

/** What a list shows while it has nothing yet: an icon, a title, one line. */
export function EmptyState({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[emptyStyles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[emptyStyles.icon, { backgroundColor: colors.accentSoft }]}>{icon}</View>
      <Text style={[emptyStyles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[emptyStyles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  box: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 24, borderWidth: 1 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.38, textAlign: 'center' },
  text: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

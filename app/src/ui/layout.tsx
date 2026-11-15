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
import { TIGHT_TEXT_SCALE } from '@/tokens';

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
  // iPad (mockups): the screen title sits on the row of the nav bar.
  return wide
    ? { top: insets.top + 2, bottom: insets.bottom + 32 }
    : { top: insets.top + 12, bottom: insets.bottom + 110 };
}

/** Scrollable tab screen; on iPad the whole width, 32 from the edges, as in the mockups. */
export function TabScreen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const space = useNavSpace();
  const wide = useWide();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          wide ? styles.contentWide : styles.content,
          { paddingTop: space.top, paddingBottom: space.bottom },
        ]}
      >
        <View style={[wide ? styles.columnWide : styles.column, style]}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 19 },
  contentWide: { paddingHorizontal: 32, flexGrow: 1 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
  columnWide: { flexGrow: 1, gap: 20 },
});

/** Large title of a tab screen with its round buttons on the right. */
export function ScreenHeader({
  title,
  kicker,
  children,
}: {
  title: string;
  /** Small line above the title: "Mercredi 11 novembre". */
  kicker?: string;
  children?: ReactNode;
}) {
  const colors = useColors();
  const wide = useWide();
  return (
    <View style={[headerStyles.header, wide && headerStyles.headerWide]}>
      <View style={headerStyles.titles}>
        {kicker ? (
          <Text style={[headerStyles.kicker, { color: colors.textSecondary }]}>{kicker}</Text>
        ) : null}
        <Text
          style={[headerStyles.title, wide && headerStyles.titleWide, { color: colors.text }]}
          numberOfLines={1}
          accessibilityRole="header"
          maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
        >
          {title}
        </Text>
      </View>
      {children ? <View style={headerStyles.actions}>{children}</View> : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  // iPad mockups: a 54 high row, 30 pt title, on the line of the nav bar.
  headerWide: { height: 54, marginBottom: 0 },
  titles: { flex: 1, gap: 2 },
  kicker: { fontFamily: fonts.text, fontSize: 14 },
  title: { fontFamily: fonts.display, fontSize: 31, lineHeight: 34, letterSpacing: -0.93 },
  titleWide: { fontSize: 30, lineHeight: 34, letterSpacing: -0.9 },
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

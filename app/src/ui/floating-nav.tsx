import type { BottomTabBarProps } from 'expo-router/tabs';
import {
  Compass,
  House,
  Route,
  Trophy,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useColors } from '@/theme';

import { Glass } from './primitives';
import { useWide } from './layout';

const ICONS: Record<string, LucideIcon> = {
  index: House,
  journeys: Route,
  rankings: Trophy,
  explore: Compass,
  community: UsersRound,
  profile: UserRound,
};

/** Floating glass bar: bottom on iPhone, top on iPad (specification decisions). */
export function FloatingNav({ state, navigateToTab }: BottomTabBarProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        wide
          ? { top: insets.top + 10, alignItems: 'center' }
          : { bottom: Math.max(insets.bottom - 8, 12) },
      ]}
    >
      <Glass style={[styles.bar, { shadowColor: colors.shadow }, wide && styles.barWide]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? House;
          const color = focused ? colors.text : colors.textSecondary;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
              style={[
                styles.tab,
                wide && styles.tabWide,
                focused && {
                  backgroundColor: colors.dark ? colors.inset : 'rgba(21,22,26,0.06)',
                },
              ]}
            >
              <Icon
                size={wide ? 18 : 22}
                color={focused ? colors.accent : color}
                strokeWidth={focused ? 2 : 1.7}
              />
              <Text
                style={[
                  styles.label,
                  { color, fontFamily: focused ? fonts.textSemiBold : fonts.textMedium },
                  wide && styles.labelWide,
                ]}
              >
                {t(`nav.${route.name}`)}
              </Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 20, right: 20 },
  bar: {
    flexDirection: 'row',
    gap: 2,
    padding: 5,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
  },
  barWide: { alignSelf: 'center' },
  tab: {
    flex: 1,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabWide: { flex: 0, height: 44, paddingHorizontal: 18, flexDirection: 'row', gap: 8 },
  label: { fontSize: 10.5 },
  labelWide: { fontSize: 14 },
});

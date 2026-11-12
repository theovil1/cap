import {
  Bluetooth,
  Check,
  Flame,
  Footprints,
  Loader,
  Route as RouteIcon,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDark } from '@/settings/appearance';
import { fonts, useColors, useShadows } from '@/theme';
import { Grain } from '@/ui/grain';
import { Glass } from '@/ui/primitives';

import { CapLogo } from './logo';

const MAP = {
  day: require('../../assets/images/onboarding/side-day.jpg'),
  night: require('../../assets/images/onboarding/side-night.jpg'),
};

export type SideKey = 'destination' | 'profile' | 'goal' | 'mood' | 'bluetooth' | 'treadmill';

/** One line of "Ton départ": done with its choice, under way, or still to come. */
export type SideRow = { key: SideKey; state: 'done' | 'current' | 'todo'; value?: string };

const ICONS: Record<SideKey, LucideIcon> = {
  destination: RouteIcon,
  profile: User,
  goal: Flame,
  mood: Loader,
  bluetooth: Bluetooth,
  treadmill: Footprints,
};

/** iPad: the isometric map with Cap's pill and the checklist of the onboarding. */
export function SidePanel({ rows }: { rows: SideRow[] }) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const dark = useDark();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.panel, { width: Math.round(width * 0.469) }]}>
      <Image
        source={dark ? MAP.night : MAP.day}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <Grain on="picture" />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundImage: `linear-gradient(90deg, ${colors.background}00 60%, ${colors.background} 100%)`,
          },
        ]}
      />
      <Glass style={[styles.brand, { top: insets.top + 28 }, shadows.floating]}>
        <CapLogo size={32} />
        <Text style={[styles.brandText, { color: colors.text }]}>Cap</Text>
      </Glass>
      <Glass style={[styles.card, { bottom: insets.bottom + 28 }, shadows.floating]}>
        <Text style={[styles.overline, { color: colors.textSecondary }]}>
          {t('onboarding.side.title')}
        </Text>
        {rows.map(({ key, state, value }) => {
          const Icon = state === 'done' ? Check : ICONS[key];
          const [background, foreground] = {
            done: [colors.successSoft, colors.success],
            current: [colors.accent, colors.onAccent],
            todo: [colors.inset, colors.textSecondary],
          }[state];
          return (
            <View key={key} style={[styles.line, state === 'todo' && styles.todo]}>
              <View style={[styles.icon, { backgroundColor: background }]}>
                <Icon size={17} color={foreground} strokeWidth={2.2} />
              </View>
              <Text
                style={[
                  styles.label,
                  state === 'current' && styles.labelCurrent,
                  { color: colors.text },
                ]}
              >
                {t(`onboarding.side.${key}`)}
              </Text>
              <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>
                {state === 'current' ? t('onboarding.side.current') : (value ?? '')}
              </Text>
            </View>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { overflow: 'hidden' },
  brand: {
    position: 'absolute',
    left: 28,
    height: 46,
    paddingLeft: 8,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: { fontFamily: fonts.display, fontSize: 18 },
  card: {
    position: 'absolute',
    left: 28,
    width: 320,
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 26,
  },
  overline: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    letterSpacing: 0.52,
    textTransform: 'uppercase',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  todo: { opacity: 0.5 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: fonts.textMedium, fontSize: 14 },
  labelCurrent: { fontFamily: fonts.textSemiBold },
  value: { fontFamily: fonts.text, fontSize: 13, maxWidth: 150 },
});

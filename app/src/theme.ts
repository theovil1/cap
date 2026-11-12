import { useColorScheme } from 'react-native';

import { useAppearance, type AppColor } from '@/settings/appearance';

/** Colours from the validated mockups (docs/sources, not versioned). */
const palette = {
  light: {
    dark: false,
    background: '#F4F2EE',
    surface: '#FFFFFF',
    border: 'rgba(21,22,26,0.08)',
    /** Tiles inside a card and progress tracks. */
    inset: '#F3F1EC',
    track: '#E8E4DC',
    glass: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.75)',
    text: '#15161A',
    textSecondary: '#5C5E67',
    textMuted: '#8B8D96',
    accent: '#FF5A1F',
    onAccent: '#1A0E08',
    accentText: '#C2410C',
    blue: '#2952FF',
    blueText: '#2547E8',
    blueSoft: '#E6EBFF',
    success: '#16894A',
    successSoft: '#E1F4E8',
    danger: '#C8251D',
    shadow: 'rgba(21,22,26,0.10)',
  },
  dark: {
    dark: true,
    background: '#0B0C0F',
    surface: '#16171B',
    border: 'rgba(255,255,255,0.07)',
    inset: '#1F2025',
    track: '#2A2C33',
    glass: 'rgba(30,31,37,0.62)',
    glassBorder: 'rgba(255,255,255,0.10)',
    text: '#F3F1EC',
    textSecondary: '#A2A4AD',
    textMuted: '#777A84',
    accent: '#FF7440',
    onAccent: '#1A0E08',
    accentText: '#FF9466',
    blue: '#4C68FF',
    blueText: '#93A6FF',
    blueSoft: '#1D2440',
    success: '#3DCB7D',
    successSoft: '#12291B',
    danger: '#FF6B61',
    shadow: 'rgba(0,0,0,0.45)',
  },
};

export type Colors = typeof palette.light;

type Accent = Pick<Colors, 'accent' | 'onAccent' | 'accentText'>;

/** The five app colours of the profile (orange is Cap's own), light then dark. */
export const ACCENTS: Record<AppColor, { light: Accent; dark: Accent }> = {
  orange: {
    light: { accent: '#FF5A1F', onAccent: '#1A0E08', accentText: '#C2410C' },
    dark: { accent: '#FF7440', onAccent: '#1A0E08', accentText: '#FF9466' },
  },
  blue: {
    light: { accent: '#2952FF', onAccent: '#FFFFFF', accentText: '#2547E8' },
    dark: { accent: '#4C68FF', onAccent: '#FFFFFF', accentText: '#93A6FF' },
  },
  green: {
    light: { accent: '#16894A', onAccent: '#FFFFFF', accentText: '#12703C' },
    dark: { accent: '#3DCB7D', onAccent: '#06170D', accentText: '#6EE7A0' },
  },
  purple: {
    light: { accent: '#8B5CF6', onAccent: '#FFFFFF', accentText: '#6D3FD6' },
    dark: { accent: '#A78BFA', onAccent: '#140A2B', accentText: '#C4B5FD' },
  },
  pink: {
    light: { accent: '#E8447A', onAccent: '#FFFFFF', accentText: '#C2265C' },
    dark: { accent: '#FF6B9A', onAccent: '#2B0612', accentText: '#FF9EBE' },
  },
};

const themes = Object.fromEntries(
  Object.entries(ACCENTS).map(([name, accent]) => [
    name,
    { light: { ...palette.light, ...accent.light }, dark: { ...palette.dark, ...accent.dark } },
  ]),
) as Record<AppColor, { light: Colors; dark: Colors }>;

export function useColors(): Colors {
  const { appColor } = useAppearance();
  const theme = themes[appColor] ?? themes.orange;
  return useColorScheme() === 'dark' ? theme.dark : theme.light;
}

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  text: 'Inter_400Regular',
  textMedium: 'Inter_500Medium',
  textSemiBold: 'Inter_600SemiBold',
};

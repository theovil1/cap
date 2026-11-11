import { useColorScheme } from 'react-native';

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

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  text: 'Inter_400Regular',
  textMedium: 'Inter_500Medium',
  textSemiBold: 'Inter_600SemiBold',
};

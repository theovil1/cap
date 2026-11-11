import { useColorScheme } from 'react-native';

/** Colours from the validated mockups (docs/sources, not versioned). */
const palette = {
  light: {
    background: '#F4F2EE',
    surface: '#FFFFFF',
    card: '#ECE8E1',
    text: '#15161A',
    textSecondary: '#5C5E67',
    textMuted: '#8B8D96',
    accent: '#FF5A1F',
    accentText: '#C2410C',
    blue: '#2952FF',
    success: '#16A34A',
  },
  dark: {
    background: '#0B0C0F',
    surface: '#1C1D24',
    card: '#23252E',
    text: '#F3F1EC',
    textSecondary: '#A2A4AD',
    textMuted: '#8B8D96',
    accent: '#FF7440',
    accentText: '#FF7440',
    blue: '#5B7BFF',
    success: '#4ADE80',
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

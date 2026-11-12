import { useAppearance, useDark, type AppColor } from '@/settings/appearance';
import { palette, shadow } from '@/tokens';

export { fonts } from '@/tokens';

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

/** `color` laid over `base` at `amount` (0 to 1), as a hex colour. */
export function mix(color: string, base: string, amount: number): string {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(base, i) + (channel(color, i) - channel(base, i)) * amount))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/**
 * Soft accent (Bravo given, my row): the mockups give it for orange only,
 * the others are the accent over white (11 %) or the night background (14 %).
 */
function softAccent(name: string, accent: string, dark: boolean): string {
  if (name === 'orange') return dark ? palette.dark.accentSoft : palette.light.accentSoft;
  return dark ? mix(accent, palette.dark.background, 0.14) : mix(accent, '#FFFFFF', 0.11);
}

const themes = Object.fromEntries(
  Object.entries(ACCENTS).map(([name, accent]) => [
    name,
    {
      light: {
        ...palette.light,
        ...accent.light,
        accentSoft: softAccent(name, accent.light.accent, false),
      },
      dark: {
        ...palette.dark,
        ...accent.dark,
        accentSoft: softAccent(name, accent.dark.accent, true),
      },
    },
  ]),
) as Record<AppColor, { light: Colors; dark: Colors }>;

export function useColors(): Colors {
  const { appColor } = useAppearance();
  const theme = themes[appColor] ?? themes.orange;
  return useDark() ? theme.dark : theme.light;
}

/** Card, floating and sheet shadows for the current mode (none on night cards). */
export function useShadows() {
  return useDark() ? shadow.dark : shadow.light;
}

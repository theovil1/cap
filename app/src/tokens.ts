/**
 * Design tokens taken from the mockups (docs/design/maquettes/sources, not versioned).
 * Values are the exact ones of the HTML sources; `theme.ts` builds the colours hook on them.
 */

/** Surface and text colours, light (day map) then dark (night map). */
export const palette = {
  light: {
    dark: false,
    background: '#F4F2EE',
    surface: '#FFFFFF',
    border: 'rgba(21,22,26,0.08)',
    /** Tiles inside a card (stats, countdown, form fields on a card). */
    inset: '#F3F1EC',
    /** Progress tracks, field borders and dashed outlines. */
    track: '#E8E4DC',
    /** Idle segments of the onboarding progress. */
    trackIdle: '#CFC8BC',
    /** Floating glass: tab bar, buttons over the map. */
    glass: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.75)',
    /** Chips over a photo or the map (blur 14). */
    scrim: 'rgba(255,255,255,0.18)',
    scrimBorder: 'rgba(255,255,255,0.32)',
    text: '#15161A',
    textSecondary: '#5C5E67',
    textMuted: '#8B8D96',
    /** Strong inverted fill: active segment, dark buttons, active filter chip. */
    inverse: '#15161A',
    onInverse: '#F4F2EE',
    /** Thumb of a segmented control. */
    segmentThumb: '#FFFFFF',
    accent: '#FF5A1F',
    onAccent: '#1A0E08',
    accentText: '#C2410C',
    /** Soft accent fill: "Trajet de la semaine", Bravo given, my row in a ranking. */
    accentSoft: '#FFEDE4',
    blue: '#2952FF',
    blueText: '#2547E8',
    blueSoft: '#E8ECFF',
    success: '#16894A',
    successSoft: '#E1F4E8',
    /** First place and gold avatar tone. */
    gold: '#E8A317',
    onGold: '#2A1A00',
    danger: '#C8281C',
    /** Pulsing "live" dot. */
    live: '#7CF0A9',
    shadow: 'rgba(21,22,26,0.10)',
  },
  dark: {
    dark: true,
    background: '#0B0C0F',
    surface: '#16171B',
    border: 'rgba(255,255,255,0.07)',
    inset: '#1F2025',
    track: '#2A2C33',
    trackIdle: '#3A3C45',
    glass: 'rgba(30,31,37,0.62)',
    glassBorder: 'rgba(255,255,255,0.10)',
    scrim: 'rgba(255,255,255,0.18)',
    scrimBorder: 'rgba(255,255,255,0.32)',
    text: '#F3F1EC',
    textSecondary: '#A2A4AD',
    textMuted: '#777A84',
    inverse: '#F3F1EC',
    onInverse: '#0B0C0F',
    segmentThumb: '#24262C',
    accent: '#FF7440',
    onAccent: '#1A0E08',
    accentText: '#FF9466',
    accentSoft: '#2E1A12',
    blue: '#4C68FF',
    blueText: '#93A6FF',
    blueSoft: '#1A2048',
    success: '#3DCB7D',
    successSoft: '#12291B',
    gold: '#F2B63A',
    onGold: '#2A1A00',
    danger: '#FF7A6E',
    live: '#7CF0A9',
    shadow: 'rgba(0,0,0,0.45)',
  },
};

/** Avatar backgrounds for walkers without a photo, picked from the user id. */
export const avatarTones = [
  '#2952FF',
  '#16894A',
  '#8B5CF6',
  '#E8447A',
  '#E8A317',
  '#C9611B',
] as const;

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  text: 'Inter_400Regular',
  textMedium: 'Inter_500Medium',
  textSemiBold: 'Inter_600SemiBold',
  textBold: 'Inter_700Bold',
};

/** Letter spacing is in em in the mockups, in points in React Native. */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100;

const display = (size: number, tracking: number, lineHeight?: number) => ({
  fontFamily: fonts.display,
  fontSize: size,
  letterSpacing: em(size, tracking),
  ...(lineHeight ? { lineHeight: Math.round(size * lineHeight) } : {}),
});

/** Big numbers: Space Grotesk, tight, tabular. */
const figure = (size: number) => ({
  ...display(size, -0.035, 0.92),
  fontVariant: ['tabular-nums' as const],
});

const text = (size: number, family: string, lineHeight?: number) => ({
  fontFamily: family,
  fontSize: size,
  ...(lineHeight ? { lineHeight: Math.round(size * lineHeight) } : {}),
});

/** The type ramp, most used first in each group. */
export const type = {
  /** Screen titles: Explorer, Communauté, Salut Théo. */
  largeTitle: display(32, -0.035, 1.08),
  /** Onboarding headline. */
  hero: display(40, -0.035, 1.05),
  /** Card titles: La Loire à pied, De la Sologne à Paris. */
  title: display(22, -0.02),
  /** Row and section titles: Blois → Amboise, Les plus suivis. */
  title2: display(18, -0.01),
  headline: display(16, 0),
  figureHero: figure(52),
  figureXL: figure(30),
  figureL: figure(24),
  figureM: figure(20),
  figureS: figure(16),
  /** Ranks and short numbers in lists. */
  rank: { ...display(15, 0), fontVariant: ['tabular-nums' as const] },
  body: text(15, fonts.text, 1.5),
  bodyStrong: { ...text(16, fonts.textSemiBold), letterSpacing: em(16, -0.01) },
  callout: text(14.5, fonts.textSemiBold),
  label: text(13.5, fonts.textSemiBold),
  subhead: text(13.5, fonts.text, 1.45),
  footnote: text(12.5, fonts.text),
  footnoteStrong: text(12.5, fonts.textSemiBold),
  caption: text(11.5, fonts.textSemiBold, 1.25),
  /** Tab bar labels. */
  tab: text(10.5, fonts.textMedium),
  /** Small capitals: section kickers like PROFIL. */
  overline: {
    ...text(11.5, fonts.textBold),
    letterSpacing: em(11.5, 0.06),
    textTransform: 'uppercase' as const,
  },
};

export const radius = {
  /** Progress bars and stage ticks. */
  bar: 3,
  dot: 9,
  /** Small buttons (40 to 44 high) and fields on a card. */
  small: 12,
  button: 14,
  /** Search bar, text fields, tiles. */
  field: 16,
  /** Primary call to action (56 high), stat tiles. */
  cta: 18,
  tile: 20,
  /** List cards (Explorer rows, Publier summary). */
  cardSmall: 22,
  /** Feed and home cards. */
  card: 24,
  /** Hero cards (trajet de la semaine). */
  hero: 28,
  /** Top of a sheet over a photo or the map. */
  sheet: 34,
  pill: 999,
};

/** Gaps and paddings of the mockups (4 point grid with a few half steps). */
export const space = {
  xxs: 2,
  xs: 4,
  s: 6,
  m: 8,
  l: 10,
  xl: 12,
  xxl: 14,
  xxxl: 16,
  section: 22,
  /** Side margins: 19 on iPhone screens, 20 on sheets and cards. */
  gutter: 20,
};

/** Standard heights. */
export const size = {
  cta: 56,
  searchBar: 50,
  field: 52,
  button: 44,
  smallButton: 40,
  chip: 36,
  smallChip: 30,
  /** Floating tab bar: 54 items in a 5 padded pill, 26 from the bottom. */
  tabItem: 54,
  roundButton: 48,
};

/** Shadows as React Native style objects (iOS takes the larger layer). */
export const shadow = {
  light: {
    card: {
      shadowColor: '#15161A',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    floating: {
      shadowColor: '#15161A',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    sheet: {
      shadowColor: '#15161A',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -12 },
    },
    field: {
      shadowColor: '#000000',
      shadowOpacity: 0.09,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 6 },
    },
  },
  dark: {
    /** Cards have no shadow at night, only their border. */
    card: null,
    floating: {
      shadowColor: '#000000',
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    sheet: {
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -12 },
    },
    field: {
      shadowColor: '#000000',
      shadowOpacity: 0.25,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 6 },
    },
  },
};

/** Glass on floating elements only (tab bar, map buttons). */
export const blur = { glass: 24, chip: 14 };

/** Paper grain: multiplied by day, screened at night, overlaid on orange. */
export const grain = {
  background: { light: [0.1, 'multiply'], dark: [0.16, 'screen'] },
  picture: { light: [0.16, 'multiply'], dark: [0.12, 'screen'] },
  accent: { light: [0.28, 'overlay'], dark: [0.28, 'overlay'] },
} as const;

/** Medal metals: three stop gradient (light, mid, deep) and engraving colour. */
export const metals = {
  bronze: { stops: ['#FAD2AE', '#D38B52', '#99582A'], engrave: '#5F3313' },
  silver: { stops: ['#FAFBFC', '#C7CDD6', '#8A93A1'], engrave: '#4E5765' },
  gold: { stops: ['#FFE9A6', '#F2B53A', '#B97A12'], engrave: '#7C4E07' },
  cap: { stops: ['#FFD2BC', '#FF7440', '#C2410C'], engrave: '#6B2205' },
  /** Not won yet: greige, with an orange progress ring. */
  locked: { stops: ['#E4E1DB', '#C9C5BD', '#A8A39A'], engrave: '#8B867C' },
} as const;

/** Medal ribbons, outer, middle and inner stripe: Cap (gold), green (bronze), blue (silver), black (Cap metal). */
export const ribbons = {
  cap: ['#FF5A1F', '#FFFFFF', '#2952FF'],
  green: ['#16894A', '#FFFFFF', '#16894A'],
  blue: ['#2952FF', '#FFFFFF', '#2952FF'],
  black: ['#15161A', '#FF5A1F', '#15161A'],
  locked: ['#CFC8BC', '#E6E1D8', '#CFC8BC'],
} as const;

/** Profile badges: a 12 scallop seal filled with a diagonal gradient. */
export const badges = {
  team: ['#FF8A50', '#E5420E'],
  certified: ['#5A78FF', '#2140E0'],
  developer: ['#5A6072', '#23252D'],
  github: ['#9B7BFF', '#6A3FE0'],
  supporter: ['#FFC15A', '#E58F00'],
  founder: ['#FF6FA0', '#D02E66'],
  beta: ['#2CC7C2', '#0B8E8A'],
  organizer: ['#3DCB7D', '#14894A'],
  creator: ['#3BB8E8', '#0B7FB0'],
  ambassador: ['#7C83FF', '#4146D8'],
  moderator: ['#8C97A8', '#4D5868'],
  club: ['#F5A35A', '#C9611B'],
} as const;

export type BadgeKind = keyof typeof badges;
export type Metal = keyof typeof metals;

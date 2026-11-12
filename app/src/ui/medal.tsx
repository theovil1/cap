import { useId, type ReactNode } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { fonts } from '@/theme';
import { metals, ribbons, type Metal } from '@/tokens';

type Ribbon = keyof typeof ribbons;

/** Pictograms engraved on a medal, on a 24 grid. */
const PICTOGRAMS = {
  streak: (
    <Path d="M12 21c-3.6 0-6-2.5-6-5.8 0-3.4 2.6-5.3 3.6-8.7.2-.7 1-.9 1.4-.3 1.2 1.7 1.6 3.3 1.6 4.6 1-.6 1.6-1.6 1.8-2.6.1-.5.8-.7 1.1-.2 1.4 1.9 2.5 4 2.5 6.6C18 18.6 15.6 21 12 21Z" />
  ),
  podium: <Path d="M9 20V10h6v10M3 20v-6h6M15 20v-8h6v8M2 20h20" />,
  finish: <Path d="M6 21V4M6 4h11l-2.5 4.5L17 13H6" />,
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2.5} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
} as const;

export type MedalFace =
  /** 100 KM, 1er PLACE. */
  | { kind: 'number'; value: string; unit: string }
  /** Flame and 30 J, podium and 2E, flag and FINI. */
  | { kind: 'icon'; icon: keyof typeof PICTOGRAMS; label: string }
  /** Arrival city of a finished journey, clipped in the disc (100 point box). */
  | { kind: 'picture'; picture: ReactNode };

/** The two ribbon halves, three stripes each, in the medal's 132 x 170 box. */
const STRIPES = [
  ['14.0,0.0 27.7,0.0 56.2,79.1 44.0,82.0', '106.0,0.0 92.3,0.0 63.8,79.1 76.0,82.0'],
  ['27.7,0.0 38.3,0.0 65.8,76.9 56.2,79.1', '92.3,0.0 81.7,0.0 54.2,76.9 63.8,79.1'],
  ['38.3,0.0 52.0,0.0 78.0,74.0 65.8,76.9', '81.7,0.0 68.0,0.0 42.0,74.0 54.2,76.9'],
];

/** 40 notches around the rim. */
const TICKS = Array.from({ length: 40 }, (_, i) => {
  const a = (i * 9 * Math.PI) / 180;
  return [
    60 + 43 * Math.sin(a),
    108 - 43 * Math.cos(a),
    60 + 39 * Math.sin(a),
    108 - 39 * Math.cos(a),
  ];
});

/** Engraving: a light copy just below and right, then the dark one. */
function Engraved({
  light,
  dark,
  children,
}: {
  light: string;
  dark: string;
  children: (color: string) => ReactNode;
}) {
  return (
    <>
      <G transform="translate(0.8 1.2)" opacity={0.9}>
        {children(light)}
      </G>
      {children(dark)}
    </>
  );
}

/**
 * Finisher medal: ribbon in Cap colours and an engraved metal disc. Bronze,
 * silver, gold and Cap give the level; `locked` with `progress` is one to win.
 */
export function Medal({
  metal,
  ribbon,
  face,
  progress,
  width = 58,
  label,
}: {
  metal: Metal;
  ribbon: Ribbon;
  face?: MedalFace;
  /** 0 to 1, drawn as an orange ring around a locked medal. */
  progress?: number;
  width?: number;
  label: string;
}) {
  const id = useId().replace(/:/g, '');
  const { stops, engrave } = metals[metal];
  const [light, mid, deep] = stops;
  const ring = progress !== undefined;
  const viewBox = ring ? '-6 -10 132 180' : '-6 0 132 170';
  const height = (width * (ring ? 180 : 170)) / 132;
  const lengthRing = 2 * Math.PI * 52;
  const textProps = { textAnchor: 'middle' as const, fontFamily: fonts.display };
  return (
    <Svg
      width={width}
      height={height}
      viewBox={viewBox}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Defs>
        <LinearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.45" stopColor={mid} />
          <Stop offset="1" stopColor={deep} />
        </LinearGradient>
        <LinearGradient id={`${id}f`} x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.55" stopColor={mid} />
          <Stop offset="1" stopColor={deep} />
        </LinearGradient>
        <ClipPath id={`${id}c`}>
          <Circle cx={60} cy={108} r={36} />
        </ClipPath>
      </Defs>
      {STRIPES.map((pair, index) =>
        pair.map((points) => (
          <Polygon key={points} points={points} fill={ribbons[ribbon][index]} />
        )),
      )}
      <Polygon points="14,0 52,0 54.5,8 17,8" fill="#000" opacity={0.12} />
      <Polygon points="68,0 106,0 103,8 65.5,8" fill="#000" opacity={0.12} />
      <Polygon points="60,40 78,74 42,74" fill="#000" opacity={0.16} />
      {ring ? (
        <>
          <Circle
            cx={60}
            cy={108}
            r={52}
            fill="none"
            stroke={deep}
            strokeOpacity={0.25}
            strokeWidth={4}
          />
          <Circle
            cx={60}
            cy={108}
            r={52}
            fill="none"
            stroke="#FF5A1F"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, Math.min(1, progress)) * lengthRing} ${lengthRing}`}
            transform="rotate(-90 60 108)"
          />
        </>
      ) : null}
      <Circle cx={60} cy={110.5} r={46} fill="#000" opacity={0.18} />
      <Circle cx={60} cy={108} r={46} fill={`url(#${id}r)`} />
      {ring
        ? null
        : TICKS.map(([x1, y1, x2, y2]) => (
            <Line
              key={`${x1}${y1}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={deep}
              strokeOpacity={0.45}
              strokeWidth={1.4}
            />
          ))}
      <Circle cx={60} cy={108} r={37} fill={`url(#${id}f)`} />
      <Circle
        cx={60}
        cy={108}
        r={37}
        fill="none"
        stroke={deep}
        strokeOpacity={0.55}
        strokeWidth={1.2}
      />
      <Circle
        cx={60}
        cy={108}
        r={35.5}
        fill="none"
        stroke={light}
        strokeOpacity={0.8}
        strokeWidth={0.8}
      />

      {face?.kind === 'picture' ? (
        <G clipPath={`url(#${id}c)`}>
          <G transform="translate(24 72) scale(0.72)">{face.picture}</G>
        </G>
      ) : null}
      {face?.kind === 'number' ? (
        <Engraved light={light} dark={engrave}>
          {(color) => (
            <>
              <SvgText
                x={60}
                y={112}
                fontSize={face.value.length > 3 ? 20 : 25}
                letterSpacing={-0.5}
                fill={color}
                {...textProps}
              >
                {face.value}
              </SvgText>
              <SvgText
                x={60}
                y={127}
                fontSize={9.5}
                letterSpacing={1.2}
                fill={color}
                {...textProps}
                fontFamily={fonts.textBold}
              >
                {face.unit}
              </SvgText>
            </>
          )}
        </Engraved>
      ) : null}
      {face?.kind === 'icon' || metal === 'locked' ? (
        <Engraved light={light} dark={engrave}>
          {(color) =>
            face?.kind === 'icon' ? (
              <>
                <G
                  transform="translate(43 84) scale(1.4167)"
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {PICTOGRAMS[face.icon]}
                </G>
                <SvgText
                  x={60}
                  y={133}
                  fontSize={14}
                  letterSpacing={0.5}
                  fill={color}
                  {...textProps}
                >
                  {face.label}
                </SvgText>
              </>
            ) : (
              <G
                transform="translate(39 87) scale(1.75)"
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {PICTOGRAMS.lock}
              </G>
            )
          }
        </Engraved>
      ) : null}
      <Path d="M22 102 A 38 38 0 0 1 70 70 A 44 44 0 0 0 22 102 Z" fill="#FFFFFF" opacity={0.35} />
    </Svg>
  );
}

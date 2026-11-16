import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

const COLORS = ['#FF5A1F', '#FF8A5B', '#5B7CFF', '#3DCB7D', '#FFC94D', '#F3F1EC'];
const COUNT = 110;
/** Seconds: the whole show, and the fade at its end. */
const LIFE = 6.2;
const FADE = 1.2;
/** Air drag (1/s) and the slow speed paper falls at (in screen heights per second). */
const DRAG = 1.6;
const FALL = 0.2;

type Piece = {
  fromLeft: boolean;
  delay: number;
  /** Launch speed, as a share of the screen size per second. */
  up: number;
  side: number;
  size: number;
  color: string;
  round: boolean;
  tilt: number;
  spin: number;
  wobble: number;
  sway: number;
};

function pieces(): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      fromLeft,
      delay: fromLeft ? 0 : 0.12,
      up: 0.95 + Math.random() * 0.45,
      side: 0.12 + Math.random() * 0.32,
      size: 6 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.2,
      tilt: Math.random() * Math.PI * 2,
      spin: 3 + Math.random() * 6,
      wobble: Math.random() * Math.PI * 2,
      sway: 1.5 + Math.random() * 2.5,
    };
  });
}

/**
 * One burst of confetti from the bottom corners: paper shot up and inwards,
 * slowed by the air, then drifting down while it turns over, for about six
 * seconds. Nothing when iOS reduces motion.
 */
export function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const still = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [list] = useState(pieces);
  const time = useSharedValue(0);

  useFrameCallback((frame) => {
    time.value += Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
  });
  useEffect(() => {
    const timer = setTimeout(onDone, LIFE * 1000 + 100);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (still) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {list.map((piece, i) => (
        <Bit key={i} piece={piece} time={time} width={width} height={height} />
      ))}
    </View>
  );
}

function Bit({
  piece,
  time,
  width,
  height,
}: {
  piece: Piece;
  time: SharedValue<number>;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, time.value - piece.delay);
    // Linear drag, solved: the launch fades out and the fall settles at a slow speed.
    const slow = (1 - Math.exp(-DRAG * t)) / DRAG;
    const fall = FALL * height;
    const vx = (piece.fromLeft ? 1 : -1) * piece.side * width * DRAG;
    const vy = -piece.up * height * DRAG;
    const x =
      (piece.fromLeft ? 0.04 : 0.96) * width +
      vx * slow +
      Math.sin(piece.wobble + piece.sway * t) * 12;
    const y = height * 1.02 + fall * t + (vy - fall) * slow;
    const flip = Math.cos(piece.tilt + piece.spin * t);
    const left = LIFE - time.value;
    return {
      opacity: time.value < piece.delay ? 0 : left < FADE ? Math.max(0, left / FADE) : 1,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${(piece.wobble + piece.sway * t) * 0.6}rad` },
        { scaleY: Math.abs(flip) < 0.15 ? (flip < 0 ? -0.15 : 0.15) : flip },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.bit,
        {
          width: piece.size,
          height: piece.round ? piece.size * 0.8 : piece.size * 0.6,
          borderRadius: piece.round ? piece.size : 1.5,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', left: 0, top: 0 },
});

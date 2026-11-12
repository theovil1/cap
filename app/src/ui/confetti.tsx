import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

const COLORS = ['#FF5A1F', '#2952FF', '#16894A', '#E8A317'];
const COUNT = 34;

/** Same pieces on every visit: position, size, speed and spin. */
const PIECES = (() => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: COUNT }, (_, i) => ({
    left: rand(),
    /** Where the piece rests when motion is reduced. */
    rest: rand() * 0.52,
    delay: rand() * 2_400,
    duration: 3_200 + rand() * 2_200,
    spin: 180 + rand() * 360,
    drift: (rand() - 0.5) * 60,
    color: COLORS[i % COLORS.length],
    long: rand() > 0.5,
  }));
})();

/**
 * Confetti falling over the top of the screen, again and again; still pieces
 * when the walker asked iOS to reduce motion.
 */
export function Confetti() {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => PIECES.map(() => new Animated.Value(0)));
  const [still, setStill] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill);
  }, []);

  useEffect(() => {
    if (still !== false) return;
    const loops = progress.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(PIECES[i].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: PIECES[i].duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [still, progress]);

  if (still === null) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PIECES.map((piece, i) => {
        const value = progress[i];
        const moving = still
          ? [{ translateY: piece.rest * height }, { rotate: `${piece.spin}deg` }]
          : [
              {
                translateY: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, height * 0.62],
                }),
              },
              {
                translateX: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, piece.drift],
                }),
              },
              {
                rotate: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${piece.spin}deg`],
                }),
              },
            ];
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              piece.long && styles.long,
              {
                left: piece.left * width,
                backgroundColor: piece.color,
                opacity: still
                  ? 0.9
                  : value.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.95, 0.9, 0] }),
                transform: moving,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, width: 7, height: 5, borderRadius: 1.5 },
  long: { width: 9, height: 4 },
});

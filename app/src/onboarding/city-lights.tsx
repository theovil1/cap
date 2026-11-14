import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { CityWindow } from './windows';

/** Same numbers on every launch, different for every window. */
function random(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A window that goes dark now and then: a patch of wall colour fades in over
 * the lit window, stays a while, then fades out again.
 */
function Light({
  window,
  index,
  scale,
  dx,
  dy,
}: {
  window: CityWindow;
  index: number;
  scale: number;
  dx: number;
  dy: number;
}) {
  const [x, y, w, h, wall] = window;
  const off = useSharedValue(random(index + 1) < 0.35 ? 1 : 0);
  useEffect(() => {
    const fade = { duration: 500 + random(index + 2) * 700, easing: Easing.inOut(Easing.quad) };
    const lit = 2_000 + random(index + 3) * 9_000;
    const dark = 1_500 + random(index + 4) * 6_000;
    const start = off.value;
    off.value = withDelay(
      random(index + 5) * 6_000,
      withRepeat(
        withSequence(
          withTiming(1 - start, fade),
          withDelay(start ? lit : dark, withTiming(start, fade)),
          withDelay(start ? dark : lit, withTiming(start, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [index, off]);
  const style = useAnimatedStyle(() => ({ opacity: off.value }));
  return (
    <Animated.View
      style={[
        styles.light,
        {
          left: dx + x * scale,
          top: dy + y * scale,
          width: w * scale,
          height: h * scale,
          backgroundColor: wall,
        },
        style,
      ]}
    />
  );
}

/**
 * The night city of the welcome screen, drawn like `resizeMode="cover"`, with
 * windows that light up and go dark. Still when Reduce Motion is on.
 */
export function CityLights({
  source,
  size,
  windows,
  style,
}: {
  source: ImageSourcePropType;
  /** The image's own size, in pixels. */
  size: [number, number];
  /** Lit windows; none for the day picture. */
  windows: CityWindow[];
  style?: StyleProp<ViewStyle>;
}) {
  const still = useReducedMotion();
  const [box, setBox] = useState<[number, number] | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setBox([e.nativeEvent.layout.width, e.nativeEvent.layout.height]);
  const scale = box ? Math.max(box[0] / size[0], box[1] / size[1]) : 0;
  const dx = box ? (box[0] - size[0] * scale) / 2 : 0;
  const dy = box ? (box[1] - size[1] * scale) / 2 : 0;
  return (
    <View style={[styles.box, style]} onLayout={onLayout} pointerEvents="none">
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {box && !still
        ? windows.map((window, index) => (
            <Light key={index} window={window} index={index} scale={scale} dx={dx} dy={dy} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  light: { position: 'absolute', borderRadius: 1 },
});

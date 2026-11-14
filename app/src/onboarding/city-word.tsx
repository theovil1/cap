import { useEffect, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

/** How long each city stays before the next one comes in. */
const HOLD_MS = 2600;

/**
 * "Paris", then other cities in turn, each rising into place: the welcome
 * title's destination. Stays on the first one with Reduce Motion.
 */
export function CityWord({
  cities,
  style,
}: {
  /** The first one is shown first and kept when motion is reduced. */
  cities: string[];
  style: StyleProp<TextStyle>;
}) {
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (still || cities.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % cities.length), HOLD_MS);
    return () => clearInterval(timer);
  }, [still, cities.length]);
  return (
    <Animated.Text
      key={index}
      entering={FadeInDown.duration(380).easing(Easing.out(Easing.cubic))}
      exiting={FadeOutUp.duration(260)}
      style={style}
    >
      {cities[index]}.
    </Animated.Text>
  );
}

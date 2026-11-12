import { Image, StyleSheet } from 'react-native';

import { useDark } from '@/settings/appearance';
import { grain } from '@/tokens';

const TILE = require('../../assets/images/grain.png');

/**
 * Paper grain of the mockups: a repeated noise tile blended over a surface
 * (the background, a picture or the map, an orange card). Put it first in a
 * view with `overflow: 'hidden'`; it takes no touches.
 */
export function Grain({ on = 'background' }: { on?: keyof typeof grain }) {
  const [opacity, mixBlendMode] = grain[on][useDark() ? 'dark' : 'light'];
  return (
    <Image
      source={TILE}
      resizeMode="repeat"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.grain, { opacity, mixBlendMode }]}
    />
  );
}

const styles = StyleSheet.create({
  grain: { width: '100%', height: '100%' },
});

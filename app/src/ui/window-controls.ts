import { Dimensions, Platform, useWindowDimensions } from 'react-native';

/** Room for iPadOS's window buttons (close, minimise, arrange), top left. */
const CONTROLS_HEIGHT = 32;

/**
 * Extra top space when the app runs in a window on iPadOS 26 or later, where the
 * window buttons sit over the top left corner. Zero in full screen and on iPhone.
 */
export function useWindowControlsInset(): number {
  const window = useWindowDimensions();
  if (Platform.OS !== 'ios' || !Platform.isPad) return 0;
  if (Number(String(Platform.Version).split('.')[0]) < 26) return 0;
  const screen = Dimensions.get('screen');
  const windowed = window.width < screen.width - 1 || window.height < screen.height - 1;
  return windowed ? CONTROLS_HEIGHT : 0;
}

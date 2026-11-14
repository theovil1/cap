import {
  ActionSheetIOS,
  findNodeHandle,
  type ActionSheetIOSOptions,
  type GestureResponderEvent,
} from 'react-native';

/**
 * iOS action menu that pops from the element tapped (iPad, and iPhone since
 * iOS 26) instead of the middle of the screen. Without `from`, it shows the
 * classic way.
 */
export function showActions(
  from: GestureResponderEvent | undefined,
  options: ActionSheetIOSOptions,
  onPick: (index: number) => void,
) {
  const target = from?.currentTarget as Parameters<typeof findNodeHandle>[0] | undefined;
  const anchor = target ? (findNodeHandle(target) ?? undefined) : undefined;
  ActionSheetIOS.showActionSheetWithOptions({ ...options, anchor }, onPick);
}

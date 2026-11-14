import { MenuView } from '@expo/ui/community/menu';
import { requireOptionalNativeModule } from 'expo';
import { t as translate } from 'i18next';
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { showActions } from './action-sheet';

export type MenuItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  /** SF Symbol shown before the label. */
  icon?: SFSymbol;
  /** Shows a checkmark: the value picked in a list. */
  checked?: boolean;
};

/**
 * The native iOS menu needs a development build that includes @expo/ui; older
 * builds keep the action sheet instead of failing.
 */
const NATIVE = !!requireOptionalNativeModule('ExpoUI');

/**
 * A native iOS menu that opens from its trigger, the way Apple's apps do. The
 * trigger is drawn by `children` and only drawn: the menu takes the touch.
 */
export function ActionMenu({
  items,
  title,
  longPress = false,
  label,
  style,
  children,
}: {
  items: MenuItem[];
  title?: string;
  /** Opens on a long press (a comment) instead of a tap. */
  longPress?: boolean;
  /** For VoiceOver: what the trigger does. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (!NATIVE) {
    const open = (from?: Parameters<typeof showActions>[0]) =>
      showActions(
        from,
        {
          title,
          options: [...items.map((i) => i.label), translate('journeys.cancel')],
          cancelButtonIndex: items.length,
          destructiveButtonIndex: items.flatMap((item, i) => (item.destructive ? [i] : [])),
        },
        (index) => items[index]?.onPress(),
      );
    return (
      <Pressable
        onPress={longPress ? undefined : open}
        onLongPress={longPress ? open : undefined}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={style}
      >
        <View pointerEvents="none">{children}</View>
      </Pressable>
    );
  }
  return (
    <MenuView
      title={title}
      shouldOpenOnLongPress={longPress}
      style={style}
      actions={items.map((item, i) => ({
        id: String(i),
        title: item.label,
        image: item.icon,
        state: item.checked ? 'on' : undefined,
        attributes: item.destructive ? { destructive: true } : undefined,
      }))}
      onPressAction={({ nativeEvent }) => items[Number(nativeEvent.event)]?.onPress()}
    >
      <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={label}>
        {children}
      </View>
    </MenuView>
  );
}

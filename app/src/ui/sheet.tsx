import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  /** Visible heights below the full sheet, smallest first. */
  stops: number[];
  /** Shown just above the sheet and moving with it (map buttons). */
  above?: ReactNode;
  grabberColor: string;
  grabberLabel: string;
  onChange?: (index: number, height: number) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Bottom sheet that snaps to a few heights: drag it or tap the grabber. */
export function Sheet({
  stops,
  above,
  grabberColor,
  grabberLabel,
  onChange,
  style,
  children,
}: Props) {
  const [full, setFull] = useState(0);
  const [index, setIndex] = useState(stops.length);
  const [translate] = useState(() => new Animated.Value(0));
  const heights = [...stops.map((h) => Math.min(h, full || h)), full];
  const offsetOf = (i: number) => Math.max(0, full - heights[i]);

  // Mutable box shared with the gesture callbacks, which are created once.
  const [box] = useState(() => ({ start: 0, heights, full, snapTo: (_i: number) => {} }));
  const glide = (toValue: number) =>
    Animated.spring(translate, {
      toValue,
      useNativeDriver: false,
      bounciness: 0,
      speed: 18,
    }).start();
  // One animation per snap. The JS driver keeps the value in sync, so a new
  // spring (content resized mid-way) starts from where the sheet really is.
  const snapTo = (i: number) => {
    if (i === index) glide(offsetOf(i));
    else setIndex(i);
  };
  useEffect(() => {
    Object.assign(box, { heights, full, snapTo });
  });

  // Also follows the content when its size changes (first layout, rotation).
  const offset = offsetOf(index);
  const height = heights[index];
  useEffect(() => {
    Animated.spring(translate, {
      toValue: offset,
      useNativeDriver: false,
      bounciness: 0,
      speed: 18,
    }).start();
  }, [offset, translate]);
  useEffect(() => onChange?.(index, height), [index, height, onChange]);

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => translate.stopAnimation((value) => (box.start = value)),
      onPanResponderMove: (_, g) => {
        const { heights: h, full: f } = box;
        translate.setValue(Math.max(0, Math.min(f - h[0], box.start + g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const { heights: h, full: f, snapTo: snap } = box;
        const target = box.start + g.dy + g.vy * 160;
        let best = 0;
        h.forEach((value, i) => {
          if (Math.abs(f - value - target) < Math.abs(f - h[best] - target)) best = i;
        });
        snap(best);
      },
    }),
  );

  const onLayout = (event: LayoutChangeEvent) => setFull(event.nativeEvent.layout.height);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { transform: [{ translateY: translate }] }]}
    >
      {above}
      <View style={style} onLayout={onLayout} {...responder.panHandlers}>
        <Pressable
          onPress={() => snapTo((index + 1) % heights.length)}
          accessibilityRole="button"
          accessibilityLabel={grabberLabel}
          hitSlop={12}
          style={styles.grabberArea}
        >
          <View style={[styles.grabber, { backgroundColor: grabberColor }]} />
        </Pressable>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  grabberArea: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 30 },
  grabber: { width: 38, height: 5, borderRadius: 99 },
});

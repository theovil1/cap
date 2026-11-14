import { Globe } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useColors } from '@/theme';

import { FLAGS } from './flags-data';

/**
 * A country's flag as a small 3:2 card: rounded corners, a hairline edge so
 * white flags stand out, and a soft light from the top left.
 */
export function Flag({
  code,
  height = 16,
  style,
}: {
  code: string;
  /** In points; the width follows (3:2). */
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const width = Math.round(height * 1.5);
  const svg = FLAGS[code];
  const radius = Math.max(2, height * 0.18);
  return (
    <View
      style={[
        styles.flag,
        { width, height, borderRadius: radius, backgroundColor: colors.inset },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {svg ? (
        <SvgXml xml={svg} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <Globe size={height * 0.8} color={colors.textMuted} />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.finish,
          {
            borderRadius: radius,
            borderColor: colors.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flag: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  finish: {
    borderWidth: StyleSheet.hairlineWidth,
    backgroundImage:
      'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.12) 100%)',
  },
});

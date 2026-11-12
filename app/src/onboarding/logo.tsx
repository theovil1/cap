import { Route as RouteIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';
import { Grain } from '@/ui/grain';

/** Cap's square logo: the route mark on the accent, with its grain. */
export function CapLogo({ size }: { size: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size * 0.3125, backgroundColor: colors.accent },
      ]}
    >
      <Grain on="accent" />
      <RouteIcon size={size * 0.5625} color={colors.onAccent} strokeWidth={2.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

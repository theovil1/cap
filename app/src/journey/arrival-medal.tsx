import { StyleSheet, Text, View } from 'react-native';

import { AerialView } from '@/map/aerial';
import { fonts } from '@/theme';
import { metals } from '@/tokens';
import { Medal } from '@/ui/medal';

/**
 * Gold finisher medal with the destination seen from the sky in the disc and
 * the distance engraved under it, as on the arrival mockup.
 */
export function ArrivalMedal({
  lat,
  lon,
  distance,
  width,
  zoom = 15,
  label,
}: {
  lat: number;
  lon: number;
  /** "201 KM". */
  distance: string;
  width: number;
  /** Smaller medals show a wider area. */
  zoom?: number;
  label: string;
}) {
  // The medal is drawn in a 132 x 170 box starting at x = -6; the disc is at (60, 108), r 36.
  const k = width / 132;
  const radius = 36 * k;
  const gold = metals.gold;
  return (
    <View style={{ width, height: (width * 170) / 132 }} accessible accessibilityLabel={label}>
      <Medal metal="gold" ribbon="cap" width={width} label={label} />
      <View
        style={[
          styles.disc,
          {
            left: 66 * k - radius,
            top: 108 * k - radius,
            width: radius * 2,
            height: radius * 2,
            borderColor: gold.stops[0],
          },
        ]}
      >
        <AerialView lat={lat} lon={lon} size={radius * 2} zoom={zoom} />
        <View style={[StyleSheet.absoluteFill, styles.shade]} />
        {width >= 100 ? (
          <Text style={[styles.distance, { fontSize: 9 * k }]}>{distance}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shade: {
    backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(40,24,4,0.55) 100%)',
  },
  distance: {
    position: 'absolute',
    bottom: '12%',
    fontFamily: fonts.textBold,
    letterSpacing: 1.2,
    color: '#FFE9A6',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});

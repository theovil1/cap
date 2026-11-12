import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { API_URL } from '@/api/client';
import type { Place, RoutePhoto } from '@/api/types';
import { AerialView } from '@/map/aerial';
import { useColors } from '@/theme';

/**
 * The picture of a public route: the author's photo when there is one, else
 * the place seen from the sky (IGN). Fills its parent.
 */
export function RouteCover({
  photos,
  place,
  kind = 'end',
  zoom = 14,
}: {
  photos: RoutePhoto[];
  /** Where the aerial view looks when there is no photo. */
  place: Place;
  kind?: RoutePhoto['kind'];
  zoom?: number;
}) {
  const colors = useColors();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const photo = photos.find((p) => p.kind === kind);
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.inset }]}
      onLayout={(e) => setBox(e.nativeEvent.layout)}
    >
      {photo ? (
        <Image
          source={{ uri: `${API_URL}${photo.url}` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
      ) : box ? (
        <AerialView
          lat={place.lat}
          lon={place.lon}
          width={box.width}
          height={box.height}
          zoom={zoom}
        />
      ) : null}
    </View>
  );
}

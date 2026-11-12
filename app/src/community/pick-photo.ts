/**
 * Picks a photo in the library and returns it as a JPEG, `width` pixels wide.
 * The picker is a native module: an older build of the app throws
 * `needs-update`; a cancelled pick gives null.
 */
export async function pickPhoto(
  width: number,
  aspect?: [number, number],
): Promise<{ uri: string; bytes: ArrayBuffer } | null> {
  let picker: typeof import('expo-image-picker');
  let manipulator: typeof import('expo-image-manipulator');
  try {
    picker = await import('expo-image-picker');
    manipulator = await import('expo-image-manipulator');
  } catch {
    throw new Error('needs-update');
  }
  const result = await picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  const small = await manipulator.manipulateAsync(asset.uri, [{ resize: { width } }], {
    compress: 0.8,
    format: manipulator.SaveFormat.JPEG,
  });
  const bytes = await (await fetch(small.uri)).arrayBuffer();
  return { uri: small.uri, bytes };
}

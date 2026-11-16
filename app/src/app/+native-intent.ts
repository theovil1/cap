/**
 * Spotify's sign-in comes back to the app as cap://spotify-auth: the music module
 * takes it, so it must not open a screen.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.includes('spotify-auth') ? '' : path;
}

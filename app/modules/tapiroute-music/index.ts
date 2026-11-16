import { requireOptionalNativeModule, type EventSubscription } from 'expo';

export type MusicSource = 'apple' | 'spotify';

/** What plays now, as the native side reports it. */
export type NowPlaying = {
  source: MusicSource;
  /** False while Spotify is not (or no longer) linked. */
  connected: boolean;
  playing: boolean;
  title: string;
  artist: string;
  /** A small JPEG as a data URI, when the app gives one. */
  artwork?: string;
};

type NativeMusic = {
  requestAppleMusic(): Promise<boolean>;
  start(source: MusicSource): Promise<void>;
  stop(): Promise<void>;
  command(source: MusicSource, name: 'play' | 'pause' | 'next' | 'previous'): Promise<void>;
  spotifyReady(): boolean;
  addListener(event: 'onChange', listener: (track: NowPlaying) => void): EventSubscription;
};

/** Missing in builds made before the music module: the app then shows no player. */
export const TapirouteMusic = requireOptionalNativeModule<NativeMusic>('TapirouteMusic');

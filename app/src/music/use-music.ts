import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { getValue, setValue } from '@/session/store';

import { TapirouteMusic, type MusicSource, type NowPlaying } from '../../modules/tapiroute-music';

export type { MusicSource, NowPlaying };

/** Per device, on by default: Mon compte > Préférences > Musique en séance. */
const ENABLED_KEY = 'musicInSession';
const SOURCE_KEY = 'musicSource';

export function musicEnabled(): boolean {
  return getValue<boolean>(ENABLED_KEY) ?? true;
}

export function setMusicEnabled(on: boolean): void {
  setValue(ENABLED_KEY, on);
}

/** Whether this build can show a player at all. */
export const musicSupported = !!TapirouteMusic;

type Apps = { apple: boolean; spotify: boolean; deezer: boolean };

/**
 * Music during a session: the source the walker picked (remembered), what it
 * plays, its controls, and which music apps are on the phone.
 */
export function useMusic() {
  const [enabled, setEnabled] = useState(musicEnabled);
  const [source, setSource] = useState<MusicSource | null>(() => getValue<MusicSource>(SOURCE_KEY));
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const [apps, setApps] = useState<Apps>({ apple: false, spotify: false, deezer: false });

  useEffect(() => {
    // Needs the schemes in LSApplicationQueriesSchemes (app.json).
    Promise.all(
      ['music://', 'spotify://', 'deezer://'].map((url) =>
        Linking.canOpenURL(url).catch(() => false),
      ),
    ).then(([apple, spotify, deezer]) =>
      setApps({ apple, spotify: spotify && !!TapirouteMusic?.spotifyReady(), deezer }),
    );
  }, []);

  useEffect(() => {
    const native = TapirouteMusic;
    if (!native || !enabled || !source) return;
    const subscription = native.addListener('onChange', (now) => {
      if (now.source === source) setTrack(now);
    });
    native.start(source).catch(() => {});
    return () => {
      subscription.remove();
      native.stop().catch(() => {});
    };
  }, [enabled, source]);

  const choose = useCallback(async (next: MusicSource) => {
    if (next === 'apple' && TapirouteMusic)
      await TapirouteMusic.requestAppleMusic().catch(() => false);
    setValue(SOURCE_KEY, next);
    setTrack(null);
    setSource(next);
  }, []);

  const command = useCallback(
    (name: 'play' | 'pause' | 'next' | 'previous') => {
      if (source) TapirouteMusic?.command(source, name).catch(() => {});
    },
    [source],
  );

  const hide = useCallback(() => {
    setMusicEnabled(false);
    setEnabled(false);
  }, []);

  const openDeezer = useCallback(() => {
    Linking.openURL('deezer://').catch(() => {});
  }, []);

  /** Something to show: a track with a title from the chosen source. */
  const playing = track && track.connected && track.title ? track : null;

  return {
    visible: musicSupported && enabled && (apps.apple || apps.spotify || apps.deezer),
    source,
    track: playing,
    apps,
    choose,
    command,
    hide,
    openDeezer,
  };
}

export type Music = ReturnType<typeof useMusic>;

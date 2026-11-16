import { Image } from 'expo-image';
import { Music as MusicIcon, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fonts, useColors, useShadows } from '@/theme';
import { TIGHT_TEXT_SCALE } from '@/tokens';
import { ActionMenu, type MenuItem } from '@/ui/action-menu';
import { Glass } from '@/ui/primitives';

import type { Music } from './use-music';

const SOURCE_COLOR = { apple: '#FA2D48', spotify: '#1DB954' } as const;

/** Apple Music, Spotify (ticked when chosen), Deezer to open, and a way to hide it. */
function useItems(music: Music): MenuItem[] {
  const { t } = useTranslation();
  return [
    ...(music.apps.apple
      ? [
          {
            label: 'Apple Music',
            checked: music.source === 'apple',
            onPress: () => music.choose('apple'),
          },
        ]
      : []),
    ...(music.apps.spotify
      ? [
          {
            label: 'Spotify',
            checked: music.source === 'spotify',
            onPress: () => music.choose('spotify'),
          },
        ]
      : []),
    ...(music.apps.deezer
      ? [
          {
            label: t('music.openDeezer'),
            icon: 'arrow.up.right' as const,
            onPress: music.openDeezer,
          },
        ]
      : []),
    { label: t('music.hide'), icon: 'eye.slash' as const, destructive: true, onPress: music.hide },
  ];
}

/** The source's mark on the cover: Apple Music's note, Spotify's three waves. */
function SourceBadge({ source, border }: { source: keyof typeof SOURCE_COLOR; border: string }) {
  return (
    <View style={[styles.dot, { backgroundColor: SOURCE_COLOR[source], borderColor: border }]}>
      <Svg width={10} height={10} viewBox="0 0 24 24" accessibilityElementsHidden>
        {source === 'apple' ? (
          <Path
            fill="#FFFFFF"
            d="M19 2.5v12.2a3.3 3.3 0 1 1-2-3V6.9l-7 1.5v8.8a3.3 3.3 0 1 1-2-3V5.3z"
          />
        ) : (
          <Path
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3.2}
            strokeLinecap="round"
            d="M4.5 8.5c5-1.8 10.5-1.4 15 1.2M5.5 12.8c4-1.2 8.5-.9 12.2 1.1M6.5 16.9c3-.8 6.2-.6 9 .9"
          />
        )}
      </Svg>
    </View>
  );
}

/** The cover, with the source's mark; opens the source menu. */
function Cover({ music, size }: { music: Music; size: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const track = music.track;
  return (
    <ActionMenu items={useItems(music)} label={t('music.source')}>
      <View style={{ width: size, height: size }}>
        {track?.artwork ? (
          <Image
            source={{ uri: track.artwork }}
            style={[styles.cover, { width: size, height: size, borderRadius: size * 0.26 }]}
          />
        ) : (
          <View
            style={[
              styles.cover,
              styles.center,
              {
                width: size,
                height: size,
                borderRadius: size * 0.26,
                backgroundColor: colors.inset,
              },
            ]}
          >
            <MusicIcon size={size * 0.45} color={colors.textSecondary} />
          </View>
        )}
        {track ? <SourceBadge source={track.source} border={colors.surface} /> : null}
      </View>
    </ActionMenu>
  );
}

function Words({ music, wide }: { music: Music; wide?: boolean }) {
  const colors = useColors();
  const track = music.track;
  if (!track) return <View style={styles.flex} />;
  return (
    <View style={styles.flex}>
      <Text
        style={[styles.title, wide && styles.titleWide, { color: colors.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
      >
        {track.title}
      </Text>
      <Text
        style={[styles.artist, { color: colors.textSecondary }]}
        numberOfLines={1}
        maxFontSizeMultiplier={TIGHT_TEXT_SCALE}
      >
        {track.artist}
      </Text>
    </View>
  );
}

function Control({
  icon,
  label,
  onPress,
  filled,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[styles.control, filled && [styles.filled, { backgroundColor: colors.text }]]}
    >
      {icon}
    </Pressable>
  );
}

/**
 * Phone: a glass pill floating over the map just above the session panel, or a
 * round button when nothing plays yet.
 */
export function MusicPill({ music, style }: { music: Music; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const items = useItems(music);
  if (!music.track) {
    return (
      <View style={[styles.buttonSpot, style]}>
        <ActionMenu items={items} label={t('music.choose')}>
          <Glass style={[styles.round, shadows.floating]}>
            <MusicIcon size={21} color={colors.text} />
          </Glass>
        </ActionMenu>
      </View>
    );
  }
  const playing = music.track.playing;
  return (
    <Glass style={[styles.pill, shadows.floating, style]}>
      <Cover music={music} size={38} />
      <Words music={music} />
      <Control
        icon={
          playing ? <Pause size={20} color={colors.text} /> : <Play size={20} color={colors.text} />
        }
        label={t(playing ? 'music.pause' : 'music.play')}
        onPress={() => music.command(playing ? 'pause' : 'play')}
      />
      <Control
        icon={<SkipForward size={20} color={colors.text} />}
        label={t('music.next')}
        onPress={() => music.command('next')}
      />
    </Glass>
  );
}

/** iPad: a card in the session panel, between the tiles and the journey bar. */
export function MusicCard({ music }: { music: Music }) {
  const { t } = useTranslation();
  const colors = useColors();
  const playing = !!music.track?.playing;
  return (
    <View style={[styles.card, { backgroundColor: colors.inset }]}>
      <Cover music={music} size={44} />
      {music.track ? (
        <>
          <Words music={music} wide />
          <Control
            icon={<SkipBack size={17} color={colors.text} />}
            label={t('music.previous')}
            onPress={() => music.command('previous')}
          />
          <Control
            filled
            icon={
              playing ? (
                <Pause size={16} color={colors.surface} />
              ) : (
                <Play size={16} color={colors.surface} />
              )
            }
            label={t(playing ? 'music.pause' : 'music.play')}
            onPress={() => music.command(playing ? 'pause' : 'play')}
          />
          <Control
            icon={<SkipForward size={17} color={colors.text} />}
            label={t('music.next')}
            onPress={() => music.command('next')}
          />
        </>
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('music.choose')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  cover: { overflow: 'hidden' },
  dot: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  titleWide: { fontSize: 14 },
  artist: { fontFamily: fonts.text, fontSize: 12.5 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filled: { width: 38, height: 38, borderRadius: 19 },
  pill: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 6,
    borderRadius: 27,
  },
  buttonSpot: { alignItems: 'flex-end' },
  round: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 20,
  },
  hint: { flex: 1, fontFamily: fonts.textMedium, fontSize: 14 },
});

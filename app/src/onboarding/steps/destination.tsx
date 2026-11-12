import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useUpdateProfile } from '@/api/profile';
import { useCreateRoute, useGeocode } from '@/api/queries';
import type { GeocodeResult } from '@/api/types';
import { formatKm, formatNumber } from '@/i18n/format';
import { ideasFrom } from '@/journey/ideas';
import { estimateArrival } from '@/journey/progress';
import { fonts, useColors } from '@/theme';
import { SearchBar } from '@/ui/controls';
import { Button } from '@/ui/primitives';

import type { Draft, NamedPlace } from '../draft';
import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { ChoiceCard, ChoiceText } from '../parts';

/** Walking paths wind: the same rough factor as the ideas, for a searched place. */
const WINDING = 1.25;

type Props = {
  nav: FrameNav;
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  next: () => void;
};

/**
 * Étape 1: where the walker starts (their town, asked once) and where they go:
 * four ideas at growing distances or any searched place.
 */
export function DestinationStep({ nav, draft, setDraft, next }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const update = useUpdateProfile();
  const createRoute = useCreateRoute();
  // `home` while the start is asked, `end` while another destination is searched.
  const [searching, setSearching] = useState<'home' | 'end' | null>(draft.home ? null : 'home');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const near = draft.home?.place ?? null;
  const results = useGeocode(searching ? text : '', near, i18n.language);

  const { home, destination } = draft;
  const ideas = home ? ideasFrom(home.place) : [];
  const choices = [
    ...(destination && !ideas.some((i) => i.place.label === destination.place.label)
      ? [destination]
      : []),
    ...ideas.map((i) => ({ place: i.place, name: i.place.label, distanceM: i.distanceM })),
  ];

  const detail = (metres: number) =>
    t('onboarding.destination.detail', {
      km: formatKm(metres, 0),
      sessions: formatNumber(estimateArrival(metres, 1).sessions),
    });

  const pick = (result: GeocodeResult) => {
    const chosen: NamedPlace = { place: result.place, name: result.name };
    setText('');
    setSearching(null);
    setError(null);
    if (searching === 'home') {
      setDraft({ home: chosen, destination: null, route: null });
      update.mutate({ home_city: result.name });
      return;
    }
    if (!home) return;
    const straight = Math.hypot(
      (chosen.place.lat - home.place.lat) * 111_000,
      (chosen.place.lon - home.place.lon) * 111_000 * Math.cos((home.place.lat * Math.PI) / 180),
    );
    setDraft({ destination: { ...chosen, distanceM: straight * WINDING }, route: null });
  };

  const go = () => {
    if (!home || !destination) return;
    if (draft.route) {
      next();
      return;
    }
    setError(null);
    createRoute.mutate(
      { start: home.place, end: destination.place },
      {
        onSuccess: (route) => {
          setDraft({ route });
          next();
        },
        onError: (e) =>
          setError(
            e instanceof ApiError
              ? t(`errors.${e.code}`, { defaultValue: t('errors.generic') })
              : t('errors.network'),
          ),
      },
    );
  };

  const search = searching ? (
    <View style={styles.list}>
      <SearchBar
        value={text}
        onChangeText={setText}
        placeholder={t(
          searching === 'home'
            ? 'onboarding.destination.homePlaceholder'
            : 'onboarding.destination.endPlaceholder',
        )}
      />
      {results.isFetching ? <ActivityIndicator color={colors.textMuted} /> : null}
      {(results.data ?? []).map((result) => (
        <ChoiceCard
          key={`${result.place.lat},${result.place.lon}`}
          on={false}
          onPress={() => pick(result)}
          icon={MapPin}
          label={result.name}
        >
          <ChoiceText title={result.name} detail={result.detail} />
        </ChoiceCard>
      ))}
      {searching === 'end' ? (
        <Link label={t('onboarding.cancel')} onPress={() => setSearching(null)} />
      ) : null}
    </View>
  ) : null;

  return (
    <OnboardingFrame
      {...nav}
      footer={
        <>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Button
            tone="dark"
            title={t('onboarding.continue')}
            onPress={go}
            loading={createRoute.isPending}
            disabled={!home || !destination}
          />
        </>
      }
    >
      <Headline
        kicker={t('onboarding.destination.kicker')}
        title={t('onboarding.destination.title')}
        text={
          home
            ? t('onboarding.destination.text', { town: home.name })
            : t('onboarding.destination.textNoHome')
        }
      />
      {search ?? (
        <>
          <View style={styles.list}>
            {choices.map((choice) => (
              <ChoiceCard
                key={choice.place.label}
                on={destination?.place.label === choice.place.label}
                onPress={() => setDraft({ destination: choice, route: null })}
                icon={MapPin}
                label={choice.name}
              >
                <ChoiceText title={choice.name} detail={detail(choice.distanceM)} />
              </ChoiceCard>
            ))}
          </View>
          <View style={styles.links}>
            <Link label={t('onboarding.destination.other')} onPress={() => setSearching('end')} />
            <Link
              label={t('onboarding.destination.changeHome')}
              onPress={() => setSearching('home')}
              muted
            />
          </View>
        </>
      )}
    </OnboardingFrame>
  );
}

function Link({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={[styles.link, { color: muted ? colors.textSecondary : colors.blueText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  links: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  link: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  error: { fontFamily: fonts.textMedium, fontSize: 14, textAlign: 'center' },
});

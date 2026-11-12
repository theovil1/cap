import { Bluetooth, CalendarDays, Footprints, Route as RouteIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { formatDate, formatNumber } from '@/i18n/format';
import { RouteMap } from '@/map/route-map';
import { useSession } from '@/session/session-context';
import { fonts, useColors, useShadows } from '@/theme';
import { Grain } from '@/ui/grain';
import { Button } from '@/ui/primitives';

import { arrivalDate, type Draft } from '../draft';
import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { SummaryRow } from '../parts';

/** Étape 7: the route on a map and the choices made, then the first journey starts. */
export function ReadyStep({
  nav,
  draft,
  start,
  starting,
  error,
}: {
  nav: FrameNav;
  draft: Draft;
  start: () => void;
  starting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const { user } = useAuth();
  const { connection } = useSession();
  const arrival = arrivalDate(draft);
  const { home, destination, route } = draft;
  const name = draft.firstName.trim() || user?.first_name || '';

  return (
    <OnboardingFrame
      {...nav}
      footer={
        <>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Button
            tone="accent"
            title={t('onboarding.ready.start')}
            onPress={start}
            loading={starting}
          />
        </>
      }
    >
      <Headline
        kicker={t('onboarding.ready.kicker', { name })}
        title={t('onboarding.ready.title')}
        text={
          home && route
            ? t('onboarding.ready.text', { town: home.name })
            : t('onboarding.ready.textNoRoute')
        }
      />
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          shadows.card,
        ]}
      >
        {route ? (
          <View style={[styles.map, { backgroundColor: colors.inset }]} pointerEvents="none">
            <RouteMap
              path={route.path}
              walkedM={0}
              stages={route.stages}
              mode="overview"
              initial={name}
              padding={{ top: 30, bottom: 30, left: 40, right: 40 }}
              style={StyleSheet.absoluteFill}
            />
            <Grain on="picture" />
          </View>
        ) : null}
        <View style={route ? styles.rows : undefined}>
          {home && destination && route ? (
            <SummaryRow
              icon={RouteIcon}
              tone="accent"
              label={t('onboarding.ready.route')}
              value={`${home.name} → ${destination.name}`}
            />
          ) : null}
          <SummaryRow
            icon={Footprints}
            tone="blue"
            label={t('onboarding.ready.goal')}
            value={t('onboarding.perDay', { steps: formatNumber(draft.goal) })}
          />
          {arrival && route ? (
            <SummaryRow
              icon={CalendarDays}
              tone="green"
              label={t('onboarding.ready.arrival')}
              value={t('onboarding.ready.around', {
                date: formatDate(arrival, { day: 'numeric', month: 'long' }),
              })}
            />
          ) : null}
          <SummaryRow
            icon={Bluetooth}
            tone="plain"
            label={t('onboarding.ready.treadmill')}
            value={
              connection.status === 'connected' && connection.deviceName
                ? connection.deviceName
                : t('treadmill.none')
            }
          />
        </View>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  map: { height: 200, marginHorizontal: -8, borderRadius: 18, overflow: 'hidden' },
  rows: { marginTop: 8 },
  error: { fontFamily: fonts.textMedium, fontSize: 14, textAlign: 'center' },
});

import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatKm, formatNumber, formatRank } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { Medal, type MedalFace } from '@/ui/medal';

import { ArrivalMedal } from './arrival-medal';
import type { EarnedMedal } from './medals';
import { journeyTitle } from './names';

/** A medal of the profile with its name under it. */
export function MedalView({ medal, width = 64 }: { medal: EarnedMedal; width?: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  let name: string;
  let detail: string | null = null;
  let face: MedalFace | undefined;
  switch (medal.kind) {
    case 'journey':
      name = journeyTitle(medal.journey);
      break;
    case 'distance':
      name = `${formatNumber(medal.km)} ${t('units.km')}`;
      face = { kind: 'number', value: formatNumber(medal.km), unit: 'KM' };
      if (medal.progress !== undefined) {
        detail = t('medals.progress', { percent: formatNumber(Math.floor(medal.progress * 100)) });
      }
      break;
    case 'streak':
      name = t('medals.streak', { count: medal.days });
      face = { kind: 'icon', icon: 'streak', label: t('medals.days', { count: medal.days }) };
      break;
    case 'race':
      name = journeyTitle(medal.journey);
      detail = t('medals.place', { place: formatRank(medal.place) });
      face =
        medal.place === 1
          ? { kind: 'number', value: formatRank(1), unit: t('medals.placeUnit') }
          : medal.place <= 3
            ? { kind: 'icon', icon: 'podium', label: formatRank(medal.place).toUpperCase() }
            : { kind: 'icon', icon: 'finish', label: t('medals.finished') };
      break;
  }
  return (
    <View style={[styles.item, { width: width + 26 }]}>
      {medal.kind === 'journey' ? (
        <ArrivalMedal
          lat={medal.journey.end.lat}
          lon={medal.journey.end.lon}
          distance={`${formatKm(medal.journey.route_distance_m, 0)} KM`}
          width={width}
          zoom={14}
          label={name}
        />
      ) : (
        <Medal
          metal={medal.metal}
          ribbon={medal.ribbon}
          face={face}
          progress={medal.kind === 'distance' ? medal.progress : undefined}
          width={width}
          label={name}
        />
      )}
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {name}
      </Text>
      {detail ? (
        <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.textSemiBold, fontSize: 12.5, lineHeight: 16, textAlign: 'center' },
  detail: { fontFamily: fonts.text, fontSize: 11.5, textAlign: 'center' },
});

import { CalendarDays } from 'lucide-react-native';
import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useUpdateProfile } from '@/api/profile';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { Tabs } from '@/ui/controls';
import { Button, Figure } from '@/ui/primitives';

import { arrivalDate, GOALS, goalMetres, PER_WEEK, RECOMMENDED_GOAL, type Draft } from '../draft';
import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { ChoiceCard, GroupLabel } from '../parts';

type Props = {
  nav: FrameNav;
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  next: () => void;
};

/** Étape 3: steps a day and sessions a week, with the arrival they lead to. */
export function GoalStep({ nav, draft, setDraft, next }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const update = useUpdateProfile();
  const arrival = arrivalDate(draft);

  const go = () => {
    update.mutate({ daily_step_goal: draft.goal, sessions_per_week: draft.perWeek });
    next();
  };

  return (
    <OnboardingFrame
      {...nav}
      footer={<Button tone="dark" title={t('onboarding.continue')} onPress={go} />}
    >
      <Headline
        kicker={t('onboarding.goal.kicker')}
        title={t('onboarding.goal.title')}
        text={t('onboarding.goal.text', { steps: formatNumber(RECOMMENDED_GOAL) })}
      />
      <View style={styles.list}>
        {GOALS.map((goal) => {
          const on = draft.goal === goal;
          return (
            <ChoiceCard
              key={goal}
              on={on}
              onPress={() => setDraft({ goal })}
              label={t('onboarding.perDay', { steps: formatNumber(goal) })}
            >
              <View style={styles.texts}>
                <View style={styles.figureRow}>
                  <Figure value={formatNumber(goal)} unit={t('onboarding.goal.steps')} size={24} />
                  {goal === RECOMMENDED_GOAL ? (
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.badgeText, { color: colors.onAccent }]}>
                        {t('onboarding.goal.recommended')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.detail, { color: colors.textSecondary }]}>
                  {t(`onboarding.goal.why${goal}`, {
                    km: formatKm(goalMetres(goal, draft.heightCm), 1),
                  })}
                </Text>
              </View>
            </ChoiceCard>
          );
        })}
      </View>
      <View style={styles.group}>
        <GroupLabel>{t('onboarding.goal.perWeek')}</GroupLabel>
        <Tabs
          options={PER_WEEK.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(draft.perWeek)}
          onChange={(value) => setDraft({ perWeek: Number(value) })}
        />
      </View>
      {arrival && draft.destination ? (
        <View style={[styles.banner, { backgroundColor: colors.successSoft }]}>
          <CalendarDays size={20} color={colors.success} strokeWidth={2} />
          <Text style={[styles.bannerText, { color: colors.text }]}>
            <Trans
              i18nKey="onboarding.goal.arrival"
              values={{
                place: draft.destination.name,
                date: formatDate(arrival, { day: 'numeric', month: 'long' }),
              }}
              components={{ b: <Text style={styles.bold} /> }}
            />
          </Text>
        </View>
      ) : null}
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  texts: { gap: 3 },
  figureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.textBold, fontSize: 11 },
  detail: { fontFamily: fonts.text, fontSize: 13 },
  group: { gap: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  bannerText: { flex: 1, fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  bold: { fontFamily: fonts.textSemiBold },
});

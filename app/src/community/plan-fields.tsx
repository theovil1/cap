import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { ActionMenu, type MenuItem } from '@/ui/action-menu';
import { formatDate } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { Toggle } from '@/ui/controls';
import { Card } from '@/ui/primitives';

const DAY_MS = 86_400_000;
/** Start hours offered, every half hour from 6:00 to 22:00. */
const HOURS = Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30);
/** How long walkers can sign up and walk, in days. */
const LENGTHS = [1, 3, 7, 14, 30, 60];

export type Plan = { on: boolean; startsAt: Date; endsAt: Date };

/** Start in a week at 9:00, open for a month. */
export function usePlan(): [Plan, (plan: Plan) => void] {
  const [plan, setPlan] = useState<Plan>(() => {
    const start = new Date(Date.now() + 7 * DAY_MS);
    start.setHours(9, 0, 0, 0);
    return { on: false, startsAt: start, endsAt: new Date(start.getTime() + 30 * DAY_MS) };
  });
  return [plan, setPlan];
}

/** The "Trajet planifié" card: switch, day, hour and how long it stays open. */
export function PlanFields({
  plan,
  onChange,
  alwaysOn,
}: {
  plan: Plan;
  onChange: (plan: Plan) => void;
  /** Scheduling an existing public route: no switch. */
  alwaysOn?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const lengthDays = Math.round((plan.endsAt.getTime() - plan.startsAt.getTime()) / DAY_MS);
  const withStart = (start: Date) =>
    onChange({ ...plan, startsAt: start, endsAt: new Date(start.getTime() + lengthDays * DAY_MS) });

  // The next thirty days, the usual hours, the usual lengths; the current one ticked.
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(plan.startsAt);
    const today = new Date();
    d.setFullYear(today.getFullYear(), today.getMonth(), today.getDate() + i + 1);
    return d;
  });
  const dayItems: MenuItem[] = days.map((d) => ({
    label: formatDate(d, { weekday: 'short', day: 'numeric', month: 'long' }),
    checked: d.toDateString() === plan.startsAt.toDateString(),
    onPress: () => withStart(d),
  }));
  const startMinutes = plan.startsAt.getHours() * 60 + plan.startsAt.getMinutes();
  const hourItems: MenuItem[] = HOURS.map((m) => {
    const d = new Date(plan.startsAt);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return {
      label: formatDate(d, { hour: 'numeric', minute: '2-digit' }),
      checked: m === startMinutes,
      onPress: () => withStart(d),
    };
  });
  const lengthItems: MenuItem[] = LENGTHS.map((n) => ({
    label: t('plan.days', { count: n }),
    checked: n === lengthDays,
    onPress: () => onChange({ ...plan, endsAt: new Date(plan.startsAt.getTime() + n * DAY_MS) }),
  }));

  const tile = (label: string, items: MenuItem[], a11y: string, inRow = true) => (
    <ActionMenu title={a11y} items={items} label={a11y} style={inRow ? styles.flex : undefined}>
      <View style={[styles.tile, { backgroundColor: colors.inset }]}>
        <Text style={[styles.tileText, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </ActionMenu>
  );

  return (
    <Card small style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.blueSoft }]}>
          <CalendarDays size={19} color={colors.blueText} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>{t('plan.title')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('plan.sub')}</Text>
        </View>
        {alwaysOn ? null : (
          <Toggle
            value={plan.on}
            onChange={(on) => onChange({ ...plan, on })}
            label={t('plan.title')}
          />
        )}
      </View>
      {plan.on || alwaysOn ? (
        <>
          <View style={styles.tiles}>
            {tile(
              formatDate(plan.startsAt, { weekday: 'short', day: 'numeric', month: 'long' }),
              dayItems,
              t('plan.day'),
            )}
            {tile(
              formatDate(plan.startsAt, { hour: 'numeric', minute: '2-digit' }),
              hourItems,
              t('plan.hour'),
            )}
          </View>
          {tile(t('plan.openFor', { count: lengthDays }), lengthItems, t('plan.length'), false)}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  sub: { fontFamily: fonts.text, fontSize: 12.5 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tileText: { fontFamily: fonts.textSemiBold, fontSize: 15, textTransform: 'capitalize' },
});

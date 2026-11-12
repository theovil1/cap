import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useStartJourney } from '@/api/queries';
import { formatNumber } from '@/i18n/format';
import { RECOMMENDED_GOAL, type Draft } from '@/onboarding/draft';
import type { FrameNav } from '@/onboarding/frame';
import type { SideKey, SideRow } from '@/onboarding/side-panel';
import { allowBluetooth, finishOnboarding } from '@/onboarding/state';
import { BluetoothStep } from '@/onboarding/steps/bluetooth';
import { DestinationStep } from '@/onboarding/steps/destination';
import { GoalStep } from '@/onboarding/steps/goal';
import { MoodStep } from '@/onboarding/steps/mood';
import { ProfileStep } from '@/onboarding/steps/profile';
import { ReadyStep } from '@/onboarding/steps/ready';
import { TreadmillStep } from '@/onboarding/steps/treadmill';
import { useSession } from '@/session/session-context';

/** The six steps listed on iPad; the seventh is the summary. */
const KEYS: SideKey[] = ['destination', 'profile', 'goal', 'mood', 'bluetooth', 'treadmill'];
const READY = 7;
const BLUETOOTH = 5;

/**
 * The onboarding of a new walker, after the welcome screen: destination,
 * profile, goal, mood, Bluetooth, treadmill, then the summary that starts
 * the first journey.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { connection } = useSession();
  const startJourney = useStartJourney();
  // Steps walked through, for "back" (skipping Bluetooth also skips the treadmill).
  const [path, setPath] = useState<number[]>([1]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraftState] = useState<Draft>(() => ({
    home: null,
    destination: null,
    route: null,
    firstName: user?.first_name ?? '',
    heightCm: user?.height_cm ?? 170,
    photo: null,
    goal: RECOMMENDED_GOAL,
    perWeek: user?.sessions_per_week ?? 3,
  }));
  const setDraft = (patch: Partial<Draft>) => setDraftState((d) => ({ ...d, ...patch }));
  const step = path[path.length - 1];

  const goTo = (target: number) => setPath((p) => [...p, target]);
  const next = () => goTo(step + 1);
  const back = () => {
    if (path.length > 1) setPath((p) => p.slice(0, -1));
    // Back from the first step leaves the new account for the welcome screen.
    else signOut().catch(() => {});
  };

  // The layout then leaves the onboarding for the home screen.
  const done = () => finishOnboarding();
  const start = () => {
    if (!draft.route) {
      done();
      return;
    }
    setError(null);
    startJourney.mutate(draft.route.id, {
      onSuccess: done,
      onError: (e) =>
        setError(
          e instanceof ApiError
            ? t(`errors.${e.code}`, { defaultValue: t('errors.generic') })
            : t('errors.network'),
        ),
    });
  };

  const values: Record<SideKey, string | undefined> = {
    destination:
      draft.home && draft.destination && draft.route
        ? `${draft.home.name} → ${draft.destination.name}`
        : undefined,
    profile: draft.firstName.trim()
      ? t('onboarding.side.profileValue', { name: draft.firstName.trim(), cm: draft.heightCm })
      : undefined,
    goal: t('onboarding.perDay', { steps: formatNumber(draft.goal) }),
    mood: t('onboarding.side.moodValue', {
      color: t(`onboarding.side.colors.${user?.app_color ?? 'orange'}`),
      mood: t(`onboarding.side.moods.${user?.map_mood ?? 'auto'}`),
    }),
    bluetooth: path.includes(BLUETOOTH + 1) ? t('onboarding.side.allowed') : undefined,
    treadmill: connection.status === 'connected' ? (connection.deviceName ?? undefined) : undefined,
  };
  const side: SideRow[] = KEYS.map((key, index) => ({
    key,
    state: index + 1 < step ? 'done' : index + 1 === step ? 'current' : 'todo',
    value: values[key],
  }));
  const nav: FrameNav = {
    step,
    onBack: back,
    onSkip: step < READY ? () => goTo(step === BLUETOOTH ? READY : step + 1) : undefined,
    side,
  };

  switch (step) {
    case 1:
      return <DestinationStep nav={nav} draft={draft} setDraft={setDraft} next={next} />;
    case 2:
      return <ProfileStep nav={nav} draft={draft} setDraft={setDraft} next={next} />;
    case 3:
      return <GoalStep nav={nav} draft={draft} setDraft={setDraft} next={next} />;
    case 4:
      return <MoodStep nav={nav} next={next} />;
    case 5:
      return (
        <BluetoothStep
          nav={nav}
          allow={() => {
            allowBluetooth();
            next();
          }}
        />
      );
    case 6:
      return <TreadmillStep nav={nav} next={next} />;
    default:
      return (
        <ReadyStep
          nav={nav}
          draft={draft}
          start={start}
          starting={startJourney.isPending}
          error={error}
        />
      );
  }
}

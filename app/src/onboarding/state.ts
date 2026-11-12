import { useSyncExternalStore } from 'react';

import { getValue, setValue } from '@/session/store';

/**
 * Whether the signed-in walker still has the onboarding to go through, and
 * whether its Bluetooth step has been reached (iOS asks for Bluetooth only then).
 * Kept on the phone so a closed app comes back to the onboarding.
 */
type OnboardingState = { pending: boolean; bluetooth: boolean };

const KEY = 'onboarding';
const DONE: OnboardingState = { pending: false, bluetooth: true };
/** An Apple account created this recently is a new walker, not a returning one. */
const NEW_ACCOUNT_MS = 10 * 60_000;

let current: OnboardingState | undefined;
const listeners = new Set<() => void>();

function read(): OnboardingState {
  if (current === undefined) current = getValue<OnboardingState>(KEY) ?? DONE;
  return current;
}

function write(next: OnboardingState) {
  current = next;
  setValue(KEY, next);
  listeners.forEach((listener) => listener());
}

/** A new account: the onboarding opens and Bluetooth waits for its step. */
export function startOnboarding() {
  write({ pending: true, bluetooth: false });
}

/** iOS may ask for Bluetooth now. */
export function allowBluetooth() {
  write({ ...read(), bluetooth: true });
}

export function finishOnboarding() {
  write(DONE);
}

/** Forgets the state after the local data was wiped (sign out). */
export function resetOnboarding() {
  current = undefined;
  listeners.forEach((listener) => listener());
}

export function isNewAccount(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now - created < NEW_ACCOUNT_MS;
}

export function useOnboarding(): OnboardingState {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, read);
}

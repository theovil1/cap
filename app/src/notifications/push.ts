import { requireOptionalNativeModule } from 'expo';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api/client';
import { getValue, setValue } from '@/session/store';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Push needs a development build that includes expo-notifications: older builds
 * keep working without it instead of failing at start.
 */
const Notifications: NotificationsModule | null = requireOptionalNativeModule(
  'ExpoPushTokenManager',
)
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule)
  : null;

/** The token this phone registered, to remove it at sign-out. */
const TOKEN_KEY = 'pushToken';

// A notification that arrives while Cap is open still shows as a banner.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks iOS for permission (once) and gives the server this phone's token, so it
 * can tell the walker about races, friends and the feed. Quiet when refused.
 */
export async function registerForPush(): Promise<void> {
  if (!Notifications) return;
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  if (typeof token !== 'string') return;
  // Development builds get their tokens from Apple's sandbox.
  await api('/me/devices', { method: 'POST', body: { token, sandbox: __DEV__ } });
  setValue(TOKEN_KEY, token);
}

/** Before signing out: this phone stops getting the account's notifications. */
export async function unregisterForPush(): Promise<void> {
  const token = getValue<string>(TOKEN_KEY);
  if (!token) return;
  await api(`/me/devices/${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(() => {});
}

type Response = Awaited<ReturnType<NotificationsModule['getLastNotificationResponseAsync']>>;

/** Opens the screen a notification is about, when it is tapped. */
function open(response: NonNullable<Response>) {
  // The server puts the path at the top of the payload and under `body`, where
  // expo-notifications may look for the data.
  const data = response.notification.request.content.data ?? {};
  const nested = data.body as { path?: unknown } | undefined;
  const path = typeof data.path === 'string' ? data.path : nested?.path;
  if (typeof path === 'string' && path.startsWith('/')) router.push(path as Href);
}

/**
 * Registers the phone once signed in (when the walker wants notifications) and
 * follows taps, including the one that launched the app.
 */
export function usePushNotifications(ready: boolean, wanted: boolean): void {
  useEffect(() => {
    if (ready && wanted) registerForPush().catch(() => {});
  }, [ready, wanted]);

  useEffect(() => {
    if (!Notifications || !ready) return;
    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        if (last) {
          open(last);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);
}

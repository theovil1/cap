import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  focusManager,
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/api/auth';
import '@/i18n';
import '@/map/logs';
import { usePushNotifications } from '@/notifications/push';
import { useOnboarding } from '@/onboarding/state';
import { SessionProvider } from '@/session/session-context';
import { useColors } from '@/theme';
import { useWide } from '@/ui/layout';
import { useWindowControlsInset } from '@/ui/window-controls';

SplashScreen.preventAutoHideAsync();

// Coming back to the app refreshes what is on screen (friend requests, feed...).
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) =>
    setFocused(state === 'active'),
  );
  return () => subscription.remove();
});

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // A new filter or page keeps the previous list on screen until its own
          // arrives, instead of flashing an empty state.
          queries: { retry: 1, staleTime: 30_000, placeholderData: keepPreviousData },
        },
      }),
  );
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProvider>
          <StatusBar style="auto" />
          <WindowSafeArea>
            <Screens />
          </WindowSafeArea>
        </SessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** In an iPadOS window, the top safe area also clears the window buttons. */
function WindowSafeArea({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const extra = useWindowControlsInset();
  const value = useMemo(
    () => (extra ? { ...insets, top: insets.top + extra } : insets),
    [insets, extra],
  );
  return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}

function Screens() {
  const { status, user } = useAuth();
  const { pending } = useOnboarding();
  // Asked once the walker is in the app, not during the onboarding.
  usePushNotifications(status === 'signedIn' && !pending, user?.notifications ?? false);
  const colors = useColors();
  // iPad: the treadmill setup is a full screen, as in its mockup.
  const wide = useWide();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);
  if (status === 'loading') return null;

  return (
    <Stack
      // Signing in or out starts the navigation afresh: a session that turns out to be
      // expired would otherwise leave an empty screen where the tabs were.
      key={status === 'signedIn' ? (pending ? 'onboarding' : 'app') : 'signed-out'}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={status === 'signedIn' && pending}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && !pending}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-journey" />
        <Stack.Screen name="preview" />
        <Stack.Screen
          name="session"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen name="summary" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="friends" />
        <Stack.Screen name="race/[id]" />
        <Stack.Screen name="account" />
        <Stack.Screen name="history" />
        <Stack.Screen name="manual-session" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stride" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="arrival" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="treadmill"
          options={{ presentation: wide ? 'fullScreenModal' : 'modal' }}
        />
        <Stack.Screen name="me" />
        <Stack.Screen name="walker/[id]" />
        <Stack.Screen name="public-route/[id]" />
        <Stack.Screen name="publish" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="event-live/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="post-session" options={{ presentation: 'modal' }} />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="country" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
    </Stack>
  );
}

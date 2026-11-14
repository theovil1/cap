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
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { AuthProvider, useAuth } from '@/api/auth';
import '@/i18n';
import { useOnboarding } from '@/onboarding/state';
import { SessionProvider } from '@/session/session-context';
import { useColors } from '@/theme';

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
          <Screens />
        </SessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Screens() {
  const { status } = useAuth();
  const { pending } = useOnboarding();
  const colors = useColors();

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
        <Stack.Screen name="treadmill" options={{ presentation: 'modal' }} />
        <Stack.Screen name="me" />
        <Stack.Screen name="walker/[id]" />
        <Stack.Screen name="public-route/[id]" />
        <Stack.Screen name="publish" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="event-live/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="country" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
    </Stack>
  );
}

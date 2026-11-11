import { Tabs } from 'expo-router';

import { FloatingNav } from '@/ui/floating-nav';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingNav {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="journeys" />
      <Tabs.Screen name="rankings" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

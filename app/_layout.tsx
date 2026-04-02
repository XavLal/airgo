import '../src/tasks/spotSyncTask';
import '../src/lib/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { bootstrapLocalSpotsData } from '../src/lib/localDb/bootstrap';
import { ThemeProvider, useTheme } from '../src/theme';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      void bootstrapLocalSpotsData();
    }
  }, []);

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { resolvedMode } = useTheme();

  return (
    <>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-spot" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="spot/[id]" options={{ headerShown: true, title: '' }} />
      </Stack>
    </>
  );
}

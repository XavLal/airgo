import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Carte',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Liste',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}

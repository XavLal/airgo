import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

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
      <Tabs.Screen name="index" options={{ title: t('tabs.map'), tabBarIcon: () => null }} />
      <Tabs.Screen name="list" options={{ title: t('tabs.list'), tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: () => null }} />
    </Tabs>
  );
}

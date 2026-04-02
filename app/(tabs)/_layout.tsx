import { Tabs } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme';
import { TabBarIcon, type TabBarIconName } from '../../src/components/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const renderTabIcon = useCallback(
    ({ name, color, size }: { name: TabBarIconName; color: string; size: number }) => (
      <TabBarIcon name={name} color={color} size={size} />
    ),
    [],
  );

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
          title: t('tabs.map'),
          tabBarIcon: ({ color, size }) => renderTabIcon({ name: 'map', color, size }),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: t('tabs.list'),
          tabBarIcon: ({ color, size }) => renderTabIcon({ name: 'list', color, size }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => renderTabIcon({ name: 'profile', color, size }),
        }}
      />
    </Tabs>
  );
}

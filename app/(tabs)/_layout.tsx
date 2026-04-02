import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme';
import { TabBarIcon, type TabBarIconName } from '../../src/components/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  function tabIcon(name: TabBarIconName) {
    return ({ color, size }: { color: string; size: number }) => (
      <TabBarIcon name={name} color={color} size={size} />
    );
  }

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
          tabBarIcon: tabIcon('map'),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: t('tabs.list'),
          tabBarIcon: tabIcon('list'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: tabIcon('profile'),
        }}
      />
    </Tabs>
  );
}

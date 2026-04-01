import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Input } from '../../src/components/ui';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

export default function ProfileScreen() {
  const { colors, mode, setMode, toggleMode } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Theme Playground</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Base "ShadCN-like" : tokens + variants + composants UI
        </Text>

        <Input label="Pseudo" placeholder="Ex: VanLifeMax" hint="Composant Input themable" />

        <View style={styles.row}>
          <Button label="Primary" />
          <Button label="Secondary" variant="secondary" />
        </View>
        <View style={styles.row}>
          <Button label="Ghost" variant="ghost" />
          <Button label="Danger" variant="danger" />
        </View>

        <View style={styles.row}>
          <Button label="Light" size="sm" onPress={() => setMode('light')} />
          <Button label="Dark" size="sm" onPress={() => setMode('dark')} />
          <Button label="System" size="sm" onPress={() => setMode('system')} />
        </View>

        <Text style={[styles.meta, { color: colors.textMuted }]}>Mode actuel: {mode}</Text>
        <Button label="Toggle Light/Dark" fullWidth onPress={toggleMode} />
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    ...Typography.caption,
  },
});

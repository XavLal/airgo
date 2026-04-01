import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography, useTheme } from '../../src/theme';

export default function ListScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>📋 Liste</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aires triées par proximité — Phase 4</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  title: { ...Typography.title },
  subtitle: { ...Typography.subtitle },
});

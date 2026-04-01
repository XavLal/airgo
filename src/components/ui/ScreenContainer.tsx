import { View, StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Spacing } from '../../theme';

type ScreenContainerProps = ViewProps & {
  padded?: boolean;
};

export function ScreenContainer({ padded = true, style, children, ...props }: ScreenContainerProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View
        {...props}
        style={[
          styles.content,
          padded ? { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md } : null,
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 },
});

import { TextInput, View, Text, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { Radius, Spacing, Typography } from '../../theme';

type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, style, ...props }: InputProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
          },
          style,
        ]}
      />
      {error ? <Text style={[styles.meta, { color: colors.error }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  meta: {
    ...Typography.caption,
  },
});

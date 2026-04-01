import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Radius, Spacing, Typography } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles = {
    primary: { bg: colors.primary, text: '#FFFFFF', border: colors.primary },
    secondary: { bg: colors.surface, text: colors.textPrimary, border: colors.border },
    ghost: { bg: 'transparent', text: colors.textPrimary, border: 'transparent' },
    danger: { bg: colors.error, text: '#FFFFFF', border: colors.error },
  } as const;

  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontSize: 13 },
    md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, fontSize: 15 },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, fontSize: 16 },
  } as const;

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: vs.bg,
          borderColor: vs.border,
          paddingVertical: ss.paddingVertical,
          paddingHorizontal: ss.paddingHorizontal,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: vs.text, fontSize: ss.fontSize }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.body,
    fontWeight: '600',
  },
});

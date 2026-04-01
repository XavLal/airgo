import { Text, View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '../../theme';
import { Radius, Spacing, Typography } from '../../theme';

type BadgeVariant = 'default' | 'service' | 'parking' | 'farm' | 'success' | 'warning' | 'danger';

type BadgeProps = ViewProps & {
  label: string;
  variant?: BadgeVariant;
};

export function Badge({ label, variant = 'default', style, ...props }: BadgeProps) {
  const { colors } = useTheme();

  const variants = {
    default: { bg: colors.surfaceMuted, text: colors.textSecondary, border: colors.border },
    service: { bg: colors.serviceSurface, text: colors.service, border: colors.service },
    parking: { bg: colors.parkingSurface, text: colors.parking, border: colors.parking },
    farm: { bg: colors.farmSurface, text: colors.farm, border: colors.farm },
    success: { bg: colors.primarySurface, text: colors.verified, border: colors.verified },
    warning: { bg: colors.farmSurface, text: colors.unverified, border: colors.unverified },
    danger: { bg: colors.surface, text: colors.error, border: colors.error },
  } as const;

  const v = variants[variant];

  return (
    <View
      {...props}
      style={[
        styles.container,
        { backgroundColor: v.bg, borderColor: v.border },
        style,
      ]}
    >
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

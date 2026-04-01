import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '../../theme';
import { Radius, Spacing } from '../../theme';

type CardProps = ViewProps & {
  elevated?: boolean;
  padded?: boolean;
};

export function Card({ elevated = false, padded = true, style, ...props }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: padded ? Spacing.lg : 0,
          shadowOpacity: elevated ? 0.12 : 0,
          elevation: elevated ? 2 : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
});

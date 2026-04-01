import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '../../theme';

type SeparatorProps = ViewProps & {
  orientation?: 'horizontal' | 'vertical';
};

export function Separator({ orientation = 'horizontal', style, ...props }: SeparatorProps) {
  const { colors } = useTheme();
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: colors.border,
          height: isHorizontal ? StyleSheet.hairlineWidth : '100%',
          width: isHorizontal ? '100%' : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    opacity: 0.9,
  },
});

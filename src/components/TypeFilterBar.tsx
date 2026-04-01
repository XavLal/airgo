import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SPOT_TYPE_CODES } from '../constants/spotTypes';
import { Radius, Spacing, useTheme } from '../theme';

type TypeFilterBarProps = {
  /** `null` = tous les types */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
};

export function TypeFilterBar({ value, onChange }: TypeFilterBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const allSelected = value === null;

  const toggleAll = () => onChange(null);

  const toggleType = (code: (typeof SPOT_TYPE_CODES)[number]) => {
    if (value === null) {
      onChange(SPOT_TYPE_CODES.filter((c) => c !== code));
      return;
    }
    const next = new Set(value);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    const arr = Array.from(next) as string[];
    if (arr.length === 0 || arr.length === SPOT_TYPE_CODES.length) onChange(null);
    else onChange(arr);
  };

  const chipStyle = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? colors.primarySurface : colors.surfaceMuted,
      borderColor: active ? colors.primary : colors.border,
    },
  ];

  const labelStyle = (active: boolean) => ({
    color: active ? colors.primary : colors.textSecondary,
    fontWeight: active ? '700' as const : '500' as const,
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable onPress={toggleAll} style={chipStyle(allSelected)}>
        <Text style={labelStyle(allSelected)}>{t('filters.all')}</Text>
      </Pressable>
      {SPOT_TYPE_CODES.map((code) => {
        const active = allSelected || (value?.includes(code) ?? false);
        return (
          <Pressable key={code} onPress={() => toggleType(code)} style={chipStyle(active)}>
            <Text style={labelStyle(active)}>
              {code} · {t(`spotTypes.${code}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});

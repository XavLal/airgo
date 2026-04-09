import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SPOT_TYPE_CODES } from '../constants/spotTypes';
import { Radius, Spacing, useTheme } from '../theme';

type TypeFilterBarProps = {
  /** `null` = tous les types */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /**
   * `scroll` (défaut) : chips horizontaux défilants — pour l'écran liste.
   * `list`            : toggles empilés verticalement — pour le panneau carte.
   */
  variant?: 'scroll' | 'list';
};

export function TypeFilterBar({ value, onChange, variant = 'scroll' }: TypeFilterBarProps) {
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

  const chipBg = (active: boolean) => ({
    backgroundColor: active ? colors.primarySurface : colors.surfaceMuted,
    borderColor: active ? colors.primary : colors.border,
  });

  const labelColor = (active: boolean): { color: string; fontWeight: '700' | '500' } => ({
    color: active ? colors.primary : colors.textSecondary,
    fontWeight: active ? '700' : '500',
  });

  if (variant === 'list') {
    return (
      <View style={styles.listContainer}>
        {/* Bouton "Tous" */}
        <Pressable
          onPress={toggleAll}
          style={[styles.listRow, chipBg(allSelected)]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allSelected }}
        >
          <View style={[styles.dot, { backgroundColor: allSelected ? colors.primary : colors.border }]} />
          <Text style={[styles.listLabel, labelColor(allSelected)]}>{t('filters.all')}</Text>
        </Pressable>

        {SPOT_TYPE_CODES.map((code) => {
          const active = allSelected || (value?.includes(code) ?? false);
          return (
            <Pressable
              key={code}
              onPress={() => toggleType(code)}
              style={[styles.listRow, chipBg(active)]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <View style={[styles.dot, { backgroundColor: active ? colors.primary : colors.border }]} />
              <Text style={[styles.listLabel, labelColor(active)]}>{t(`spotTypes.${code}`)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
      <Pressable onPress={toggleAll} style={[styles.chip, chipBg(allSelected)]}>
        <Text style={[styles.chipLabel, labelColor(allSelected)]}>{t('filters.all')}</Text>
      </Pressable>
      {SPOT_TYPE_CODES.map((code) => {
        const active = allSelected || (value?.includes(code) ?? false);
        return (
          <Pressable key={code} onPress={() => toggleType(code)} style={[styles.chip, chipBg(active)]}>
            <Text style={[styles.chipLabel, labelColor(active)]}>{t(`spotTypes.${code}`)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* ── Variante scroll ── */
  scrollRow: {
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
  chipLabel: {
    fontSize: 13,
  },

  /* ── Variante list ── */
  listContainer: {
    gap: Spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listLabel: {
    fontSize: 13,
    flexShrink: 1,
  },
});

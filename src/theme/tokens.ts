export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const Typography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
} as const;

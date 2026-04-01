export const Colors = {
  // Verts nature — couleurs principales
  primary: '#2D6A4F',
  primaryLight: '#4ADE80',
  primaryDark: '#1A4035',
  primarySurface: '#F0F7F2',

  // Bleu service
  service: '#2563EB',
  serviceSurface: '#EFF6FF',

  // Violet parking
  parking: '#7C3AED',
  parkingSurface: '#F5F3FF',

  // Ambre ferme
  farm: '#D97706',
  farmSurface: '#FFFBEB',

  // Neutres
  background: '#F8FAF8',
  surface: '#FFFFFF',
  border: '#E4EBE6',
  textPrimary: '#1A2E22',
  textSecondary: '#5C7A65',
  textMuted: '#9AB0A0',

  // États
  verified: '#16A34A',
  unverified: '#F59E0B',
  error: '#DC2626',
} as const;

export type ColorKey = keyof typeof Colors;

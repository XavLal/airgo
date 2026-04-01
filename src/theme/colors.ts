export type ThemeColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primarySurface: string;
  service: string;
  serviceSurface: string;
  parking: string;
  parkingSurface: string;
  farm: string;
  farmSurface: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  verified: string;
  unverified: string;
  error: string;
};

export const LightColors: ThemeColors = {
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
  backgroundAlt: '#EEF3EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F7F4',
  border: '#E4EBE6',
  textPrimary: '#1A2E22',
  textSecondary: '#5C7A65',
  textMuted: '#9AB0A0',

  // États
  verified: '#16A34A',
  unverified: '#F59E0B',
  error: '#DC2626',
};

export const DarkColors: ThemeColors = {
  primary: '#4ADE80',
  primaryLight: '#86EFAC',
  primaryDark: '#2D6A4F',
  primarySurface: '#1A2E22',
  service: '#60A5FA',
  serviceSurface: '#1D293A',
  parking: '#A78BFA',
  parkingSurface: '#2A2145',
  farm: '#F59E0B',
  farmSurface: '#3D3018',
  background: '#0F1712',
  backgroundAlt: '#16211A',
  surface: '#18221B',
  surfaceMuted: '#1D2921',
  border: '#2B3A30',
  textPrimary: '#E4F2E8',
  textSecondary: '#B4C9BC',
  textMuted: '#819888',
  verified: '#22C55E',
  unverified: '#F59E0B',
  error: '#F87171',
};

// Backward-compatible export for existing imports.
export const Colors = LightColors;

export type ColorKey = keyof typeof Colors;

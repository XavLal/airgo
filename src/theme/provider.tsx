import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors, type ThemeColors } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  colors: ThemeColors;
  resolvedMode: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemMode = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (mode === 'system') return systemMode === 'dark' ? 'dark' : 'light';
    return mode;
  }, [mode, systemMode]);

  const colors = resolvedMode === 'dark' ? DarkColors : LightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      resolvedMode,
      mode,
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [colors, mode, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type TabBarIconName = 'map' | 'list' | 'profile';

export function TabBarIcon({ name, color, size }: { name: TabBarIconName; color: string; size: number }) {
  const strokeWidth = Math.max(1.8, size / 12);
  const commonStroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (name === 'map') {
    // Pin + grille minimale
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 21s-7-4.35-7-10a7 7 0 0 1 14 0c0 5.65-7 10-7 10Z"
          {...commonStroke}
        />
        <Path d="M10 11l1.2 1.2L14.5 9" {...commonStroke} />
        <Path d="M8 14h8" {...commonStroke} opacity={0.6} />
      </Svg>
    );
  }

  if (name === 'list') {
    // Document + lignes
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M7 3h10v18H7z" {...commonStroke} />
        <Line x1="9" y1="7" x2="15" y2="7" {...commonStroke} />
        <Line x1="9" y1="11" x2="15" y2="11" {...commonStroke} opacity={0.8} />
        <Line x1="9" y1="15" x2="13" y2="15" {...commonStroke} opacity={0.6} />
      </Svg>
    );
  }

  // profile
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" {...commonStroke} />
      <Path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" {...commonStroke} />
    </Svg>
  );
}


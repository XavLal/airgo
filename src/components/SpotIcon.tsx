import React from 'react';
import Svg, { Path, Rect, Circle, Line, Text, Ellipse, G } from 'react-native-svg';

export type SpotType = 'AA' | 'AC' | 'APN' | 'ACF' | 'ACS' | 'AS' | 'ASN' | 'APCC' | 'OTHER';

/**
 * variant:
 *  'icon'  — transparent, pour listes / fiches détail (défaut)
 *  'badge' — fond solide arrondi, pour cards et tab bar
 *  'pin'   — épingle de carte avec fond solide + pointe, pour react-native-maps
 */
export type SpotIconVariant = 'icon' | 'badge' | 'pin';

interface SpotIconProps {
  type: SpotType;
  size?: number;
  color?: string;
  variant?: SpotIconVariant;
}

export const SPOT_TYPE_LABELS: Record<SpotType, string> = {
  AA:    'Aire sur Autoroute',
  AC:    'Aire de Camping',
  APN:   'Parking Toléré Nuit',
  ACF:   'Accueil à la Ferme',
  ACS:   'Service sur Camping',
  AS:    'Aire de Service',
  ASN:   'Service + Stationnement Nuit',
  APCC:  'Parking Camping-Car Dédié',
  OTHER: 'Autre',
};

const PALETTE: Record<SpotType, { s: string; f: string; bg: string }> = {
  AS:    { s: '#60A5FA', f: '#1E3A5F', bg: '#0c1e35' },
  AA:    { s: '#4ADE80', f: '#1A3D26', bg: '#0d1a12' },
  ACS:   { s: '#4ADE80', f: '#166534', bg: '#0d1a12' },
  ASN:   { s: '#60A5FA', f: '#1E3A5F', bg: '#060c14' },
  AC:    { s: '#4ADE80', f: '#166534', bg: '#0d1a12' },
  ACF:   { s: '#86EFAC', f: '#2D3A10', bg: '#111806' },
  APCC:  { s: '#A78BFA', f: '#2D1F5E', bg: '#060410' },
  APN:   { s: '#94A3B8', f: '#1E2A3A', bg: '#060a0f' },
  OTHER: { s: '#9CA3AF', f: '#374151', bg: '#111827' },
};

// ─── Brique de base : service station (robinet + cassette → vidange) ────────
// Réutilisée dans AS, AA, ACS, ASN.
// Gauche = robinet eau propre | Droite = cassette WC → trou de vidange

function ServiceStation({ s, f }: { s: string; f: string }) {
  return (
    <>
      {/* ── Robinet (gauche) ─────────────────── */}
      {/* Corps vertical */}
      <Rect x="8" y="5" width="5" height="22" rx="2.5" fill={f} stroke={s} strokeWidth="1.8" />
      {/* Poignée horizontale */}
      <Rect x="5" y="13" width="11" height="3.5" rx="1.75" fill={s} />
      {/* Bec coudé (L-shape) */}
      <Path d="M13 23H20Q20 23 20 27" stroke={s} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Goutte principale */}
      <Path d="M20 30C20 33 17.5 36 17.5 36C17.5 36 15 33 15 30C15 27.5 17.5 26 17.5 26C17.5 26 20 27.5 20 30Z" fill={s} />
      {/* Goutte secondaire */}
      <Ellipse cx="18.5" cy="40" rx="2" ry="1.3" fill={s} fillOpacity="0.45" />

      {/* ── Séparateur vertical ───────────────── */}
      <Line x1="24" y1="3" x2="24" y2="46" stroke={s} strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="2,3" />

      {/* ── Cassette WC → vidange (droite) ───── */}
      {/* Corps cassette (portrait) */}
      <Rect x="27" y="7" width="14" height="18" rx="2.5" fill={f} stroke={s} strokeWidth="1.8" />
      {/* Poignée cassette (haut-centre) */}
      <Rect x="31" y="3.5" width="6" height="5" rx="1.5" fill={f} stroke={s} strokeWidth="1.5" />
      {/* Vagues intérieures (eaux grises/noires) */}
      <Path d="M30 13Q32 11.5 34 13Q36 14.5 38 13" stroke={s} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
      <Path d="M30 17Q32 15.5 34 17Q36 18.5 38 17" stroke={s} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeOpacity="0.5" />
      {/* Bec de vidange (bas cassette) */}
      <Rect x="32" y="25" width="4" height="4" rx="1" fill={f} stroke={s} strokeWidth="1.4" />
      {/* Flèche vers le bas */}
      <Line x1="34" y1="31" x2="34" y2="36.5" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <Path d="M30.5 35L34 39.5L37.5 35" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Trou de vidange au sol */}
      <Ellipse cx="34" cy="43.5" rx="5" ry="2.5" fill={f} stroke={s} strokeWidth="1.5" />
    </>
  );
}

// ─── AS : Aire de service ────────────────────────────────────────────────────

function IconAS({ s, f }: { s: string; f: string }) {
  return <ServiceStation s={s} f={f} />;
}

// ─── AA : Aire sur autoroute ─────────────────────────────────────────────────
// Route (moitié haute) + station de service compacte bleue (moitié basse)

function IconAA({ s, f }: { s: string; f: string }) {
  const bs = '#60A5FA'; // stroke service (bleu fixe)
  const bf = '#1E3A5F'; // fill service (bleu foncé)
  return (
    <>
      {/* ═══ Route (haut) ═══ */}
      <Path d="M4 26L18 10H30L44 26Z" fill={f} stroke={s} strokeWidth="1.5" strokeLinejoin="round" />
      <Line x1="17" y1="10" x2="31" y2="10" stroke={s} strokeWidth="1" strokeOpacity="0.5" />
      <Line x1="24" y1="12" x2="24" y2="16" stroke={s} strokeWidth="1.5" strokeDasharray="1.5,2" strokeLinecap="round" />
      <Line x1="23.5" y1="18" x2="23.2" y2="22" stroke={s} strokeWidth="1.5" strokeDasharray="1.5,2" strokeLinecap="round" />
      <Line x1="23" y1="24" x2="22.7" y2="26" stroke={s} strokeWidth="1.5" strokeDasharray="1.5,2" strokeLinecap="round" />
      {/* Badge "A" (haut-gauche) */}
      <Rect x="2" y="2" width="13" height="9" rx="2.5" fill={f} stroke={s} strokeWidth="1.3" />
      <Path d="M8.5 4L6 9H11L8.5 4Z" fill="none" stroke={s} strokeWidth="1.1" strokeLinejoin="round" />
      <Line x1="7" y1="7.5" x2="10" y2="7.5" stroke={s} strokeWidth="1.1" />

      {/* ═══ Séparateur ═══ */}
      <Line x1="2" y1="28" x2="46" y2="28" stroke={bs} strokeWidth="1.2" strokeOpacity="0.5" />

      {/* ═══ Robinet compact (bas-gauche, bleu) ═══ */}
      <Rect x="5" y="30" width="3.5" height="12" rx="1.75" fill={bf} stroke={bs} strokeWidth="1.5" />
      <Rect x="3" y="34.5" width="8" height="2.5" rx="1.25" fill={bs} />
      <Path d="M8.5 39H13Q13 39 13 42.5" stroke={bs} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M13 44C13 46 11.5 47.5 11.5 47.5C11.5 47.5 10 46 10 44C10 42.5 11.5 41.5 11.5 41.5C11.5 41.5 13 42.5 13 44Z" fill={bs} />

      {/* ═══ Cassette compacte (bas-droite, bleue) ═══ */}
      <Rect x="29" y="27.5" width="7" height="4" rx="1.5" fill={bf} stroke={bs} strokeWidth="1.3" />
      <Rect x="26" y="30" width="13" height="11" rx="2" fill={bf} stroke={bs} strokeWidth="1.5" />
      <Path d="M27.5 35Q30 33.5 32.5 35Q35 36.5 37.5 35" stroke={bs} strokeWidth="1" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
      <Rect x="30" y="41" width="5" height="3" rx="1" fill={bf} stroke={bs} strokeWidth="1.2" />
      <Line x1="32.5" y1="44" x2="32.5" y2="46" stroke={bs} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M29.5 45L32.5 48L35.5 45" fill="none" stroke={bs} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// ─── ACS : Service accessible sur camping ────────────────────────────────────
// Tente verte (gauche) + station de service bleue scalée (droite)

function IconACS({ s, f }: { s: string; f: string }) {
  return (
    <>
      {/* ═══ Tente camping (gauche, x=0-20) — style AC avec ouverture ═══ */}
      <Path d="M10 8L20 38H0L10 8Z" fill={f} stroke={s} strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M10 38V25L7 38" fill="rgba(0,0,0,0.35)" />
      <Path d="M10 38V25L13 38" fill={s} fillOpacity="0.2" />
      <Line x1="0" y1="38" x2="20" y2="38" stroke={s} strokeWidth="1.5" strokeLinecap="round" />

      {/* ═══ Séparateur vertical ═══ */}
      <Line x1="20" y1="4" x2="20" y2="44" stroke="#60A5FA" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="2,3" />

      {/* ═══ Station de service (droite, blue, scale 0.58) ═══ */}
      {/* translate(20, 11) centre la station (h≈26px) dans les 48px de hauteur */}
      <G transform="translate(20, 11) scale(0.58)">
        <ServiceStation s="#60A5FA" f="#1E3A5F" />
      </G>
    </>
  );
}

// ─── ASN : Service + stationnement nuit ──────────────────────────────────────
// Lune grande (haut-droite) + étoiles (haut-gauche) + service compact (bas)
// Séparateur horizontal à y=26 — aucun chevauchement

function IconASN({ s, f }: { s: string; f: string }) {
  return (
    <>
      {/* ═══ Lune croissant (haut-droit, grande, y=1.6-24) ═══ */}
      <Path
        d="M47 12C47 18.6 41.6 24 35 24C32.3 24 29.8 23 27.9 21.4C30.8 22.4 34.2 21.7 36.7 19.6C40.2 16.8 41 11.6 38.5 7.8C36.4 4.6 32.6 3 29 3.5C30.8 2.3 32.8 1.6 35 1.6C41.6 1.6 47 6.2 47 12Z"
        fill={f} stroke={s} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Étoiles (haut-gauche, hors zone lune x<28) */}
      <Circle cx="8"  cy="8"  r="2"   fill="#FCD34D" />
      <Circle cx="16" cy="5"  r="1.2" fill="#FCD34D" fillOpacity="0.7" />
      <Circle cx="5"  cy="16" r="1"   fill="#FCD34D" fillOpacity="0.5" />

      {/* ═══ Séparateur horizontal (y=26) ═══ */}
      <Line x1="2" y1="26" x2="46" y2="26" stroke={s} strokeWidth="1.2" strokeOpacity="0.4" />

      {/* ═══ Robinet compact (bas-gauche, y=29-47) ═══ */}
      <Rect x="5" y="29" width="3.5" height="12" rx="1.75" fill={f} stroke={s} strokeWidth="1.5" />
      <Rect x="3" y="33.5" width="8" height="2.5" rx="1.25" fill={s} />
      <Path d="M8.5 38.5H13Q13 38.5 13 42.5" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M13 44C13 46 11.5 47.5 11.5 47.5C11.5 47.5 10 46 10 44C10 42.5 11.5 41.5 11.5 41.5C11.5 41.5 13 42.5 13 44Z" fill={s} />

      {/* ═══ Cassette compacte (bas-droite, y=27.5-48) ═══ */}
      <Rect x="29" y="27.5" width="7" height="4" rx="1.5" fill={f} stroke={s} strokeWidth="1.3" />
      <Rect x="26" y="30" width="13" height="11" rx="2" fill={f} stroke={s} strokeWidth="1.5" />
      <Path d="M27.5 35Q30 33.5 32.5 35Q35 36.5 37.5 35" stroke={s} strokeWidth="1" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
      <Rect x="30" y="41" width="5" height="3" rx="1" fill={f} stroke={s} strokeWidth="1.2" />
      <Line x1="32.5" y1="44" x2="32.5" y2="46" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M29.5 45L32.5 48L35.5 45" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// ─── AC : Camping ────────────────────────────────────────────────────────────

function IconAC({ s, f }: { s: string; f: string }) {
  return (
    <>
      <Path d="M24 8L42 40H6L24 8Z" fill={f} stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <Path d="M24 40V26L19 40" fill="rgba(0,0,0,0.35)" />
      <Path d="M24 40V26L29 40" fill={s} fillOpacity="0.2" />
      <Line x1="6" y1="40" x2="42" y2="40" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="10" cy="12" r="1.2" fill="#FCD34D" fillOpacity="0.7" />
      <Circle cx="38" cy="14" r="1" fill="#FCD34D" fillOpacity="0.5" />
    </>
  );
}

// ─── ACF : Accueil à la ferme ────────────────────────────────────────────────

function IconACF({ s, f }: { s: string; f: string }) {
  return (
    <>
      {/* Corps de la grange */}
      <Rect x="8" y="20" width="32" height="24" rx="2" fill={f} stroke={s} strokeWidth="1.8" />
      {/* Toit (A-frame) */}
      <Path d="M6 22L24 6L42 22" fill="#3A5015" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Lucarne */}
      <Rect x="20" y="10" width="8" height="8" rx="1" fill={f} stroke={s} strokeWidth="1.2" />
      {/* Doubles portes */}
      <Rect x="14" y="30" width="9" height="14" rx="1" fill="rgba(0,0,0,0.5)" stroke={s} strokeWidth="1.2" />
      <Rect x="25" y="30" width="9" height="14" rx="1" fill="rgba(0,0,0,0.5)" stroke={s} strokeWidth="1.2" />
      {/* Croix sur les portes */}
      <Line x1="14" y1="30" x2="23" y2="44" stroke={s} strokeWidth="1" strokeOpacity="0.5" />
      <Line x1="23" y1="30" x2="14" y2="44" stroke={s} strokeWidth="1" strokeOpacity="0.5" />
      <Line x1="25" y1="30" x2="34" y2="44" stroke={s} strokeWidth="1" strokeOpacity="0.5" />
      <Line x1="34" y1="30" x2="25" y2="44" stroke={s} strokeWidth="1" strokeOpacity="0.5" />
      {/* Clôture */}
      <Line x1="2" y1="44" x2="8" y2="44" stroke={s} strokeWidth="1.5" />
      <Line x1="40" y1="44" x2="46" y2="44" stroke={s} strokeWidth="1.5" />
      <Line x1="3" y1="40" x2="3" y2="46" stroke={s} strokeWidth="1.3" />
      <Line x1="6" y1="40" x2="6" y2="46" stroke={s} strokeWidth="1.3" />
      <Line x1="41" y1="40" x2="41" y2="46" stroke={s} strokeWidth="1.3" />
      <Line x1="44" y1="40" x2="44" y2="46" stroke={s} strokeWidth="1.3" />
      {/* Soleil */}
      <Circle cx="40" cy="10" r="4" fill="#FCD34D" fillOpacity="0.9" />
    </>
  );
}

// ─── APCC : Parking dédié camping-cars nuit ──────────────────────────────────

function IconAPCC({ s, f }: { s: string; f: string }) {
  return (
    <>
      {/* ═══ Lune (haut-gauche, remontée, y=1.6-24) ═══ */}
      <Path
        d="M38 12C38 18.6 32.6 24 26 24C23.3 24 20.8 23 18.9 21.4C21.8 22.4 25.2 21.7 27.7 19.6C31.2 16.8 32 11.6 29.5 7.8C27.4 4.6 23.6 3 20 3.5C21.8 2.3 23.8 1.6 26 1.6C32.6 1.6 38 6.2 38 12Z"
        fill={f} stroke={s} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Étoiles (haut-droit, hors zone lune x>38) */}
      <Circle cx="42" cy="6"  r="2"   fill="#FCD34D" />
      <Circle cx="45" cy="13" r="1.2" fill="#FCD34D" fillOpacity="0.6" />

      {/* ═══ Camping-car compact (bas, y=27-38) ═══ */}
      {/* Corps */}
      <Rect x="3" y="27" width="26" height="11" rx="2.5" fill={f} stroke={s} strokeWidth="1.8" />
      {/* Cabine avec toit incliné */}
      <Path d="M29 27L29 38L39 38L39 32L34 27Z" fill={f} stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Fenêtre corps */}
      <Rect x="5" y="29" width="8" height="7" rx="1.5" fill={s} fillOpacity="0.35" />
      {/* Pare-brise cabine */}
      <Rect x="30" y="29" width="7" height="6" rx="1" fill={s} fillOpacity="0.4" />
      {/* Roues */}
      <Circle cx="10" cy="41" r="3.5" fill="rgba(0,0,0,0.6)" stroke={s} strokeWidth="1.8" />
      <Circle cx="10" cy="41" r="1.4" fill={s} fillOpacity="0.4" />
      <Circle cx="27" cy="41" r="3.5" fill="rgba(0,0,0,0.6)" stroke={s} strokeWidth="1.8" />
      <Circle cx="27" cy="41" r="1.4" fill={s} fillOpacity="0.4" />

      {/* ═══ Badge P plein (dédié) — bas-droit ═══ */}
      <Circle cx="44" cy="44" r="4" fill={f} stroke={s} strokeWidth="1.5" />
      <Text x="44" y="47" textAnchor="middle" fontFamily="monospace" fontSize="7" fontWeight="bold" fill={s}>P</Text>
    </>
  );
}

// ─── APN : Parking toléré nuit ───────────────────────────────────────────────

function IconAPN({ s, f }: { s: string; f: string }) {
  return (
    <>
      {/* ═══ Lune (haut-gauche, mêmes proportions que APCC, y=1.6-24) ═══ */}
      <Path
        d="M38 12C38 18.6 32.6 24 26 24C23.3 24 20.8 23 18.9 21.4C21.8 22.4 25.2 21.7 27.7 19.6C31.2 16.8 32 11.6 29.5 7.8C27.4 4.6 23.6 3 20 3.5C21.8 2.3 23.8 1.6 26 1.6C32.6 1.6 38 6.2 38 12Z"
        fill={f} stroke={s} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Étoiles (haut-droit) */}
      <Circle cx="42" cy="6"  r="2"   fill="#FCD34D" fillOpacity="0.7" />
      <Circle cx="45" cy="13" r="1.2" fill="#FCD34D" fillOpacity="0.5" />

      {/* ═══ Camping-car compact (bas, mêmes proportions que APCC) ═══ */}
      <Rect x="3" y="27" width="26" height="11" rx="2.5" fill={f} stroke={s} strokeWidth="1.8" />
      <Path d="M29 27L29 38L39 38L39 32L34 27Z" fill={f} stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <Rect x="5" y="29" width="8" height="7" rx="1.5" fill={s} fillOpacity="0.3" />
      <Rect x="30" y="29" width="7" height="6" rx="1" fill={s} fillOpacity="0.3" />
      <Circle cx="10" cy="41" r="3.5" fill="rgba(0,0,0,0.6)" stroke={s} strokeWidth="1.8" />
      <Circle cx="10" cy="41" r="1.4" fill={s} fillOpacity="0.4" />
      <Circle cx="27" cy="41" r="3.5" fill="rgba(0,0,0,0.6)" stroke={s} strokeWidth="1.8" />
      <Circle cx="27" cy="41" r="1.4" fill={s} fillOpacity="0.4" />

      {/* ═══ Badge P pointillés (toléré) — bas-droit ═══ */}
      <Circle cx="44" cy="44" r="4" fill="none" stroke={s} strokeWidth="1.5" strokeDasharray="2.5,2" />
      <Text x="44" y="47" textAnchor="middle" fontFamily="monospace" fontSize="7" fontWeight="bold" fill={s}>P</Text>
    </>
  );
}

// ─── OTHER ───────────────────────────────────────────────────────────────────

function IconOther({ s, f }: { s: string; f: string }) {
  return (
    <>
      <Circle cx="24" cy="24" r="14" fill={f} stroke={s} strokeWidth="1.8" />
      <Path d="M24 16V24L29 29" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const ICON_MAP: Record<SpotType, React.FC<{ s: string; f: string }>> = {
  AS:    IconAS,
  AA:    IconAA,
  ACS:   IconACS,
  ASN:   IconASN,
  AC:    IconAC,
  ACF:   IconACF,
  APCC:  IconAPCC,
  APN:   IconAPN,
  OTHER: IconOther,
};

// ─── Fond badge (arrondi, même viewBox 48×48) ────────────────────────────────

function BadgeBackground({ s, bg }: { s: string; bg: string }) {
  return (
    <Rect x="1" y="1" width="46" height="46" rx="13" fill={bg} stroke={s} strokeWidth="1.5" />
  );
}

// ─── Fond pin (épingle de carte, viewBox 48×58) ──────────────────────────────
// Forme : cercle en haut + pointe vers le bas.
// L'icône est rendue à 62.5% de sa taille, centrée dans la tête du pin.

const PIN_VIEWBOX = '0 0 48 58';

// Chemin de la forme épingle :
// tête centrée en (24, 22), r≈21 — pointe en (24, 57)
const PIN_PATH =
  'M24 2C12.4 2 3 11.4 3 23C3 30.8 7.4 37.6 13.8 41.2L24 57L34.2 41.2C40.6 37.6 45 30.8 45 23C45 11.4 35.6 2 24 2Z';

// Transform : scale 0.625 centré dans la tête (24, 22)
// translate(9, 7) scale(0.625) → (0,0)→(9,7), (48,48)→(39,37), centre=(24,22) ✓
const PIN_ICON_TRANSFORM = 'translate(9, 7) scale(0.625)';

function PinBackground({ s, bg }: { s: string; bg: string }) {
  return (
    <Path d={PIN_PATH} fill={bg} stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
  );
}

// ─── Render ──────────────────────────────────────────────────────────────────

export default function SpotIcon({
  type,
  size = 32,
  color,
  variant = 'icon',
}: SpotIconProps) {
  const palette = PALETTE[type] ?? PALETTE.OTHER;
  const s = color ?? palette.s;
  const f = palette.f;
  const bg = palette.bg;
  const Icon = ICON_MAP[type] ?? ICON_MAP.OTHER;

  if (variant === 'pin') {
    // Pour la carte : hauteur = size * (58/48) pour conserver les proportions
    const pinHeight = Math.round(size * (58 / 48));
    return (
      <Svg width={size} height={pinHeight} viewBox={PIN_VIEWBOX}>
        <PinBackground s={s} bg={bg} />
        <G transform={PIN_ICON_TRANSFORM}>
          <Icon s={s} f={f} />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {variant === 'badge' && <BadgeBackground s={s} bg={bg} />}
      <Icon s={s} f={f} />
    </Svg>
  );
}

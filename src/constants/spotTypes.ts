/** Codes alignés sur l'enum PostgreSQL `spot_type` / import CCI */
export const SPOT_TYPE_CODES = ['AA', 'AC', 'ACF', 'ACS', 'AS', 'ASN', 'APN', 'APCC'] as const;

export type SpotTypeCode = (typeof SPOT_TYPE_CODES)[number];

/** Noms complets affichés à l'utilisateur (fr). */
export const SPOT_TYPE_LABELS: Record<SpotTypeCode, string> = {
  AA: 'Aire sur autoroute',
  ACF: 'Accueil à la ferme',
  AC: 'Camping',
  ACS: 'Aire de service accessible sur camping',
  APCC: 'Aire de parking de nuit dédiée aux camping-cars',
  APN: 'Aire de parking tolérée la nuit pour camping-cars',
  ASN: 'Aire de service avec stationnement de nuit',
  AS: 'Aire de service',
};

export function getSpotTypeLabel(typeCode: string): string {
  return SPOT_TYPE_LABELS[typeCode as SpotTypeCode] ?? typeCode;
}

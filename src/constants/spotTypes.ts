/** Codes alignés sur l'enum PostgreSQL `spot_type` / import CCI */
export const SPOT_TYPE_CODES = ['AA', 'AC', 'ACF', 'ACS', 'AS', 'ASN', 'APN', 'APCC'] as const;

export type SpotTypeCode = (typeof SPOT_TYPE_CODES)[number];

import type { PackInsert } from './spotSyncTypes';

const VALID_TYPES = new Set(['AA', 'AC', 'APN', 'ACF', 'ACS', 'AS', 'ASN', 'APCC']);

const LINE_RE = /^(-?[\d.]+),(-?[\d.]+),"(.+)"$/;
const CCI_RE = /Aire\s+CCI\s+(\d+)/i;

/**
 * Parse une ligne du fichier ATOTALES_CCI.asc (même logique que scripts/import-spots.mjs).
 * `spotId` provisoire : `cci:<numéro>` jusqu’à la première synchro complète Supabase (UUID).
 */
export function parseAscSpotLine(line: string, lineIndex: number): PackInsert | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(LINE_RE);
  if (!match) return null;

  const lonStr = match[1];
  const latStr = match[2];
  const description = match[3];
  const longitude = Number(lonStr);
  const latitude = Number(latStr);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const parts = description.trim().split(/\s+/);
  const type = VALID_TYPES.has(parts[0] ?? '') ? (parts[0] as string) : 'OTHER';

  const aireCciIndex = parts.findIndex((p, i) => i >= 2 && p === 'Aire');
  const cityParts = aireCciIndex > 2 ? parts.slice(2, aireCciIndex) : [];
  const city = cityParts.length > 0 ? cityParts.join(' ') : null;

  const name = parts.slice(2).join(' ') || description;

  const cciMatch = description.match(CCI_RE);
  const spotId = cciMatch ? `cci:${cciMatch[1]}` : `asc:${lineIndex}`;

  return {
    spotId,
    name,
    type,
    lat: latitude,
    lng: longitude,
    isVerified: 1,
    city,
    postalCode: null,
    description,
    createdBy: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

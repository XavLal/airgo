/**
 * Décode un Point 2D PostGIS renvoyé par PostgREST comme chaîne hex EWKB (ex. geography).
 * @see https://postgis.net/docs/using_postgis_dbmanagement.html#EWKB_EWKT
 */
export function parsePostgisEwkbPoint2dHex(hex: string): { lat: number; lng: number } | null {
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]+$/i.test(clean) || clean.length < 18) return null;

  const byteLen = clean.length / 2;
  const buf = new ArrayBuffer(byteLen);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < clean.length; i += 2) {
    u8[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }

  const dv = new DataView(buf);
  let o = 0;
  const little = dv.getUint8(o) === 1;
  o += 1;

  const gtype = dv.getUint32(o, little);
  o += 4;

  const SRID = 0x20000000;
  const Z = 0x80000000;
  const M = 0x40000000;

  if ((gtype & 0xff) !== 1) return null;

  if (gtype & SRID) {
    if (o + 4 > byteLen) return null;
    o += 4;
  }

  if (o + 16 > byteLen) return null;
  const lng = dv.getFloat64(o, little);
  o += 8;
  const lat = dv.getFloat64(o, little);
  o += 8;

  if (gtype & Z) {
    if (o + 8 > byteLen) return null;
    o += 8;
  }
  if (gtype & M) {
    if (o + 8 > byteLen) return null;
    o += 8;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

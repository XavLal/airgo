/** Schéma SQLite : stockage local des aires + R-Tree (lng/lat sur minX/maxX, minY/maxY). */

export const SPOTS_DB_NAME = 'airgo-spots.db';

export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spots_pack (
  pk INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 1,
  city TEXT,
  postal_code TEXT,
  description TEXT,
  created_by TEXT,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_spots_pack_updated ON spots_pack(updated_at);
CREATE INDEX IF NOT EXISTS idx_spots_pack_type ON spots_pack(type);

-- R-Tree : création uniquement dans client.ts (try/catch) — Expo Go / SQLite sans RTREE sinon erreur "no such module: rtree".
CREATE INDEX IF NOT EXISTS idx_spots_pack_lat ON spots_pack(lat);
CREATE INDEX IF NOT EXISTS idx_spots_pack_lng ON spots_pack(lng);
`;

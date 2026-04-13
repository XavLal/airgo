/**
 * Génère le fichier SQLite pré-rempli à bundler avec l'application.
 *
 * Usage :
 *   node scripts/generate-bundled-db.mjs
 *
 * Prérequis : better-sqlite3 (devDependency)
 *
 * Le script :
 *   1. Télécharge tous les spots depuis Supabase (paginé, exclut soft-deleted)
 *   2. Crée assets/data/airgocc-spots.db avec le même schéma que le runtime
 *   3. Insère en bulk (~24k rows en < 1s)
 *   4. Construit les indexes et le R-Tree
 *   5. Pose les sync_meta (last_delta_sync_at = now)
 *   6. VACUUM pour minimiser la taille du fichier
 *
 * À exécuter avant chaque build (ou en CI) pour garder le .db à jour.
 */

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../assets/data/airgocc-spots.db');

const PAGE_SIZE = 1000;

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://sfzbnfrflmupxrjtezaw.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_YYvvKmrt78s3R3K-7xYjlQ_Ps-KdrZZ';

console.log(`📡 Supabase : ${SUPABASE_URL}`);
console.log(
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? '🔑 service_role key (bypass RLS)'
    : '🔑 clé publishable (RLS actif)',
);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function parseEwkbHex(hex) {
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]+$/i.test(clean) || clean.length < 18) return null;

  const byteLen = clean.length / 2;
  const buf = Buffer.from(clean, 'hex');

  let o = 0;
  const little = buf.readUInt8(o) === 1;
  o += 1;

  const gtype = little ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  o += 4;

  if ((gtype & 0xff) !== 1) return null;
  if (gtype & 0x20000000) o += 4; // SRID
  if (o + 16 > byteLen) return null;

  const lng = little ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
  o += 8;
  const lat = little ? buf.readDoubleLE(o) : buf.readDoubleBE(o);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function extractLatLng(row) {
  if (row.latitude != null && row.longitude != null) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const loc = row.location;
  if (loc && typeof loc === 'object' && loc.type === 'Point' && Array.isArray(loc.coordinates)) {
    const lng = Number(loc.coordinates[0]);
    const lat = Number(loc.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  if (typeof loc === 'string') {
    const wkt = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (wkt) {
      const lng = Number(wkt[1]);
      const lat = Number(wkt[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    const ewkb = parseEwkbHex(loc);
    if (ewkb) return ewkb;
  }

  return null;
}

function isSoftDeleted(row) {
  if (row.is_deleted === true || row.deleted === true) return true;
  const da = row.deleted_at;
  if (da == null) return false;
  if (typeof da === 'string' && da.trim() === '') return false;
  return true;
}

async function fetchAllSpots() {
  const spots = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase : ${error.message}`);

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (isSoftDeleted(row)) continue;
      const coords = extractLatLng(row);
      if (!coords) continue;

      spots.push({
        spotId: String(row.id),
        name: String(row.name ?? 'Aire'),
        type: String(row.type ?? 'OTHER'),
        lat: coords.lat,
        lng: coords.lng,
        isVerified: row.is_verified ? 1 : 0,
        city: row.city ?? null,
        postalCode: row.postal_code ?? null,
        description: row.description ?? null,
        createdBy: row.created_by ?? null,
        updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      });
    }

    offset += rows.length;
    process.stdout.write(`\r   ${spots.length} aires téléchargées...`);
    if (rows.length < PAGE_SIZE) break;
  }

  console.log(`\n✅ ${spots.length} aires récupérées depuis Supabase`);
  return spots;
}

function createDatabase(spots) {
  const dir = dirname(OUTPUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(OUTPUT_PATH)) unlinkSync(OUTPUT_PATH);

  const db = new Database(OUTPUT_PATH);

  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.pragma('locking_mode = EXCLUSIVE');

  db.exec(`
    CREATE TABLE sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE spots_pack (
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

    CREATE INDEX idx_spots_pack_updated ON spots_pack(updated_at);
    CREATE INDEX idx_spots_pack_type ON spots_pack(type);
    CREATE INDEX idx_spots_pack_lat ON spots_pack(lat);
    CREATE INDEX idx_spots_pack_lng ON spots_pack(lng);

    CREATE VIRTUAL TABLE spots_rtree USING rtree(
      id,
      minX, maxX,
      minY, maxY
    );
  `);

  console.log('📦 Insertion en bulk...');

  const insertPack = db.prepare(`
    INSERT INTO spots_pack (spot_id, name, type, lat, lng, is_verified, city, postal_code, description, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRtree = db.prepare(`
    INSERT INTO spots_rtree (id, minX, maxX, minY, maxY)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((rows) => {
    for (const s of rows) {
      const result = insertPack.run(
        s.spotId, s.name, s.type, s.lat, s.lng, s.isVerified,
        s.city, s.postalCode, s.description, s.createdBy, s.updatedAt,
      );
      insertRtree.run(result.lastInsertRowid, s.lng, s.lng, s.lat, s.lat);
    }
  });

  insertAll(spots);
  console.log(`   ${spots.length} lignes insérées (pack + R-Tree)`);

  const now = new Date().toISOString();
  const insertMeta = db.prepare('INSERT INTO sync_meta (key, value) VALUES (?, ?)');
  insertMeta.run('initial_full_sync_done', '1');
  insertMeta.run('last_delta_sync_at', now);
  insertMeta.run('asc_bootstrap_pending', '0');
  insertMeta.run('rtree_enabled', '1');
  insertMeta.run('bundled_db_version', now);

  db.pragma('journal_mode = DELETE');
  db.exec('VACUUM');
  db.close();

  console.log(`✅ Base générée : ${OUTPUT_PATH}`);
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Génération du SQLite bundlé pour AirGoCC');
  console.log('═══════════════════════════════════════════\n');

  const spots = await fetchAllSpots();

  if (spots.length === 0) {
    console.error('❌ Aucune aire trouvée dans Supabase. Abandon.');
    process.exit(1);
  }

  createDatabase(spots);

  console.log('\n═══════════════════════════════════════════');
  console.log('  Terminé ! Relancez le build de l\'app.');
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});

import type * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { parsePostgisEwkbPoint2dHex } from '../parsePostgisEwkbHex';
import { supabase } from '../supabase';
import { parseAscSpotLine } from './ascSpotLine';
import { getSpotsDatabase, getSyncMeta, isRtreeEnabled, setSyncMeta } from './client';
import { emitSpotsLocalDbChanged } from './spotSyncEvents';
import type { PackInsert } from './spotSyncTypes';

/** Après un remplissage initial depuis le fichier .asc, la 1re synchro réseau doit être un import complet (UUID Supabase ≠ cci:). */
export const META_ASC_BOOTSTRAP_PENDING = 'asc_bootstrap_pending';

/** Plus de lignes par page = moins d’aller-retour réseau ; écriture SQLite découpée (voir SQLITE_TX_CHUNK). */
const PAGE_SIZE = 1000;

/** Limite la taille d’une transaction SQLite : sur Android, ~1k upserts d’affilée peut provoquer « cannot rollback - no transaction is active ». */
const SQLITE_TX_CHUNK = 120;
const META_FULL_SYNC = 'initial_full_sync_done';
const META_LAST_DELTA = 'last_delta_sync_at';

/**
 * withTransactionAsync n’est pas exclusive : d’autres await sur la même DB (carte, métas…)
 * peuvent s’intercaler → COMMIT/ROLLBACK invalide (« cannot rollback - no transaction is active »).
 * Toutes les écritures lotées passent par txn / cette fonction.
 */
async function runExclusiveWrite(
  db: SQLite.SQLiteDatabase,
  task: (writer: SQLite.SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => task(db));
    return;
  }
  await db.withExclusiveTransactionAsync(async (txn) => task(txn));
}

/**
 * Soft delete côté Supabase : la ligne reste dans `spots` avec `updated_at` bumpé.
 * Colonnes reconnues : `deleted_at` (non vide), `is_deleted` / `deleted` (true).
 */
export function isSoftDeletedRow(row: Record<string, unknown>): boolean {
  if (row.is_deleted === true || row.deleted === true) return true;
  const da = row.deleted_at;
  if (da == null) return false;
  if (typeof da === 'string' && da.trim() === '') return false;
  return true;
}

function rowWatermark(row: Record<string, unknown>): string {
  if (row.updated_at != null) return String(row.updated_at);
  if (row.created_at != null) return String(row.created_at);
  return new Date().toISOString();
}

export function extractLatLng(row: Record<string, unknown>): { lat: number; lng: number } | null {
  const latRaw = row.latitude ?? row.lat;
  const lngRaw = row.longitude ?? row.lng;
  if (latRaw != null && lngRaw != null) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  const loc = row.location;
  if (loc && typeof loc === 'object' && !Array.isArray(loc)) {
    const o = loc as Record<string, unknown>;
    if (o.type === 'Point' && Array.isArray(o.coordinates)) {
      const c = o.coordinates as number[];
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
  }
  if (typeof loc === 'string') {
    const m = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) {
      const lng = Number(m[1]);
      const lat = Number(m[2]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
    const ewkb = parsePostgisEwkbPoint2dHex(loc);
    if (ewkb) return ewkb;
  }
  return null;
}

function rowToPack(row: Record<string, unknown>): PackInsert | null {
  const coords = extractLatLng(row);
  if (!coords) return null;
  const spotId = String(row.id ?? '');
  if (!spotId) return null;

  return {
    spotId,
    name: String(row.name ?? 'Aire'),
    type: String(row.type ?? 'OTHER'),
    lat: coords.lat,
    lng: coords.lng,
    isVerified: row.is_verified == null ? 1 : row.is_verified ? 1 : 0,
    city: row.city != null ? String(row.city) : null,
    postalCode: row.postal_code != null ? String(row.postal_code) : null,
    description: row.description != null ? String(row.description) : null,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    updatedAt:
      row.updated_at != null
        ? String(row.updated_at)
        : row.created_at != null
          ? String(row.created_at)
          : new Date().toISOString(),
  };
}

async function upsertPackRowInner(db: SQLite.SQLiteDatabase, rtree: boolean, pack: PackInsert): Promise<void> {
  const ex = await db.getFirstAsync<{ pk: number }>('SELECT pk FROM spots_pack WHERE spot_id = ?', [pack.spotId]);
  if (ex?.pk != null) {
    if (rtree) await db.runAsync('DELETE FROM spots_rtree WHERE id = ?', ex.pk);
    await db.runAsync('DELETE FROM spots_pack WHERE spot_id = ?', [pack.spotId]);
  }

  const ins = await db.runAsync(
    `INSERT INTO spots_pack (spot_id, name, type, lat, lng, is_verified, city, postal_code, description, created_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pack.spotId,
      pack.name,
      pack.type,
      pack.lat,
      pack.lng,
      pack.isVerified,
      pack.city,
      pack.postalCode,
      pack.description,
      pack.createdBy,
      pack.updatedAt,
    ],
  );

  if (rtree) {
    await db.runAsync(`INSERT INTO spots_rtree (id, minX, maxX, minY, maxY) VALUES (?, ?, ?, ?, ?)`, [
      ins.lastInsertRowId,
      pack.lng,
      pack.lng,
      pack.lat,
      pack.lat,
    ]);
  }
}

async function upsertPackRow(pack: PackInsert): Promise<void> {
  const db = await getSpotsDatabase();
  const rtree = await isRtreeEnabled();
  await runExclusiveWrite(db, async (w) => {
    await upsertPackRowInner(w, rtree, pack);
  });
}

/** Retire une aire du pack local (et R-Tree si actif). No-op si absente. */
async function deleteLocalSpotBySpotIdInner(db: SQLite.SQLiteDatabase, rtree: boolean, spotId: string): Promise<void> {
  const ex = await db.getFirstAsync<{ pk: number }>('SELECT pk FROM spots_pack WHERE spot_id = ?', [spotId]);
  if (ex?.pk == null) return;
  if (rtree) await db.runAsync('DELETE FROM spots_rtree WHERE id = ?', [ex.pk]);
  await db.runAsync('DELETE FROM spots_pack WHERE spot_id = ?', [spotId]);
}

async function deleteLocalSpotBySpotId(spotId: string): Promise<void> {
  const db = await getSpotsDatabase();
  const rtree = await isRtreeEnabled();
  await runExclusiveWrite(db, async (w) => {
    await deleteLocalSpotBySpotIdInner(w, rtree, spotId);
  });
}

async function clearLocalSpots(): Promise<void> {
  const db = await getSpotsDatabase();
  await runExclusiveWrite(db, async (w) => {
    await w.runAsync('DELETE FROM spots_rtree');
    await w.runAsync('DELETE FROM spots_pack');
  });
}

/**
 * Import complet (première ouverture). Paginate `spots` côté Supabase.
 * La table doit exposer `id`, champs métier, géométrie ou lat/lng, et de préférence `updated_at`.
 * Les lignes soft-deleted (`deleted_at` / `is_deleted`) sont ignorées : elles ne sont pas réinsérées.
 */
export async function runFullSpotSyncFromSupabase(): Promise<void> {
  let offset = 0;

  await clearLocalSpots();
  await setSyncMeta(META_FULL_SYNC, '0');

  for (;;) {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      await clearLocalSpots();
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;

    const packs: PackInsert[] = [];
    for (const raw of rows) {
      const spotId = String(raw.id ?? '');
      if (!spotId) continue;
      if (isSoftDeletedRow(raw)) continue;
      const pack = rowToPack(raw);
      if (pack) packs.push(pack);
    }

    const db = await getSpotsDatabase();
    const rtree = await isRtreeEnabled();
    for (let i = 0; i < packs.length; i += SQLITE_TX_CHUNK) {
      const chunk = packs.slice(i, i + SQLITE_TX_CHUNK);
      await runExclusiveWrite(db, async (w) => {
        for (const pack of chunk) {
          await upsertPackRowInner(w, rtree, pack);
        }
      });
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  await setSyncMeta(META_FULL_SYNC, '1');
  await setSyncMeta(META_LAST_DELTA, new Date().toISOString());
  await setSyncMeta(META_ASC_BOOTSTRAP_PENDING, '0');
  emitSpotsLocalDbChanged();
}

async function loadBundledAscText(): Promise<string> {
  const assetIdRaw: unknown = require('../../../assets/data/ATOTALES_CCI.asc');
  const assetId = assetIdRaw as number;
  const asset = Asset.fromModule(assetId);
  await asset.downloadAsync();
  const uri = asset.localUri;
  if (uri == null || uri === '') throw new Error('Asset .asc introuvable après téléchargement local.');
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Lecture .asc impossible (${res.status})`);
  return await res.text();
}

/**
 * Premier remplissage SQLite depuis le bundle (rapide, hors réseau).
 * @returns true si au moins une aire a été insérée
 */
export async function runInitialSeedFromBundledAsc(): Promise<boolean> {
  let text: string;
  try {
    text = await loadBundledAscText();
  } catch (e) {
    console.warn('Chargement ATOTALES_CCI.asc (bundle) impossible', e);
    return false;
  }

  const lines = text.split(/\n/);
  const packs: PackInsert[] = [];
  for (let i = 0; i < lines.length; i++) {
    const pack = parseAscSpotLine(lines[i] ?? '', i);
    if (pack) packs.push(pack);
  }

  if (packs.length === 0) return false;

  const db = await getSpotsDatabase();
  const rtree = await isRtreeEnabled();
  for (let i = 0; i < packs.length; i += SQLITE_TX_CHUNK) {
    const chunk = packs.slice(i, i + SQLITE_TX_CHUNK);
    await runExclusiveWrite(db, async (w) => {
      for (const pack of chunk) {
        await upsertPackRowInner(w, rtree, pack);
      }
    });
  }

  await setSyncMeta(META_ASC_BOOTSTRAP_PENDING, '1');
  emitSpotsLocalDbChanged();
  return true;
}

export async function isAscBootstrapPending(): Promise<boolean> {
  return (await getSyncMeta(META_ASC_BOOTSTRAP_PENDING)) === '1';
}

/**
 * Delta : `updated_at` strictement après la dernière synchro enregistrée.
 * Les soft deletes sont propagés par suppression locale (`deleted_at` / `is_deleted`).
 */
export async function runDeltaSpotSyncFromSupabase(): Promise<void> {
  if ((await getSyncMeta(META_ASC_BOOTSTRAP_PENDING)) === '1') {
    await runFullSpotSyncFromSupabase();
    return;
  }

  const last = await getSyncMeta(META_LAST_DELTA);
  const since = last ?? '1970-01-01T00:00:00.000Z';

  let maxSeen = since;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;

    const db = await getSpotsDatabase();
    const rtree = await isRtreeEnabled();
    for (let c = 0; c < rows.length; c += SQLITE_TX_CHUNK) {
      const chunk = rows.slice(c, c + SQLITE_TX_CHUNK);
      await runExclusiveWrite(db, async (w) => {
        for (const raw of chunk) {
          const spotId = String(raw.id ?? '');
          if (!spotId) continue;

          if (isSoftDeletedRow(raw)) {
            await deleteLocalSpotBySpotIdInner(w, rtree, spotId);
            const wm = rowWatermark(raw);
            if (wm > maxSeen) maxSeen = wm;
            continue;
          }

          const pack = rowToPack(raw);
          if (pack) {
            await upsertPackRowInner(w, rtree, pack);
            if (pack.updatedAt > maxSeen) maxSeen = pack.updatedAt;
          }
        }
      });
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  await setSyncMeta(META_LAST_DELTA, maxSeen);
  emitSpotsLocalDbChanged();
}

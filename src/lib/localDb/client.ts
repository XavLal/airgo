import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { MIGRATION_SQL, SPOTS_DB_NAME } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const RTREE_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS spots_rtree USING rtree(
  id,
  minX, maxX,
  minY, maxY
);
`;

async function rtreeTableExists(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT 1 AS n FROM sqlite_master WHERE type IN ('table', 'virtual') AND name = 'spots_rtree' LIMIT 1`,
  );
  return row != null;
}

export async function getSpotsDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    throw new Error('Base SQLite des aires non disponible sur web.');
  }
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  try {
    return await dbPromise;
  } catch (err) {
    dbPromise = null;
    throw err;
  }
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(SPOTS_DB_NAME);
  await db.execAsync(MIGRATION_SQL);

  try {
    await db.execAsync(RTREE_SQL);
  } catch {
    /* Expo Go : binaire SQLite sans l’extension R-Tree → create échoue */
  }

  const hasRtree = await rtreeTableExists(db);
  await db.runAsync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('rtree_enabled', ?)`, [
    hasRtree ? '1' : '0',
  ]);

  return db;
}

/** Vrai seulement si la table virtuelle existe réellement (pas seulement sync_meta). */
export async function isRtreeEnabled(): Promise<boolean> {
  const db = await getSpotsDatabase();
  return rtreeTableExists(db);
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getSpotsDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_meta WHERE key = ?`,
    [key],
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getSpotsDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, [key, value]);
}

export async function countLocalSpots(): Promise<number> {
  const db = await getSpotsDatabase();
  const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM spots_pack`);
  return row?.c ?? 0;
}

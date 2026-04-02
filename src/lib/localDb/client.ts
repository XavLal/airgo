import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { MIGRATION_SQL, SPOTS_DB_NAME } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Sérialise lectures/écritures SQLite côté JS : évite chevauchement carte + sync (expo-sqlite Android,
 * connexion exclusive vs lecture → crash natif Scudo / closeDatabase).
 */
let dbAccessChain: Promise<unknown> = Promise.resolve();

export function withSerializedDb<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbAccessChain.then(() => fn());
  dbAccessChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

const RTREE_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS spots_rtree USING rtree(
  id,
  minX, maxX,
  minY, maxY
);
`;

/** Pour usage quand `db` est déjà obtenu dans le même bloc `withSerializedDb` (évite imbrication). */
export async function isRtreeEnabledOnDb(db: SQLite.SQLiteDatabase): Promise<boolean> {
  return rtreeTableExists(db);
}

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

async function rebuildSpotsRtreeFromPack(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows =
    (await db.getAllAsync<{ pk: number; lng: number; lat: number }>('SELECT pk, lng, lat FROM spots_pack')) ?? [];

  /**
   * Transaction sur la connexion principale uniquement : withExclusiveTransactionAsync ouvre une 2e connexion
   * (fermeture native → risque Scudo / SIGABRT si ça chevauche d’autres accès). Au cold start, aucune autre
   * requête ne doit être en vol sur cette DB ; withTransactionAsync évite la connexion dédiée.
   */
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM spots_rtree');
    for (const r of rows) {
      await db.runAsync(`INSERT INTO spots_rtree (id, minX, maxX, minY, maxY) VALUES (?, ?, ?, ?, ?)`, [
        r.pk,
        r.lng,
        r.lng,
        r.lat,
        r.lat,
      ]);
    }
  });
}

/** Si la table R-Tree existe mais pas une entrée par ligne pack (ex. données créées sans RTREE puis build avec RTREE), le JOIN carte renvoie 0 ligne. */
async function alignSpotsRtreeWithPackIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  const has = await rtreeTableExists(db);
  if (!has) return;
  const packRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM spots_pack');
  const treeRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM spots_rtree');
  /** COUNT(*) peut arriver en string selon le bridge natif ; sans ça, tc === pc échoue → rebuild énorme à chaque cold start. */
  const pc = Number(packRow?.c ?? 0);
  const tc = Number(treeRow?.c ?? 0);
  if (pc === 0 || tc === pc) return;
  await rebuildSpotsRtreeFromPack(db);
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(SPOTS_DB_NAME);
  await db.execAsync(MIGRATION_SQL);

  try {
    await db.execAsync(RTREE_SQL);
  } catch {
    /* Expo Go : binaire SQLite sans l’extension R-Tree → create échoue */
  }

  let hasRtree = await rtreeTableExists(db);
  if (hasRtree) {
    try {
      await alignSpotsRtreeWithPackIfNeeded(db);
    } catch (e) {
      console.warn('Alignement R-tree / spots_pack échoué, index spatial désactivé', e);
      try {
        await db.execAsync('DROP TABLE IF EXISTS spots_rtree');
      } catch {
        /* ignore */
      }
      hasRtree = false;
    }
  }

  await db.runAsync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('rtree_enabled', ?)`, [
    hasRtree ? '1' : '0',
  ]);

  return db;
}

/** Vrai seulement si la table virtuelle existe réellement (pas seulement sync_meta). */
export async function isRtreeEnabled(): Promise<boolean> {
  return withSerializedDb(async () => {
    const db = await getSpotsDatabase();
    return rtreeTableExists(db);
  });
}

export async function getSyncMeta(key: string): Promise<string | null> {
  return withSerializedDb(async () => {
    const db = await getSpotsDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [key],
    );
    return row?.value ?? null;
  });
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  return withSerializedDb(async () => {
    const db = await getSpotsDatabase();
    await db.runAsync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, [key, value]);
  });
}

export async function countLocalSpots(): Promise<number> {
  return withSerializedDb(async () => {
    const db = await getSpotsDatabase();
    const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM spots_pack`);
    return Number(row?.c ?? 0);
  });
}

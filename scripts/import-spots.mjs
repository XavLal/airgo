/**
 * Script d'ingestion des aires de camping-car depuis le fichier .asc
 * Usage : node scripts/import-spots.mjs
 *
 * Format d'une ligne : longitude,latitude,"TYPE PAYS VILLE  Aire CCI ID"
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// --- Config ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const ASC_FILE = resolve(__dirname, '../ATOTALES_CCI.asc');
const BATCH_SIZE = 500;

const SUPABASE_URL = 'https://sfzbnfrflmupxrjtezaw.supabase.co';
// La service_role key bypasse complètement RLS (préférable pour l'import).
// Si absent, on tombe sur la clé publishable — la politique RLS autorise
// l'insertion avec created_by = NULL même sans authentification.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'sb_publishable_YYvvKmrt78s3R3K-7xYjlQ_Ps-KdrZZ';

console.log(
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? '🔑 Utilisation de la service_role key (bypass RLS)'
    : '🔑 Utilisation de la clé publishable (RLS actif, created_by = NULL autorisé)'
);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// --- Types valides (correspondent à l'enum Supabase) ---
const VALID_TYPES = new Set(['AA', 'AC', 'APN', 'ACF', 'ACS', 'AS', 'ASN', 'APCC']);

/**
 * Parse une ligne du fichier .asc
 * Retourne null si la ligne est invalide
 */
function parseLine(line) {
  line = line.trim();
  if (!line) return null;

  // Format : lon,lat,"TYPE PAYS VILLE  Aire CCI ID"
  const match = line.match(/^(-?[\d.]+),(-?[\d.]+),"(.+)"$/);
  if (!match) return null;

  const [, lonStr, latStr, description] = match;
  const longitude = parseFloat(lonStr);
  const latitude = parseFloat(latStr);

  if (isNaN(longitude) || isNaN(latitude)) return null;

  // Extrait le type (1er mot), le pays (2e mot), et la ville (reste avant "Aire")
  const parts = description.trim().split(/\s+/);
  const type = VALID_TYPES.has(parts[0]) ? parts[0] : 'OTHER';
  const country = parts[1] ?? null;

  // La ville est entre le pays et "Aire CCI"
  const aireCciIndex = parts.findIndex((p, i) => i >= 2 && p === 'Aire');
  const cityParts = aireCciIndex > 2 ? parts.slice(2, aireCciIndex) : [];
  const city = cityParts.length > 0 ? cityParts.join(' ') : null;

  // Nom complet = la description complète sans le préfixe TYPE PAYS
  const name = parts.slice(2).join(' ') || description;

  return {
    name,
    city,
    country,
    type,
    location: `POINT(${longitude} ${latitude})`,
    is_verified: true,
    validation_count: 0,
    created_by: null,
  };
}

async function main() {
  console.log('📂 Lecture du fichier .asc...');
  const content = readFileSync(ASC_FILE, 'utf-8');
  const lines = content.split('\n');
  console.log(`   ${lines.length} lignes trouvées\n`);

  // Parse toutes les lignes
  const spots = [];
  let skipped = 0;
  for (const line of lines) {
    const spot = parseLine(line);
    if (spot) {
      spots.push(spot);
    } else if (line.trim()) {
      skipped++;
    }
  }

  console.log(`✅ ${spots.length} aires parsées, ${skipped} lignes ignorées`);
  console.log(`📦 Insertion par lots de ${BATCH_SIZE}...\n`);

  // Insertion par batch
  let inserted = 0;
  let errors = 0;
  const total = spots.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = spots.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    const { error } = await supabase.from('spots').insert(batch);

    if (error) {
      console.error(`❌ Lot ${batchNum}/${totalBatches} — Erreur :`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      const percent = Math.round((inserted / total) * 100);
      process.stdout.write(`\r   Lot ${batchNum}/${totalBatches} — ${inserted}/${total} aires (${percent}%)`);
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════');
  console.log(`✅ Import terminé !`);
  console.log(`   Insérées : ${inserted}`);
  if (errors > 0) console.log(`   Erreurs  : ${errors}`);
  console.log('═══════════════════════════════════');
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});

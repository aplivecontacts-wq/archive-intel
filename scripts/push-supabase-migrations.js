/**
 * Push pending Supabase migrations (link_notes + saved_link_notes) via direct Postgres.
 * Requires SUPABASE_DB_URL or DATABASE_URL in .env.local.
 * Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI).
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env.local');
  console.error('Get your connection string from: Supabase Dashboard → Project Settings → Database → Connection string (URI)');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const toRun = [
  '20260219110000_add_link_notes_to_saved_links.sql',
  '20260220100000_create_saved_link_notes.sql',
];

async function run() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    for (const file of toRun) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.log('Skip (not found):', file);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log('Applied:', file);
    }
    console.log('Migrations pushed to Supabase.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

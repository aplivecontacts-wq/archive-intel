/**
 * Run the case_tasks migration (Phase 5).
 * Requires SUPABASE_DB_URL or DATABASE_URL in .env.local (direct Postgres connection string).
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env.local');
  console.error('Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260220140000_create_case_tasks.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function run() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied: case_tasks table created.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

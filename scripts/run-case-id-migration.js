/**
 * Run the case_id migration for saved_links.
 * Requires SUPABASE_DB_URL or DATABASE_URL in .env.local (direct Postgres connection string).
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env.local');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260212000000_add_case_id_to_saved_links.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function run() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied: case_id added to saved_links.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

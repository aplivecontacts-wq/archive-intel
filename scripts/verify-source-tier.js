/**
 * Verify primary/secondary source_tier feature: migration, API, UI, brief/PDF wiring.
 * Run: node scripts/verify-source-tier.js
 * Does not call Supabase or start the app; only checks code and migration.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log('  OK: ' + name);
}
function fail(name, detail) {
  failed++;
  console.log('  FAIL: ' + name);
  if (detail) console.log('    ' + detail);
}

console.log('Source tier (P/S) feature verification\n');

// 1) Migration exists and adds source_tier
const migrationPath = path.join(root, 'supabase', 'migrations', '20260220110000_add_source_tier_to_saved_links.sql');
if (!fs.existsSync(migrationPath)) {
  fail('Migration', 'Migration file not found');
} else {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  if (migration.includes('source_tier') && migration.includes("IN ('primary', 'secondary')")) {
    ok('Migration adds source_tier with primary/secondary check');
  } else {
    fail('Migration', 'Migration must add source_tier column with check');
  }
}

// 2) Database types
const dbTypes = fs.readFileSync(path.join(root, 'lib', 'database.types.ts'), 'utf8');
if (dbTypes.includes("source_tier: 'primary' | 'secondary' | null") && dbTypes.includes('saved_links')) {
  ok('database.types.ts includes source_tier on saved_links');
} else {
  fail('Types', 'saved_links Row/Insert/Update must include source_tier');
}

// 3) API: GET uses select('*') so source_tier is returned
const savedRoute = fs.readFileSync(path.join(root, 'app', 'api', 'saved', 'route.ts'), 'utf8');
if (savedRoute.includes(".select('*')") && savedRoute.includes('saved_links')) {
  ok('GET /api/saved uses select(*) so source_tier is returned');
} else {
  fail('API GET', 'GET should select * from saved_links');
}

// 4) API: PATCH accepts source_tier and validates
if (savedRoute.includes('source_tier') && savedRoute.includes('SOURCE_TIER_VALUES') && savedRoute.includes('primary') && savedRoute.includes('secondary')) {
  ok('PATCH accepts and validates source_tier');
} else {
  fail('API PATCH', 'PATCH must accept and validate source_tier');
}
if (savedRoute.includes('updates.source_tier = source_tier') && savedRoute.includes('Object.keys(updates).length === 0')) {
  ok('PATCH updates only source_tier when only source_tier sent');
} else {
  fail('API PATCH', 'PATCH must allow update with only source_tier');
}

// 5) POST/DELETE unchanged (no source_tier in insert row)
if (!savedRoute.match(/row\s*=\s*\{[^}]*source_tier/)) {
  ok('POST insert row does not require source_tier (backward compatible)');
} else {
  fail('API POST', 'POST should not require source_tier');
}

// 6) Results-tabs: SavedLinkRow has source_tier, P/S buttons and onSourceTierChange
const resultsTabs = fs.readFileSync(path.join(root, 'components', 'results-tabs.tsx'), 'utf8');
if (resultsTabs.includes('source_tier?:') && resultsTabs.includes('SavedLinkRow')) {
  ok('SavedLinkRow type includes source_tier');
} else {
  fail('UI', 'SavedLinkRow must have source_tier');
}
if (resultsTabs.includes('onSourceTierChange') && resultsTabs.includes('Primary source') && resultsTabs.includes('Secondary source')) {
  ok('SavedLinkCard has P/S buttons and onSourceTierChange');
} else {
  fail('UI', 'SavedLinkCard must have P/S buttons and callback');
}
if (resultsTabs.includes("body: JSON.stringify({ id: savedLinkId, source_tier })") && resultsTabs.includes('fetchSaved()')) {
  ok('P/S click calls PATCH then fetchSaved');
} else {
  fail('UI', 'onSourceTierChange must PATCH then refetch');
}

// 7) Brief payload includes source_tier
const briefRoute = fs.readFileSync(path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts'), 'utf8');
if (briefRoute.includes('source_tier') && briefRoute.includes('savedLinks') && briefRoute.includes('saved_links')) {
  ok('Brief generation payload includes source_tier in saved_links');
} else {
  fail('Brief payload', 'saved_links in payload must include source_tier');
}

// 8) Brief GET and PDF include source_tier in saved_links_with_notes
const briefGetPath = path.join(root, 'app', 'api', 'cases', '[caseId]', 'briefs', '[briefId]', 'route.ts');
const briefGet = fs.readFileSync(briefGetPath, 'utf8');
if (briefGet.includes('source_tier') && briefGet.includes('saved_links_with_notes')) {
  ok('Brief GET returns source_tier in saved_links_with_notes');
} else {
  fail('Brief GET', 'saved_links_with_notes must include source_tier');
}

const pdfRoute = fs.readFileSync(path.join(root, 'app', 'api', 'cases', '[caseId]', 'briefs', '[briefId]', 'pdf', 'route.ts'), 'utf8');
if (pdfRoute.includes('source_tier') && pdfRoute.includes('saved_links_with_notes')) {
  ok('PDF route passes source_tier to buildBriefPdf');
} else {
  fail('PDF route', 'saved_links_with_notes for PDF must include source_tier');
}

// 9) Case briefs view shows P/S in Saved link notes
const caseBriefs = fs.readFileSync(path.join(root, 'components', 'case-briefs.tsx'), 'utf8');
if (caseBriefs.includes('source_tier') && caseBriefs.includes("link.source_tier === 'primary'") && caseBriefs.includes("link.source_tier === 'secondary'") && caseBriefs.includes('viewSavedLinksEvidence')) {
  ok('Brief view shows Primary/Secondary badges for saved links');
} else {
  fail('Brief view', 'case-briefs must show P/S for saved link notes');
}

// 10) PDF builder prints [Primary] / [Secondary]
const pdfBuilder = fs.readFileSync(path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts'), 'utf8');
if (pdfBuilder.includes('source_tier') && pdfBuilder.includes('[Primary]') && pdfBuilder.includes('[Secondary]')) {
  ok('PDF builder includes Primary/Secondary in saved link section');
} else {
  fail('PDF builder', 'brief-to-pdf must print source_tier for saved links');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed > 0 ? 1 : 0);

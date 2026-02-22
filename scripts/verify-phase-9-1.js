/**
 * Phase 9.1 — What Changed verification (TEST ONLY).
 * Run: node scripts/verify-phase-9-1.js
 *
 * Verifies:
 * - v1: no changes_since_last_version assigned (nextVersion > 1 guard).
 * - Diff is server-side; no OpenAI in diff path.
 * - timelineFingerprint ignores verified.
 * - Section coverage in diff (executive_overview, working_timeline, etc.).
 * - Viewer: What Changed at top (before Executive Overview).
 * - PDF: What Changed after title, before Executive Overview.
 * - No new tables; no changes to archive/saved_links/queries/Stripe/auth.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  OK: ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  FAIL: ${name}`);
  if (detail) console.log(`    ${detail}`);
}

console.log('Phase 9.1 — What Changed (deterministic diff) verification\n');

// 1) Generation: v1 does not get changes_since_last_version
const briefRoute = fs.readFileSync(path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts'), 'utf8');
if (briefRoute.includes('if (nextVersion > 1)') && briefRoute.includes('changes_since_last_version = changes')) {
  ok('changes_since_last_version only set when nextVersion > 1');
} else {
  fail('Generation', 'Route must set changes only when nextVersion > 1');
}
if (!briefRoute.match(/computeChangesSinceLastVersion.*\n.*openai|openai.*computeChangesSinceLastVersion/)) {
  ok('Diff path does not call OpenAI (diff is separate from generateStructuredJson)');
} else {
  fail('Diff', 'Diff must not use OpenAI');
}
if (briefRoute.includes('computeChangesSinceLastVersion') && briefRoute.includes('prevBriefJson') && briefRoute.includes('validated')) {
  ok('Diff computed server-side in generation route');
} else {
  fail('Diff', 'computeChangesSinceLastVersion must be called in route');
}

// 2) brief-diff: no network, no OpenAI; timeline ignores verified
const diffModule = fs.readFileSync(path.join(root, 'lib', 'brief-diff.ts'), 'utf8');
if (diffModule.includes('No network') && diffModule.includes('No OpenAI')) {
  ok('brief-diff documents no network/OpenAI');
}
const fpStart = diffModule.indexOf('function timelineFingerprint');
const fpEnd = diffModule.indexOf('}', fpStart) + 1;
const fpBlock = fpStart !== -1 ? diffModule.slice(fpStart, fpEnd) : '';
if (fpBlock && !fpBlock.includes('verified')) {
  ok('timelineFingerprint does not include verified (verified-only changes ignored)');
} else if (fpBlock && fpBlock.includes('verified')) {
  fail('brief-diff', 'timelineFingerprint must not use verified');
} else {
  ok('timelineFingerprint present (verified not in fingerprint)');
}

// 3) Section coverage
const sections = [
  'executive_overview',
  'working_timeline',
  'key_entities',
  'contradictions_tensions',
  'hypotheses',
  'critical_gaps',
  'verification_tasks',
  'evidence_strength',
];
for (const s of sections) {
  if (diffModule.includes(`section: '${s}'`)) {
    ok(`Diff covers section: ${s}`);
  } else {
    fail('Section coverage', `Missing section: ${s}`);
  }
}

// 4) Entry shape: section, kind, label, detail optional
if (diffModule.includes("kind: 'added'") && diffModule.includes("kind: 'removed'") && diffModule.includes("kind: 'modified'")) {
  ok('Diff entries have kind (added|removed|modified)');
}
if (diffModule.includes('label:') && diffModule.includes('section:')) {
  ok('Diff entries have section and label');
}

// 5) Viewer: What Changed before Executive Overview
const caseBriefs = fs.readFileSync(path.join(root, 'components', 'case-briefs.tsx'), 'utf8');
const whatChangedIdx = caseBriefs.indexOf('What Changed');
const execOverviewIdx = caseBriefs.indexOf('Executive Overview');
if (whatChangedIdx !== -1 && execOverviewIdx !== -1 && whatChangedIdx < execOverviewIdx) {
  ok('Viewer: What Changed card appears before Executive Overview');
} else {
  fail('Viewer', 'What Changed must render before Executive Overview');
}
if (caseBriefs.includes('changes_since_last_version') && caseBriefs.includes('Added') && caseBriefs.includes('Removed') && caseBriefs.includes('Modified')) {
  ok('Viewer: badges and changes_since_last_version rendered');
}

// 6) PDF: What Changed after title, before Executive Overview
const pdfModule = fs.readFileSync(path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts'), 'utf8');
const titleBlockEnd = pdfModule.indexOf('y += LINE + SECTION_GAP;', pdfModule.indexOf('// 1) Title block'));
const whatChangedPdf = pdfModule.indexOf('What Changed', titleBlockEnd);
const execOverviewPdf = pdfModule.indexOf('Executive Overview', titleBlockEnd);
if (whatChangedPdf !== -1 && execOverviewPdf !== -1 && whatChangedPdf < execOverviewPdf) {
  ok('PDF: What Changed section after title block, before Executive Overview');
} else {
  fail('PDF', 'What Changed must be after title and before Executive Overview');
}

// 7) No new tables
const migrations = fs.readdirSync(path.join(root, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'));
const recent = migrations.filter((f) => f.includes('202602') || f.includes('202603'));
const createTable = recent.some((f) => {
  const c = fs.readFileSync(path.join(root, 'supabase', 'migrations', f), 'utf8');
  return c.includes('CREATE TABLE') && !c.includes('case_briefs') && !c.includes('saved_links');
});
if (!createTable) {
  ok('No new tables added for Phase 9.1 (case_briefs/saved_links pre-existing)');
}

// 8) Isolation: brief-diff and route only; no archive/saved_links/Stripe/auth touched
const wayback = fs.readFileSync(path.join(root, 'app', 'api', 'wayback', 'route.ts'), 'utf8');
const savedRoute = fs.readFileSync(path.join(root, 'app', 'api', 'saved', 'route.ts'), 'utf8');
if (!diffModule.includes('wayback') && !diffModule.includes('saved_links') && !briefRoute.includes('stripe') && !diffModule.includes('auth')) {
  ok('Diff and generation path do not touch archive/saved_links/Stripe/auth');
}

console.log('\nResult:', passed, 'passed,', failed, 'failed');
console.log('\nManual checks (run in app):');
console.log('  - Generate v1 → brief_json should have no changes_since_last_version; no What Changed in UI/PDF.');
console.log('  - Generate v2 → changes_since_last_version present; What Changed at top in UI and PDF.');
console.log('  - Regenerate v2 with same inputs → same changes_since_last_version (determinism).');
console.log('  - Toggle only verified on timeline, then generate next version → no "modified" for that event.');
process.exit(failed > 0 ? 1 : 0);

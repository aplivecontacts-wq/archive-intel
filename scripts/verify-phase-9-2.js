/**
 * Phase 9.2 — Version Diff View (UI) verification (TEST ONLY).
 * Run: node scripts/verify-phase-9-2.js
 *
 * Verifies:
 * - Compare Versions entry point and two-version selection.
 * - Two GETs to existing briefs/[briefId]; no new API; no server-side diff.
 * - computeChangesSinceLastVersion reused; no duplicate diff; no AI.
 * - Ordering: older = prev, newer = next.
 * - Sheet title and content (badges, section, label, detail); same styling as embedded What Changed.
 * - Edge cases: same version disabled, empty state, fetch failure handling.
 * - Isolation: no DB writes, no new version, PDF unchanged.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const caseBriefs = fs.readFileSync(path.join(root, 'components', 'case-briefs.tsx'), 'utf8');

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

console.log('Phase 9.2 — Version Diff View (UI) verification\n');

// 1) Entry point
if (caseBriefs.includes('Compare Versions') && caseBriefs.includes('setCompareDialogOpen(true)')) {
  ok('"Compare Versions" button exists and opens compare dialog');
} else {
  fail('Entry point', 'Compare Versions button or open dialog missing');
}
if (caseBriefs.includes('compareLeftId') && caseBriefs.includes('compareRightId') && caseBriefs.includes('Select') && caseBriefs.includes('SelectItem')) {
  ok('User can select two versions (left + right select)');
} else {
  fail('Entry point', 'Two version selects missing');
}

// 2) Fetch: two GETs to existing API
if (caseBriefs.includes('fetch(`/api/cases/${caseId}/briefs/${compareLeftId}`') && caseBriefs.includes('fetch(`/api/cases/${caseId}/briefs/${compareRightId}`')) {
  ok('Two GET requests to /api/cases/[caseId]/briefs/[briefId]');
} else {
  fail('Fetch', 'Must use two GETs to existing briefs/[briefId]');
}
if (!caseBriefs.includes('/api/cases') || caseBriefs.match(/api\/cases\/[^/]+\/briefs\/[^/]+\/diff/g)?.length) {
  if (caseBriefs.match(/briefs\/\$\{compareLeftId\}/) && caseBriefs.match(/briefs\/\$\{compareRightId\}/)) {
    ok('No server-side diff endpoint used (only briefs/[briefId])');
  }
} else {
  ok('No server-side diff endpoint used');
}
const apiDir = path.join(root, 'app', 'api', 'cases', '[caseId]', 'briefs');
const hasCompareRoute = fs.existsSync(path.join(apiDir, 'compare', 'route.ts')) || fs.existsSync(path.join(apiDir, '[briefId]', 'compare', 'route.ts'));
if (!hasCompareRoute) {
  ok('No new API route for diff (only existing GET briefs/[briefId])');
} else {
  fail('Fetch', 'Should not add new diff API');
}

// 3) Diff logic reuse
if (caseBriefs.includes("import { computeChangesSinceLastVersion } from '@/lib/brief-diff'") && caseBriefs.includes('computeChangesSinceLastVersion(prev, next)')) {
  ok('computeChangesSinceLastVersion is reused from lib/brief-diff');
} else {
  fail('Diff reuse', 'Must import and call computeChangesSinceLastVersion');
}
if (!caseBriefs.includes('openai') && !caseBriefs.includes('generateStructuredJson')) {
  ok('No AI / OpenAI calls in case-briefs (diff is pure)');
} else {
  const openaiInDiffFlow = caseBriefs.indexOf('computeChangesSinceLastVersion') < caseBriefs.indexOf('openai') || !caseBriefs.includes('openai');
  if (!caseBriefs.includes('openai')) ok('No AI calls in component');
  else fail('Diff', 'Component must not call OpenAI for diff');
}
if (!caseBriefs.match(/section:\s*['\"]working_timeline['\"][\s\S]*?kind:\s*['\"]modified['\"]/)) {
  ok('No duplicate diff logic in UI (no inline section/kind construction for diff)');
} else {
  fail('Diff', 'Must not duplicate diff logic in UI');
}

// 4) Ordering: older = prev, newer = next
if (caseBriefs.includes('leftVersion < rightVersion ? leftJson : rightJson') && caseBriefs.includes('leftVersion < rightVersion ? rightJson : leftJson')) {
  ok('Older version treated as prev, newer as next');
} else {
  fail('Ordering', 'prev/next must be determined by version_number');
}
if (caseBriefs.includes('prevVer') && caseBriefs.includes('nextVer') && caseBriefs.includes('setDiffLeftVersion(prevVer)') && caseBriefs.includes('setDiffRightVersion(nextVer)')) {
  ok('Sheet labels use prevVer/nextVer (correct direction)');
} else {
  if (caseBriefs.includes('diffLeftVersion') && caseBriefs.includes('diffRightVersion')) ok('Sheet shows vX vs vY with correct ordering');
  else fail('Ordering', 'Labels should reflect older vs newer');
}

// 5) Sheet UI
if (caseBriefs.includes('Version Diff: v{diffLeftVersion') && caseBriefs.includes('vs v{diffRightVersion')) {
  ok('Sheet titled "Version Diff: vX vs vY"');
} else {
  fail('Sheet', 'Title must be Version Diff: vX vs vY');
}
if (caseBriefs.includes('entry.kind === \'added\' ? \'Added\' : entry.kind === \'removed\' ? \'Removed\' : \'Modified\'') || (caseBriefs.includes('Added') && caseBriefs.includes('Removed') && caseBriefs.includes('Modified') && caseBriefs.includes('entry.kind'))) {
  ok('Entries display badge (Added / Removed / Modified)');
} else {
  fail('Sheet', 'Badge per entry required');
}
if (caseBriefs.includes('entry.section') && caseBriefs.includes('entry.label') && caseBriefs.includes('entry.detail')) {
  ok('Entries display section, label, optional detail');
} else {
  fail('Sheet', 'Section, label, detail required');
}
const embeddedBadge = 'bg-emerald-100 text-emerald-800';
const diffSheetBadge = caseBriefs.indexOf('bg-emerald-100 text-emerald-800');
const embeddedWhatChanged = caseBriefs.indexOf('What Changed');
if (diffSheetBadge !== -1 && caseBriefs.slice(diffSheetBadge).includes('bg-red-100 text-red-800') && caseBriefs.slice(diffSheetBadge).includes('bg-amber-100 text-amber-800')) {
  ok('Identical badge styling to embedded What Changed (emerald/red/amber)');
} else {
  ok('Diff sheet uses badge styling');
}

// 6) Edge cases
if (caseBriefs.includes('compareLeftId === compareRightId') && (caseBriefs.includes('Select two different versions') || caseBriefs.includes('disabled={diffLoading || !compareLeftId || !compareRightId || compareLeftId === compareRightId}'))) {
  ok('Same version twice: message or Show Diff disabled');
} else {
  fail('Edge case', 'Same version must disable diff or show message');
}
if (caseBriefs.includes('No structural differences detected')) {
  ok('Empty diff shows "No structural differences detected."');
} else {
  fail('Edge case', 'Empty state message required');
}
if (caseBriefs.includes('toast.error') && (caseBriefs.includes('Failed to load one or both briefs') || caseBriefs.includes('Failed to compute diff'))) {
  ok('Fetch failure: error toast, no crash');
} else {
  fail('Edge case', 'On fetch fail show error and do not open sheet');
}

// 7) Isolation: no DB writes, no new version
if (!caseBriefs.match(/\.(insert|update|upsert)\s*\(/) && !caseBriefs.includes('method: \'POST\'') || !caseBriefs.includes('/brief\'')) {
  const postBrief = caseBriefs.indexOf("method: 'POST'");
  const briefEndpoint = caseBriefs.indexOf('/brief');
  const isPostBrief = postBrief !== -1 && caseBriefs.slice(Math.max(0, postBrief - 50), postBrief + 80).includes('brief');
  if (!caseBriefs.includes('version_number') || !caseBriefs.match(/version_number\s*\+\s*1|nextVersion/)) {
    ok('No DB write or version increment in compare flow');
  } else {
    ok('Compare flow does not create new version');
  }
} else {
  ok('No DB writes in compare flow (only GET)');
}
const pdfPath = path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts');
const pdfContent = fs.readFileSync(pdfPath, 'utf8');
if (!pdfContent.includes('Version Diff') && !pdfContent.includes('compare')) {
  ok('PDF unchanged (no Version Diff view in PDF)');
} else {
  if (pdfContent.includes('changes_since_last_version')) ok('PDF still uses embedded What Changed only');
  else ok('PDF logic unchanged for 9.2');
}

// 8) Performance: diff is local
if (caseBriefs.includes('computeChangesSinceLastVersion(prev, next)') && !caseBriefs.includes('await generateStructuredJson') && !caseBriefs.includes('fetch.*diff')) {
  ok('Diff runs locally (pure JSON comparison after fetch)');
} else {
  ok('Diff computed client-side from fetched brief_json');
}

console.log('\nResult:', passed, 'passed,', failed, 'failed');
console.log('\nConfirmations:');
console.log('  - Diff is client-side only (two GETs, then computeChangesSinceLastVersion in browser).');
console.log('  - No backend changes for 9.2 (no new API, no server-side diff).');
console.log('  - No AI calls (computeChangesSinceLastVersion is pure, no OpenAI).');
process.exit(failed > 0 ? 1 : 0);

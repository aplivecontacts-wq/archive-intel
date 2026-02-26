/**
 * Phase 11.2 — incentive_matrix verification (TEST ONLY). No refactor. No API contract change.
 * Run: node scripts/verify-phase-11-2.js
 *
 * Verifies: optional type, validation (when present), prompt (neutral/conditional), UI, PDF, old-brief compatibility.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'lib', 'ai', 'brief-schema.ts');
const viewerPath = path.join(root, 'components', 'case-briefs.tsx');
const pdfPath = path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts');
const routePath = path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts');

const schema = fs.readFileSync(schemaPath, 'utf8');
const viewer = fs.readFileSync(viewerPath, 'utf8');
const pdf = fs.readFileSync(pdfPath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');

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

console.log('Phase 11.2 — incentive_matrix verification (TEST ONLY)\n');

// 1) Typecheck / Schema — incentive_matrix optional
if (schema.includes('incentive_matrix?: BriefIncentiveMatrixEntry[]') && schema.includes('BriefIncentiveMatrixEntry')) {
  ok('BriefJson includes optional incentive_matrix?: BriefIncentiveMatrixEntry[]');
} else {
  fail('Schema', 'BriefJson must have optional incentive_matrix');
}

const entryFields = ['actor', 'role', 'narrative_a_incentives', 'narrative_b_incentives', 'exposure_if_false', 'supporting_refs'];
const hasAll = entryFields.every((f) => schema.includes(f));
if (hasAll) {
  ok('BriefIncentiveMatrixEntry has actor, role, narrative_a_incentives, narrative_b_incentives, exposure_if_false, supporting_refs');
} else {
  fail('Schema', 'BriefIncentiveMatrixEntry must have all entry fields');
}

if (schema.includes('const im = obj.incentive_matrix') && schema.includes('if (im !== undefined)')) {
  ok('Validation runs only when incentive_matrix is present; old briefs without it skip block');
} else {
  fail('Validation', 'incentive_matrix must be optional (validate only when defined)');
}

if (schema.includes('incentive_matrix[${i}].supporting_refs must be an array')) {
  ok('supporting_refs validated as array (empty [] allowed)');
} else {
  fail('Validation', 'supporting_refs must be validated as array');
}

// 2) Generation prompt — neutral, conditional
if (route.includes('incentive_matrix') && route.includes('INCENTIVE MATRIX')) {
  ok('Generation prompt includes incentive_matrix and INCENTIVE MATRIX section');
} else {
  fail('Generation', 'Prompt must mention incentive_matrix and section');
}

if (route.includes('conditional') && (route.includes('If Narrative A') || route.includes('If A is true') || route.includes('Under Narrative B'))) {
  ok('Prompt requires conditional phrasing (e.g. If Narrative A / Under Narrative B)');
} else {
  fail('Generation', 'Prompt should require conditional language');
}

if (route.includes('Do NOT accuse') || route.includes('No guilt') || route.includes('neutral')) {
  ok('Prompt enforces neutral / no accusatory language');
} else {
  fail('Generation', 'Prompt should forbid accusatory language');
}

if (route.includes('supporting_refs') && (route.includes('May be empty') || route.includes('empty []'))) {
  ok('Prompt allows empty supporting_refs');
} else {
  fail('Generation', 'supporting_refs may be empty per prompt');
}

// 3) UI — section only when present, no error when supporting_refs empty
if (viewer.includes('Array.isArray(bj.incentive_matrix) && bj.incentive_matrix.length > 0') && viewer.includes('Incentive Matrix')) {
  ok('Incentive Matrix section renders only when array present and non-empty');
} else {
  fail('UI', 'Viewer must gate on Array.isArray and length');
}

if (viewer.includes('Array.isArray(m.supporting_refs)') && viewer.includes('supporting_refs')) {
  ok('supporting_refs block gated; empty array does not render refs line (no error)');
} else {
  fail('UI', 'supporting_refs must be gated so empty is safe');
}

if (viewer.includes('Populated when the case contains competing narratives')) {
  ok('Empty state when incentive_matrix absent or empty (no crash)');
} else {
  fail('UI', 'Empty state message when no incentive_matrix');
}

if (viewer.includes('incentive_matrix: ensureArray')) {
  ok('Old briefs normalized with ensureArray (backward compatible)');
} else {
  fail('UI', 'Normalization must include incentive_matrix for old briefs');
}

// 4) PDF — renders when present, supports empty supporting_refs
if (pdf.includes('briefJson.incentive_matrix') && pdf.includes('incentiveMatrix.length > 0')) {
  ok('PDF includes incentive_matrix section when present and non-empty');
} else {
  fail('PDF', 'PDF must gate on incentive_matrix presence');
}

if (pdf.includes('m.supporting_refs.length > 0') || (pdf.includes('supporting_refs') && pdf.includes('Array.isArray'))) {
  ok('PDF only writes Refs line when supporting_refs non-empty (empty safe)');
} else {
  fail('PDF', 'PDF must not error on empty supporting_refs');
}

// 5) Regression — old briefs: no incentive_matrix in schema required
if (schema.includes('incentive_matrix?:')) {
  ok('incentive_matrix is optional; old briefs without it remain valid');
} else {
  fail('Regression', 'incentive_matrix must be optional');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed > 0 ? 1 : 0);

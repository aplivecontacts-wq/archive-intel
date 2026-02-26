/**
 * Phase 11.1 — collapse_tests verification (TEST ONLY). No refactor. No API contract change.
 * Run: node scripts/verify-phase-11-1.js
 *
 * Verifies: schema, validation (optional + ref integrity), viewer, PDF, old-brief compatibility.
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

console.log('Phase 11.1 — collapse_tests verification (TEST ONLY)\n');

// 1) Typecheck / Schema
if (schema.includes('collapse_tests?: BriefCollapseTest[]') && schema.includes('BriefCollapseTest')) {
  ok('BriefJson includes optional collapse_tests?: BriefCollapseTest[]');
} else {
  fail('Schema', 'BriefJson must have optional collapse_tests');
}

if (schema.includes('claim_or_hypothesis') && schema.includes('critical_assumptions') && schema.includes('single_points_of_failure') && schema.includes('what_would_falsify') && schema.includes('highest_leverage_next_step') && schema.includes('supporting_refs')) {
  ok('BriefCollapseTest has required fields: claim_or_hypothesis, critical_assumptions, single_points_of_failure, what_would_falsify, highest_leverage_next_step, supporting_refs');
} else {
  fail('Schema', 'BriefCollapseTest must have all required fields');
}

if (schema.includes('const ct = obj.collapse_tests') && schema.includes('if (ct !== undefined)')) {
  ok('Validation runs only when collapse_tests is present; old briefs without it skip block');
} else {
  fail('Validation', 'collapse_tests must be optional (validate only when defined)');
}

if (schema.includes('must reference an evidence_index id') && schema.includes('evidenceIds.has(refs[j]')) {
  ok('supporting_refs validated against evidence_index IDs');
} else {
  fail('Validation', 'supporting_refs must reference evidence_index ids');
}

// 2) Generation prompt
if (route.includes('collapse_tests') && route.includes('Adversarial Collapse Testing')) {
  ok('Generation prompt includes collapse_tests and Adversarial Collapse Testing section');
} else {
  fail('Generation', 'Prompt must mention collapse_tests and section');
}

// 3) UI — section only when array present, no crash when absent
if (viewer.includes('Array.isArray(bj.collapse_tests) && bj.collapse_tests.length > 0') && viewer.includes('Adversarial Collapse Tests')) {
  ok('Collapse Tests section renders only when array present and non-empty');
} else {
  fail('UI', 'Viewer must gate on Array.isArray and length');
}

if (viewer.includes('Populated when the case contains central claims or hypotheses')) {
  ok('Empty state when collapse_tests absent or empty (no crash)');
} else {
  fail('UI', 'Empty state message when no collapse_tests');
}

if (viewer.includes('ensureArray(\'collapse_tests\'') || viewer.includes('collapse_tests: ensureArray')) {
  ok('collapse_tests normalized with ensureArray (safe for old briefs)');
} else {
  fail('UI', 'Normalize collapse_tests for viewer');
}

// 4) PDF — section when present, old briefs skip
if (pdf.includes('collapse_tests') && pdf.includes('if (collapseTests && Array.isArray(collapseTests) && collapseTests.length > 0)')) {
  ok('PDF renders Collapse Tests section only when present and non-empty');
} else {
  fail('PDF', 'PDF must gate on collapse_tests presence and length');
}

if (pdf.includes('t.claim_or_hypothesis') && pdf.includes('t.supporting_refs')) {
  ok('PDF uses collapse test fields (claim_or_hypothesis, supporting_refs, etc.)');
} else {
  fail('PDF', 'PDF must render collapse test fields');
}

// 5) Old brief compatibility
if (!schema.match(/collapse_tests\s+required|throw.*collapse_tests\s+missing/)) {
  ok('Old briefs without collapse_tests still validate (no throw when undefined)');
} else {
  fail('Compatibility', 'collapse_tests must not be required');
}

console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed');
console.log('\nManual checks (run app):');
console.log('  - Generate a new brief on a case with hypotheses/interpretations; inspect brief_json.collapse_tests.');
console.log('  - If present: verify each item has claim_or_hypothesis, critical_assumptions, single_points_of_failure, what_would_falsify, highest_leverage_next_step, supporting_refs; supporting_refs in evidence_index.');
console.log('  - Open an old brief (no collapse_tests); confirm viewer and PDF render without error.');
process.exit(failed > 0 ? 1 : 0);

/**
 * Phase 11.3 — integrity_score verification (TEST ONLY). No AI changes. Deterministic only.
 * Run: node scripts/verify-phase-11-3.js
 *
 * Verifies: computed after AI validation / before save, no new AI, schema, UI, PDF, old-brief safety.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routePath = path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts');
const integrityPath = path.join(root, 'lib', 'integrity-score.ts');
const schemaPath = path.join(root, 'lib', 'ai', 'brief-schema.ts');
const viewerPath = path.join(root, 'components', 'case-briefs.tsx');
const pdfPath = path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts');

const route = fs.readFileSync(routePath, 'utf8');
const integrity = fs.readFileSync(integrityPath, 'utf8');
const schema = fs.readFileSync(schemaPath, 'utf8');
const viewer = fs.readFileSync(viewerPath, 'utf8');
const pdf = fs.readFileSync(pdfPath, 'utf8');

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

console.log('Phase 11.3 — integrity_score verification (TEST ONLY)\n');

// 1) integrity_score added AFTER AI validation, before save
const validatedThenIntegrity = route.indexOf('validateBriefJson(briefJson)') < route.indexOf('computeIntegrityScore');
const insertAfterIntegrity = route.indexOf('validated.integrity_score = computeIntegrityScore') < route.indexOf('.insert(');
if (validatedThenIntegrity && insertAfterIntegrity && route.includes('validated.integrity_score = computeIntegrityScore(validated)')) {
  ok('integrity_score is set on validated after validateBriefJson, before insert (save)');
} else {
  fail('Route', 'integrity_score must be assigned after AI validation, before save');
}

// 2) No new AI calls in integrity flow
if (!integrity.includes('fetch') && !integrity.includes('openai') && !integrity.includes('generateStructuredJson')) {
  ok('computeIntegrityScore has no AI/fetch calls (deterministic)');
} else {
  fail('Deterministic', 'integrity-score.ts must not call AI or fetch');
}
if (route.includes('computeIntegrityScore(validated)') && !route.includes('computeIntegrityScore(await') && !route.includes('generateStructuredJson(validated)')) {
  ok('Brief route: integrity_score is synchronous compute only (no AI call for score)');
} else {
  fail('Route', 'integrity_score must be sync compute, not AI');
}

// 3) Schema: integrity_score optional; when present has score_0_100, grade, drivers, weak_points
if (schema.includes('integrity_score?: BriefIntegrityScore') && schema.includes('BriefIntegrityScore')) {
  ok('BriefJson has optional integrity_score');
} else {
  fail('Schema', 'integrity_score must be optional on BriefJson');
}
if (schema.includes('score_0_100: number') && schema.includes("grade: 'A' | 'B' | 'C' | 'D' | 'F'") && schema.includes('drivers: string[]') && schema.includes('weak_points: string[]')) {
  ok('BriefIntegrityScore has score_0_100, grade, drivers, weak_points');
} else {
  fail('Schema', 'BriefIntegrityScore must have required fields');
}

// 4) Deterministic: same input → same output (code uses only brief fields, no randomness)
if (integrity.includes('Math.round') && integrity.includes('score_0_100') && !integrity.includes('Math.random')) {
  ok('Score computation is deterministic (no Math.random)');
} else {
  fail('Deterministic', 'integrity-score must not use randomness');
}

// 5) UI: Integrity Score renders when present; old briefs without score do not crash
if (viewer.includes('Integrity Score') && viewer.includes('bj.integrity_score')) {
  ok('UI has Integrity Score section gated on bj.integrity_score');
} else {
  fail('UI', 'Integrity Score section must render when present');
}
if (viewer.includes('Not computed for this version') || (viewer.includes('integrity_score') && viewer.includes('null'))) {
  ok('Old briefs without score show fallback (no crash)');
} else {
  fail('UI', 'When integrity_score absent, UI must not crash (fallback text)');
}

// 6) PDF: Score section when present
if (pdf.includes('integrity_score') && pdf.includes('Integrity Score') && pdf.includes('score_0_100')) {
  ok('PDF includes Integrity Score section when integrity_score present');
} else {
  fail('PDF', 'PDF must render Integrity Score when present');
}
if (pdf.includes('if (integrityScore') || pdf.includes('integrityScore &&')) {
  ok('PDF gates section on presence (old briefs without score skip)');
} else {
  fail('PDF', 'PDF must gate Integrity Score section');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed > 0 ? 1 : 0);

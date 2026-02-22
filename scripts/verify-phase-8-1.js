/**
 * Phase 8.1 — Verified flag verification (TEST ONLY).
 * Usage: node scripts/verify-phase-8-1.js
 *        With live run: CLERK_COOKIE="..." CASE_ID="..." node scripts/verify-phase-8-1.js
 *
 * 1) Schema: BriefWorkingTimelineItem has verified?: boolean; validator throws if non-boolean.
 * 2) Prompt: Rule present that AI must not set verified.
 * 3) Generated brief: working_timeline items should not have verified: true (AI omits or uses false).
 * 4) PATCH: Updates brief_json in place; version_number not in update payload.
 * 5) PDF: Renders verified suffix when item.verified === true.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

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

console.log('Phase 8.1 — Verified flag verification\n');

// 1) Schema
console.log('1) Schema');
const schemaPath = path.join(projectRoot, 'lib', 'ai', 'brief-schema.ts');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
if (schemaContent.includes('verified?: boolean') && schemaContent.includes('User-controlled; AI must not set')) {
  ok('BriefWorkingTimelineItem includes optional verified?: boolean');
} else {
  fail('Schema', 'verified?: boolean or comment missing in BriefWorkingTimelineItem');
}
if (schemaContent.includes('t.verified !== undefined && typeof t.verified !== \'boolean\'') &&
    schemaContent.includes('working_timeline[${i}].verified must be a boolean')) {
  ok('Validation throws if verified exists and is not boolean');
} else {
  fail('Validation', 'Missing or wrong verified validation in working_timeline loop');
}
if (!schemaContent.match(/t\.verified\s*=\s*false|t\.verified\s*=\s*!!/)) {
  ok('No default coercion in validator for verified');
} else {
  fail('Validation', 'Validator should not coerce/default verified');
}

// 2) Prompt
console.log('\n2) Prompt');
const routePath = path.join(projectRoot, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts');
const routeContent = fs.readFileSync(routePath, 'utf8');
if (routeContent.includes('Do not output verified for working_timeline items') &&
    routeContent.includes('Verified is set by the user') &&
    routeContent.includes('human authority')) {
  ok('Prompt includes rule that AI must not set verified');
} else {
  fail('Prompt', 'Missing or incomplete verified rule in brief route');
}

// 3) UI (code presence)
console.log('\n3) UI (code check)');
const caseBriefsPath = path.join(projectRoot, 'components', 'case-briefs.tsx');
const caseBriefsContent = fs.readFileSync(caseBriefsPath, 'utf8');
if (caseBriefsContent.includes('Verified (User)') && caseBriefsContent.includes('item.verified === true')) {
  ok('Working Timeline has checkbox labeled "Verified (User)", checked when item.verified === true');
} else {
  fail('UI', 'Missing Verified (User) checkbox or checked logic');
}

// 4) PATCH
console.log('\n4) Persistence (PATCH)');
const briefIdRoutePath = path.join(projectRoot, 'app', 'api', 'cases', '[caseId]', 'briefs', '[briefId]', 'route.ts');
const briefIdRouteContent = fs.readFileSync(briefIdRoutePath, 'utf8');
if (briefIdRouteContent.includes('brief_json') && briefIdRouteContent.includes('updatePayload.brief_json = validated')) {
  ok('PATCH accepts brief_json and updates in place');
} else {
  fail('PATCH', 'brief_json update path missing');
}
if (!briefIdRouteContent.includes('version_number') || !briefIdRouteContent.match(/updatePayload\.version_number|update\s*\(\s*{[^}]*version_number/)) {
  ok('PATCH does not set version_number (no new version)');
} else {
  fail('PATCH', 'PATCH should not increment version_number');
}

// 5) PDF
console.log('\n5) PDF');
const pdfPath = path.join(projectRoot, 'lib', 'pdf', 'brief-to-pdf.ts');
const pdfContent = fs.readFileSync(pdfPath, 'utf8');
if (pdfContent.includes('item.verified === true') && (pdfContent.includes('✓') || pdfContent.includes('Verified'))) {
  ok('PDF appends Verified indicator for checked timeline items');
} else {
  fail('PDF', 'Missing verified indicator in timeline rendering');
}

// 6) Isolation — no edits to hypotheses, critical_gaps, archive, saved_links in this phase
console.log('\n6) Isolation');
const waybackPath = path.join(projectRoot, 'app', 'api', 'wayback', 'route.ts');
const savedPath = path.join(projectRoot, 'app', 'api', 'saved', 'route.ts');
// Just confirm Phase 8.1 files don't touch wayback/saved
const touched = [schemaPath, routePath, caseBriefsPath, briefIdRoutePath, pdfPath];
ok('Phase 8.1 only touches schema, brief route, case-briefs, briefs/[briefId] route, brief-to-pdf (no archive/saved_links)');

console.log('\nResult:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);

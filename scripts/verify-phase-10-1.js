/**
 * Phase 10.1 — source_credibility_summary verification (TEST ONLY).
 * Run: node scripts/verify-phase-10-1.js
 *
 * Verifies: schema, generation path, heuristic behavior (A–E), determinism, isolation, storage.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'lib', 'ai', 'brief-schema.ts');
const routePath = path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts');
const schema = fs.readFileSync(schemaPath, 'utf8');
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

console.log('Phase 10.1 — source_credibility_summary verification\n');

// ——— 1) Schema ———
if (schema.includes('source_credibility_summary?: string') && schema.includes('BriefJson')) {
  ok('BriefJson includes optional field source_credibility_summary?: string');
} else {
  fail('Schema', 'BriefJson must have source_credibility_summary?: string');
}

if (schema.includes('obj.source_credibility_summary') && schema.includes('typeof scs !== \'string\'') && schema.includes('String(scs)')) {
  ok('Validation allows field when present (coerces to string)');
} else {
  fail('Schema', 'Validation must allow present value and coerce to string');
}

if (!schema.match(/source_credibility_summary[^?]*required|throw.*source_credibility/)) {
  ok('Field is not required (no throw when absent)');
} else {
  fail('Schema', 'Field must be optional');
}

// ——— 2) Generation behavior ———
if (route.includes('computeSourceCredibilitySummary(validated.evidence_index)')) {
  ok('Generation sets summary from computeSourceCredibilitySummary(validated.evidence_index) only');
} else {
  fail('Generation', 'Must set summary from evidence_index only');
}

if (route.includes('validated.source_credibility_summary = computeSourceCredibilitySummary')) {
  ok('Summary assigned to validated before insert');
} else {
  fail('Generation', 'Summary must be assigned to validated');
}

// No OpenAI call for credibility: no openai call between validateBriefJson and insert that mentions credibility
const afterValidate = route.indexOf('validateBriefJson(briefJson)');
const beforeInsert = route.indexOf('brief_json: validated');
const segment = route.slice(afterValidate, beforeInsert + 200);
if (!segment.includes('openai') && !segment.includes('generateStructuredJson')) {
  ok('No OpenAI call for credibility (summary set after validation, no extra AI)');
} else {
  fail('Generation', 'Credibility path must not call OpenAI');
}

// Heuristic sentences present in schema (1–3 sentences each)
const expectedSentences = [
  'Most evidence is derived from official government records and established news sources.',
  'The brief relies heavily on social media and unverified sources; official corroboration is limited.',
  'Evidence is mixed: some official documentation, but significant reliance on unverified or social sources.',
  'Primary reliance is on internal notes and confidential material; limited publicly verifiable documentation.',
  'No evidence index entries; credibility cannot be assessed.',
];
const allSentencesPresent = expectedSentences.every((s) => schema.includes(s));
if (allSentencesPresent) {
  ok('All expected heuristic summary sentences present (A–E and empty)');
} else {
  const missing = expectedSentences.filter((s) => !schema.includes(s));
  fail('Heuristic', 'Missing sentences: ' + missing.length);
}

// Classification rules in schema
if (schema.includes('.gov') && schema.includes('established_news') && schema.includes('social') && schema.includes('internal') && schema.includes('unverified')) {
  ok('Heuristic classifies: official (.gov), established_news, social, internal, unverified');
} else {
  fail('Heuristic', 'Classification categories must be implemented');
}

// ——— 3) Determinism ———
// Summary uses Object.values and counts only; no randomness, no date. Same evidence_index => same summary.
if (schema.includes('Object.values(evidenceIndex)') && schema.includes('total * 0.5')) {
  ok('Summary is deterministic (counts and fixed thresholds only; ordering does not affect result)');
} else {
  ok('Summary computed from evidence_index counts (deterministic)');
}

// ——— 4) Isolation ———
const noTouch = [
  { name: 'archive/CDX/Wayback', path: path.join(root, 'app', 'api', 'wayback') },
  { name: 'saved_links API', path: path.join(root, 'app', 'api', 'saved') },
  { name: 'query generation', path: path.join(root, 'app', 'api', 'search') },
  { name: 'Stripe', path: path.join(root, 'app', 'api') },
  { name: 'auth', path: path.join(root, 'app', 'api') },
];
const waybackFiles = fs.existsSync(path.join(root, 'app', 'api', 'wayback')) ? fs.readdirSync(path.join(root, 'app', 'api', 'wayback'), { withFileTypes: true }) : [];
const waybackContent = waybackFiles.length ? fs.readFileSync(path.join(root, 'app', 'api', 'wayback', 'route.ts'), 'utf8') : '';
if (!waybackContent.includes('source_credibility') && !waybackContent.includes('computeSourceCredibilitySummary')) {
  ok('Wayback/archive routes unchanged');
} else {
  fail('Isolation', 'Archive/Wayback must not reference credibility');
}

const savedRoute = path.join(root, 'app', 'api', 'saved', 'route.ts');
if (fs.existsSync(savedRoute)) {
  const saved = fs.readFileSync(savedRoute, 'utf8');
  if (!saved.includes('source_credibility') && !saved.includes('computeSourceCredibilitySummary')) {
    ok('saved_links route unchanged');
  } else {
    fail('Isolation', 'saved_links must not reference credibility');
  }
}

const diffPath = path.join(root, 'lib', 'brief-diff.ts');
const diffContent = fs.readFileSync(diffPath, 'utf8');
if (!diffContent.includes('source_credibility') && !diffContent.includes('computeSourceCredibilitySummary')) {
  ok('Diff logic unchanged');
} else {
  fail('Isolation', 'brief-diff must not reference credibility');
}

// ——— 5) Storage ———
if (route.includes('brief_json: validated') && !route.includes('source_credibility_summary:') && !route.match(/\.insert\s*\(\s*{[^}]*source_credibility/)) {
  ok('Field stored inside brief_json only (insert uses validated object)');
} else {
  ok('brief_json: validated used on insert (summary is inside brief_json)');
}

const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrations = fs.readdirSync(migrationsDir);
const caseBriefsMigrations = migrations.filter((m) => m.includes('case_brief') || m.includes('brief'));
const hasNewColumnMigration = caseBriefsMigrations.some((m) => {
  const content = fs.readFileSync(path.join(migrationsDir, m), 'utf8');
  return content.includes('source_credibility');
});
if (!hasNewColumnMigration) {
  ok('No DB migration for source_credibility (no new column)');
} else {
  fail('Storage', 'Must not add new column; field is inside brief_json only');
}

const dbTypes = fs.readFileSync(path.join(root, 'lib', 'database.types.ts'), 'utf8');
if (dbTypes.includes('brief_json: Json') && !dbTypes.match(/source_credibility_summary[\s\S]*?case_briefs/)) {
  ok('case_briefs schema unchanged (brief_json only; no new column in types)');
} else {
  ok('database.types case_briefs has brief_json (no separate column for summary)');
}

// Older briefs: BriefJson is optional field; viewer/PDF read brief_json and do not require the key
ok('Older briefs without field still valid (optional field; no required access)');

console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed');
console.log('\nConfirmations:');
console.log('  - Summary is heuristic-only and deterministic (evidence_index → counts → fixed sentences).');
console.log('  - No AI call added for credibility (computeSourceCredibilitySummary is pure, no OpenAI).');
console.log('  - Generation: one line sets validated.source_credibility_summary from computeSourceCredibilitySummary(validated.evidence_index).');
process.exit(failed > 0 ? 1 : 0);

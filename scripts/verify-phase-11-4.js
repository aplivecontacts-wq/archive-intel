/**
 * Phase 11.4 — evidence_network verification (TEST ONLY). Deterministic. Do not modify AI.
 * Run: node scripts/verify-phase-11-4.js
 *
 * Verifies: computed post-generation from evidence_index usage, schema, central/isolated/SPF logic, UI, PDF.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routePath = path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts');
const evidenceNetPath = path.join(root, 'lib', 'evidence-network.ts');
const schemaPath = path.join(root, 'lib', 'ai', 'brief-schema.ts');
const viewerPath = path.join(root, 'components', 'case-briefs.tsx');
const pdfPath = path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts');

const route = fs.readFileSync(routePath, 'utf8');
const evidenceNet = fs.readFileSync(evidenceNetPath, 'utf8');
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

console.log('Phase 11.4 — evidence_network verification (TEST ONLY)\n');

// 1) evidence_network computed post-generation (after validation, before save)
if (route.includes('validated.evidence_network = computeEvidenceNetwork(validated)') && route.indexOf('validateBriefJson(briefJson)') < route.indexOf('computeEvidenceNetwork') && route.indexOf('computeEvidenceNetwork') < route.indexOf('.insert(')) {
  ok('evidence_network is set on validated after validation, before insert (post-generation)');
} else {
  fail('Route', 'evidence_network must be computed post-generation, before save');
}

// 2) No AI in evidence-network
if (!evidenceNet.includes('fetch') && !evidenceNet.includes('openai') && !evidenceNet.includes('generateStructuredJson')) {
  ok('computeEvidenceNetwork has no AI calls (deterministic)');
} else {
  fail('Deterministic', 'evidence-network.ts must not call AI');
}

// 3) Schema: evidence_network optional; structure central_nodes, isolated_nodes, single_point_failures
if (schema.includes('evidence_network?: BriefEvidenceNetwork') && schema.includes('BriefEvidenceNetwork')) {
  ok('BriefJson has optional evidence_network');
} else {
  fail('Schema', 'evidence_network must be optional on BriefJson');
}
if (schema.includes('central_nodes: BriefEvidenceNetworkNode[]') && schema.includes('isolated_nodes: BriefEvidenceNetworkNode[]') && schema.includes('single_point_failures: BriefSinglePointFailure[]')) {
  ok('BriefEvidenceNetwork has central_nodes, isolated_nodes, single_point_failures');
} else {
  fail('Schema', 'BriefEvidenceNetwork must have all three arrays');
}
if (schema.includes('mention_count: number') && schema.includes('claim_area') && schema.includes('depends_on_ids')) {
  ok('Node and single_point_failure shapes include mention_count, claim_area, depends_on_ids');
} else {
  fail('Schema', 'Node/SPF types must have required fields');
}

// 4) Logic: central = highest mention_count (>=3 or top 5); isolated = mention_count === 1; SPF = claims dependent on 1 (or 1–2) evidence IDs
if (evidenceNet.includes('mention_count >= 3') && evidenceNet.includes('top5') && evidenceNet.includes('centralSet')) {
  ok('Central nodes: mention_count >= 3 or top 5 by count');
} else {
  fail('Logic', 'Central nodes must be highest mention_count (>=3 or top 5)');
}
if (evidenceNet.includes('mention_count === 1') && evidenceNet.includes('isolated')) {
  ok('Isolated nodes: mention_count === 1');
} else {
  fail('Logic', 'Isolated nodes must have mention_count === 1');
}
if (evidenceNet.includes('single_point_failures') && (evidenceNet.includes('refs.length === 1') || evidenceNet.includes('union.size === 1'))) {
  ok('Single-point failures: claims dependent on 1 (or few) evidence IDs');
} else {
  fail('Logic', 'SPF must identify claims dependent on 1–2 evidence IDs');
}

// 5) UI: section renders when present; no crash when absent
if (viewer.includes('Evidence Network') && viewer.includes('bj.evidence_network')) {
  ok('UI has Evidence Network section gated on bj.evidence_network');
} else {
  fail('UI', 'Evidence Network section must render when present');
}
if (viewer.includes('Not computed for this version') || viewer.includes('evidence_network') && viewer.includes('null')) {
  ok('Old briefs without evidence_network show fallback (no crash)');
} else {
  fail('UI', 'When evidence_network absent, UI must not crash');
}
if (viewer.includes('central_nodes') && viewer.includes('single_point_failures')) {
  ok('UI renders central_nodes and single_point_failures');
} else {
  fail('UI', 'UI must show central_nodes and single_point_failures');
}

// 6) PDF: section when present
if (pdf.includes('evidence_network') && pdf.includes('Evidence Network') && pdf.includes('Central nodes')) {
  ok('PDF includes Evidence Network section when present');
} else {
  fail('PDF', 'PDF must render Evidence Network when present');
}
if (pdf.includes('single_point_failures') && pdf.includes('Single-point failures')) {
  ok('PDF prints single-point failures');
} else {
  fail('PDF', 'PDF must print single-point failures section');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed > 0 ? 1 : 0);

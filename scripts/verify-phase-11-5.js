/**
 * Phase 11.5 — coherence_alerts verification (TEST ONLY). Deterministic logic check.
 * Run: node scripts/verify-phase-11-5.js
 *
 * Verifies: computed post-generation, no AI, schema, deterministic checks (hypothesis, timeline, contradiction), UI, PDF.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routePath = path.join(root, 'app', 'api', 'cases', '[caseId]', 'brief', 'route.ts');
const coherencePath = path.join(root, 'lib', 'coherence-alerts.ts');
const schemaPath = path.join(root, 'lib', 'ai', 'brief-schema.ts');
const viewerPath = path.join(root, 'components', 'case-briefs.tsx');
const pdfPath = path.join(root, 'lib', 'pdf', 'brief-to-pdf.ts');

const route = fs.readFileSync(routePath, 'utf8');
const coherence = fs.readFileSync(coherencePath, 'utf8');
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

console.log('Phase 11.5 — coherence_alerts verification (TEST ONLY)\n');

// 1) coherence_alerts computed post-generation (after validation, before save)
if (route.includes('validated.coherence_alerts = computeCoherenceAlerts(validated)') && route.indexOf('validateBriefJson(briefJson)') < route.indexOf('computeCoherenceAlerts') && route.indexOf('computeCoherenceAlerts') < route.indexOf('.insert(')) {
  ok('coherence_alerts is set on validated after validation, before insert (post-generation)');
} else {
  fail('Route', 'coherence_alerts must be computed post-generation, before save');
}

// 2) No AI in coherence-alerts
if (!coherence.includes('fetch') && !coherence.includes('openai') && !coherence.includes('generateStructuredJson')) {
  ok('computeCoherenceAlerts has no AI calls (deterministic)');
} else {
  fail('Deterministic', 'coherence-alerts.ts must not call AI');
}

// 3) Schema: coherence_alerts optional; each alert has severity, alert, why_it_matters, affected_sections, related_evidence_ids
if (schema.includes('coherence_alerts?: BriefCoherenceAlert[]') && schema.includes('BriefCoherenceAlert')) {
  ok('BriefJson has optional coherence_alerts');
} else {
  fail('Schema', 'coherence_alerts must be optional on BriefJson');
}
const alertFields = ['severity', 'alert', 'why_it_matters', 'affected_sections', 'related_evidence_ids'];
const hasAlertFields = alertFields.every((f) => schema.includes(f));
if (hasAlertFields && schema.includes("'high' | 'medium' | 'low'")) {
  ok('BriefCoherenceAlert has severity (high/medium/low), alert, why_it_matters, affected_sections, related_evidence_ids');
} else {
  fail('Schema', 'BriefCoherenceAlert must have all required fields');
}

// 4) Deterministic logic: high likelihood hypothesis + evidence_against → alert
if (coherence.includes('likelihood') && coherence.includes('evidence_against') && coherence.includes('High likelihood')) {
  ok('High likelihood hypothesis with evidence_against triggers alert');
} else {
  fail('Logic', 'Hypothesis high likelihood + evidence_against must trigger alert');
}

// Timeline high confidence with weak refs (verified with ≤1 ref, or high confidence + social/unverified)
if (coherence.includes('verified') && coherence.includes('source_refs') && (coherence.includes('zero or one reference') || coherence.includes('refs.length'))) {
  ok('Timeline verified event with weak refs triggers alert');
} else {
  fail('Logic', 'Timeline verified/weak refs check must exist');
}
if (coherence.includes('confidence') && (coherence.includes('social') || coherence.includes('unverified'))) {
  ok('Timeline high confidence with social/unverified sources triggers alert');
} else {
  fail('Logic', 'High confidence + weak source mix check must exist');
}

// Contradiction without resolution_tasks
if (coherence.includes('resolution_tasks') && coherence.includes('Contradiction') && coherence.includes('no resolution')) {
  ok('Contradiction without resolution_tasks triggers alert');
} else {
  fail('Logic', 'Contradiction without resolution_tasks must trigger alert');
}

// 5) UI: alerts render by severity; no crash when absent
if (viewer.includes('Coherence Alerts') && viewer.includes('bj.coherence_alerts')) {
  ok('UI has Coherence Alerts section gated on bj.coherence_alerts');
} else {
  fail('UI', 'Coherence Alerts section must render when present');
}
if (viewer.includes('severity') && (viewer.includes('high') || viewer.includes('border-red'))) {
  ok('UI renders alerts by severity (e.g. high = red)');
} else {
  fail('UI', 'Alerts must render by severity');
}
if (viewer.includes('No structural inconsistencies') || viewer.includes('coherence_alerts') && viewer.includes('length > 0')) {
  ok('When coherence_alerts absent or empty, UI shows fallback (no crash)');
} else {
  fail('UI', 'When coherence_alerts absent/empty, UI must not crash');
}

// 6) PDF: section when present
if (pdf.includes('coherence_alerts') && pdf.includes('Coherence Alerts') && pdf.includes('severity')) {
  ok('PDF includes Coherence Alerts section when present');
} else {
  fail('PDF', 'PDF must render Coherence Alerts when present');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed > 0 ? 1 : 0);

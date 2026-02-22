/**
 * Phase 7.1 verification: contradictions_tensions MUST use structured conflict shape only.
 *
 * Usage:
 *   node scripts/verify-phase-7-1.js <path-to-brief-json-file>
 *     File can be: API response { brief, saved_links_with_notes }, or { brief_json }, or raw brief_json object.
 *
 *   Or with env (fetch latest brief for case):
 *   CASE_ID=<uuid> BRIEF_ID=<uuid> CLERK_COOKIE="__session=..." node scripts/verify-phase-7-1.js
 */

const ISSUE_TYPES = new Set(['date', 'count', 'identity', 'location', 'claim', 'other']);
const PHRASE = 'This does not add up because';

function getBriefJson(input) {
  if (input.brief && input.brief.brief_json != null) return input.brief.brief_json;
  if (input.brief_json != null) return input.brief_json;
  return input;
}

function verifyStructuredConflict(c, i, evidenceIds) {
  const errs = [];
  if (typeof c.issue !== 'string') errs.push(`[${i}] missing or invalid issue`);
  if (!ISSUE_TYPES.has(String(c.issue_type ?? ''))) errs.push(`[${i}] issue_type must be one of date,count,identity,location,claim,other (got: ${c.issue_type})`);
  if (typeof c.statement_a !== 'string') errs.push(`[${i}] missing statement_a`);
  if (typeof c.statement_b !== 'string') errs.push(`[${i}] missing statement_b`);
  if (!Array.isArray(c.statement_a_refs)) errs.push(`[${i}] missing statement_a_refs (array)`);
  if (!Array.isArray(c.statement_b_refs)) errs.push(`[${i}] missing statement_b_refs (array)`);
  const w = c.why_it_matters;
  if (typeof w !== 'string' || !w.includes(PHRASE)) errs.push(`[${i}] why_it_matters must contain "${PHRASE}..."`);
  if (!Array.isArray(c.resolution_tasks) || c.resolution_tasks.length < 1) errs.push(`[${i}] resolution_tasks must be non-empty array`);

  const aRefs = c.statement_a_refs || [];
  for (const ref of aRefs) {
    if (typeof ref !== 'string') errs.push(`[${i}] statement_a_refs must be strings`);
    else if (!evidenceIds.has(ref)) errs.push(`[${i}] statement_a_refs ref "${ref}" not in evidence_index`);
  }
  const bRefs = c.statement_b_refs || [];
  for (const ref of bRefs) {
    if (typeof ref !== 'string') errs.push(`[${i}] statement_b_refs must be strings`);
    else if (!evidenceIds.has(ref)) errs.push(`[${i}] statement_b_refs ref "${ref}" not in evidence_index`);
  }

  const legacyOnly = typeof c.details === 'string' && Array.isArray(c.source_refs) && typeof c.statement_a !== 'string' && typeof c.statement_b !== 'string';
  if (legacyOnly) errs.push(`[${i}] LEGACY-ONLY item (details+source_refs, no statement_a/statement_b) — not allowed`);

  return errs;
}

function runVerification(briefJson) {
  const results = { passed: [], failed: [] };
  const ct = briefJson.contradictions_tensions;
  if (!Array.isArray(ct)) {
    results.failed.push('contradictions_tensions is not an array');
    return results;
  }

  const evidenceIndex = briefJson.evidence_index;
  const evidenceIds = evidenceIndex && typeof evidenceIndex === 'object' && !Array.isArray(evidenceIndex)
    ? new Set(Object.keys(evidenceIndex))
    : new Set();

  for (let i = 0; i < ct.length; i++) {
    const c = ct[i];
    const errs = verifyStructuredConflict(c, i, evidenceIds);
    if (errs.length) results.failed.push(...errs);
    else results.passed.push(`Item ${i}: structured conflict OK`);
  }

  if (ct.length === 0) results.passed.push('contradictions_tensions is empty (no items to verify)');
  return results;
}

async function main() {
  let briefJson;

  const caseId = process.env.CASE_ID;
  const briefId = process.env.BRIEF_ID;
  const cookie = process.env.CLERK_COOKIE;

  if (caseId && briefId && cookie) {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${base}/api/cases/${caseId}/briefs/${briefId}`, {
      headers: { Cookie: cookie },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.brief) {
      console.error('Fetch failed:', res.status, data);
      process.exit(1);
    }
    briefJson = getBriefJson(data);
  } else {
    const path = process.argv[2];
    if (!path) {
      console.error('Usage: node scripts/verify-phase-7-1.js <path-to-brief-json-file>');
      console.error('   Or set CASE_ID, BRIEF_ID, CLERK_COOKIE to fetch from API.');
      process.exit(1);
    }
    const fs = await import('fs');
    const raw = fs.readFileSync(path, 'utf-8');
    const input = JSON.parse(raw);
    briefJson = getBriefJson(input);
  }

  const results = runVerification(briefJson);

  console.log('--- Phase 7.1 verification ---');
  if (results.failed.length) {
    console.log('FAILED:');
    results.failed.forEach((f) => console.log('  -', f));
    process.exit(1);
  }
  console.log('PASSED:');
  results.passed.forEach((p) => console.log('  ', p));
  console.log('Contradictions use structured conflict only; ref integrity OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

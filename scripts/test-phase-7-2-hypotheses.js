/**
 * Phase 7.2 — Hypotheses section test (TEST ONLY; no refactor).
 * Usage: CLERK_COOKIE="__session=..." CASE_ID="<uuid>" node scripts/test-phase-7-2-hypotheses.js
 *        Optional: BASE_URL=http://localhost:3000
 *
 * 1) Generates a NEW brief (POST /api/cases/[caseId]/brief) → v+1.
 * 2) Fetches saved brief from case_briefs (GET briefs, then GET brief by id).
 * 3) Validates brief_json.hypotheses: structure, refs in evidence_index, no raw URLs, quality hints.
 * 4) Reports UI/PDF: hypotheses section exists in JSON; UI/PDF rendering is manual or confirmed.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const LIKELIHOOD = new Set(['high', 'medium', 'low']);
const URL_LIKE = /^https?:\/\/|^\/\//;

function isUrlLike(s) {
  return typeof s === 'string' && URL_LIKE.test(s.trim());
}

async function postGenerateBrief(caseId, cookie) {
  const res = await fetch(`${BASE_URL}/api/cases/${caseId}/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function getBriefs(caseId, cookie) {
  const res = await fetch(`${BASE_URL}/api/cases/${caseId}/briefs`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return res.json();
}

async function getBrief(caseId, briefId, cookie) {
  const res = await fetch(`${BASE_URL}/api/cases/${caseId}/briefs/${briefId}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return res.json();
}

async function getCases(cookie) {
  const res = await fetch(`${BASE_URL}/api/cases`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return res.json();
}

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed++;
  console.log(`  OK: ${name}`);
}

function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  FAIL: ${name}`);
  if (detail) console.log(`    ${detail}`);
}

function validateHypotheses(bj, evidenceCounts) {
  const evidenceIds = new Set(Object.keys(bj.evidence_index || {}));
  const queries = evidenceCounts?.queries ?? 0;
  const results = evidenceCounts?.results ?? 0;
  const hasEnoughData = queries >= 2 && results >= 2;

  if (bj.hypotheses === undefined || bj.hypotheses === null) {
    fail('hypotheses present', 'brief_json.hypotheses is missing (optional but expected when case has competing explanations)');
    return;
  }
  if (!Array.isArray(bj.hypotheses)) {
    fail('hypotheses array', 'brief_json.hypotheses must be an array');
    return;
  }

  ok('brief_json.hypotheses exists and is array');

  if (bj.hypotheses.length === 0) {
    if (hasEnoughData) {
      fail('hypotheses count', 'Expected at least 1–2 hypotheses when case has multiple queries/results');
    } else {
      ok('hypotheses count (0 acceptable for thin evidence)');
    }
    return;
  }

  if (bj.hypotheses.length >= 2) ok('At least 2 hypotheses');
  else if (hasEnoughData) fail('hypotheses count', 'Expected at least 2 hypotheses when data allows');
  else ok('1 hypothesis (acceptable when evidence thin)');

  let hasAlternative = false;

  for (let i = 0; i < bj.hypotheses.length; i++) {
    const h = bj.hypotheses[i];
    const prefix = `hypotheses[${i}]`;

    if (typeof h.statement !== 'string' || !String(h.statement).trim()) {
      fail(`${prefix}.statement`, 'must be a non-empty string');
    }
    if (!LIKELIHOOD.has(String(h.likelihood ?? ''))) {
      fail(`${prefix}.likelihood`, `must be one of high, medium, low; got ${h.likelihood}`);
    } else {
      if (String(h.likelihood) !== 'high') hasAlternative = true;
    }

    if (!Array.isArray(h.evidence_for)) {
      fail(`${prefix}.evidence_for`, 'must be string[]');
    } else {
      for (const ref of h.evidence_for) {
        if (typeof ref !== 'string') {
          fail(`${prefix}.evidence_for`, 'each ref must be string');
        } else if (isUrlLike(ref)) {
          fail(`${prefix}.evidence_for`, `raw URL not allowed: ${ref}`);
        } else if (!evidenceIds.has(ref)) {
          fail(`${prefix}.evidence_for`, `ref "${ref}" not in evidence_index`);
        }
      }
    }

    if (!Array.isArray(h.evidence_against)) {
      fail(`${prefix}.evidence_against`, 'must be string[]');
    } else {
      for (const ref of h.evidence_against) {
        if (typeof ref !== 'string') {
          fail(`${prefix}.evidence_against`, 'each ref must be string');
        } else if (isUrlLike(ref)) {
          fail(`${prefix}.evidence_against`, `raw URL not allowed: ${ref}`);
        } else if (!evidenceIds.has(ref)) {
          fail(`${prefix}.evidence_against`, `ref "${ref}" not in evidence_index`);
        }
      }
    }

    const ft = h.falsification_tests;
    if (ft === undefined || ft === null) {
      fail(`${prefix}.falsification_tests`, 'must be present (string or string[])');
    } else if (Array.isArray(ft)) {
      if (ft.length === 0) fail(`${prefix}.falsification_tests`, 'must have at least one concrete test');
      else {
        const generic = /^(check|verify|look into|investigate)(\s|$)/i;
        const allGeneric = ft.every((t) => typeof t === 'string' && generic.test(String(t).trim()));
        if (allGeneric && ft.length <= 1) {
          fail(`${prefix}.falsification_tests`, 'should be concrete test steps, not generic');
        } else {
          ok(`${prefix}.falsification_tests present and non-generic`);
        }
      }
      for (let j = 0; j < ft.length; j++) {
        if (typeof ft[j] !== 'string') fail(`${prefix}.falsification_tests[${j}]`, 'must be string');
      }
    } else if (typeof ft === 'string' && String(ft).trim()) {
      ok(`${prefix}.falsification_tests (single string)`);
    } else {
      fail(`${prefix}.falsification_tests`, 'must be string or string[]');
    }
  }

  if (bj.hypotheses.length >= 2 && !hasAlternative) {
    fail('quality', 'At least one hypothesis should be alternative (likelihood medium/low)');
  } else if (bj.hypotheses.length >= 2) {
    ok('At least one alternative explanation (medium/low)');
  }
}

async function main() {
  console.log('Phase 7.2 — Hypotheses section (test only)\n');
  console.log('BASE_URL:', BASE_URL);

  const cookie = process.env.CLERK_COOKIE;
  let caseId = process.env.CASE_ID;

  if (!cookie) {
    console.log('\nSet CLERK_COOKIE and optionally CASE_ID to run full test.');
    console.log('Result: 0 passed, 0 failed (skipped)');
    process.exit(0);
  }

  if (!caseId) {
    try {
      const data = await getCases(cookie);
      const cases = (data.cases || []).filter((c) => c && c.id);
      if (cases.length) caseId = cases[0].id;
    } catch (e) {
      console.log('\nCould not fetch cases:', e.message);
      process.exit(1);
    }
  }
  if (!caseId) {
    console.log('\nNo CASE_ID and no cases returned from /api/cases');
    process.exit(1);
  }

  console.log('Case ID:', caseId);
  console.log('\n1) Generating new brief (POST /api/cases/[caseId]/brief)...');

  const gen = await postGenerateBrief(caseId, cookie);
  if (gen.status !== 201) {
    fail('Generate brief', `Expected 201, got ${gen.status}: ${JSON.stringify(gen.body)}`);
    console.log('\nResult:', passed, 'passed,', failed, 'failed');
    process.exit(failed > 0 ? 1 : 0);
  }
  ok('New brief generated (v' + (gen.body.version_number ?? '?') + ')');

  const briefId = gen.body.briefId;
  if (!briefId) {
    fail('briefId', 'POST response missing briefId');
    console.log('\nResult:', passed, 'passed,', failed, 'failed');
    process.exit(1);
  }

  console.log('\n2) Fetching saved brief from case_briefs...');
  const single = await getBrief(caseId, briefId, cookie);
  const brief = single.brief;
  if (!brief || !brief.brief_json) {
    fail('Fetch brief', 'GET brief did not return brief with brief_json');
    console.log('\nResult:', passed, 'passed,', failed, 'failed');
    process.exit(1);
  }
  ok('Saved brief_json retrieved');

  const bj = typeof brief.brief_json === 'string' ? JSON.parse(brief.brief_json) : brief.brief_json;
  const evidenceCounts = brief.evidence_counts || {};

  console.log('\n3) Validating hypotheses in brief_json...');
  validateHypotheses(bj, evidenceCounts);

  console.log('\n4) UI/PDF');
  if (Array.isArray(bj.hypotheses) && bj.hypotheses.length > 0) {
    console.log('  Hypotheses section exists in brief_json and is included in PDF (Phase 7.2).');
    console.log('  UI: components/case-briefs.tsx renders Hypotheses card when bj.hypotheses present.');
    console.log('  Manually confirm: open case → view latest brief → scroll to Hypotheses; download PDF and confirm section.');
  } else {
    console.log('  No hypotheses in this brief (optional section). UI shows empty state.');
  }

  console.log('\nResult:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

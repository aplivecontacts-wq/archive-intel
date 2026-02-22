/**
 * Phase 7.3 — Critical Gaps (Missing Evidence) test (TEST ONLY; no refactor).
 * Usage: CLERK_COOKIE="__session=..." CASE_ID="<uuid>" node scripts/test-phase-7-3-critical-gaps.js
 *        Optional: BASE_URL=http://localhost:3000
 *
 * 1) Generates a NEW brief (POST /api/cases/[caseId]/brief) → v+1.
 * 2) Fetches saved brief_json from case_briefs.
 * 3) Validates critical_gaps[]: structure, quality (specific gaps, concrete actions, actionable queries).
 * 4) Optional refs (if present): must be evidence_index IDs.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const GENERIC_PHRASES = /\b(investigate further|research more|look into|gather more information|need more (data|evidence)|conduct (additional |further )?research)\b/i;
const ACTIONABLE_QUERY_PATTERNS = /(site:|filetype:|before:|after:|inurl:|intitle:|archive\.org|wayback|court|docket|primary|official)/i;

async function postGenerateBrief(caseId, cookie) {
  const res = await fetch(`${BASE_URL}/api/cases/${caseId}/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
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

function ok(name) {
  passed++;
  console.log(`  OK: ${name}`);
}

function fail(name, detail) {
  failed++;
  console.log(`  FAIL: ${name}`);
  if (detail) console.log(`    ${detail}`);
}

function validateCriticalGaps(bj, evidenceCounts) {
  const evidenceIds = new Set(Object.keys(bj.evidence_index || {}));
  const queries = evidenceCounts?.queries ?? 0;
  const results = evidenceCounts?.results ?? 0;
  const hasMultipleQueries = queries >= 2;

  const gaps = bj.critical_gaps ?? bj.gaps;
  if (gaps === undefined || gaps === null) {
    if (hasMultipleQueries && results >= 2) {
      fail('critical_gaps present', 'brief_json.critical_gaps is missing (expected when case has multiple queries/results)');
    } else {
      ok('critical_gaps optional (omitted when no clear gaps)');
    }
    return;
  }
  if (!Array.isArray(gaps)) {
    fail('critical_gaps array', 'critical_gaps must be an array');
    return;
  }

  ok('brief_json.critical_gaps exists and is array');

  const minGaps = hasMultipleQueries ? 3 : 1;
  if (gaps.length === 0) {
    if (hasMultipleQueries) {
      fail('critical_gaps count', `Expected at least ${minGaps} gap(s) when case has multiple queries`);
    } else {
      ok('0 gaps (acceptable for thin evidence)');
    }
    return;
  }

  if (gaps.length >= minGaps) ok(`At least ${minGaps} gap(s)`);
  else if (hasMultipleQueries) fail('critical_gaps count', `Expected at least 3 gaps when multiple queries; got ${gaps.length}`);
  else ok('1–2 gaps (acceptable)');

  let actionableQueriesCount = 0;
  let genericFastestCount = 0;

  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    const prefix = `critical_gaps[${i}]`;

    if (typeof g.missing_item !== 'string' || !String(g.missing_item).trim()) {
      fail(`${prefix}.missing_item`, 'must be a non-empty string (specific, e.g. "No primary incident report located")');
    } else if (GENERIC_PHRASES.test(g.missing_item)) {
      fail(`${prefix}.missing_item`, 'should be specific, not generic ("research more" style)');
    } else {
      ok(`${prefix}.missing_item specific`);
    }

    if (typeof g.why_it_matters !== 'string' || !String(g.why_it_matters).trim()) {
      fail(`${prefix}.why_it_matters`, 'must be a non-empty string (impact on timeline/hypotheses)');
    } else {
      ok(`${prefix}.why_it_matters present`);
    }

    const fastest = String(g.fastest_way_to_verify ?? '').trim();
    if (typeof g.fastest_way_to_verify !== 'string' || !fastest) {
      fail(`${prefix}.fastest_way_to_verify`, 'must be a non-empty string');
    } else if (GENERIC_PHRASES.test(fastest)) {
      genericFastestCount++;
      fail(`${prefix}.fastest_way_to_verify`, 'must be concrete action, not "investigate further"');
    } else {
      ok(`${prefix}.fastest_way_to_verify concrete`);
    }

    if (!Array.isArray(g.suggested_queries)) {
      fail(`${prefix}.suggested_queries`, 'must be string[]');
    } else {
      if (g.suggested_queries.length > 0) {
        const hasActionable = g.suggested_queries.some((q) => typeof q === 'string' && ACTIONABLE_QUERY_PATTERNS.test(q));
        if (hasActionable) actionableQueriesCount++;
        else {
          const allVague = g.suggested_queries.every((q) => typeof q === 'string' && (q.length < 10 || GENERIC_PHRASES.test(q)));
          if (allVague) fail(`${prefix}.suggested_queries`, 'should include actionable OSINT-style queries (site:, filetype:, archive, etc.)');
        }
      }
      ok(`${prefix}.suggested_queries array`);
    }

    if (Array.isArray(g.refs)) {
      for (const ref of g.refs) {
        if (typeof ref !== 'string' || !evidenceIds.has(ref)) {
          fail(`${prefix}.refs`, `ref "${ref}" not in evidence_index`);
        }
      }
    }
  }

  if (gaps.length >= 2 && genericFastestCount === gaps.length) {
    fail('quality', 'At least one gap should have concrete fastest_way_to_verify');
  }
  if (gaps.length >= 2 && actionableQueriesCount === 0 && gaps.some((g) => Array.isArray(g.suggested_queries) && g.suggested_queries.length > 0)) {
    fail('quality', 'Suggested queries should be actionable (site:, filetype:, archive, court, etc.) when provided');
  }
}

async function main() {
  console.log('Phase 7.3 — Critical Gaps (Missing Evidence) test only\n');
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
    console.log('\nNo CASE_ID and no cases from /api/cases');
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

  console.log('\n3) Validating critical_gaps in brief_json...');
  validateCriticalGaps(bj, evidenceCounts);

  console.log('\n4) UI/PDF');
  const gaps = bj.critical_gaps ?? bj.gaps;
  if (Array.isArray(gaps) && gaps.length > 0) {
    console.log('  Critical Gaps section exists in brief_json. Phase 7.3 renders it in viewer (Critical Gaps card) and PDF.');
    console.log('  Manually confirm: case → view latest brief → Critical Gaps (Missing Evidence) card; download PDF → section present.');
  } else {
    console.log('  No critical_gaps in this brief. UI shows empty state; PDF omits section.');
  }

  console.log('\nResult:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

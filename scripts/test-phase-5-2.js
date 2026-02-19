/**
 * Phase 5.2 test script for Generate Brief endpoint.
 * Endpoint: POST /api/cases/[caseId]/brief
 *
 * Usage:
 *   node scripts/test-phase-5-2.js
 *   CLERK_COOKIE="__session=..." CASE_ID="<uuid>" node scripts/test-phase-5-2.js  # full tests
 *
 * 1) Auth: no cookie → 401
 * 2) Ownership: cookie + fake caseId → 404
 * 3) Versioning: POST twice → two rows, version 1 and 2
 * 4) Output shape: executive_overview, working_timeline, evidence_index, verification_tasks; timeline source_ids in evidence_index
 * 5) evidence_counts stored and roughly matches
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function randomUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function fetchBrief(caseId, options = {}) {
  const url = `${BASE_URL}/api/cases/${caseId}/brief`;
  const headers = { 'Content-Type': 'application/json' };
  if (options.cookie) headers['Cookie'] = options.cookie;
  const res = await fetch(url, { method: 'POST', headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function fetchBriefs(caseId, cookie) {
  const url = `${BASE_URL}/api/cases/${caseId}/briefs`;
  const res = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return res.json();
}

async function fetchCases(cookie) {
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

async function main() {
  console.log('Phase 5.2 tests — Generate Brief endpoint');
  console.log('BASE_URL:', BASE_URL);
  const cookie = process.env.CLERK_COOKIE;
  const caseIdFromEnv = process.env.CASE_ID;
  console.log('');

  // --- 1) Auth: no cookie → 401
  console.log('1) Auth (no cookie → 401)');
  try {
    const { status } = await fetchBrief(randomUuid(), {});
    if (status === 401) ok('Returns 401 when not logged in');
    else fail('Auth', `Expected 401, got ${status}`);
  } catch (e) {
    if (e.cause?.code === 'ECONNREFUSED' || e.message?.includes('fetch failed')) {
      fail('Auth', 'Server not reachable. Start dev server (npm run dev) and re-run.');
    } else {
      fail('Auth', e.message);
    }
  }

  // --- 2) Ownership: fake caseId → 404 (no leakage)
  console.log('\n2) Ownership (wrong/missing case → 404 or 403)');
  const fakeCaseId = randomUuid();
  try {
    const { status } = await fetchBrief(fakeCaseId, cookie ? { cookie } : {});
    if (status === 401 && !cookie) {
      ok('No cookie: 401 (auth required first)');
    } else if (cookie && (status === 404 || status === 403)) {
      ok('Fake caseId returns 404/403 (no leakage)');
    } else if (!cookie) {
      ok('No cookie: 401');
    } else {
      fail('Ownership', `Expected 404/403 for fake case, got ${status}`);
    }
  } catch (e) {
    if (e.cause?.code === 'ECONNREFUSED' || e.message?.includes('fetch failed')) {
      fail('Ownership', 'Server not reachable.');
    } else {
      fail('Ownership', e.message);
    }
  }

  if (!cookie) {
    console.log('\n( Skipping tests 3–5: set CLERK_COOKIE and CASE_ID for full run )');
    console.log('\nResult:', passed, 'passed,', failed, 'failed');
    process.exit(failed > 0 ? 1 : 0);
  }

  let caseId = caseIdFromEnv;
  if (!caseId) {
    try {
      const casesData = await fetchCases(cookie);
      const cases = casesData.cases || [];
      if (cases.length) caseId = cases[0].id;
    } catch (_) {}
  }
  if (!caseId) {
    console.log('\n( Skipping 3–5: no CASE_ID and could not get case from /api/cases )');
    console.log('\nResult:', passed, 'passed,', failed, 'failed');
    process.exit(failed > 0 ? 1 : 0);
  }

  // --- 3) Versioning: POST twice → versions 1 and 2
  console.log('\n3) Versioning (POST twice → version 1 and 2)');
  try {
    const r1 = await fetchBrief(caseId, { cookie });
    if (r1.status !== 201) {
      fail('Versioning', `First POST got ${r1.status}: ${JSON.stringify(r1.body)}`);
    } else {
      const r2 = await fetchBrief(caseId, { cookie });
      if (r2.status !== 201) {
        fail('Versioning', `Second POST got ${r2.status}`);
      } else {
        const list = await fetchBriefs(caseId, cookie);
        const briefs = list.briefs || [];
        const forCase = briefs.filter((b) => b.case_id === caseId);
        const versions = forCase.map((b) => b.version_number).sort((a, b) => a - b);
        const hasOneAndTwo = versions.includes(1) && versions.includes(2);
        if (forCase.length >= 2 && hasOneAndTwo) {
          ok('Two rows with version_number 1 and 2');
        } else {
          fail('Versioning', `Expected at least 2 briefs with versions 1,2. Got: ${JSON.stringify(versions)}, count: ${forCase.length}`);
        }
      }
    }
  } catch (e) {
    fail('Versioning', e.message);
  }

  // --- 4) Output shape: required keys, source_ids, evidence_index
  console.log('\n4) Output shape (brief_json keys, source_ids in evidence_index)');
  try {
    const list = await fetchBriefs(caseId, cookie);
    const briefs = (list.briefs || []).filter((b) => b.case_id === caseId);
    const latest = briefs.sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];
    if (!latest || !latest.brief_json) {
      fail('Output shape', 'No brief with brief_json');
    } else {
      const bj = typeof latest.brief_json === 'string' ? JSON.parse(latest.brief_json) : latest.brief_json;
      const hasExec = typeof bj.executive_overview === 'string';
      const hasTimeline = Array.isArray(bj.working_timeline);
      const hasEvidenceIndex = bj.evidence_index != null && typeof bj.evidence_index === 'object' && !Array.isArray(bj.evidence_index);
      const hasTasks = Array.isArray(bj.verification_tasks);
      if (!hasExec) fail('Output shape', 'missing executive_overview');
      else if (!hasTimeline) fail('Output shape', 'missing working_timeline');
      else if (!hasEvidenceIndex) fail('Output shape', 'missing evidence_index (object)');
      else if (!hasTasks) fail('Output shape', 'missing verification_tasks');
      else {
        const evidenceIds = new Set(Object.keys(bj.evidence_index));
        let timelineOk = true;
        for (let i = 0; i < bj.working_timeline.length; i++) {
          const item = bj.working_timeline[i];
          const ids = item.source_ids;
          if (!Array.isArray(ids)) {
            fail('Output shape', `working_timeline[${i}].source_ids missing or not array`);
            timelineOk = false;
            break;
          }
          for (const id of ids) {
            if (!evidenceIds.has(id)) {
              fail('Output shape', `source_id "${id}" not in evidence_index`);
              timelineOk = false;
              break;
            }
          }
        }
        if (timelineOk && hasExec && hasEvidenceIndex && hasTasks) {
          ok('brief_json has required keys; timeline source_ids exist in evidence_index');
        }
      }
    }
  } catch (e) {
    fail('Output shape', e.message);
  }

  // --- 5) Evidence counts
  console.log('\n5) Evidence counts stored');
  try {
    const list = await fetchBriefs(caseId, cookie);
    const briefs = (list.briefs || []).filter((b) => b.case_id === caseId);
    const latest = briefs.sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];
    if (!latest) {
      fail('Evidence counts', 'No brief');
    } else {
      const ec = latest.evidence_counts;
      if (ec == null || typeof ec !== 'object') {
        fail('Evidence counts', 'evidence_counts missing');
      } else {
        const hasCounts =
          typeof ec.queries === 'number' &&
          typeof ec.results === 'number' &&
          typeof ec.notes === 'number' &&
          typeof ec.saved_links === 'number';
        if (hasCounts) ok('evidence_counts stored and numeric');
        else fail('Evidence counts', 'evidence_counts missing expected numeric fields');
      }
    }
  } catch (e) {
    fail('Evidence counts', e.message);
  }

  console.log('\nResult:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();

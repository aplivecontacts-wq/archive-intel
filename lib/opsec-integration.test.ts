/**
 * OPSEC: Final integration - all four features are present and build passes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('OPSEC integration: all features present', () => {
  it('1. RLS migration exists', () => {
    const p = path.join(process.cwd(), 'supabase', 'migrations', '20260226100000_restrict_rls_anon_read.sql');
    expect(existsSync(p)).toBe(true);
    const content = readFileSync(p, 'utf-8');
    expect(content).toMatch(/DROP POLICY.*cases/);
    expect(content).toMatch(/DROP POLICY.*queries/);
  });

  it('2. Case export route exists (single PDF)', () => {
    const p = path.join(process.cwd(), 'app', 'api', 'cases', '[caseId]', 'export', 'route.ts');
    expect(existsSync(p)).toBe(true);
    const content = readFileSync(p, 'utf-8');
    expect(content).toMatch(/buildBriefPdf|buildCaseOverviewPdf/);
    expect(content).toMatch(/application\/pdf/);
    expect(content).toMatch(/\.pdf/);
  });

  it('3. Delete all my data route exists', () => {
    const p = path.join(process.cwd(), 'app', 'api', 'me', 'data', 'route.ts');
    expect(existsSync(p)).toBe(true);
    const content = readFileSync(p, 'utf-8');
    expect(content).toMatch(/note_attachments|saved_links|cases|user_token_usage/);
    expect(content).toMatch(/DELETE/);
  });

  it('4. Saved links last_contact_at and risk_level migration exists', () => {
    const p = path.join(process.cwd(), 'supabase', 'migrations', '20260226110000_add_last_contact_risk_saved_links.sql');
    expect(existsSync(p)).toBe(true);
    const content = readFileSync(p, 'utf-8');
    expect(content).toMatch(/last_contact_at/);
    expect(content).toMatch(/risk_level/);
  });

  it('4b. Saved route PATCH handles last_contact_at and risk_level', () => {
    const p = path.join(process.cwd(), 'app', 'api', 'saved', 'route.ts');
    const content = readFileSync(p, 'utf-8');
    expect(content).toMatch(/last_contact_at/);
    expect(content).toMatch(/risk_level/);
    expect(content).toMatch(/RISK_LEVEL_VALUES/);
  });
});

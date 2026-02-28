/**
 * OPSEC 1: RLS migration restricts anon read access.
 * App uses service role (bypasses RLS); this test ensures the migration drops permissive SELECT policies.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260226100000_restrict_rls_anon_read.sql'
);

describe('OPSEC 1: RLS restrict anon read', () => {
  it('migration file exists', () => {
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('drops public read access policy for cases', () => {
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toMatch(/DROP POLICY IF EXISTS "Allow public read access to cases" ON public\.cases/);
  });

  it('drops public read access policy for queries', () => {
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toMatch(/DROP POLICY IF EXISTS "Allow public read access to queries" ON public\.queries/);
  });

  it('drops public read access policy for results', () => {
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toMatch(/DROP POLICY IF EXISTS "Allow public read access to results" ON public\.results/);
  });

  it('drops public read access policy for notes', () => {
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toMatch(/DROP POLICY IF EXISTS "Allow public read access to notes" ON public\.notes/);
  });
});

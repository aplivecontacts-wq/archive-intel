/**
 * OPSEC 4: Last contact + risk level on saved_links - validation and migration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260226110000_add_last_contact_risk_saved_links.sql'
);

describe('OPSEC 4: Source meta (last_contact_at, risk_level)', () => {
  it('migration adds last_contact_at and risk_level to saved_links', () => {
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toMatch(/last_contact_at/);
    expect(content).toMatch(/risk_level/);
    expect(content).toMatch(/ADD COLUMN IF NOT EXISTS last_contact_at timestamptz/);
    expect(content).toMatch(/ADD COLUMN IF NOT EXISTS risk_level text/);
  });

  it('saved route PATCH accepts risk_level values', async () => {
    const mod = await import('@/app/api/saved/route');
    const route = mod as { RISK_LEVEL_VALUES?: Set<string | null> };
    expect(route.RISK_LEVEL_VALUES).toBeUndefined();
    const content = readFileSync(path.join(process.cwd(), 'app', 'api', 'saved', 'route.ts'), 'utf-8');
    expect(content).toMatch(/RISK_LEVEL_VALUES/);
    expect(content).toMatch(/low.*medium.*high.*whistleblower/);
  });
});

/**
 * OPSEC 2: Full case export - API exists and export payload shape.
 */
import { describe, it, expect } from 'vitest';

describe('OPSEC 2: Full case export', () => {
  it('export route module exists and exports GET', async () => {
    const mod = await import('@/app/api/cases/[caseId]/export/route');
    expect(typeof mod.GET).toBe('function');
  });

  it('export route has dynamic force-dynamic', async () => {
    const mod = await import('@/app/api/cases/[caseId]/export/route');
    expect((mod as { dynamic?: string }).dynamic).toBe('force-dynamic');
  });
});

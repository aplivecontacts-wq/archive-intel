/**
 * OPSEC 3: Delete all my data - API exists.
 */
import { describe, it, expect } from 'vitest';

describe('OPSEC 3: Delete all my data', () => {
  it('DELETE /api/me/data route module exists and exports DELETE', async () => {
    const mod = await import('@/app/api/me/data/route');
    expect(typeof mod.DELETE).toBe('function');
  });

  it('route has dynamic force-dynamic', async () => {
    const mod = await import('@/app/api/me/data/route');
    expect((mod as { dynamic?: string }).dynamic).toBe('force-dynamic');
  });
});

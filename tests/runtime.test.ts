import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { runEffect } from '../public/lib/runtime.js';

describe('Effect Promise boundary', () => {
  it('preserves success values and the original typed failure', async () => {
    expect(await runEffect(Effect.succeed(42))).toBe(42);
    const error = new Error('disk full');
    await expect(runEffect(Effect.fail(error))).rejects.toBe(error);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { createProgram } from '../../src/program';

// Real commander (program.test.ts mocks it): commander 13+ rejects extra arguments unless allowed.
describe('createProgram with real commander', () => {
  it('still runs a command given an extra argument', async () => {
    const argv = process.argv;
    process.argv = ['node', 'appcircle', 'build', 'profile', 'list', 'extra-arg'];
    try {
      const onRun = vi.fn();
      const program = createProgram();
      program.onCommandRun(onRun);
      await program.parseAsync();
      expect(onRun).toHaveBeenCalledOnce();
    } finally {
      process.argv = argv;
    }
  });
});

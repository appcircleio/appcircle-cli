/**
 * handleBuildCommand parameter checks when no help text is registered for the
 * command: the command still exits with code 1, but prints nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/core/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/commands')>();
  return { ...actual, Commands: [] };
});

vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config')>();
  return { ...actual, getInteractiveMode: vi.fn(() => false) };
});

vi.mock('../../../src/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services')>();
  return {
    ...actual,
    getBranches: vi.fn(),
    getWorkflows: vi.fn(),
    getConfigurations: vi.fn(),
    getCommits: vi.fn(),
    getBuildsOfCommit: vi.fn(),
    downloadArtifact: vi.fn(),
    downloadBuildLog: vi.fn(),
    uploadEnvironmentVariablesFromFile: vi.fn(),
  };
});

import { handleBuildCommand, getLongDescriptionForCommand } from '../../../src/core/command-runner';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import * as services from '../../../src/services';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('build commands without a registered help text', () => {
  const cases: Array<[string, Record<string, any>]> = [
    ['build-profile-branch-list', {}],
    ['build-profile-workflow-list', {}],
    ['build-profile-workflows', {}],
    ['build-profile-workflow-download', { profileId: 'p1' }],
    ['build-profile-workflow-update', { profileId: 'p1', workflowId: 'w1' }],
    ['build-profile-workflow-create', { profileId: 'p1', workflowName: 'New' }],
    ['build-profile-configurations', {}],
    ['build-profile-branch-commits', {}],
    ['build-profile-branch-commits', { profileId: 'p1' }],
    ['build-list', {}],
    ['build-list', { profileId: 'p1' }],
    ['build-list', { profileId: 'p1', branchId: 'b1' }],
    ['build-download', {}],
    ['build-download', { profileId: 'p1' }],
    ['build-download', { profileId: 'p1', branchId: 'b1' }],
    ['build-download', { profileId: 'p1', branchId: 'b1', commitId: 'c1' }],
    ['build-download-log', {}],
    ['build-download-log', { profileId: 'p1' }],
    ['build-variable-group-upload', { filePath: '/vars.json' }],
  ];

  it.each(cases)('%s %j exits with code 1 and prints nothing', async (name, params) => {
    const fullCommandName = `appcircle-${name}`;
    expect(getLongDescriptionForCommand(fullCommandName)).toBeUndefined();

    const error: any = await handleBuildCommand({ fullCommandName, opts: () => ({}) } as any, { ...params }).catch((e) => e);

    expect(error).toBeInstanceOf(AppcircleExitError);
    expect(error.code).toBe(1);
    expect(error.message).toBe('');
    expect(errorSpy).not.toHaveBeenCalled();
    for (const fn of Object.values(services)) {
      if (vi.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled();
    }
  });
});

/**
 * @fileoverview Drives handleInteractiveParamsOrArguments (the interactive parameter dispatcher)
 * through every parameter kind with scripted enquirer answers and mocked services.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const h = vi.hoisted(() => {
  const state = {
    answers: [] as any[],
    prompts: [] as any[],
    spinners: [] as any[],
  };
  const next = (kind: string, cfg: any) => {
    state.prompts.push({ kind, ...cfg });
    if (state.answers.length === 0) {
      throw new Error(`No scripted answer for ${kind} prompt "${cfg?.name}"`);
    }
    const answer = state.answers.shift();
    return typeof answer === 'function' ? answer(cfg) : answer;
  };
  return { state, next };
});

vi.mock('enquirer', () => {
  const make = (kind: string) =>
    vi.fn(function (this: any, cfg: any) {
      this.run = async () => h.next(kind, cfg);
    });
  const mod = {
    AutoComplete: make('autocomplete'),
    BooleanPrompt: make('boolean'),
    Input: make('input'),
    Select: make('select'),
    Editor: make('editor'),
    prompt: vi.fn(async (questions: any[]) => {
      const q = questions[0];
      return { [q.name]: await h.next('prompt', q) };
    }),
  };
  return { ...mod, default: mod };
});

vi.mock('ora', () => ({
  default: vi.fn((text: string) => {
    const spinner: any = { text };
    spinner.start = vi.fn(() => spinner);
    spinner.stop = vi.fn(() => spinner);
    spinner.fail = vi.fn(() => spinner);
    spinner.succeed = vi.fn(() => spinner);
    h.state.spinners.push(spinner);
    return spinner;
  }),
}));

vi.mock('readline', () => {
  const createInterface = vi.fn(() => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const rl: any = {
      handlers,
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
        return rl;
      }),
      close: vi.fn(() => handlers.close?.()),
    };
    return rl;
  });
  return { createInterface, default: { createInterface } };
});

vi.mock('../../../src/services', () => ({
  getBranches: vi.fn(),
  getEnterpriseProfiles: vi.fn(),
  getEnterpriseAppVersions: vi.fn(),
  getWorkflows: vi.fn(),
  getBuildProfiles: vi.fn(),
  getCommits: vi.fn(),
  getBuildsOfCommit: vi.fn(),
  getDistributionProfiles: vi.fn(),
  getEnvironmentVariableGroups: vi.fn(),
  getConfigurations: vi.fn(),
  getOrganizations: vi.fn(),
  getUserInfo: vi.fn(),
  getRoleList: vi.fn(),
  getOrganizationInvitations: vi.fn(),
  getOrganizationUsers: vi.fn(),
  getOrganizationUserinfo: vi.fn(),
  getPublishProfiles: vi.fn(),
  getPublishFlows: vi.fn(),
  getAppVersions: vi.fn(),
  getPublishVariableGroups: vi.fn(),
  getCountries: vi.fn(),
  getiOSP12Certificates: vi.fn(),
  getiOSCSRCertificates: vi.fn(),
  getAndroidKeystores: vi.fn(),
  getProvisioningProfiles: vi.fn(),
  getTestingGroups: vi.fn(),
  getDistributionProfileById: vi.fn(),
  getTestingGroupById: vi.fn(),
  getTokenFromApiKey: vi.fn(),
}));

vi.mock('../../../src/program', () => ({
  createCommandActionCallback: vi.fn((input: any) => ({ prepared: true, input })),
}));

vi.mock('../../../src/core/command-runner', () => ({
  runCommand: vi.fn(),
  validateCurrentTokenIsValid: vi.fn(),
  clearStoredToken: vi.fn(),
}));

import * as services from '../../../src/services';
import * as readline from 'readline';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { CommandParameterTypes } from '../../../src/core/commands';
import { createCommandActionCallback } from '../../../src/program';
import {
  handleInteractiveParamsOrArguments,
  handleCommandParamsAndArguments,
  getSimpleMultilineInput,
  expandTilde,
  validateFilePathForParam,
  createParameterPromptConfig,
  processParameterValue,
} from '../../../src/core/interactive-runner';

const svc = services as unknown as Record<string, ReturnType<typeof vi.fn>>;
const SELECT = CommandParameterTypes.SELECT;
const MULTI = CommandParameterTypes.MULTIPLE_SELECT;
const STRING = CommandParameterTypes.STRING;
const PASSWORD = CommandParameterTypes.PASSWORD;
const BOOLEAN = CommandParameterTypes.BOOLEAN;

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const U3 = '33333333-3333-3333-3333-333333333333';
const U4 = '44444444-4444-4444-4444-444444444444';

// createAutoCompletePrompt loads enquirer with a CommonJS require, which vi.mock does not reach.
// Replace the cached CommonJS export so those prompts are scripted too.
const nodeRequire = createRequire(import.meta.url);
const enquirerKey = nodeRequire.resolve('enquirer');
let originalEnquirerExports: any;

const run = (params: any[]) => handleInteractiveParamsOrArguments(params as any);
const answer = (...values: any[]) => h.state.answers.push(...values);
const lastSpinner = () => h.state.spinners[h.state.spinners.length - 1];
const promptMessages = () => h.state.prompts.map((p) => p.message);

beforeAll(() => {
  nodeRequire('enquirer');
  originalEnquirerExports = nodeRequire.cache[enquirerKey]!.exports;
  nodeRequire.cache[enquirerKey]!.exports = {
    AutoComplete: function (this: any, cfg: any) {
      this.run = async () => h.next('autocomplete', cfg);
    },
  };
});

afterAll(() => {
  nodeRequire.cache[enquirerKey]!.exports = originalEnquirerExports;
});

beforeEach(() => {
  h.state.answers.length = 0;
  h.state.prompts.length = 0;
  h.state.spinners.length = 0;
  Object.values(svc).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  // Every scripted answer must have been consumed by a prompt.
  expect(h.state.answers).toEqual([]);
});

describe('small helpers', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/tester');
    vi.mocked(path.resolve).mockImplementation((p: string) => `/abs${p.startsWith('/') ? '' : '/'}${p}`);
  });

  it('expandTilde returns empty input unchanged and resolves ~ to the home directory', () => {
    expect(expandTilde('')).toBe('');
    expect(expandTilde('~/app.ipa')).toBe('/abs/home/tester/app.ipa');
    expect(expandTilde('rel/app.apk')).toBe('/abs/rel/app.apk');
  });

  it('validateFilePathForParam requires a value', () => {
    expect(validateFilePathForParam('', 'app')).toBe('This field is required');
  });

  it('validateFilePathForParam checks existence only for app and filePath', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(validateFilePathForParam('~/missing.ipa', 'app')).toBe('File not exists. Please enter a valid file path');
    expect(fs.existsSync).toHaveBeenCalledWith('/abs/home/tester/missing.ipa');
    expect(validateFilePathForParam('anything', 'name')).toBe(true);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(validateFilePathForParam('/tmp/a.apk', 'filePath')).toBe(true);
  });

  it('validateFilePathForParam reports an invalid path when expansion throws', () => {
    vi.mocked(os.homedir).mockImplementation(() => {
      throw new Error('no home');
    });
    expect(validateFilePathForParam('~/x', 'app')).toBe('Invalid file path. Please enter a valid file path');
  });

  it('createParameterPromptConfig validates paths and switches release notes to multiline input', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const plain = createParameterPromptConfig({ type: STRING, name: 'app', description: 'App path' });
    expect(plain).toMatchObject({ type: STRING, name: 'app', message: 'App path' });
    expect(plain.isSimpleMultilineInput).toBeUndefined();
    expect(plain.validate('x')).toBe('File not exists. Please enter a valid file path');

    const notes = createParameterPromptConfig({
      type: STRING,
      name: 'message',
      description: 'Release Notes for this version',
      required: false,
    });
    expect(notes).toMatchObject({ isSimpleMultilineInput: true, required: false, validate: undefined });

    const messageWithoutDescription = createParameterPromptConfig({ type: STRING, name: 'message' });
    expect(messageWithoutDescription.isSimpleMultilineInput).toBeUndefined();
    const otherMessage = createParameterPromptConfig({ type: STRING, name: 'message', description: 'Commit text' });
    expect(otherMessage.isSimpleMultilineInput).toBeUndefined();
  });

  it('processParameterValue expands only filePath values', () => {
    expect(processParameterValue('filePath', '~/f.ipa')).toBe('/abs/home/tester/f.ipa');
    expect(processParameterValue('name', '~/f.ipa')).toBe('~/f.ipa');
  });
});

describe('getSimpleMultilineInput', () => {
  const lastInterface = () => vi.mocked(readline.createInterface).mock.results.at(-1)!.value as any;

  it('finishes after two blank lines and drops the trailing blank line', async () => {
    const pending = getSimpleMultilineInput('Release notes');
    const rl = lastInterface();
    expect(readline.createInterface).toHaveBeenCalledWith({ input: process.stdin, output: process.stdout, terminal: true });
    rl.handlers.line('first');
    rl.handlers.line('');
    rl.handlers.line('second');
    rl.handlers.line('');
    rl.handlers.line('');
    await expect(pending).resolves.toBe('first\n\nsecond');
    expect(rl.close).toHaveBeenCalled();
    // A late blank line after finishing closes again without changing the result.
    rl.handlers.line('');
    expect(rl.close).toHaveBeenCalledTimes(2);
  });

  it('resolves the collected lines when the stream closes', async () => {
    const pending = getSimpleMultilineInput('Notes');
    const rl = lastInterface();
    rl.handlers.line('  only line  ');
    rl.handlers.close();
    await expect(pending).resolves.toBe('only line');
  });

  it('resolves an empty string on Ctrl+C', async () => {
    const pending = getSimpleMultilineInput('Notes');
    const rl = lastInterface();
    rl.handlers.line('typed');
    rl.handlers.SIGINT();
    await expect(pending).resolves.toBe('typed');
    expect(console.log).toHaveBeenCalledWith('\nInput cancelled.');
  });
});

describe('handleInteractiveParamsOrArguments - build selection chain', () => {
  it('resolves profile, branch, commit and build ids from the selected labels', async () => {
    svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Prof' }]);
    svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
    svc.getCommits.mockResolvedValue([
      { id: U1, message: 'A commit message longer than twenty' },
      { id: U2, message: '   ' },
      { id: U3 },
    ]);
    svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: U4, startDate: '2024-01-02T03:04:00Z' }, { id: U2 }] });
    answer('Prof (p1)', 'main (b1)', (cfg: any) => cfg.choices[0].name, (cfg: any) => cfg.choices[1]);

    const result = await run([
      { name: 'profileId', description: 'Build profile', type: SELECT },
      { name: 'branchId', type: SELECT },
      { name: 'commitId', type: SELECT },
      { name: 'buildId', type: SELECT },
    ]);

    expect(result).toEqual({ profileId: 'p1', branchId: 'b1', commitId: U1, buildId: U2 });
    expect(svc.getBranches).toHaveBeenCalledWith({ profileId: 'p1' });
    expect(svc.getCommits).toHaveBeenCalledWith({ profileId: 'p1', branchId: 'b1' });
    expect(svc.getBuildsOfCommit).toHaveBeenCalledWith({ commitId: U1 });
    expect(promptMessages()).toEqual([
      'Build profile (1 options)',
      'Branch (1 options)',
      'Commit Message (ID) (3 options)',
      'Build ID (2 options)',
    ]);
    expect(h.state.prompts[2].choices.map((c: any) => c.name)).toEqual([
      `"A commit message lon..." (${U1})  (latest)`,
      `"<no message>" (${U2}) `,
      `"<no message>" (${U3}) `,
    ]);
  });

  it('falls back to name/id lookups and keeps unknown raw selections', async () => {
    svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Prof' }]);
    svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
    answer('p1', 'b1');
    expect(await run([{ name: 'profileId', type: SELECT }, { name: 'branchId', description: 'Pick branch', type: SELECT }])).toEqual({
      profileId: 'p1',
      branchId: 'b1',
    });
    expect(promptMessages()).toEqual(['Build Profile (1 options)', 'Pick branch (1 options)']);

    answer('mystery-profile', 'mystery-branch');
    expect(await run([{ name: 'profileId', type: SELECT }, { name: 'branchId', type: SELECT }])).toEqual({
      profileId: 'mystery-profile',
      branchId: 'mystery-branch',
    });
  });

  it('re-resolves earlier selections whose ids end in parentheses', async () => {
    svc.getBuildProfiles.mockResolvedValue([
      { id: 'x(p2)', name: 'Outer' },
      { id: 'p2', name: 'Inner' },
    ]);
    svc.getBranches.mockResolvedValue({
      branches: [
        { id: 'y(b2)', name: 'Outer' },
        { id: 'b2', name: 'Inner' },
      ],
    });
    svc.getCommits.mockResolvedValue([{ id: 'c1', message: 'm' }]);
    // "Outer (x(p2))" does not match the trailing "(id)" pattern, so the name lookup keeps "x(p2)".
    answer('Outer (x(p2))', 'Outer (y(b2))', 'Outer (y(b2))', U1);

    const result = await run([
      { name: 'profileId', type: SELECT },
      { name: 'branchId', type: SELECT },
      { name: 'branchId', type: SELECT },
      { name: 'commitId', type: SELECT },
    ]);

    // The trailing "(p2)" / "(b2)" of the stored ids is resolved against the cached lists.
    expect(svc.getBranches).toHaveBeenNthCalledWith(1, { profileId: 'p2' });
    expect(svc.getCommits).toHaveBeenCalledWith({ profileId: 'p2', branchId: 'b2' });
    expect(result).toEqual({ profileId: 'p2', branchId: 'b2', commitId: U1 });
  });

  it('re-resolves plain stored branch and commit ids against the cached lists', async () => {
    svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
    svc.getCommits.mockResolvedValue([{ id: 'c1', message: 'one' }]);
    answer('b1', 'b1', 'unlisted', (cfg: any) => {
      expect(cfg.initial).toBe('unlisted');
      return `x (${U1})`;
    });

    const result = await run([
      { name: 'branchId', type: SELECT },
      { name: 'branchId', type: SELECT },
      { name: 'commitId', type: SELECT },
      { name: 'commitId', type: SELECT },
    ]);

    expect(result).toEqual({ branchId: 'b1', commitId: U1 });
    expect(svc.getCommits).toHaveBeenCalledWith({ profileId: '', branchId: 'b1' });
  });

  it('keeps stored ids when their parenthesised part is not in the cached lists', async () => {
    svc.getBuildProfiles.mockResolvedValue([{ id: 'x(zz)', name: 'Outer' }]);
    svc.getBranches.mockResolvedValue({ branches: [{ id: 'y(zz)', name: 'Outer' }] });
    svc.getCommits.mockResolvedValue([{ id: 'c1', message: 'm' }]);
    answer('Outer (x(zz))', 'Outer (y(zz))', 'Outer (y(zz))', U1);

    const result = await run([
      { name: 'profileId', type: SELECT },
      { name: 'branchId', type: SELECT },
      { name: 'branchId', type: SELECT },
      { name: 'commitId', type: SELECT },
    ]);

    expect(svc.getBranches).toHaveBeenCalledWith({ profileId: 'x(zz)' });
    expect(svc.getCommits).toHaveBeenCalledWith({ profileId: 'x(zz)', branchId: 'y(zz)' });
    expect(result).toEqual({ profileId: 'x(zz)', branchId: 'y(zz)', commitId: U1 });
  });

  it('returns an error when no profiles, branches, commits or builds exist', async () => {
    svc.getBuildProfiles.mockResolvedValue([]);
    expect(await run([{ name: 'profileId', type: SELECT }])).toEqual({ isError: true });
    expect(lastSpinner().fail).toHaveBeenCalledWith('No build profiles found');

    svc.getBuildProfiles.mockResolvedValue(undefined);
    expect(await run([{ name: 'profileId', type: SELECT }])).toEqual({ isError: true });

    svc.getBranches.mockResolvedValue({ branches: [] });
    expect(await run([{ name: 'branchId', type: SELECT }])).toEqual({ isError: true });
    expect(svc.getBranches).toHaveBeenCalledWith({ profileId: '' });
    expect(lastSpinner().fail).toHaveBeenCalledWith('No branches found for the selected profile');

    svc.getBranches.mockResolvedValue({});
    expect(await run([{ name: 'branchId', type: SELECT }])).toEqual({ isError: true });

    svc.getCommits.mockResolvedValue([]);
    expect(await run([{ name: 'commitId', type: SELECT }])).toEqual({ isError: true });
    expect(svc.getCommits).toHaveBeenCalledWith({ profileId: '', branchId: '' });
    expect(lastSpinner().fail).toHaveBeenCalledWith('No commits found for the selected branch');

    svc.getCommits.mockResolvedValue(null);
    expect(await run([{ name: 'commitId', type: SELECT }])).toEqual({ isError: true });

    svc.getBuildsOfCommit.mockResolvedValue({ builds: [] });
    expect(await run([{ name: 'buildId', type: SELECT }])).toEqual({ isError: true });
    expect(lastSpinner().fail).toHaveBeenCalledWith('No builds found for the selected commit');
  });
});

describe('handleInteractiveParamsOrArguments - params that do not keep the assigned choices', () => {
  // A param whose "params" property ignores writes (accessor without storage) makes the
  // dispatcher fall back to an empty choice list instead of passing a non-array to the prompt.
  const forgetfulParam = (name: string) => ({
    name,
    type: SELECT,
    get params() {
      return undefined;
    },
    set params(_value: any) {
      // ignore
    },
  });

  it('passes empty choices to the branch, profile, commit and variable group prompts', async () => {
    svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Prof' }]);
    svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
    svc.getCommits.mockResolvedValue([{ id: U1, message: 'm' }]);
    svc.getPublishVariableGroups.mockResolvedValue([{ id: 'g1', name: 'G' }]);
    answer('Prof (p1)', 'main (b1)', `m (${U1})`, 'G (g1)');

    const result = await run([
      forgetfulParam('profileId'),
      forgetfulParam('branchId'),
      forgetfulParam('commitId'),
      forgetfulParam('publishVariableGroupId'),
    ]);

    expect(result).toEqual({ profileId: 'p1', branchId: 'b1', commitId: U1, publishVariableGroupId: 'g1', variableGroupId: undefined });
    expect(h.state.prompts.map((p) => p.choices)).toEqual([[], [], [], []]);
  });
});

describe('handleInteractiveParamsOrArguments - commit id handling', () => {
  it('re-resolves a stored "(id)" commit and skips the prompt when it is already valid', async () => {
    svc.getCommits.mockResolvedValue([
      { id: 'c1', message: 'one' },
      { id: 'c2', message: 'two' },
    ]);
    answer('pick (c2)');

    const result = await run([
      { name: 'commitId', type: SELECT, description: 'Commit' },
      { name: 'commitId', type: SELECT },
    ]);

    expect(result).toEqual({ commitId: 'c2' });
    expect(h.state.prompts).toHaveLength(1);
    expect(h.state.prompts[0].message).toBe('Commit (2 options)');
  });

  it('prompts again with the previous value as initial when the stored commit is unknown', async () => {
    svc.getCommits.mockResolvedValue([{ id: 'c1', message: 'one' }]);
    answer('pick (zz)', (cfg: any) => {
      expect(cfg.initial).toBe('pick (zz)');
      return 'still unknown';
    });

    const result = await run([
      { name: 'commitId', type: SELECT, defaultValue: 'd' },
      { name: 'commitId', type: SELECT, defaultValue: 'd' },
    ]);

    expect(result).toEqual({ commitId: 'still unknown' });
    expect(h.state.prompts[0].initial).toBe('d');
  });

  it('uses an empty commit id for an optional parameter without a UUID selection', async () => {
    svc.getCommits.mockResolvedValue([{ id: 'c1', message: 'one' }]);
    answer('no uuid here');
    expect(await run([{ name: 'commitId', type: SELECT, required: false }])).toEqual({ commitId: '' });
  });

  it('maps a non-UUID final commit label to the cached commit id', async () => {
    svc.getCommits.mockResolvedValue([{ id: 'c2', message: 'two' }]);
    answer('pick (c2)');
    // The final pass turns "pick (c2)" into "c2".
    expect(await run([{ name: 'commitId', type: SELECT }])).toEqual({ commitId: 'c2' });

    answer('nothing');
    expect(await run([{ name: 'commitId', type: SELECT }])).toEqual({ commitId: 'nothing' });
  });
});

describe('handleInteractiveParamsOrArguments - delegated handlers', () => {
  it('stores the build id, enterprise profile/version, variable group and organization selections', async () => {
    svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: U1 }] });
    svc.getEnterpriseProfiles.mockResolvedValue([{ id: 'ep1', name: 'Ent' }]);
    svc.getEnterpriseAppVersions.mockResolvedValue([{ id: 'v1', version: '1.0', versionCode: '7' }]);
    svc.getEnvironmentVariableGroups.mockResolvedValue([{ id: 'vg1', name: 'Vars' }]);
    svc.getUserInfo.mockResolvedValue({ currentOrganizationId: 'o1' });
    svc.getOrganizations.mockResolvedValue([{ id: 'o1', name: 'Org' }]);
    answer(`${U1} (-)`, 'Ent (ep1)', '1.0 (7) (v1)', 'Vars (vg1)', 'Org (o1)');

    const result = await run([
      { name: 'buildId', type: SELECT },
      { name: 'entProfileId', type: SELECT },
      { name: 'entVersionId', type: SELECT },
      { name: 'variableGroupId', type: SELECT },
      { name: 'organizationId', type: SELECT },
    ]);

    expect(result).toEqual({
      buildId: U1,
      entProfileId: 'ep1',
      entVersionId: 'v1',
      variableGroupId: 'vg1',
      organizationId: 'o1',
      currentOrganizationId: 'o1',
    });
    expect(svc.getEnterpriseAppVersions).toHaveBeenCalledWith({ entProfileId: 'ep1', publishType: '' });
  });

  it.each([
    ['entProfileId', 'getEnterpriseProfiles', []],
    ['entVersionId', 'getEnterpriseAppVersions', []],
    ['variableGroupId', 'getEnvironmentVariableGroups', []],
    ['workflowId', 'getWorkflows', []],
    ['configurationId', 'getConfigurations', []],
    ['organizationId', 'getOrganizations', []],
    ['role', 'getRoleList', []],
    ['userId', 'getOrganizationUsers', null],
    ['publishProfileId', 'getPublishProfiles', []],
    ['appVersionId', 'getAppVersions', []],
    ['publishFlowId', 'getPublishFlows', []],
    ['certificateBundleId', 'getiOSP12Certificates', []],
    ['keystoreId', 'getAndroidKeystores', []],
    ['provisioningProfileId', 'getProvisioningProfiles', []],
    ['testingGroupId', 'getTestingGroups', []],
  ])('returns an error result when %s has nothing to select', async (name, serviceName, empty) => {
    svc.getUserInfo.mockResolvedValue({ currentOrganizationId: 'o1' });
    svc[serviceName].mockResolvedValue(empty);
    const result = await run([{ name, type: SELECT }]);
    expect(result).toEqual({ isError: true });
    expect(lastSpinner().fail).toHaveBeenCalled();
  });

  it('returns an error result when certificateId has nothing to select', async () => {
    svc.getiOSP12Certificates.mockResolvedValue([]);
    svc.getiOSCSRCertificates.mockResolvedValue([]);
    expect(await run([{ name: 'certificateId', type: SELECT }])).toEqual({ isError: true });
  });

  it('throws AppcircleExitError when no distribution profile exists', async () => {
    svc.getDistributionProfiles.mockResolvedValue([]);
    const promise = run([{ name: 'distProfileId', type: SELECT }]);
    await expect(promise).rejects.toBeInstanceOf(AppcircleExitError);
    await expect(promise).rejects.toMatchObject({ message: 'No Distribution Profile Available', code: 1 });
  });

  it('stores the selected distribution profile', async () => {
    svc.getDistributionProfiles.mockResolvedValue([{ id: 'd1', name: 'Dist' }]);
    answer('Dist (d1)');
    expect(await run([{ name: 'distProfileId', type: SELECT }])).toEqual({ distProfileId: 'd1' });
  });

  it('resolves the workflow again after selection by name, id or label', async () => {
    const workflows = [
      { id: 'w0', workflowName: 'Other' },
      { id: 'w1', workflowName: 'Default' },
    ];
    svc.getWorkflows.mockResolvedValue(workflows);

    answer('Default');
    expect(await run([{ name: 'workflowId', type: SELECT }])).toEqual({ workflowId: 'w1' });
    expect(svc.getWorkflows).toHaveBeenLastCalledWith({ profileId: '' });

    answer('w1');
    expect(await run([{ name: 'workflowId', type: SELECT }])).toEqual({ workflowId: 'w1' });

    answer('Default (w1)');
    expect(await run([{ name: 'workflowId', type: SELECT }])).toEqual({ workflowId: 'w1' });

    answer('unknown-flow');
    expect(await run([{ name: 'workflowId', type: SELECT }])).toEqual({ workflowId: 'unknown-flow' });
  });

  it('resolves configurations, the branch id they report and the final configuration lookup', async () => {
    svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
    svc.getConfigurations.mockResolvedValue([
      { item1: { id: 'cfg-0', configurationName: 'Debug' } },
      { item1: { id: 'cfg-1', configurationName: 'Release' } },
    ]);
    answer('main (b1)', 'Release (cfg-1)');

    const result = await run([
      { name: 'branchId', type: SELECT },
      { name: 'configurationId', type: SELECT },
    ]);
    expect(result).toEqual({ branchId: 'b1', configurationId: 'cfg-1' });
    expect(svc.getConfigurations).toHaveBeenCalledWith({ profileId: '' });
  });

  it('maps a raw configuration label to its id at the end and keeps unknown ones', async () => {
    svc.getConfigurations.mockResolvedValue([
      { item1: { id: 'cfg-0', configurationName: 'Debug' } },
      { item1: { id: 'cfg-1', configurationName: 'Release' } },
    ]);

    answer('Release');
    expect(await run([{ name: 'configurationId', type: SELECT }])).toEqual({ configurationId: 'cfg-1' });

    answer('Unknown config');
    expect(await run([{ name: 'configurationId', type: SELECT }])).toEqual({ configurationId: 'Unknown config' });

    answer('skip');
    expect(await run([{ name: 'configurationId', type: SELECT, required: false }])).toEqual({ configurationId: '' });
  });

  it('reads the optional organization-id input', async () => {
    answer('  org-9  ');
    expect(await run([{ name: 'organization-id', type: STRING, defaultValue: 'def' }])).toEqual({ 'organization-id': 'org-9' });
    expect(h.state.prompts[0]).toMatchObject({
      kind: 'input',
      message: 'Organization ID (optional - press Enter to skip):',
      initial: 'def',
    });

    answer('   ');
    expect(await run([{ name: 'organization-id', type: STRING }])).toEqual({ 'organization-id': undefined });

    answer(undefined);
    expect(await run([{ name: 'organization-id', type: STRING }])).toEqual({ 'organization-id': undefined });
  });

  it('loads role choices without prompting', async () => {
    svc.getRoleList.mockResolvedValue([{ key: 'admin', description: 'Admin' }]);
    const roleParam: any = { name: 'role', type: SELECT };
    expect(await run([roleParam])).toEqual({});
    expect(roleParam.params).toEqual([{ name: 'admin', message: 'Admin' }]);
    expect(h.state.prompts).toEqual([]);
  });

  it('selects a user for SELECT userId and prompts for a STRING userId', async () => {
    svc.getOrganizationUsers.mockResolvedValue([{ id: 'u1', email: 'a@b.c' }]);
    answer('a@b.c (u1)');
    expect(await run([{ name: 'userId', type: SELECT }])).toEqual({ userId: 'u1' });

    answer('typed-user');
    expect(await run([{ name: 'userId', type: STRING, description: 'User id' }])).toEqual({ userId: 'typed-user' });
    expect(svc.getOrganizationUsers).toHaveBeenCalledTimes(1);
  });

  it('stores publish profile, app version and publish flow only when a value was chosen', async () => {
    svc.getPublishProfiles.mockResolvedValue([{ id: 'pp1', name: 'Store', platformType: 1 }]);
    svc.getAppVersions.mockResolvedValue([{ id: U2, name: 'App', version: '1.0' }]);
    svc.getPublishFlows.mockResolvedValue([{ id: 'pf1', flowName: 'Flow' }]);
    answer('Store (pp1) - iOS', ` App(1.0) - ${U2} `, 'Flow (pf1)');

    const result = await run([
      { name: 'publishProfileId', type: SELECT },
      { name: 'appVersionId', type: SELECT },
      { name: 'publishFlowId', type: SELECT },
    ]);
    expect(result).toMatchObject({ publishProfileId: 'pp1', appVersionId: U2, publishFlowId: 'pf1' });

    answer('', '', '');
    const empty = await run([
      { name: 'publishProfileId', type: SELECT },
      { name: 'appVersionId', type: SELECT },
      { name: 'publishFlowId', type: SELECT },
    ]);
    expect(empty).toEqual({ _publishProfileParams: expect.any(Array) });
  });

  it('only treats publish parameters specially for SELECT types', async () => {
    answer('pp-typed', 'av-typed', 'pf-typed', 'pvg-typed', 'mail@x.y', 'TR', 'cb', 'cert', 'ks', 'prov', 'tg', 'tester@x.y');
    const names = [
      'publishProfileId',
      'appVersionId',
      'publishFlowId',
      'publishVariableGroupId',
      'email',
      'countryCode',
      'certificateBundleId',
      'certificateId',
      'keystoreId',
      'provisioningProfileId',
      'testingGroupId',
      'testerEmail',
    ];
    const result = await run(names.map((name) => ({ name, type: STRING })));
    expect(result).toEqual({
      publishProfileId: 'pp-typed',
      appVersionId: 'av-typed',
      publishFlowId: 'pf-typed',
      publishVariableGroupId: 'pvg-typed',
      email: 'mail@x.y',
      countryCode: 'TR',
      certificateBundleId: 'cb',
      certificateId: 'cert',
      keystoreId: 'ks',
      provisioningProfileId: 'prov',
      testingGroupId: 'tg',
      testerEmail: 'tester@x.y',
    });
    expect(svc.getPublishProfiles).not.toHaveBeenCalled();
    expect(svc.getTestingGroupById).not.toHaveBeenCalled();
  });
});

describe('handleInteractiveParamsOrArguments - publish variable groups', () => {
  const groups = [
    { id: 'g0', name: 'Zero' },
    { id: 'g1', name: 'One' },
  ];

  it('fails when there are no groups', async () => {
    svc.getPublishVariableGroups.mockResolvedValue([]);
    expect(await run([{ name: 'publishVariableGroupId', type: SELECT }])).toEqual({ isError: true });
    expect(lastSpinner().text).toBe('No groups available');
    expect(lastSpinner().fail).toHaveBeenCalled();

    svc.getPublishVariableGroups.mockResolvedValue(undefined);
    expect(await run([{ name: 'publishVariableGroupId', type: SELECT }])).toEqual({ isError: true });
  });

  it('stores the selected group id and clears variableGroupId', async () => {
    svc.getPublishVariableGroups.mockResolvedValue(groups);
    answer('One (g1)');
    expect(await run([{ name: 'publishVariableGroupId', type: SELECT, description: 'Group' }])).toEqual({
      publishVariableGroupId: 'g1',
      variableGroupId: undefined,
    });
    expect(promptMessages()).toEqual(['Group (2 options)']);

    answer('g1');
    expect(await run([{ name: 'publishVariableGroupId', type: SELECT }])).toEqual({
      publishVariableGroupId: 'g1',
      variableGroupId: undefined,
    });
    expect(h.state.prompts[1].message).toBe('Publish Variable Group (2 options)');
  });

  it('fails when the selection does not match any group', async () => {
    svc.getPublishVariableGroups.mockResolvedValue(groups);
    answer('Ghost (g9)');
    expect(await run([{ name: 'publishVariableGroupId', type: SELECT }])).toEqual({ isError: true });
    expect(lastSpinner().fail).toHaveBeenCalledWith('Selected variable group not found! Lütfen geçerli bir grup seçin.');

    answer('ghost');
    expect(await run([{ name: 'publishVariableGroupId', type: SELECT }])).toEqual({ isError: true });
  });
});

describe('handleInteractiveParamsOrArguments - invitations, secrets and countries', () => {
  it('halts when invitations cannot be listed', async () => {
    svc.getOrganizationInvitations.mockRejectedValue(new Error('down'));
    expect(await run([{ name: 'email', type: SELECT }])).toEqual({ _AC_INTERACTIVE_HALT_: true });
  });

  it('prompts for an invitation email after loading the choices', async () => {
    svc.getOrganizationInvitations.mockResolvedValue([{ userEmail: 'x@y.z' }]);
    answer((cfg: any) => {
      expect(cfg.choices).toEqual([{ name: 'x@y.z', message: 'x@y.z' }]);
      return 'x@y.z';
    });
    expect(await run([{ name: 'email', type: SELECT, description: 'Email' }])).toEqual({ email: 'x@y.z' });
    expect(promptMessages()).toEqual(['Email (1 options)']);
  });

  it('asks for a secret value as a password', async () => {
    answer(true, (cfg: any) => {
      expect(cfg.type).toBe(PASSWORD);
      return 's3cret';
    });
    const valueParam: any = { name: 'value', type: STRING, description: 'Value' };
    const result = await run([{ name: 'isSecret', type: BOOLEAN, description: 'Secret?' }, valueParam]);
    expect(result).toEqual({ isSecret: true, value: 's3cret' });
    expect(valueParam.type).toBe(PASSWORD);
  });

  it('prompts for a country after loading the countries', async () => {
    svc.getCountries.mockReturnValue([{ alpha2: 'TR', name: 'Türkiye' }]);
    answer('TR');
    expect(await run([{ name: 'countryCode', type: SELECT, description: 'Country' }])).toEqual({ countryCode: 'TR' });
    expect(h.state.prompts[0].choices).toEqual([{ name: 'TR', message: 'Türkiye' }]);
  });

  it('returns an error when the countries cannot be loaded', async () => {
    svc.getCountries.mockImplementation(() => {
      throw new Error('no countries');
    });
    expect(await run([{ name: 'countryCode', type: SELECT }])).toEqual({ isError: true });
  });
});

describe('handleInteractiveParamsOrArguments - signing identities', () => {
  it('stores certificate bundle, certificate, keystore and provisioning profile ids', async () => {
    svc.getiOSP12Certificates.mockResolvedValue([{ id: 'p12', name: 'Dist', extension: 'P12' }]);
    svc.getiOSCSRCertificates.mockResolvedValue([{ id: 'csr', name: 'Req', extension: 'CSR', email: 'e@x' }]);
    svc.getAndroidKeystores.mockResolvedValue([{ id: 'ks1', name: 'Key' }]);
    svc.getProvisioningProfiles.mockResolvedValue([{ id: 'pr1', name: 'Prov' }]);
    answer('Dist (p12)', 'csr: Req - e@x (csr)', 'Key (ks1)', 'Prov (pr1)');

    expect(
      await run([
        { name: 'certificateBundleId', type: SELECT },
        { name: 'certificateId', type: SELECT },
        { name: 'keystoreId', type: SELECT },
        { name: 'provisioningProfileId', type: SELECT },
      ])
    ).toEqual({ certificateBundleId: 'p12', certificateId: 'csr', keystoreId: 'ks1', provisioningProfileId: 'pr1' });
  });

  it('leaves the ids unset when the selection is empty', async () => {
    svc.getiOSP12Certificates.mockResolvedValue([{ id: 'p12', name: 'Dist', extension: 'P12' }]);
    svc.getiOSCSRCertificates.mockResolvedValue([]);
    svc.getAndroidKeystores.mockResolvedValue([{ id: 'ks1', name: 'Key' }]);
    svc.getProvisioningProfiles.mockResolvedValue([{ id: 'pr1', name: 'Prov' }]);
    svc.getTestingGroups.mockResolvedValue([{ id: 'tg1', name: 'QA' }]);
    answer('', '', '', '', '');

    expect(
      await run([
        { name: 'certificateBundleId', type: SELECT },
        { name: 'certificateId', type: SELECT },
        { name: 'keystoreId', type: SELECT },
        { name: 'provisioningProfileId', type: SELECT },
        { name: 'testingGroupId', type: SELECT },
      ])
    ).toEqual({});
  });
});

describe('handleInteractiveParamsOrArguments - testing groups and testers', () => {
  it('fails without testing groups', async () => {
    svc.getTestingGroups.mockResolvedValue([]);
    svc.getDistributionProfileById.mockResolvedValue({});
    expect(await run([{ name: 'testingGroupIds', type: MULTI }])).toEqual({ isError: true });
    expect(lastSpinner().text).toBe('No testing group available');

    svc.getTestingGroups.mockResolvedValue(null);
    expect(await run([{ name: 'testingGroupIds', type: MULTI }])).toEqual({ isError: true });
  });

  it('pre-selects the profile groups and maps the chosen labels to ids', async () => {
    svc.getTestingGroups.mockResolvedValue([
      { id: 'g0', name: 'Zero' },
      { id: 'g1', name: 'One' },
    ]);
    svc.getDistributionProfileById.mockResolvedValue({ testingGroupIds: ['g1', 'missing'] });
    answer((cfg: any) => {
      expect(cfg.initial).toEqual([1]);
      expect(cfg.multiple).toBe(true);
      expect(cfg.message).toBe("Groups (2 options) (Multiple selection with 'space')");
      return ['Zero (g0)', 'raw-entry'];
    });

    expect(await run([{ name: 'testingGroupIds', type: MULTI, description: 'Groups' }])).toEqual({
      testingGroupIds: ['g0', 'raw-entry'],
    });
    expect(svc.getDistributionProfileById).toHaveBeenCalledTimes(1);
  });

  it('uses no defaults when the profile has no testing groups', async () => {
    svc.getTestingGroups.mockResolvedValue([{ id: 'g0', name: 'Zero' }]);
    svc.getDistributionProfileById.mockResolvedValue(undefined);
    answer((cfg: any) => {
      expect(cfg.initial).toEqual([]);
      return [];
    });
    expect(await run([{ name: 'testingGroupIds', type: MULTI }])).toEqual({ testingGroupIds: [] });
  });

  it('stores the selected testing group', async () => {
    svc.getTestingGroups.mockResolvedValue([{ id: 'tg1', name: 'QA' }]);
    answer('QA (tg1)');
    expect(await run([{ name: 'testingGroupId', type: SELECT }])).toEqual({ testingGroupId: 'tg1' });
  });

  it('fails when the testing group has no testers', async () => {
    svc.getTestingGroupById.mockResolvedValue({ testers: [] });
    expect(await run([{ name: 'testerEmail', type: SELECT }])).toEqual({ isError: true });
    expect(lastSpinner().text).toBe('No tester available');

    svc.getTestingGroupById.mockResolvedValue(undefined);
    expect(await run([{ name: 'testerEmail', type: SELECT }])).toEqual({ isError: true });
  });

  it('prompts for one of the testers', async () => {
    svc.getTestingGroupById.mockResolvedValue({ testers: ['a@x', 'b@x'] });
    answer('b@x');
    expect(await run([{ name: 'testerEmail', type: SELECT, description: 'Tester' }])).toEqual({ testerEmail: 'b@x' });
    expect(h.state.prompts[0].choices).toEqual([
      { name: 'a@x', message: 'a@x' },
      { name: 'b@x', message: 'b@x' },
    ]);
  });
});

describe('handleInteractiveParamsOrArguments - generic prompts', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/tester');
    vi.mocked(path.join).mockImplementation((...parts: string[]) => parts.join('/'));
    vi.mocked(path.resolve).mockImplementation((p: string) => `/abs${p}`);
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('defaults certificate download paths to the Downloads folder', async () => {
    const pathParam: any = { name: 'path', type: STRING, description: 'Path of the certificate to be downloaded' };
    answer('/tmp/out');
    expect(await run([pathParam])).toEqual({ path: '/tmp/out' });
    expect(pathParam.defaultValue).toBe('/home/tester/Downloads');

    const otherPath: any = { name: 'path', type: STRING, description: 'Some path' };
    const noDescription: any = { name: 'path', type: STRING };
    answer('/a', '/b');
    expect(await run([otherPath, noDescription])).toEqual({ path: '/b' });
    expect(otherPath.defaultValue).toBeUndefined();
  });

  it('skips parameters whose paramType does not match the selected type', async () => {
    answer('iOS', 'cert-name');
    const result = await run([
      { name: 'type', type: SELECT, params: ['iOS', 'Android'], description: 'Type' },
      { name: 'androidOnly', type: STRING, paramType: 'Android' },
      { name: 'iosOnly', type: STRING, paramType: 'iOS' },
    ]);
    expect(result).toEqual({ type: 'iOS', iosOnly: 'cert-name' });
    expect(h.state.prompts[0]).toMatchObject({ message: 'Type (2 options)', choices: ['iOS', 'Android'] });
  });

  it('skips string prompts marked skipForInteractiveMode and SELECT/MULTI params without choices', async () => {
    const result = await run([
      { name: 'hidden', type: STRING, skipForInteractiveMode: true },
      { name: 'noChoices', type: SELECT },
      { name: 'noMulti', type: MULTI },
    ]);
    expect(result).toEqual({});
    expect(h.state.prompts).toEqual([]);
  });

  it('allows empty optional strings but still validates non-empty ones', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    answer((cfg: any) => {
      expect(cfg.validate('')).toBe(true);
      expect(cfg.validate('~/missing')).toBe('File not exists. Please enter a valid file path');
      return '~/file.ipa';
    });
    expect(await run([{ name: 'filePath', type: STRING, required: false, description: 'File' }])).toEqual({
      filePath: '/abs/home/tester/file.ipa',
    });
  });

  it('reads release notes with the multiline input', async () => {
    const pending = run([{ name: 'message', type: STRING, description: 'Release notes text', required: true }]);
    await vi.waitFor(() => expect(readline.createInterface).toHaveBeenCalled());
    const rl = vi.mocked(readline.createInterface).mock.results.at(-1)!.value as any;
    rl.handlers.line('Line 1');
    rl.handlers.line('');
    rl.handlers.line('');
    expect(await pending).toEqual({ message: 'Line 1' });
  });

  it('handles boolean parameters with and without prompting', async () => {
    answer(false);
    const result = await run([
      { name: 'skipTrue', type: BOOLEAN, skipForInteractiveMode: true, defaultValue: true },
      { name: 'skipDefault', type: BOOLEAN, skipForInteractiveMode: true },
      { name: 'asked', type: BOOLEAN, description: 'Ask?' },
    ]);
    expect(result).toEqual({ skipTrue: true, skipDefault: false, asked: false });
    expect(h.state.prompts).toEqual([expect.objectContaining({ kind: 'boolean', name: 'asked', message: 'Ask?' })]);
  });

  it('stores multiple selections for non testing-group parameters as-is', async () => {
    answer(['a', 'b']);
    expect(await run([{ name: 'tags', type: MULTI, params: ['a', 'b', 'c'], description: 'Tags' }])).toEqual({ tags: ['a', 'b'] });
  });

  it('uses an empty parameter list by default', async () => {
    expect(await handleInteractiveParamsOrArguments()).toEqual({});
  });
});

describe('handleCommandParamsAndArguments', () => {
  it('returns undefined when the arguments halt', async () => {
    svc.getOrganizationInvitations.mockRejectedValue(new Error('down'));
    const command: any = { command: 'x', description: 'X', params: [], arguments: [{ name: 'email', type: SELECT }] };
    expect(await handleCommandParamsAndArguments(command, null)).toBeUndefined();
    expect(createCommandActionCallback).not.toHaveBeenCalled();
  });

  it('builds the program command from params and arguments', async () => {
    answer('val');
    const command: any = { command: 'x', description: 'X', params: [], arguments: [{ name: 'arg', type: STRING }] };
    const result: any = await handleCommandParamsAndArguments(command, null);
    expect(result.prepared).toBe(true);
    expect(result.input.args()).toEqual(['val']);
    expect(result.input.name()).toBe('x');
  });
});


/**
 * handleBuildCommand: `build download`, `build download-log` and the
 * `build variable-group list / create / upload` commands.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

const h = vi.hoisted(() => {
  const state = {
    spinners: [] as any[],
    startFailures: new Map<string, number>(),
    startError: null as null | (() => unknown),
    onCreate: null as null | ((spinner: any) => void),
  };
  const makeSpinner = (initialText: string) => {
    const spinner: any = {
      initialText,
      text: initialText,
      start: vi.fn(() => {
        const remaining = state.startFailures.get(initialText) || 0;
        if (remaining > 0) {
          state.startFailures.set(initialText, remaining - 1);
          throw state.startError ? state.startError() : new Error('spinner unavailable');
        }
        return spinner;
      }),
      stop: vi.fn(() => spinner),
      succeed: vi.fn(() => spinner),
      fail: vi.fn(() => spinner),
    };
    state.spinners.push(spinner);
    if (state.onCreate) state.onCreate(spinner);
    return spinner;
  };
  return { state, makeSpinner };
});

vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn((text: string) => h.makeSpinner(text)),
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn(),
  configWriter: vi.fn(),
}));

vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config')>();
  return {
    ...actual,
    getInteractiveMode: vi.fn(() => false),
  };
});

vi.mock('../../../src/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services')>();
  return {
    ...actual,
    getBuildProfiles: vi.fn(),
    getBranches: vi.fn(),
    getBuildsOfCommit: vi.fn(),
    downloadArtifact: vi.fn(),
    downloadBuildLog: vi.fn(),
    downloadTaskLog: vi.fn(),
    getLatestBuildByBranch: vi.fn(),
    getEnvironmentVariableGroups: vi.fn(),
    createEnvironmentVariableGroup: vi.fn(),
    uploadEnvironmentVariablesFromFile: vi.fn(),
  };
});

import { handleBuildCommand, getLongDescriptionForCommand } from '../../../src/core/command-runner';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { CommandTypes } from '../../../src/core/commands';
import * as services from '../../../src/services';
import { getInteractiveMode } from '../../../src/config';
import { commandWriter } from '../../../src/core/writer';

const svc = vi.mocked(services);
const HOME = '/mock/home/user';
const DOWNLOADS = `${HOME}/Downloads`;
let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

const cmd = (name: string): any => ({ fullCommandName: `appcircle-${name}`, opts: () => ({}) });
const spinner = (initialText: string) => {
  const found = [...h.state.spinners].reverse().find((s) => s.initialText === initialText);
  if (!found) throw new Error(`no spinner created with "${initialText}"`);
  return found;
};
const logged = () => logSpy.mock.calls.map((c) => c.map(String).join(' '));

async function expectExitCode1(name: string, params: any) {
  const error: any = await handleBuildCommand(cmd(name), params).catch((e) => e);
  expect(error).toBeInstanceOf(AppcircleExitError);
  expect(error.code).toBe(1);
}

beforeEach(() => {
  h.state.spinners.length = 0;
  h.state.startFailures.clear();
  h.state.startError = null;
  h.state.onCreate = null;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(getInteractiveMode).mockReturnValue(false);
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true, isFile: () => true, size: 1 } as any);
  svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Profile' }]);
  svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
  svc.downloadArtifact.mockResolvedValue(undefined as any);
  svc.downloadBuildLog.mockResolvedValue(undefined as any);
  svc.downloadTaskLog.mockResolvedValue(undefined as any);
  svc.getLatestBuildByBranch.mockResolvedValue({ id: 'b-latest', commitId: 'c-latest' });
  svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-1' }] });
});

describe('build download - required parameters', () => {
  const full = { profileId: 'p1', branchId: 'b1', commitId: 'c1', buildId: 'build-1' };
  const cases = [
    ['profile', { ...full, profileId: undefined }, 'Error: Missing Build Profile. Please ensure a valid build profile is selected.'],
    ['branch', { ...full, branchId: undefined }, 'Error: Missing Branch. Please ensure a valid branch is selected.'],
    ['commit', { ...full, commitId: undefined }, 'Error: Missing Commit ID. Please ensure a valid commit is selected.'],
    ['build', { ...full, buildId: undefined }, 'Error: Missing Build ID. Please ensure a valid build is selected.'],
  ] as const;

  it.each(cases)('explains a missing %s in interactive mode', async (_label, params, message) => {
    vi.mocked(getInteractiveMode).mockReturnValue(true);

    await expectExitCode1('build-download', { ...params });

    expect(errorSpy).toHaveBeenCalledWith(message);
    expect(svc.downloadArtifact).not.toHaveBeenCalled();
  });

  it.each(cases)('prints the help for a missing %s on the command line', async (_label, params) => {
    await expectExitCode1('build-download', { ...params });

    expect(errorSpy).toHaveBeenCalledWith(`\n${getLongDescriptionForCommand('appcircle-build-download')}\n`);
    expect(svc.downloadArtifact).not.toHaveBeenCalled();
  });
});

describe('build download', () => {
  const params = (extra: Record<string, any> = {}) => ({
    profileId: 'p1',
    branchId: 'b1',
    commitId: 'c1',
    buildId: 'build-1',
    ...extra,
  });

  it('downloads the latest artifact of the branch into the default directory', async () => {
    await handleBuildCommand(cmd('build-download'), params());

    expect(svc.downloadArtifact).toHaveBeenCalledTimes(1);
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      { branchId: 'b1', profileId: 'p1', commitId: 'c1' },
      DOWNLOADS,
      expect.stringMatching(/^artifacts-\d+\.zip$/)
    );
    expect(spinner('Downloading').succeed).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^The file is downloaded successfully: file://${DOWNLOADS}/artifacts-\\d+\\.zip$`))
    );
    expect(svc.getBuildsOfCommit).not.toHaveBeenCalled();
  });

  it('creates a missing download directory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await handleBuildCommand(cmd('build-download'), params({ path: '~/dl' }));

    const dir = `/mock/resolved/${HOME}/dl`;
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(svc.downloadArtifact).toHaveBeenCalledWith(expect.anything(), dir, expect.any(String));
  });

  it('falls back to the home directory when the download directory cannot be created', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementationOnce(() => {
      throw new Error('EACCES');
    });

    await handleBuildCommand(cmd('build-download'), params({ path: '/locked' }));

    expect(logged()).toContain('Could not create directory at /mock/resolved//locked. Using home directory instead.');
    expect(svc.downloadArtifact).toHaveBeenCalledWith(expect.anything(), HOME, expect.any(String));
  });

  it('switches to the latest build of the commit when the requested build is not the latest', async () => {
    svc.downloadArtifact.mockRejectedValueOnce(new Error('branch download failed'));
    svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-new' }, { id: 'build-1' }] });
    const p: any = params();

    await handleBuildCommand(cmd('build-download'), p);

    expect(svc.getBuildsOfCommit).toHaveBeenCalledWith({ commitId: 'c1' });
    expect(p.buildId).toBe('build-new');
    expect(svc.downloadArtifact).toHaveBeenLastCalledWith(p, DOWNLOADS, expect.stringMatching(/^artifacts-\d+\.zip$/));
    expect(spinner('Downloading').succeed).toHaveBeenCalledWith(
      expect.stringMatching(/^The file artifacts-\d+\.zip is downloaded successfully: file:\/\/.*artifacts-\d+\.zip$/)
    );
  });

  it('keeps the requested build when it is the latest one', async () => {
    svc.downloadArtifact.mockRejectedValueOnce(new Error('branch download failed'));
    svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-1' }, { id: 'build-0' }] });
    const p: any = params();

    await handleBuildCommand(cmd('build-download'), p);

    expect(p.buildId).toBe('build-1');
  });

  it('replaces a requested build that does not belong to the commit', async () => {
    svc.downloadArtifact.mockRejectedValueOnce(new Error('branch download failed'));
    svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-x' }] });
    const p: any = params({ buildId: 'unknown' });

    await handleBuildCommand(cmd('build-download'), p);

    expect(p.buildId).toBe('build-x');
  });

  it.each([
    ['an empty build list', { builds: [] }],
    ['no build list', {}],
    ['no response', null],
  ])('reports %s for the commit', async (_label, response) => {
    svc.downloadArtifact.mockRejectedValueOnce(new Error('branch download failed'));
    svc.getBuildsOfCommit.mockResolvedValue(response as any);

    await handleBuildCommand(cmd('build-download'), params());

    expect(spinner('Downloading').fail).toHaveBeenCalledWith('No Builds found for commit ID: c1');
    expect(svc.downloadArtifact).toHaveBeenCalledTimes(1);
  });

  it('keeps the requested build when the build list cannot be fetched', async () => {
    svc.downloadArtifact.mockRejectedValueOnce(new Error('branch download failed'));
    svc.getBuildsOfCommit.mockRejectedValue(new Error('list failed'));
    const p: any = params();

    await handleBuildCommand(cmd('build-download'), p);

    expect(p.buildId).toBe('build-1');
    expect(svc.downloadArtifact).toHaveBeenCalledTimes(2);
    expect(spinner('Downloading').succeed).toHaveBeenCalled();
  });

  it('suggests the latest build after a failed download', async () => {
    svc.downloadArtifact.mockRejectedValue(new Error('404'));

    await handleBuildCommand(cmd('build-download'), params());

    expect(spinner('Downloading').fail).toHaveBeenCalledWith('No artifacts were found for this build.');
    expect(logged()).toContain('\nTry downloading with the latest Build ID:');
    expect(logged()).toContain('appcircle build download --commitId c1 --buildId build-1');
  });

  it.each([
    ['the build list is empty', () => svc.getBuildsOfCommit.mockResolvedValueOnce({ builds: [{ id: 'build-1' }] }).mockResolvedValueOnce({ builds: [] })],
    ['the build list has no builds', () => svc.getBuildsOfCommit.mockResolvedValueOnce({ builds: [{ id: 'build-1' }] }).mockResolvedValueOnce({})],
    ['there is no build list', () => svc.getBuildsOfCommit.mockResolvedValueOnce({ builds: [{ id: 'build-1' }] }).mockResolvedValueOnce(null as any)],
    ['the build list fails', () => svc.getBuildsOfCommit.mockResolvedValueOnce({ builds: [{ id: 'build-1' }] }).mockRejectedValueOnce(new Error('down'))],
  ])('does not suggest a build when %s', async (_label, arrange) => {
    arrange();
    svc.downloadArtifact.mockRejectedValue(new Error(''));

    await handleBuildCommand(cmd('build-download'), params());

    // An error without a message is reported as an unknown error for an unknown build status
    expect(spinner('Downloading').fail).toHaveBeenCalledWith('No artifacts were found for this build.');
    expect(logged()).not.toContain('\nTry downloading with the latest Build ID:');
  });

  it.each([
    ['with', new Error('render failed')],
    ['without', new Error('')],
  ])('reports an unexpected error %s a message', async (_label, failure) => {
    svc.downloadArtifact.mockRejectedValue(new Error('404'));
    h.state.onCreate = (s) => {
      if (s.initialText === 'Downloading') {
        s.fail.mockImplementationOnce(() => {
          throw failure;
        });
      }
    };

    await handleBuildCommand(cmd('build-download'), params());

    const s = spinner('Downloading');
    expect(s.fail).toHaveBeenCalledTimes(2);
    expect(s.fail).toHaveBeenLastCalledWith('No artifacts were found for this build.');
    expect(svc.getBuildsOfCommit).toHaveBeenCalledTimes(1);
  });

  it('uses the first build profile when the named profile has no id', async () => {
    svc.getBuildProfiles
      .mockResolvedValueOnce([{ id: '', name: 'Nameless' }])
      .mockResolvedValueOnce([{ id: 'p-first', name: 'First' }]);
    const p: any = { profile: 'Nameless', branchId: 'b1', commitId: 'c1', buildId: 'build-1' };

    await handleBuildCommand(cmd('build-download'), p);

    expect(p.profileId).toBe('p-first');
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      { branchId: 'b1', profileId: 'p-first', commitId: 'c1' },
      DOWNLOADS,
      expect.any(String)
    );
  });

  it.each([
    ['no build profiles exist', () => svc.getBuildProfiles.mockResolvedValueOnce([{ id: '', name: 'Nameless' }]).mockResolvedValueOnce([])],
    ['build profiles cannot be listed', () => svc.getBuildProfiles.mockResolvedValueOnce([{ id: '', name: 'Nameless' }]).mockRejectedValueOnce(new Error('down'))],
  ])('downloads by commit when %s', async (_label, arrange) => {
    arrange();
    const p: any = { profile: 'Nameless', branchId: 'b1', commitId: 'c1', buildId: 'build-1' };

    await handleBuildCommand(cmd('build-download'), p);

    expect(p.profileId).toBe('');
    expect(svc.downloadArtifact).toHaveBeenCalledTimes(1);
    expect(svc.downloadArtifact).toHaveBeenCalledWith(p, DOWNLOADS, expect.any(String));
    expect(svc.getBuildsOfCommit).toHaveBeenCalledWith({ commitId: 'c1' });
  });
});

describe('build download-log', () => {
  it.each([
    ['profile', { branchId: 'b1' }, 'Error: Missing Build Profile. Please ensure a valid build profile is selected.'],
    ['branch', { profileId: 'p1' }, 'Error: Missing Branch. Please ensure a valid branch is selected.'],
  ])('explains a missing %s in interactive mode', async (_label, params, message) => {
    vi.mocked(getInteractiveMode).mockReturnValue(true);

    await expectExitCode1('build-download-log', params);

    expect(errorSpy).toHaveBeenCalledWith(message);
  });

  it.each([
    ['profile', { branchId: 'b1' }],
    ['branch', { profileId: 'p1' }],
  ])('prints the help for a missing %s on the command line', async (_label, params) => {
    await expectExitCode1('build-download-log', params);

    expect(errorSpy).toHaveBeenCalledWith(`\n${getLongDescriptionForCommand('appcircle-build-download-log')}\n`);
    expect(svc.downloadBuildLog).not.toHaveBeenCalled();
  });

  it('downloads the task log when a task id is given', async () => {
    await handleBuildCommand(cmd('build-download-log'), { profileId: 'p1', branchId: 'b1', taskId: 't9', path: '/logs' });

    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 't9' }, '/logs');
    expect(svc.downloadBuildLog).not.toHaveBeenCalled();
  });

  it('downloads the latest build log of the branch', async () => {
    await handleBuildCommand(cmd('build-download-log'), { profileId: 'p1', branchId: 'b1' });

    expect(svc.getLatestBuildByBranch).toHaveBeenCalledWith({ branchId: 'b1', profileId: 'p1' });
    expect(svc.downloadBuildLog).toHaveBeenCalledTimes(1);
    expect(svc.downloadBuildLog).toHaveBeenCalledWith(
      { commitId: 'c-latest', buildId: 'b-latest' },
      DOWNLOADS,
      expect.stringMatching(/^main-Profile-build-b-latest-logs-\d+\.txt$/)
    );
  });

  it('falls back to the commit and build id when the branch download crashes', async () => {
    h.state.startFailures.set('Preparing to download Build Logs...', 1);

    await handleBuildCommand(cmd('build-download-log'), {
      profileId: 'p1',
      branchId: 'b1',
      commitId: 'c1',
      buildId: 'build-1',
    });

    expect(svc.downloadBuildLog).toHaveBeenCalledTimes(1);
    expect(svc.getLatestBuildByBranch).not.toHaveBeenCalled();
    expect(svc.downloadBuildLog).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'build-1' },
      DOWNLOADS,
      expect.any(String)
    );
  });

  it('uses the commit\'s latest build when the named profile has no id', async () => {
    svc.getBuildProfiles.mockResolvedValueOnce([{ id: '', name: 'Nameless' }]);

    await handleBuildCommand(cmd('build-download-log'), { profile: 'Nameless', branchId: 'b1', commitId: 'c1' });

    // Without a profile id the commit's latest build is used
    expect(svc.getLatestBuildByBranch).not.toHaveBeenCalled();
    expect(svc.getBuildsOfCommit).toHaveBeenCalledWith({ commitId: 'c1' });
    expect(svc.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: 'build-1' }, DOWNLOADS, expect.any(String));
  });

  it.each([
    ['with', () => new Error('spinner unavailable'), 'Error downloading Build Logs: spinner unavailable'],
    ['without', () => 'raw failure', 'Error downloading Build Logs: raw failure'],
  ])('reports and rethrows a crash %s an error message', async (_label, makeError, message) => {
    h.state.startError = makeError;
    h.state.startFailures.set('Preparing to download Build Logs...', 2);

    const error = await handleBuildCommand(cmd('build-download-log'), {
      profileId: 'p1',
      branchId: 'b1',
      commitId: 'c1',
      buildId: 'build-1',
    }).catch((e) => e);

    expect(String(error instanceof Error ? error.message : error)).toBe(message.replace('Error downloading Build Logs: ', ''));
    expect(errorSpy).toHaveBeenCalledWith(message);
  });
});

describe('build variable groups', () => {
  it('lists the variable groups', async () => {
    svc.getEnvironmentVariableGroups.mockResolvedValue([{ id: 'g1', name: 'Group' }]);
    const params = { all: true };

    await handleBuildCommand(cmd('build-variable-group-list'), params);

    expect(svc.getEnvironmentVariableGroups).toHaveBeenCalledWith(params);
    expect(spinner('Listing Variable Groups...').stop).toHaveBeenCalled();
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
      fullCommandName: 'appcircle-build-variable-group-list',
      data: [{ id: 'g1', name: 'Group' }],
    });
  });

  it('creates a variable group and reports its name', async () => {
    svc.createEnvironmentVariableGroup.mockResolvedValue({ id: 'g2' } as any);

    await handleBuildCommand(cmd('build-variable-group-create'), { name: 'Secrets' });

    expect(svc.createEnvironmentVariableGroup).toHaveBeenCalledWith({ name: 'Secrets' });
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
      fullCommandName: 'appcircle-build-variable-group-create',
      data: { id: 'g2', name: 'Secrets' },
    });
  });

  it('prints the help and exits without a variable group', async () => {
    await expectExitCode1('build-variable-group-upload', { filePath: '/vars.json' });

    expect(errorSpy).toHaveBeenCalledWith(`\n${getLongDescriptionForCommand('appcircle-build-variable-group-upload')}\n`);
    expect(svc.uploadEnvironmentVariablesFromFile).not.toHaveBeenCalled();
  });

  it('requires a JSON file path', async () => {
    const error: any = await handleBuildCommand(cmd('build-variable-group-upload'), { variableGroupId: 'g1' }).catch((e) => e);

    expect(error).toBeInstanceOf(AppcircleExitError);
    expect(error.message).toBe('JSON file path is required');
    const s = spinner('Loading Environment Variables from JSON file...');
    expect(s.fail).toHaveBeenNthCalledWith(1, 'JSON file path is required');
    expect(s.fail).toHaveBeenNthCalledWith(2, 'Failed to upload Environment Variables');
  });

  it('extracts the id from a "Name (id)" selection before checking the file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const params: any = { variableGroupId: 'Secrets (g-123)', filePath: '~/vars.json' };

    const error: any = await handleBuildCommand(cmd('build-variable-group-upload'), params).catch((e) => e);

    expect(params.variableGroupId).toBe('g-123');
    expect(fs.existsSync).toHaveBeenCalledWith(`/mock/resolved/${HOME}/vars.json`);
    expect(error).toBeInstanceOf(AppcircleExitError);
    expect(error.message).toBe('File not found');
    expect(spinner('Loading Environment Variables from JSON file...').fail).toHaveBeenCalledWith('File not found');
  });

  it('uploads with a plain variable group id', async () => {
    svc.uploadEnvironmentVariablesFromFile.mockResolvedValue({ ok: true } as any);
    const params: any = { variableGroupId: 'g1', filePath: '/vars.json' };

    await handleBuildCommand(cmd('build-variable-group-upload'), params);

    expect(params.variableGroupId).toBe('g1');
    expect(svc.uploadEnvironmentVariablesFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ variableGroupId: 'g1', filePath: '/mock/resolved//vars.json' })
    );
    expect(spinner('Loading Environment Variables from JSON file...').succeed).toHaveBeenCalledWith(
      'Environment Variables uploaded successfully'
    );
  });

  it('continues without an id when the named variable group has none', async () => {
    svc.getEnvironmentVariableGroups.mockResolvedValue([{ id: '', name: 'Nameless' }]);
    svc.uploadEnvironmentVariablesFromFile.mockResolvedValue({ ok: true } as any);
    const params: any = { variableGroup: 'Nameless', filePath: '/vars.json' };

    await handleBuildCommand(cmd('build-variable-group-upload'), params);

    expect(params.variableGroupId).toBe('');
    expect(svc.uploadEnvironmentVariablesFromFile).toHaveBeenCalledWith(expect.objectContaining({ variableGroupId: '' }));
  });
});

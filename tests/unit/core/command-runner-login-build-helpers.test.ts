/**
 * Unit tests for command-runner login helpers, download helpers and build-completion
 * helpers (paths not reached by the older suites).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import * as services from '../../../src/services';
import * as config from '../../../src/config';
import { commandWriter } from '../../../src/core/writer';
import { createOra } from '../../../src/utils/orahelper';
import enquirer from 'enquirer';
import { Commands } from '../../../src/core/commands';
import { CommandTypes } from '../../../src/core/commands';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import {
  handleUnknownLoginCommand,
  handleLoginCommand,
  validateCommandParameters,
  setupDownloadDirectoryCmd,
  downloadArtifactWithRetry,
  createProgressSpinner,
  monitorBuildProgress,
  handleBuildSuccessCompletion,
  promptForDownloadActions,
  downloadBuildLogsInteractive,
  handleBuildFailureCompletion,
} from '../../../src/core/command-runner';

const h = vi.hoisted(() => ({ spinners: [] as any[] }));

vi.mock('../../../src/services', async (importOriginal) => {
  const actual: any = await importOriginal();
  const mocked: any = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === 'function' ? vi.fn() : value;
  }
  return mocked;
});

vi.mock('../../../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getConsoleOutputType: vi.fn(() => 'plain'),
    readEnviromentConfigVariable: vi.fn(),
    writeEnviromentConfigVariable: vi.fn(),
  };
});

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn(),
  configWriter: vi.fn(),
}));

vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn() }));

vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));

vi.mock('chalk', () => {
  const id = (text: string) => text;
  return {
    default: {
      red: id, yellow: id, green: id, cyan: id, blue: id, gray: id, white: id,
      hex: () => id,
    },
  };
});

const svc = services as any;
const longDescriptionOf = (name: string) => {
  const cmd: any = Commands.find((c) => c.command === name);
  return cmd.longDescription || cmd.description;
};

describe('command-runner login and build helpers', () => {
  beforeEach(() => {
    h.spinners.length = 0;
    vi.mocked(createOra).mockImplementation((text?: string) => {
      const spinner: any = { text: text ?? '' };
      spinner.start = vi.fn(() => spinner);
      spinner.stop = vi.fn(() => spinner);
      spinner.succeed = vi.fn(() => spinner);
      spinner.fail = vi.fn(() => spinner);
      h.spinners.push(spinner);
      return spinner;
    });
    vi.mocked(config.getConsoleOutputType).mockReturnValue('plain' as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleUnknownLoginCommand', () => {
    it('prints the long description when the command is in the registry', () => {
      handleUnknownLoginCommand({ fullCommandName: 'appcircle-login' } as any);
      expect(console.error).toHaveBeenCalledWith(`\n${longDescriptionOf('login')}\n`);
    });
  });

  describe('handleLoginCommand with a stored token', () => {
    it('clears an expired token and logs in again with the personal access key', async () => {
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue('old-token');
      svc.getBuildProfiles.mockRejectedValue({ response: { status: 401 } });
      svc.getToken.mockResolvedValue({ access_token: 'new-token' });

      await handleLoginCommand({ fullCommandName: 'appcircle-login-personal-access-key' } as any, {
        secret: 'pat-value',
      });

      expect(console.log).toHaveBeenCalledWith(
        'Current token is expired or invalid. Clearing stored token and proceeding with new login...',
      );
      expect(vi.mocked(config.writeEnviromentConfigVariable).mock.calls).toEqual([
        [config.EnvironmentVariables.AC_ACCESS_TOKEN, ''],
        [config.EnvironmentVariables.AC_ACCESS_TOKEN, 'new-token'],
      ]);
      expect(svc.getToken).toHaveBeenCalledWith({ personalAccessKey: 'pat-value' });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.LOGIN, { access_token: 'new-token' });
    });
  });

  describe('validateCommandParameters', () => {
    it('prints the long description and exits when a required parameter is missing', () => {
      expect(() =>
        validateCommandParameters({}, ['secret'], { fullCommandName: 'appcircle-login' } as any, false),
      ).toThrow(AppcircleExitError);
      expect(console.error).toHaveBeenCalledWith(`\n${longDescriptionOf('login')}\n`);
    });
  });

  describe('setupDownloadDirectoryCmd', () => {
    it('returns the resolved download directory when it is valid', () => {
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      expect(setupDownloadDirectoryCmd({ path: 'out' }, '/home/me')).toBe('/mock/resolved/out');
    });

    it('falls back to the home directory when the default directory is not usable', () => {
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
      expect(setupDownloadDirectoryCmd({}, '/home/me')).toBe('/home/me');
      expect(console.log).toHaveBeenCalledWith('Could not create directory. Using home directory instead.');
    });
  });

  describe('downloadArtifactWithRetry', () => {
    const spinner = () => ({ succeed: vi.fn(), fail: vi.fn() });

    it('downloads by branch and profile with an empty commit id by default', async () => {
      const s = spinner();
      svc.downloadArtifact.mockResolvedValue(undefined);
      await downloadArtifactWithRetry({ branchId: 'b1', profileId: 'p1' }, '/dl', 'a.zip', s);
      expect(svc.downloadArtifact).toHaveBeenCalledWith(
        { branchId: 'b1', profileId: 'p1', commitId: '' },
        '/dl',
        'a.zip',
      );
      expect(s.succeed).toHaveBeenCalledWith('The file a.zip is downloaded successfully: file:///dl/a.zip');
    });

    it('passes the given commit id with branch and profile', async () => {
      const s = spinner();
      svc.downloadArtifact.mockResolvedValue(undefined);
      await downloadArtifactWithRetry({ branchId: 'b1', profileId: 'p1', commitId: 'c1' }, '/dl', 'a.zip', s);
      expect(svc.downloadArtifact).toHaveBeenCalledWith(
        { branchId: 'b1', profileId: 'p1', commitId: 'c1' },
        '/dl',
        'a.zip',
      );
    });

    it('uses the first build of the commit when no build id is given', async () => {
      const s = spinner();
      svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-1' }, { id: 'build-2' }] });
      svc.downloadArtifact.mockResolvedValue(undefined);
      const params: any = { commitId: 'c1' };
      await downloadArtifactWithRetry(params, '/dl', 'a.zip', s);
      expect(params.buildId).toBe('build-1');
      expect(svc.downloadArtifact).toHaveBeenCalledWith(params, '/dl', 'a.zip');
      expect(s.succeed).toHaveBeenCalled();
    });

    it('keeps an explicit build id', async () => {
      const s = spinner();
      svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-1' }] });
      svc.downloadArtifact.mockResolvedValue(undefined);
      const params: any = { commitId: 'c1', buildId: 'build-9' };
      await downloadArtifactWithRetry(params, '/dl', 'a.zip', s);
      expect(params.buildId).toBe('build-9');
    });

    it('fails when the commit has no builds', async () => {
      const s = spinner();
      svc.getBuildsOfCommit.mockResolvedValue({ builds: [] });
      await expect(downloadArtifactWithRetry({ commitId: 'c1' }, '/dl', 'a.zip', s)).rejects.toThrow(
        'No Builds found for commit ID: c1',
      );
      expect(s.fail).toHaveBeenCalledWith('Cannot download artifact: No Builds found for commit ID: c1');
      expect(svc.downloadArtifact).not.toHaveBeenCalled();
    });

    it('fails when the builds response is empty', async () => {
      const s = spinner();
      svc.getBuildsOfCommit.mockResolvedValue(undefined);
      await expect(downloadArtifactWithRetry({ commitId: 'c2' }, '/dl', 'a.zip', s)).rejects.toThrow(
        'No Builds found for commit ID: c2',
      );
    });

    it('reports "Unknown error" when the error has no message', async () => {
      const s = spinner();
      svc.downloadArtifact.mockRejectedValue({});
      await expect(
        downloadArtifactWithRetry({ branchId: 'b', profileId: 'p' }, '/dl', 'a.zip', s),
      ).rejects.toEqual({});
      expect(s.fail).toHaveBeenCalledWith('Cannot download artifact: Unknown error');
    });

    it('only reports success when neither branch/profile nor commit is given', async () => {
      const s = spinner();
      await downloadArtifactWithRetry({}, '/dl', 'a.zip', s);
      expect(svc.downloadArtifact).not.toHaveBeenCalled();
      expect(svc.getBuildsOfCommit).not.toHaveBeenCalled();
      expect(s.succeed).toHaveBeenCalledWith('The file a.zip is downloaded successfully: file:///dl/a.zip');
    });
  });

  describe('createProgressSpinner', () => {
    it('returns a silent spinner in JSON output mode', () => {
      vi.mocked(config.getConsoleOutputType).mockReturnValue('json' as any);
      const spinner: any = createProgressSpinner('Building');
      expect(createOra).not.toHaveBeenCalled();
      expect(spinner.text).toBe('');
      expect(spinner.succeed()).toBeUndefined();
      expect(spinner.fail()).toBeUndefined();
      expect(spinner.stop()).toBeUndefined();
    });
  });

  describe('monitorBuildProgress', () => {
    it('forces completion after more than 5 polls without a known status', async () => {
      vi.useFakeTimers();
      const getStatus = vi.fn().mockImplementation(async () => ({}));
      const getLatest = vi.fn();
      const promise = monitorBuildProgress('task-1', {}, getStatus, getLatest);
      await vi.advanceTimersByTimeAsync(2000 + 6 * 3000);
      const result = await promise;

      expect(getStatus).toHaveBeenCalledTimes(7);
      expect(getStatus).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(getLatest).not.toHaveBeenCalled();
      expect(result).toEqual({
        buildCompleted: true,
        buildSuccess: false,
        finalStatusResponse: { buildStatus: null, hasWarning: undefined },
        latestBuildId: null,
        timedOut: false,
      });
    });
  });

  describe('handleBuildSuccessCompletion', () => {
    it('prints JSON and exits with 0 in JSON mode, also when a path is given', async () => {
      vi.mocked(config.getConsoleOutputType).mockReturnValue('json' as any);
      await expect(
        handleBuildSuccessCompletion({}, null, { path: '~/out' }, { taskId: 't', queueItemId: 'q' }, vi.fn(), vi.fn()),
      ).rejects.toMatchObject({ code: 0 });
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify({ taskId: 't', queueItemId: 'q', status: 'success', message: 'Build completed successfully' }),
      );
    });

    it('downloads artifacts using the build id from the status response', async () => {
      vi.useFakeTimers();
      const downloadArtifact = vi.fn().mockResolvedValue(undefined);
      const downloadLogs = vi.fn();
      const promise = handleBuildSuccessCompletion(
        { commitId: 'c1', buildId: 'b-from-status', buildStatus: 0, hasWarning: false },
        null,
        { downloadArtifacts: true, branchId: 'br', profileId: 'pr' },
        { taskId: 't', queueItemId: 'q' },
        downloadArtifact,
        downloadLogs,
      );
      const assertion = expect(promise).rejects.toMatchObject({ message: 'Build completed', code: 0 });
      await vi.advanceTimersByTimeAsync(10000);
      await assertion;

      expect(downloadArtifact).toHaveBeenCalledWith(
        { commitId: 'c1', buildId: 'b-from-status', branchId: 'br', profileId: 'pr' },
        '/mock/home/user/Downloads',
        expect.stringMatching(/^artifacts-\d+\.zip$/),
      );
      expect(downloadLogs).not.toHaveBeenCalled();
    });
  });

  describe('promptForDownloadActions', () => {
    it('closes the SSE connection before prompting', async () => {
      const close = vi.fn();
      vi.mocked(enquirer.prompt).mockResolvedValue({ action: 'continue' } as any);
      await expect(
        promptForDownloadActions({}, null, { sseConnection: { close } }, '/dl', vi.fn(), vi.fn(), {}),
      ).rejects.toMatchObject({ message: 'Build completed', code: 0 });
      expect(close).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Build completed successfully.');
    });
  });

  describe('downloadBuildLogsInteractive', () => {
    it('downloads logs by queue item id when the status has no commit id', async () => {
      const downloadLogs = vi.fn().mockResolvedValue(undefined);
      await expect(
        downloadBuildLogsInteractive({ buildStatus: 0, buildId: 'b1' }, null, {}, '/logs', downloadLogs, {
          queueItemId: 'q-1',
        }),
      ).rejects.toMatchObject({ code: 0 });
      expect(downloadLogs).toHaveBeenCalledWith('q-1', { path: '/logs' });
      expect(console.log).toHaveBeenCalledWith('Build log downloaded successfully.');
    });
  });

  describe('handleBuildFailureCompletion', () => {
    it('exits with 1 without downloading logs when only artifacts were requested', async () => {
      const downloadLogs = vi.fn();
      await expect(
        handleBuildFailureCompletion({ buildId: 'b1' }, null, { 'download-artifacts': true }, { queueItemId: 'q' }, downloadLogs),
      ).rejects.toMatchObject({ message: 'Build failed', code: 1 });
      expect(downloadLogs).not.toHaveBeenCalled();
      expect(createOra).not.toHaveBeenCalled();
    });
  });
});

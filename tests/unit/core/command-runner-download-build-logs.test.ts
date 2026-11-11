/**
 * Tests for downloadBuildLogs: the task ID flow (task log, queue status fallback, task ID parsing),
 * the object parameter flow (latest build lookup, commit lookup), download path selection,
 * profile/branch naming and the retry/failure reporting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

const h = vi.hoisted(() => {
  const textHistory: string[] = [];
  const spinner: any = {};
  let text = '';
  Object.defineProperty(spinner, 'text', {
    get: () => text,
    set: (v: string) => {
      text = v;
      textHistory.push(v);
    },
  });
  spinner.start = vi.fn(() => spinner);
  spinner.stop = vi.fn(() => spinner);
  spinner.succeed = vi.fn(() => spinner);
  spinner.fail = vi.fn(() => spinner);
  return { spinner, textHistory };
});

vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => h.spinner) }));
vi.mock('../../../src/services');
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));

import { downloadBuildLogs } from '../../../src/core/command-runner';
import { sanitizeForFileName } from '../../../src/core/command-runner-utilities';
import * as services from '../../../src/services';

const s = vi.mocked(services);
const NOW = 1700000000000;
const ZERO = '00000000-0000-0000-0000-000000000000';
const DOWNLOADS = '/mock/home/user/Downloads';

/** Starts the download, runs all pending timers and resolves with the function result. */
const runWithTimers = async (promise: Promise<unknown>) => {
  await vi.runAllTimersAsync();
  return promise;
};

const failMessages = () => h.spinner.fail.mock.calls.map((c: any[]) => String(c[0]));
const succeedMessages = () => h.spinner.succeed.mock.calls.map((c: any[]) => String(c[0]));

describe('downloadBuildLogs', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    Object.values(services).forEach((fn: any) => {
      if (vi.isMockFunction(fn)) fn.mockReset();
    });
    h.textHistory.length = 0;
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/cwd');
    // Default: the Downloads directory does not exist, so the default directory is the cwd.
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    cwdSpy.mockRestore();
  });

  describe('with a task ID', () => {
    it('downloads the task log into the given path', async () => {
      await runWithTimers(downloadBuildLogs('task-1', { path: '/custom' }));
      expect(s.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'task-1' }, '/custom');
      expect(succeedMessages()).toEqual([
        'Build Logs downloaded successfully: file:///custom/build-task-task-1-log.txt',
      ]);
    });

    it('uses the Downloads directory when it exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      await runWithTimers(downloadBuildLogs('task-1'));
      expect(s.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'task-1' }, DOWNLOADS);
    });

    it.each(['No Logs Available', 'HTTP error 503'])('waits and retries after "%s"', async (message) => {
      s.downloadTaskLog.mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce(undefined as any);
      await runWithTimers(downloadBuildLogs('task-1', { path: '/custom' }));
      expect(s.downloadTaskLog).toHaveBeenCalledTimes(2);
      expect(h.textHistory).toContain('Waiting for Build Logs to be prepared... (0s elapsed)');
      expect(succeedMessages()).toHaveLength(1);
      expect(s.getBuildStatusFromQueue).not.toHaveBeenCalled();
    });

    it('falls back to the queue status and uses its build ID', async () => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      s.getBuildStatusFromQueue.mockResolvedValue({ commitId: 'c1', buildId: 'b1' } as any);

      await runWithTimers(downloadBuildLogs('task-1', { path: '/custom', fileName: 'out.txt' }));

      expect(s.downloadTaskLog).toHaveBeenCalledTimes(1);
      expect(h.textHistory).toContain('Trying alternative download method...');
      expect(s.getBuildStatusFromQueue).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(s.getBuildsOfCommit).not.toHaveBeenCalled();
      // The same path is reused for the build log download: it does not exist yet, so it is created.
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/resolved//custom', { recursive: true });
      expect(s.downloadBuildLog).toHaveBeenCalledWith(
        { commitId: 'c1', buildId: 'b1' },
        '/mock/resolved//custom',
        'out.txt'
      );
      expect(succeedMessages()).toEqual(['Build Logs downloaded successfully: file:///mock/resolved//custom/out.txt']);
    });

    it('looks up the first build of the commit when the queue has an empty build ID', async () => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      s.getBuildStatusFromQueue.mockResolvedValue({ commitId: 'c1', buildId: ZERO } as any);
      s.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'first' }, { id: 'second' }] } as any);

      await runWithTimers(downloadBuildLogs('task-1', { fileName: 'out.txt' }));

      expect(s.getBuildsOfCommit).toHaveBeenCalledTimes(1);
      expect(s.getBuildsOfCommit).toHaveBeenCalledWith({ commitId: 'c1' });
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: 'first' }, '/cwd', 'out.txt');
    });

    it('fails with missing parameters when neither the queue nor the commit has a build', async () => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      s.getBuildStatusFromQueue.mockResolvedValue({ commitId: 'c1' } as any);
      s.getBuildsOfCommit.mockResolvedValue({ builds: [] } as any);

      await runWithTimers(downloadBuildLogs('task-1'));

      expect(s.getBuildsOfCommit).toHaveBeenCalledTimes(2);
      expect(failMessages()).toEqual([expect.stringContaining('Missing required parameters: commitId and buildId')]);
      expect(s.downloadBuildLog).not.toHaveBeenCalled();
    });

    it('keeps the empty build ID when the commit lookup fails and waits longer for a canceled build', async () => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      s.getBuildStatusFromQueue.mockResolvedValue({ commitId: 'c1', buildId: ZERO, buildStatus: 2 } as any);
      s.getBuildsOfCommit.mockRejectedValue(new Error('down'));

      await runWithTimers(downloadBuildLogs('task-1', { fileName: 'out.txt' }));

      expect(s.getBuildsOfCommit).toHaveBeenCalledTimes(2);
      expect(h.textHistory).toContain('Waiting for canceled Build Logs to be prepared...');
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: ZERO }, '/cwd', 'out.txt');
    });

    it.each([
      ['an empty queue status', () => s.getBuildStatusFromQueue.mockResolvedValue(null as any)],
      ['a queue status without commit', () => s.getBuildStatusFromQueue.mockResolvedValue({} as any)],
      ['a failing queue lookup', () => s.getBuildStatusFromQueue.mockRejectedValue(new Error('down'))],
    ])('parses "commit-build" from the task ID after %s', async (_label, setup) => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      setup();
      await runWithTimers(downloadBuildLogs('c9-b9', { fileName: 'out.txt' }));
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c9', buildId: 'b9' }, '/cwd', 'out.txt');
    });

    it.each([
      ['a queue status without commit', () => s.getBuildStatusFromQueue.mockResolvedValue({} as any)],
      ['a failing queue lookup', () => s.getBuildStatusFromQueue.mockRejectedValue(new Error('down'))],
    ])('gives up when the task ID cannot be parsed after %s', async (_label, setup) => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      setup();
      await runWithTimers(downloadBuildLogs('single'));
      expect(failMessages()).toEqual([expect.stringContaining('Could not get Build details from Task ID.')]);
      expect(s.downloadBuildLog).not.toHaveBeenCalled();
    });

    it('reports an error without a message as an unexpected failure', async () => {
      s.downloadTaskLog.mockRejectedValue({});
      await runWithTimers(downloadBuildLogs('task-1', { path: '/custom' }));
      expect(failMessages()).toEqual([expect.stringContaining('Error downloading Build Logs: ')]);
      expect(s.getBuildStatusFromQueue).not.toHaveBeenCalled();
    });

    it('reports a non-Error failure by its string value', async () => {
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw 'disk gone';
      });
      await runWithTimers(downloadBuildLogs('task-1'));
      expect(failMessages()).toEqual([expect.stringContaining('Error downloading Build Logs: disk gone')]);
    });

    it('names the file after the profile from params when the task ID has no branch', async () => {
      s.downloadTaskLog.mockRejectedValue(new Error('forbidden'));
      s.getBuildStatusFromQueue.mockResolvedValue({ commitId: 'c1', buildId: 'b1' } as any);
      s.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'iOS App' }] as any);

      await runWithTimers(downloadBuildLogs('task-1', { profileId: 'p1' }));

      expect(s.getBranches).not.toHaveBeenCalled();
      const expectedName = `${sanitizeForFileName('unknown')}-${sanitizeForFileName('iOS App')}-build-b1-logs-${NOW}.txt`;
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: 'b1' }, '/cwd', expectedName);
    });
  });

  describe('with an object of IDs', () => {
    it('downloads the latest build of the branch and names the file after branch and profile', async () => {
      s.getLatestBuildByBranch.mockResolvedValue({ id: 'b2', commitId: 'c2' } as any);
      s.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'My Profile' }] as any);
      s.getBranches.mockResolvedValue({ branches: [{ id: 'br1', name: 'main' }] } as any);

      await runWithTimers(downloadBuildLogs({ branchId: 'br1', profileId: 'p1' }));

      expect(s.getLatestBuildByBranch).toHaveBeenCalledWith({ branchId: 'br1', profileId: 'p1' });
      expect(h.textHistory).toContain('Got latest Build ID from API: b2');
      expect(s.getBranches).toHaveBeenCalledWith({ profileId: 'p1' });
      const expectedName = `${sanitizeForFileName('main')}-${sanitizeForFileName('My Profile')}-build-b2-logs-${NOW}.txt`;
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c2', buildId: 'b2' }, '/cwd', expectedName);
    });

    it('stops when the branch has no builds', async () => {
      s.getLatestBuildByBranch.mockResolvedValue(null as any);
      await runWithTimers(downloadBuildLogs({ branchId: 'br1', profileId: 'p1' }));
      expect(failMessages()).toEqual([expect.stringContaining('No Builds found for Branch and Profile ID.')]);
      expect(s.downloadBuildLog).not.toHaveBeenCalled();
    });

    it('continues with the given IDs when the latest build lookup fails', async () => {
      s.getLatestBuildByBranch.mockRejectedValue(new Error('down'));
      await runWithTimers(
        downloadBuildLogs({ branchId: 'br1', profileId: 'p1', commitId: 'c1', buildId: 'b1', fileName: 'f.txt' })
      );
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: 'b1' }, '/cwd', 'f.txt');
    });

    it('skips the latest build lookup without a profile ID', async () => {
      await runWithTimers(downloadBuildLogs({ branchId: 'br1', commitId: 'c1', buildId: 'b1', fileName: 'f.txt' }));
      expect(s.getLatestBuildByBranch).not.toHaveBeenCalled();
      expect(s.getBuildProfiles).not.toHaveBeenCalled();
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: 'b1' }, '/cwd', 'f.txt');
    });

    it('takes the first build of the commit when no build ID is given', async () => {
      s.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'b3' }] } as any);
      await runWithTimers(downloadBuildLogs({ commitId: 'c1', fileName: 'f.txt' }));
      expect(s.downloadBuildLog).toHaveBeenCalledWith({ commitId: 'c1', buildId: 'b3' }, '/cwd', 'f.txt');
    });

    it.each([
      ['no response', () => s.getBuildsOfCommit.mockResolvedValue(undefined as any)],
      ['no builds field', () => s.getBuildsOfCommit.mockResolvedValue({} as any)],
      ['a failing lookup', () => s.getBuildsOfCommit.mockRejectedValue(new Error('down'))],
    ])('fails with missing parameters after %s for the commit', async (_label, setup) => {
      setup();
      await runWithTimers(downloadBuildLogs({ commitId: 'c1' }));
      expect(failMessages()).toEqual([expect.stringContaining('Missing required parameters')]);
    });

    it('fails with missing parameters without commit and build', async () => {
      await runWithTimers(downloadBuildLogs({}));
      expect(s.getBuildsOfCommit).not.toHaveBeenCalled();
      expect(failMessages()).toEqual([expect.stringContaining('Missing required parameters')]);
    });

    describe('download path', () => {
      const base = { commitId: 'c1', buildId: 'b1', fileName: 'f.txt' };

      it('creates a missing directory and downloads into it', async () => {
        await runWithTimers(downloadBuildLogs({ ...base, path: 'logs' }));
        expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/resolved/logs', { recursive: true });
        expect(s.downloadBuildLog).toHaveBeenCalledWith(expect.anything(), '/mock/resolved/logs', 'f.txt');
      });

      it('falls back to the default directory when the directory cannot be created', async () => {
        vi.mocked(fs.mkdirSync).mockImplementation(() => {
          throw new Error('EACCES');
        });
        await runWithTimers(downloadBuildLogs({ ...base, path: 'logs' }));
        expect(failMessages()[0]).toContain('Could not create directory: /mock/resolved/logs. Using default path: /cwd');
        expect(s.downloadBuildLog).toHaveBeenCalledWith(expect.anything(), '/cwd', 'f.txt');
      });

      it('uses an existing directory', async () => {
        vi.mocked(fs.existsSync).mockImplementation((p: any) => String(p).startsWith('/mock/resolved'));
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
        await runWithTimers(downloadBuildLogs({ ...base, path: 'logs' }));
        expect(s.downloadBuildLog).toHaveBeenCalledWith(expect.anything(), '/mock/resolved/logs', 'f.txt');
      });

      it('falls back to the default directory when the path is a file', async () => {
        vi.mocked(fs.existsSync).mockImplementation((p: any) => String(p).startsWith('/mock/resolved'));
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
        await runWithTimers(downloadBuildLogs({ ...base, path: 'logs' }));
        expect(failMessages()[0]).toContain('Specified path is not a directory: /mock/resolved/logs');
        expect(s.downloadBuildLog).toHaveBeenCalledWith(expect.anything(), '/cwd', 'f.txt');
      });

      it.each([
        ['a blank path', '   '],
        ['a non-string path', 42],
      ])('uses the default directory for %s', async (_label, value) => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
        await runWithTimers(downloadBuildLogs({ ...base, path: value as any }));
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(s.downloadBuildLog).toHaveBeenCalledWith(expect.anything(), DOWNLOADS, 'f.txt');
      });
    });

    describe('file name from profile and branch', () => {
      const ids = { commitId: 'c1', buildId: 'b1', profileId: 'p1' };
      const expectFileName = (branch: string, profile: string) =>
        expect(s.downloadBuildLog).toHaveBeenCalledWith(
          expect.anything(),
          '/cwd',
          `${sanitizeForFileName(branch)}-${sanitizeForFileName(profile)}-build-b1-logs-${NOW}.txt`
        );

      it('uses "unknown" for a profile and branch without names', async () => {
        s.getBuildProfiles.mockResolvedValue([{ id: 'p1' }] as any);
        s.getBranches.mockResolvedValue({ branches: [{ id: 'br1' }] } as any);
        await runWithTimers(downloadBuildLogs(ids, { branchId: 'br1', profileId: 'p1' }));
        expect(s.getBranches).toHaveBeenCalledWith({ profileId: 'p1' });
        expectFileName('unknown', 'unknown');
      });

      it('uses "unknown" when the profile and branch are not found', async () => {
        s.getBuildProfiles.mockResolvedValue(undefined as any);
        s.getBranches.mockResolvedValue({ branches: [{ id: 'other', name: 'dev' }] } as any);
        await runWithTimers(downloadBuildLogs(ids, { branchId: 'br1' }));
        expectFileName('unknown', 'unknown');
      });

      it('uses "unknown" when the branch list is missing', async () => {
        s.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Prof' }] as any);
        s.getBranches.mockResolvedValue(undefined as any);
        await runWithTimers(downloadBuildLogs(ids, { branchId: 'br1' }));
        expectFileName('unknown', 'Prof');
      });

      it('uses "unknown" when the profile lookup fails', async () => {
        s.getBuildProfiles.mockRejectedValue(new Error('down'));
        await runWithTimers(downloadBuildLogs(ids));
        expectFileName('unknown', 'unknown');
      });
    });
  });

  describe('retries and failure reporting', () => {
    const ids = { commitId: 'c1', buildId: 'b1', fileName: 'f.txt' };

    it('succeeds on the second attempt after a not-found error', async () => {
      s.downloadBuildLog.mockRejectedValueOnce(new Error('HTTP error 404')).mockResolvedValueOnce(undefined as any);
      await runWithTimers(downloadBuildLogs(ids));
      expect(s.downloadBuildLog).toHaveBeenCalledTimes(2);
      expect(h.textHistory).toContain('Waiting for Build Logs to be prepared... (Attempt 1)');
      expect(succeedMessages()).toEqual(['Build Logs downloaded successfully: file:///cwd/f.txt']);
    });

    it('waits longer between attempts for a canceled build', async () => {
      s.downloadBuildLog.mockRejectedValueOnce(new Error('No Logs Available')).mockResolvedValueOnce(undefined as any);
      await runWithTimers(downloadBuildLogs(ids, { wasCanceled: true }));
      expect(h.textHistory).toContain('Waiting for canceled Build Logs to be prepared... (Attempt 1)');
      expect(succeedMessages()).toHaveLength(1);
    });

    it.each([
      ['No Logs Available', false, 'No Logs available for this Build. The Build may not be completed yet.'],
      ['No Logs Available', true, 'No Logs available for this canceled Build.'],
      ['Request failed with status 404', false, 'Build Logs are not ready yet. Please try again later.'],
      ['HTTP error 500', false, 'Cannot download logs since the build failed: HTTP error 500'],
    ])('gives up after 5 attempts of "%s" (canceled: %s)', async (message, wasCanceled, expected) => {
      s.downloadBuildLog.mockRejectedValue(new Error(message));
      await runWithTimers(downloadBuildLogs(ids, { wasCanceled }));
      expect(s.downloadBuildLog).toHaveBeenCalledTimes(5);
      expect(failMessages()).toEqual([expect.stringContaining(expected)]);
    });

    it('stops at once on an error that is not a not-found error', async () => {
      s.downloadBuildLog.mockRejectedValue(new Error('Unauthorized'));
      await runWithTimers(downloadBuildLogs(ids));
      expect(s.downloadBuildLog).toHaveBeenCalledTimes(1);
      expect(failMessages()).toEqual(['Cannot download logs since the build failed: Unauthorized']);
    });

    it('reports an error without a message by its string value', async () => {
      s.downloadBuildLog.mockRejectedValue(new Error(''));
      await runWithTimers(downloadBuildLogs(ids));
      expect(s.downloadBuildLog).toHaveBeenCalledTimes(1);
      expect(failMessages()).toEqual(['Cannot download logs since the build failed: Error']);
    });
  });
});

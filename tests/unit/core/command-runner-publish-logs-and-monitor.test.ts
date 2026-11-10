/**
 * Tests for downloadPublishLogs, checkPublishStatusDirectly, monitorPublishProcess,
 * handleSuccessfulPublish and handleFailedPublish.
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
  return {
    spinner,
    textHistory,
    prompt: vi.fn(),
    apiGet: vi.fn(),
    outputType: vi.fn(() => 'plain'),
  };
});

vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => h.spinner) }));
vi.mock('../../../src/services');
vi.mock('../../../src/services/api', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, appcircleApi: { get: h.apiGet }, getHeaders: vi.fn(() => ({ authorization: 'Bearer t' })) };
});
vi.mock('../../../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, getConsoleOutputType: h.outputType };
});
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: h.prompt } }));

import {
  downloadPublishLogs,
  checkPublishStatusDirectly,
  monitorPublishProcess,
  handleSuccessfulPublish,
  handleFailedPublish,
} from '../../../src/core/command-runner';
import { sanitizeForFileName } from '../../../src/core/command-runner-utilities';
import { createOra } from '../../../src/utils/orahelper';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import * as services from '../../../src/services';

const s = vi.mocked(services);
const NOW = 1700000000000;
const DOWNLOADS = '/mock/home/user/Downloads';
const LOG_URL = 'publish/v1/profiles/ios/pp1/publish/pub1/logs';
const STATUS_URL = 'publish/v1/profiles/ios/pp1/app-versions/av1/publish';
const params = { platform: 'ios', publishProfileId: 'pp1', appVersionId: 'av1', publishId: 'pub1' };
const VIEW_CMD = 'appcircle publish view --platform ios --publishProfileId pp1 --appVersionId av1';

const failMessages = () => h.spinner.fail.mock.calls.map((c: any[]) => String(c[0]));
const succeedMessages = () => h.spinner.succeed.mock.calls.map((c: any[]) => String(c[0]));

/**
 * Routes appcircleApi.get: the publish status URL answers with the given statuses in order
 * (the last one repeats), the logs URL answers with logResponse.
 */
const routeApi = (statuses: number[], logResponse: any = { status: 200, data: 'LOGS' }) => {
  const queue = [...statuses];
  h.apiGet.mockImplementation(async (url: string) => {
    if (url.endsWith('/logs')) return logResponse;
    const status = queue.length > 1 ? queue.shift() : queue[0];
    return { status: 200, data: { status } };
  });
};

const settle = (p: Promise<unknown>) =>
  p.then(
    (value) => ({ ok: true as const, value, error: undefined as any }),
    (error) => ({ ok: false as const, value: undefined, error })
  );

describe('publish logs and monitoring', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const logged = () => logSpy.mock.calls.map((c: any[]) => String(c[0]));

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    Object.values(services).forEach((fn: any) => {
      if (vi.isMockFunction(fn)) fn.mockReset();
    });
    h.apiGet.mockReset();
    h.prompt.mockReset();
    h.outputType.mockReset();
    h.outputType.mockReturnValue('plain');
    h.textHistory.length = 0;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    logSpy.mockRestore();
  });

  describe('downloadPublishLogs', () => {
    const run = async (detail: any, userPath?: string) => {
      const p = downloadPublishLogs(detail, 'ios', 'pp1', userPath);
      await vi.runAllTimersAsync();
      return p;
    };

    it('does nothing without a publish ID', async () => {
      await run(undefined);
      await run({});
      expect(createOra).not.toHaveBeenCalled();
      expect(h.apiGet).not.toHaveBeenCalled();
    });

    it('writes the logs into an existing directory, named after the profile', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'Store Profile' } as any);
      h.apiGet.mockResolvedValue({ status: 200, data: 'LOG LINES' });

      await run({ id: 'pub1' }, 'logs');

      expect(s.getPublishProfileDetailById).toHaveBeenCalledWith({ platform: 'ios', publishProfileId: 'pp1' });
      expect(h.apiGet).toHaveBeenCalledWith(LOG_URL, {
        headers: { authorization: 'Bearer t' },
        responseType: 'text',
      });
      const file = `/mock/resolved/logs/${sanitizeForFileName('Store Profile')}-${NOW}.txt`;
      expect(fs.writeFileSync).toHaveBeenCalledWith(file, 'LOG LINES');
      expect(succeedMessages()).toEqual([`Publish Logs downloaded successfully to: ${file}`]);
    });

    it('creates a missing directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      h.apiGet.mockResolvedValue({ status: 200, data: 'L' });

      await run({ id: 'pub1' }, 'logs');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/resolved/logs', { recursive: true });
      expect(logged()).toContainEqual(expect.stringContaining('Created directory: /mock/resolved/logs'));
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringMatching(/^\/mock\/resolved\/logs\//), 'L');
    });

    it('uses the default directory when the directory cannot be created', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('EACCES');
      });
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      h.apiGet.mockResolvedValue({ status: 200, data: 'L' });

      await run({ id: 'pub1' }, 'logs');

      expect(logged()).toContainEqual(
        expect.stringContaining('Could not create directory at /mock/resolved/logs: EACCES. Using default download path.')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/P-${NOW}.txt`, 'L');
    });

    it('uses the default directory when the path is a file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      h.apiGet.mockResolvedValue({ status: 200, data: 'L' });

      await run({ id: 'pub1' }, 'logs');

      expect(logged()).toContainEqual(expect.stringContaining('is not a directory. Using default download path.'));
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/P-${NOW}.txt`, 'L');
    });

    it.each([
      ['a blank path', '  '],
      ['no path', undefined],
    ])('uses the default directory for %s and "unknown" for a profile without a name', async (_label, userPath) => {
      s.getPublishProfileDetailById.mockResolvedValue({} as any);
      h.apiGet.mockResolvedValue({ status: 200, data: 'L' });

      await run({ id: 'pub1' }, userPath);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/${sanitizeForFileName('unknown')}-${NOW}.txt`, 'L');
    });

    it('uses "unknown" when the profile cannot be read', async () => {
      s.getPublishProfileDetailById.mockRejectedValue(new Error('down'));
      h.apiGet.mockResolvedValue({ status: 200, data: 'L' });

      await run({ id: 'pub1' });

      expect(logged()).toContainEqual(expect.stringContaining('Could not retrieve profile name, using default name'));
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/${sanitizeForFileName('unknown')}-${NOW}.txt`, 'L');
    });

    it('waits while the logs are empty, not ready or not found', async () => {
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      const notFound = Object.assign(new Error('nf'), { response: { status: 404 } });
      h.apiGet
        .mockResolvedValueOnce({ status: 200, data: '' })
        .mockResolvedValueOnce({ status: 200, data: '   ' })
        .mockResolvedValueOnce({ status: 200, data: 'No Logs Available yet' })
        .mockResolvedValueOnce({ status: 202, data: 'queued' })
        .mockRejectedValueOnce(notFound)
        .mockResolvedValueOnce({ status: 200, data: 'FINAL' });

      await run({ id: 'pub1' });

      expect(h.apiGet).toHaveBeenCalledTimes(6);
      expect(h.textHistory.filter((t) => t === 'Waiting for Publish Logs to be prepared...')).toHaveLength(5);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/P-${NOW}.txt`, 'FINAL');
    });

    it('gives up after two minutes and writes a placeholder file', async () => {
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      h.apiGet.mockResolvedValue({ status: 204, data: '' });

      await run({ id: 'pub1' });

      expect(h.apiGet).toHaveBeenCalledTimes(24);
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/P-${NOW}.txt`, 'No logs available for this publish.');
      expect(failMessages()).toEqual(['Could not retrieve Publish Logs after waiting for 2 minutes.']);
    });

    it.each([
      ['an Error', Object.assign(new Error('server exploded'), { response: { status: 500 } }), 'server exploded'],
      ['a non-Error value', 'socket hang up', 'socket hang up'],
    ])('reports %s from the API', async (_label, error, text) => {
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      h.apiGet.mockRejectedValue(error);

      await run({ id: 'pub1' });

      expect(failMessages()).toEqual([`Error downloading Publish Logs: ${text}`]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('checkPublishStatusDirectly', () => {
    it('returns the numeric status and accepts every HTTP status', async () => {
      h.apiGet.mockResolvedValue({ status: 200, data: { status: 91, id: 'x' } });
      await expect(checkPublishStatusDirectly('ios', 'pp1', 'av1')).resolves.toEqual({
        status: 91,
        detail: { status: 91, id: 'x' },
      });
      const [url, config] = h.apiGet.mock.calls[0];
      expect(url).toBe(STATUS_URL);
      expect(config.headers).toEqual({ authorization: 'Bearer t' });
      expect(config.validateStatus(500)).toBe(true);
    });

    it('maps a non-numeric status to 99', async () => {
      h.apiGet.mockResolvedValue({ status: 200, data: { status: 'Running' } });
      await expect(checkPublishStatusDirectly('ios', 'pp1', 'av1')).resolves.toEqual({
        status: 99,
        detail: { status: 'Running' },
      });
    });

    it.each([
      [200, undefined],
      [500, { status: 1 }],
    ])('returns 99 for HTTP %s with data %j', async (code, data) => {
      h.apiGet.mockResolvedValue({ status: code, data });
      await expect(checkPublishStatusDirectly('ios', 'pp1', 'av1')).resolves.toEqual({ status: 99 });
      expect(logged()).toContainEqual(expect.stringContaining(`Could not get Publish Status. Status code: ${code}`));
    });

    it('returns 99 when the request fails', async () => {
      h.apiGet.mockRejectedValue(new Error('ECONNRESET'));
      await expect(checkPublishStatusDirectly('ios', 'pp1', 'av1')).resolves.toEqual({ status: 99 });
      expect(logged()).toContainEqual(expect.stringContaining('Error checking Publish Status: ECONNRESET'));
    });
  });

  describe('monitorPublishProcess', () => {
    const start = (ms: number, p = params) => {
      const result = settle(monitorPublishProcess(p));
      return vi.advanceTimersByTimeAsync(ms).then(() => result);
    };

    describe('plain output', () => {
      it('shows the running time while waiting and finishes with the total time in minutes', async () => {
        routeApi([91, 91, 91, 91, 91, 91, 91, 0]);
        s.getPublisDetailById.mockResolvedValue({ id: 'pub1' } as any);
        h.prompt.mockResolvedValue({ download: 'no' });

        const result = settle(monitorPublishProcess(params));
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.textHistory).toContainEqual(expect.stringMatching(/Publish Running\.* \(\d+s\)/));
        await vi.advanceTimersByTimeAsync(65000);
        expect(h.textHistory).toContainEqual(expect.stringMatching(/Publish Running\.* \(1m \d+s\)/));
        await vi.advanceTimersByTimeAsync(20000);
        const outcome = await result;

        expect(outcome.ok).toBe(true);
        expect(succeedMessages()).toEqual([expect.stringContaining('Publish completed successfully ✅ - Total time: 1m 12s')]);
        expect(s.getPublisDetailById).toHaveBeenCalledWith(params);
        expect(logged()).toContainEqual(expect.stringContaining('Skipping Publish Logs download.'));
        expect(logged()).toContain(VIEW_CMD);

        // The progress interval is stopped after completion.
        const count = h.textHistory.length;
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.textHistory).toHaveLength(count);
      });

      it('downloads the logs to the chosen path after success', async () => {
        routeApi([0]);
        s.getPublisDetailById.mockResolvedValue({ id: 'pub1' } as any);
        s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
        h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '/dl' });

        const outcome = await start(30000);

        expect(outcome.ok).toBe(true);
        expect(succeedMessages()[0]).toContain('Total time: 2s');
        expect(h.prompt).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'input', initial: DOWNLOADS }));
        expect(h.apiGet).toHaveBeenCalledWith(LOG_URL, expect.anything());
        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'LOGS');
        expect(logged()).toContain(VIEW_CMD);
      });

      it('prints the view command when the publish details cannot be read after success', async () => {
        routeApi([0]);
        s.getPublisDetailById.mockRejectedValue(new Error('down'));

        const outcome = await start(30000);

        expect(outcome.ok).toBe(true);
        expect(h.prompt).not.toHaveBeenCalled();
        expect(logged()).toContainEqual(
          expect.stringContaining('Publish completed successfully, but could not retrieve details to offer log download.')
        );
        expect(logged()).toContain(VIEW_CMD);
      });

      // Current behaviour: the AppcircleExitError thrown for a failed final status is caught by the
      // polling loop's own catch block, so monitorPublishProcess resolves and the CLI exits with 0.
      describe.each([
        [1, 'Publish failed ❌'],
        [2, 'Publish was canceled 🚫'],
        [3, 'Publish timed out ⏱️'],
        [201, 'Publish was stopped 🛑'],
      ])('final status %s', (status, message) => {
        it('reports the failure, skips the logs on "no" and resolves (exit error swallowed)', async () => {
          routeApi([status]);
          s.getPublisDetailById.mockResolvedValue({ id: 'pub1' } as any);
          h.prompt.mockResolvedValue({ download: 'no' });

          const outcome = await start(30000);

          expect(outcome.ok).toBe(true);
          expect(failMessages()).toEqual([expect.stringContaining(message)]);
          expect(logged()).toContainEqual(expect.stringContaining('Publish process did not complete successfully.'));
          expect(logged()).toContainEqual(expect.stringContaining('Skipping Publish Logs download.'));
          expect(logged()).toContain(VIEW_CMD);
        });

        it('downloads the logs on "yes"', async () => {
          routeApi([status]);
          s.getPublisDetailById.mockResolvedValue({ id: 'pub1' } as any);
          s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
          h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '/dl' });

          const outcome = await start(30000);

          expect(outcome.ok).toBe(true);
          expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'LOGS');
          expect(logged()).not.toContainEqual(expect.stringContaining('Skipping Publish Logs download.'));
        });

        it('prints the view command when the publish details cannot be read', async () => {
          routeApi([status]);
          s.getPublisDetailById.mockRejectedValue(new Error('down'));

          const outcome = await start(30000);

          expect(outcome.ok).toBe(true);
          expect(logged()).toContainEqual(
            expect.stringContaining(
              'Publish process did not complete successfully, and could not retrieve details to offer log download.'
            )
          );
          expect(logged()).toContain(VIEW_CMD);
        });
      });

      it('shows a message for each intermediate status', async () => {
        routeApi([90, 92, 99, 100, 202, 203, 77, 0]);
        s.getPublisDetailById.mockResolvedValue({ id: 'pub1' } as any);
        h.prompt.mockResolvedValue({ download: 'no' });

        const outcome = await start(100000);

        expect(outcome.ok).toBe(true);
        for (const text of [
          'Publish waiting in queue ⏳',
          'Publish finishing... 🔜',
          'Publish Status unknown',
          'Publish Step skipped ⏭️',
          'Publish in progress...',
          'Publish awaiting response... ⌛',
          'Publish Status: 77',
        ]) {
          expect(h.textHistory).toContainEqual(expect.stringContaining(text));
        }
        expect(succeedMessages()).toHaveLength(1);
      });

      it('times out after 60 checks', async () => {
        routeApi([91]);

        const outcome = await start(700000);

        expect(outcome.ok).toBe(false);
        expect(outcome.error).toBeInstanceOf(AppcircleExitError);
        expect(outcome.error.message).toBe('Publish monitoring timed out');
        expect(outcome.error.code).toBe(1);
        expect(h.apiGet).toHaveBeenCalledTimes(60);
        expect(failMessages()).toEqual([expect.stringContaining('Publish monitoring timed out after 600 seconds.')]);
      });

      it('turns an unexpected error into a monitoring error', async () => {
        routeApi([91]);
        h.outputType
          .mockReturnValueOnce('plain')
          .mockReturnValueOnce('plain')
          .mockImplementationOnce(() => {
            throw new Error('config broken');
          })
          .mockReturnValue('plain');

        const outcome = await start(700000);

        expect(outcome.ok).toBe(false);
        expect(outcome.error).toBeInstanceOf(AppcircleExitError);
        expect(outcome.error.message).toBe('Error while monitoring Publish Status');
        expect(outcome.error.code).toBe(1);
        expect(failMessages()).toEqual([expect.stringContaining('Error while monitoring Publish Status.')]);
      });
    });

    describe('json output', () => {
      const jsonLines = () =>
        logged()
          .filter((l) => l.startsWith('{'))
          .map((l) => JSON.parse(l));

      beforeEach(() => {
        h.outputType.mockReturnValue('json');
      });

      it('prints a success line without a spinner', async () => {
        routeApi([91, 0]);

        const outcome = await start(30000);

        expect(outcome.ok).toBe(true);
        expect(createOra).not.toHaveBeenCalled();
        expect(h.textHistory).toHaveLength(0);
        expect(jsonLines()).toEqual([
          { publishId: 'pub1', status: 'success', message: 'Publish completed successfully' },
        ]);
        expect(s.getPublisDetailById).not.toHaveBeenCalled();
      });

      // Same as above: the exit error is swallowed by the polling loop, so the call resolves.
      it.each([1, 2, 3, 201])('prints a failure line for final status %s and resolves', async (status) => {
        routeApi([status]);

        const outcome = await start(30000);

        expect(outcome.ok).toBe(true);
        expect(jsonLines()).toEqual([{ publishId: 'pub1', status: 'failed', message: 'Publish failed' }]);
        expect(s.getPublisDetailById).not.toHaveBeenCalled();
        expect(h.prompt).not.toHaveBeenCalled();
      });

      it('prints a failure line and exits with code 1 on timeout', async () => {
        routeApi([91]);

        const outcome = await start(700000);

        expect(outcome.error).toBeInstanceOf(AppcircleExitError);
        expect(outcome.error.message).toBe('');
        expect(outcome.error.code).toBe(1);
        expect(jsonLines()).toEqual([{ publishId: 'pub1', status: 'failed', message: 'Publish failed' }]);
      });

      it('prints a failure line and exits with code 1 on an unexpected error', async () => {
        routeApi([91]);
        h.outputType
          .mockReturnValueOnce('json')
          .mockReturnValueOnce('json')
          .mockImplementationOnce(() => {
            throw new Error('config broken');
          })
          .mockReturnValue('json');

        const outcome = await start(700000);

        expect(outcome.error).toBeInstanceOf(AppcircleExitError);
        expect(outcome.error.message).toBe('');
        expect(outcome.error.code).toBe(1);
        expect(jsonLines()).toEqual([{ publishId: 'pub1', status: 'failed', message: 'Publish failed' }]);
      });
    });
  });

  describe.each([
    ['handleSuccessfulPublish', handleSuccessfulPublish, 0, 'Publish completed successfully',
      'Publish completed successfully, but could not retrieve details to offer log download.'],
    ['handleFailedPublish', handleFailedPublish, 1, 'Publish process did not complete successfully',
      'Publish process did not complete successfully, and could not retrieve details to offer log download.'],
  ])('%s', (_name, handler, code, exitMessage, fallbackText) => {
    it('downloads the logs on "yes" and exits with the expected code', async () => {
      s.getPublisDetailById.mockResolvedValue({ id: 'pub1' } as any);
      s.getPublishProfileDetailById.mockResolvedValue({ name: 'P' } as any);
      h.apiGet.mockResolvedValue({ status: 200, data: 'LOGS' });
      h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '' });

      const outcome = settle(handler(params, h.spinner));
      await vi.runAllTimersAsync();
      const { error } = await outcome;

      expect(error).toBeInstanceOf(AppcircleExitError);
      expect(error.code).toBe(code);
      expect(error.message).toBe(exitMessage);
      expect(fs.writeFileSync).toHaveBeenCalledWith(`${DOWNLOADS}/P-${NOW}.txt`, 'LOGS');
      expect(logged()).toContain(VIEW_CMD);
    });

    it('prints the fallback text when the publish details cannot be read', async () => {
      s.getPublisDetailById.mockRejectedValue(new Error('down'));

      const { error } = await settle(handler(params, h.spinner));

      expect(error).toBeInstanceOf(AppcircleExitError);
      expect(error.code).toBe(code);
      expect(error.message).toBe(exitMessage);
      expect(h.prompt).not.toHaveBeenCalled();
      expect(logged()).toContainEqual(expect.stringContaining(fallbackText));
      expect(logged()).toContain(VIEW_CMD);
    });
  });
});

/**
 * Drives `appcircle build start` through handleBuildCommand end to end:
 * monitor modes (summary / steps / verbose), SSE log streaming handlers,
 * success / failure / timeout outcomes, automatic downloads and the
 * interactive "what next" prompts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

const h = vi.hoisted(() => {
  const state = {
    spinners: [] as any[],
    startFailures: new Map<string, number>(),
    onCreate: null as null | ((spinner: any) => void),
  };
  const makeSpinner = (initialText: string) => {
    const spinner: any = {
      initialText,
      texts: [] as string[],
      _text: initialText,
      get text() {
        return this._text;
      },
      set text(value: string) {
        this._text = value;
        this.texts.push(value);
      },
      start: vi.fn(() => {
        const remaining = state.startFailures.get(initialText) || 0;
        if (remaining > 0) {
          state.startFailures.set(initialText, remaining - 1);
          throw new Error('spinner unavailable');
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
  const logProcessor = {
    forceStartLogs: vi.fn(),
    processMessage: vi.fn(),
    flushAllMessages: vi.fn(),
  };
  const renderer = { renderMessage: vi.fn(() => ''), renderSummary: vi.fn() };
  const progressTracker = {
    updateProgress: vi.fn(),
    getBuildStats: vi.fn(() => ({ steps: 3 })),
    stop: vi.fn(),
  };
  const prompt = vi.fn();
  return { state, makeSpinner, logProcessor, renderer, progressTracker, prompt };
});

vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn((text: string) => h.makeSpinner(text)),
}));

vi.mock('enquirer', () => ({
  default: { prompt: h.prompt },
  prompt: h.prompt,
}));

vi.mock('../../../src/utils/LogProcessor', () => ({
  LogProcessor: vi.fn(function () {
    return h.logProcessor;
  }),
}));
vi.mock('../../../src/utils/TerminalRenderer', () => ({
  TerminalRenderer: vi.fn(function () {
    return h.renderer;
  }),
}));
vi.mock('../../../src/utils/ProgressTracker', () => ({
  ProgressTracker: vi.fn(function () {
    return h.progressTracker;
  }),
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn(),
  configWriter: vi.fn(),
}));

vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config')>();
  return {
    ...actual,
    getConsoleOutputType: vi.fn(() => 'plain'),
    getInteractiveMode: vi.fn(() => false),
    readEnviromentConfigVariable: vi.fn(() => undefined),
  };
});

vi.mock('../../../src/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services')>();
  return {
    ...actual,
    getBuildProfiles: vi.fn(),
    getBranches: vi.fn(),
    getBuildsOfCommit: vi.fn(),
    startBuild: vi.fn(),
    downloadArtifact: vi.fn(),
    downloadBuildLog: vi.fn(),
    downloadTaskLog: vi.fn(),
    getBuildStatusFromQueue: vi.fn(),
    getLatestBuildId: vi.fn(),
    getLatestBuildByBranch: vi.fn(),
    resolveIdentityFromToken: vi.fn(),
    getHookAccessToken: vi.fn(),
    openHookSSE: vi.fn(),
    triggerBuildLogsStreaming: vi.fn(),
    triggerStopBuildLogsStreaming: vi.fn(),
  };
});

import { handleBuildCommand } from '../../../src/core/command-runner';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import * as services from '../../../src/services';
import { getConsoleOutputType } from '../../../src/config';
import { commandWriter } from '../../../src/core/writer';

const svc = vi.mocked(services);
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const DOWNLOADS = '/mock/home/user/Downloads';

type Outcome = { ok: true; value: unknown } | { ok: false; error: any };

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
const originalArgv = process.argv;

const spinner = (initialText: string) => {
  const found = [...h.state.spinners].reverse().find((s) => s.initialText === initialText);
  if (!found) throw new Error(`no spinner created with "${initialText}"`);
  return found;
};
const hasSpinner = (initialText: string) => h.state.spinners.some((s) => s.initialText === initialText);

const logged = () => logSpy.mock.calls.map((c) => c.map(String).join(' '));
const errored = () => errorSpy.mock.calls.map((c) => c.map(String).join(' '));

const makeSse = (withClose = true) => {
  const conn: any = { browserId: 'browser-1', handlers: {} as Record<string, any> };
  conn.onMessage = vi.fn((fn: any) => {
    conn.handlers.message = fn;
  });
  conn.onClose = vi.fn((fn: any) => {
    conn.handlers.close = fn;
  });
  if (withClose) conn.close = vi.fn();
  return conn;
};

const baseParams = (extra: Record<string, any> = {}) => ({
  profileId: 'p1',
  workflowId: 'w1',
  branchId: 'b1',
  ...extra,
});

async function runBuildStart(params: any, monitor: string = 'summary'): Promise<Outcome> {
  const command: any = { fullCommandName: 'appcircle-build-start', opts: () => ({ monitor }) };
  let settled = false;
  const outcome: Promise<Outcome> = handleBuildCommand(command, params).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error })
  );
  outcome.then(() => {
    settled = true;
  });
  for (let i = 0; i < 2000 && !settled; i++) {
    await vi.advanceTimersByTimeAsync(1000);
  }
  return outcome;
}

function expectExit(outcome: Outcome, code: number, message?: string) {
  expect(outcome.ok).toBe(false);
  const error = (outcome as any).error;
  expect(error).toBeInstanceOf(AppcircleExitError);
  expect(error.code).toBe(code);
  if (message !== undefined) expect(error.message).toBe(message);
}

beforeEach(() => {
  vi.useFakeTimers();
  h.state.spinners.length = 0;
  h.state.startFailures.clear();
  h.state.onCreate = null;
  process.argv = ['node', 'appcircle'];
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true, isFile: () => true, size: 10 } as any);
  vi.mocked(getConsoleOutputType).mockReturnValue('plain' as any);
  vi.mocked(commandWriter).mockImplementation(() => undefined as any);

  h.prompt.mockReset();
  svc.startBuild.mockResolvedValue({ taskId: 't1', queueItemId: 'q1' });
  svc.getLatestBuildId.mockResolvedValue('build-latest');
  svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', hasWarning: false });
  svc.downloadArtifact.mockResolvedValue(undefined as any);
  svc.downloadBuildLog.mockResolvedValue(undefined as any);
  svc.downloadTaskLog.mockResolvedValue(undefined as any);
  svc.getLatestBuildByBranch.mockResolvedValue({ id: 'b-latest', commitId: 'c1' });
  svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Profile' }]);
  svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
  svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'b-commit' }] });
  svc.resolveIdentityFromToken.mockReturnValue({ sub: 'u1', currentOrganizationId: 'o1' } as any);
  svc.getHookAccessToken.mockResolvedValue('hook-token');
  svc.openHookSSE.mockResolvedValue(makeSse());
  svc.triggerBuildLogsStreaming.mockResolvedValue(undefined as any);
  svc.triggerStopBuildLogsStreaming.mockResolvedValue(undefined as any);
});

afterEach(() => {
  vi.useRealTimers();
  process.argv = originalArgv;
});

describe('build start - summary monitoring, successful build', () => {
  it('animates the progress spinner and exits after the user chooses to continue', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValueOnce({ buildStatus: 91 });
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    const progress = spinner('Checking Build Status...');
    // The 500ms animation cycles the dots: ".", "..", "...", "" and so on
    expect(progress.texts.some((t: string) => /^Build Running\. \(\d+s\)$/.test(t))).toBe(true);
    expect(progress.texts.some((t: string) => /^Build Running\.\.\. \(\d+s\)$/.test(t))).toBe(true);
    expect(progress.texts.some((t: string) => /^Build Running \(\d+s\)$/.test(t))).toBe(true);
    expect(progress.succeed).toHaveBeenCalledWith(expect.stringMatching(/^Build completed successfully ✅ - Total time: \d+s$/));
    expect(spinner('Starting Build...').succeed).toHaveBeenCalledWith('Build successfully added to queue.\n\nTaskId: t1');
    expect(logged()).toContain('\nWhat would you like to do next?');
    expect(logged()).toContain('Build completed successfully.');
    expect(svc.getBuildStatusFromQueue).toHaveBeenCalledWith({ taskId: 'q1' });

    // The animation interval is cleared once monitoring finishes
    const textCount = progress.texts.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(progress.texts.length).toBe(textCount);
  });

  it('reports warnings on the spinner when the successful build has warnings', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', hasWarning: true });
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    const progress = spinner('Checking Build Status...');
    expect(progress.text).toMatch(/^Build completed with warnings ⚠️ - Total time: \d+s$/);
    expect(progress.succeed).toHaveBeenCalledWith();
  });

  it('falls back to a plain success message when the spinner cannot render the summary', async () => {
    h.state.onCreate = (s) => {
      if (s.initialText === 'Checking Build Status...') {
        s.succeed.mockImplementationOnce(() => {
          throw new Error('render failed');
        });
      }
    };
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    const progress = spinner('Checking Build Status...');
    expect(progress.succeed).toHaveBeenCalledTimes(2);
    expect(progress.succeed).toHaveBeenLastCalledWith('Build completed successfully ✅');
  });

  it('rethrows unexpected errors raised after monitoring', async () => {
    vi.mocked(os.homedir).mockImplementationOnce(() => {
      throw new Error('no home directory');
    });

    const outcome = await runBuildStart(baseParams());

    expect(outcome.ok).toBe(false);
    expect((outcome as any).error).not.toBeInstanceOf(AppcircleExitError);
    expect((outcome as any).error.message).toBe('no home directory');
    expect(h.prompt).not.toHaveBeenCalled();
  });
});

describe('build start - successful build with automatic downloads', () => {
  it('waits for artifacts, downloads them and the build logs, then exits', async () => {
    const outcome = await runBuildStart(
      baseParams({ downloadArtifacts: true, downloadLogs: true, path: '~/out' })
    );

    expectExit(outcome, 0, 'Build completed');
    const expectedPath = '/mock/resolved//mock/home/user/out';
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'build-latest', branchId: 'b1', profileId: 'p1' },
      expectedPath,
      expect.stringMatching(/^artifacts-\d+\.zip$/)
    );
    const artifactSpinner = spinner('Waiting for artifacts to be ready...');
    expect(artifactSpinner.texts).toContain('Downloading artifacts...');
    expect(artifactSpinner.succeed).toHaveBeenCalledWith(
      expect.stringMatching(/^Artifacts downloaded successfully: file:\/\/\/mock\/resolved\/.*artifacts-\d+\.zip$/)
    );
    // Logs are fetched by commit/build through the latest build of the branch
    expect(svc.getLatestBuildByBranch).toHaveBeenCalledWith({ branchId: 'b1', profileId: 'p1' });
    expect(svc.downloadBuildLog).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'b-latest' },
      `/mock/resolved/${expectedPath}`,
      expect.stringMatching(/^main-Profile-build-b-latest-logs-\d+\.txt$/)
    );
    expect(spinner('Downloading build logs...').fail).not.toHaveBeenCalled();
    expect(h.prompt).not.toHaveBeenCalled();
  });

  it('reports a missing artifact and falls back to the queue item for logs when the build id is empty', async () => {
    svc.getLatestBuildId.mockResolvedValue(null as any);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', buildId: ZERO_ID });
    svc.downloadArtifact.mockRejectedValue(new Error('404 not found'));

    const outcome = await runBuildStart(baseParams({ 'download-artifacts': true, 'download-logs': true }));

    expectExit(outcome, 0, 'Build completed');
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ commitId: 'c1', buildId: ZERO_ID }),
      DOWNLOADS,
      expect.any(String)
    );
    expect(spinner('Waiting for artifacts to be ready...').fail).toHaveBeenCalledWith(
      'Build succeeded, but no artifacts were found.'
    );
    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'q1' }, DOWNLOADS);
    expect(svc.downloadBuildLog).not.toHaveBeenCalled();
  });

  it('only downloads artifacts when logs are not requested', async () => {
    const outcome = await runBuildStart(baseParams({ downloadArtifacts: true }));

    expectExit(outcome, 0, 'Build completed');
    expect(svc.downloadArtifact).toHaveBeenCalledTimes(1);
    expect(hasSpinner('Downloading build logs...')).toBe(false);
    expect(svc.downloadBuildLog).not.toHaveBeenCalled();
  });

  it('skips artifacts without a commit id and reports a log download crash', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0 });
    h.state.startFailures.set('Preparing to download Build Logs...', 1);

    const outcome = await runBuildStart(baseParams({ downloadArtifacts: true, downloadLogs: true }));

    expectExit(outcome, 0, 'Build completed');
    expect(hasSpinner('Waiting for artifacts to be ready...')).toBe(false);
    expect(svc.downloadArtifact).not.toHaveBeenCalled();
    expect(spinner('Downloading build logs...').fail).toHaveBeenCalledWith(
      'Cannot download logs since the build failed: spinner unavailable'
    );
  });
});

describe('build start - successful build, interactive next step', () => {
  it('downloads artifacts to the default path when the user leaves the path empty', async () => {
    h.prompt.mockResolvedValueOnce({ action: 'artifacts' }).mockResolvedValueOnce({ path: '   ' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    expect(h.prompt).toHaveBeenNthCalledWith(2, expect.objectContaining({
      message: '[OPTIONAL] Enter download path for artifacts',
      initial: DOWNLOADS,
    }));
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'build-latest', branchId: 'b1', profileId: 'p1' },
      DOWNLOADS,
      expect.stringMatching(/^artifacts-\d+\.zip$/)
    );
    expect(spinner('Downloading artifacts...').succeed).toHaveBeenCalledWith(
      expect.stringContaining('Artifacts downloaded successfully: file://')
    );
  });

  it('uses the build id from the queue status when the latest build id is unknown', async () => {
    svc.getLatestBuildId.mockResolvedValue(null as any);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', buildId: 'b-queue' });
    h.prompt.mockResolvedValueOnce({ action: 'artifacts' }).mockResolvedValueOnce({ path: '/art' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'b-queue', branchId: 'b1', profileId: 'p1' },
      '/art',
      expect.any(String)
    );
  });

  it('explains a missing artifact for a build with warnings', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', hasWarning: true });
    svc.downloadArtifact.mockRejectedValue(new Error('not found'));
    h.prompt.mockResolvedValueOnce({ action: 'artifacts' }).mockResolvedValueOnce({ path: '~/art' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    expect(svc.downloadArtifact).toHaveBeenCalledWith(expect.anything(), '/mock/home/user/art', expect.any(String));
    expect(spinner('Downloading artifacts...').fail).toHaveBeenCalledWith(
      'Build completed with warnings, but no artifacts were found.'
    );
  });

  it('tells the user when artifact information is unavailable', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0 });
    h.prompt.mockResolvedValueOnce({ action: 'artifacts' }).mockResolvedValueOnce({ path: '' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    expect(svc.downloadArtifact).not.toHaveBeenCalled();
    expect(logged()).toContain('Build completed successfully but could not get artifact information.');
  });

  it('downloads build logs by commit and build id and exits', async () => {
    h.prompt.mockResolvedValueOnce({ action: 'logs' }).mockResolvedValueOnce({ path: '/tmp/logs' });
    const params: any = baseParams();

    const outcome = await runBuildStart(params);

    expectExit(outcome, 0, '');
    expect(params.path).toBe('/tmp/logs');
    expect(svc.downloadBuildLog).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'b-latest' },
      '/mock/resolved//tmp/logs',
      expect.any(String)
    );
    expect(logged()).toContain('Build log downloaded successfully.');
  });

  it('downloads logs through the queue item when the build id is empty', async () => {
    svc.getLatestBuildId.mockResolvedValue(null as any);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', buildId: ZERO_ID });
    h.prompt.mockResolvedValueOnce({ action: 'logs' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, '');
    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'q1' }, '/tmp/logs');
    expect(logged()).toContain('Build log downloaded successfully.');
  });

  // Current behaviour: the fallback's own AppcircleExitError lands in its catch block, so a successful
  // retry also prints "could not download logs", and a successful build ends with exit 1 "Build failed".
  it('retries the log download through the queue item after a crash', async () => {
    h.state.startFailures.set('Preparing to download Build Logs...', 1);
    h.prompt.mockResolvedValueOnce({ action: 'logs' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain('Build failed and log download also failed: spinner unavailable');
    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'q1' }, '/tmp/logs');
    expect(logged()).toContain('Build failed but logs downloaded successfully.');
    expect(logged()).toContain('Build failed and could not download logs.');
  });

  it('reports when the fallback log download also crashes', async () => {
    h.state.startFailures.set('Preparing to download Build Logs...', 2);
    h.prompt.mockResolvedValueOnce({ action: 'logs' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain('Build failed and could not download logs.');
    expect(logged()).not.toContain('Build failed but logs downloaded successfully.');
  });

  it('treats a cancelled prompt as "continue"', async () => {
    h.prompt.mockRejectedValueOnce(new Error('cancelled'));

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    expect(logged()).toContain('Build completed successfully.');
  });
});

describe('build start - failed build, summary monitoring', () => {
  it.each([
    [1, 'Build completed, but failed.'],
    [2, 'Build was canceled.'],
    [3, 'Build timed out.'],
    [7, 'Build completed with status code: 7.'],
  ])('fails the spinner for status %s and exits when logs are declined', async (status, message) => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: status, commitId: 'c1' });
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(spinner('Checking Build Status...').fail).toHaveBeenCalledWith(message);
    expect(logged()).toContain('\nBuild failed. Would you like to download the logs?');
  });

  it('reports unavailable status information when the queue never reports a status', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({});
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(spinner('Checking Build Status...').fail).toHaveBeenCalledWith(
      'Build completed but status information is unavailable.'
    );
  });

  it('falls back to a generic failure message when the spinner cannot render the status', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1 });
    h.state.onCreate = (s) => {
      if (s.initialText === 'Checking Build Status...') {
        s.fail.mockImplementationOnce(() => {
          throw new Error('render failed');
        });
      }
    };
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(spinner('Checking Build Status...').fail).toHaveBeenLastCalledWith('Build completed unsuccessfully.');
  });

  it('fails the spinner when monitoring times out', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 91 });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build monitoring timed out');
    expect(spinner('Checking Build Status...').fail).toHaveBeenCalledWith('Build monitoring timed out after 900 seconds.');
    expect(svc.getBuildStatusFromQueue).toHaveBeenCalledTimes(300);
  });
});

describe('build start - failed build with automatic downloads', () => {
  it('downloads artifacts and waits before fetching logs of a canceled build', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 2, commitId: 'c1' });

    const outcome = await runBuildStart(baseParams({ downloadArtifacts: true, downloadLogs: true }));

    expectExit(outcome, 1, 'Build failed');
    expect(svc.downloadArtifact).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'build-latest', branchId: 'b1', profileId: 'p1' },
      DOWNLOADS,
      expect.any(String)
    );
    expect(spinner('Waiting for artifacts to be ready...').succeed).toHaveBeenCalledWith(
      expect.stringContaining('Artifacts downloaded successfully: file://')
    );
    expect(logged()).toContain('Note: Logs for canceled builds might not be immediately available.');
    expect(svc.downloadBuildLog).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'b-latest' },
      `/mock/resolved/${DOWNLOADS}`,
      expect.any(String)
    );
  });

  it('reports artifact failures and downloads logs through the queue item for an empty build id', async () => {
    svc.getLatestBuildId.mockResolvedValue(null as any);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1, commitId: 'c1', buildId: ZERO_ID });
    svc.downloadArtifact.mockRejectedValue(new Error('boom'));

    const outcome = await runBuildStart(baseParams({ 'download-artifacts': true, 'download-logs': true, path: '/out' }));

    expectExit(outcome, 1, 'Build failed');
    expect(spinner('Waiting for artifacts to be ready...').fail).toHaveBeenCalledWith(
      'Cannot download artifact since the build failed: boom'
    );
    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'q1' }, '/mock/resolved//out');
    expect(logged()).not.toContain('Note: Logs for canceled builds might not be immediately available.');
  });

  it('skips artifacts without a commit id and reports a log download crash', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1 });
    h.state.startFailures.set('Preparing to download Build Logs...', 1);

    const outcome = await runBuildStart(baseParams({ downloadArtifacts: true, downloadLogs: true }));

    expectExit(outcome, 1, 'Build failed');
    expect(svc.downloadArtifact).not.toHaveBeenCalled();
    expect(spinner('Downloading build logs...').fail).toHaveBeenCalledWith(
      'Cannot download logs since the build failed: spinner unavailable'
    );
  });

  it('only downloads artifacts when logs are not requested', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1, commitId: 'c1' });

    const outcome = await runBuildStart(baseParams({ downloadArtifacts: true }));

    expectExit(outcome, 1, 'Build failed');
    expect(svc.downloadArtifact).toHaveBeenCalledTimes(1);
    expect(hasSpinner('Downloading build logs...')).toBe(false);
  });
});

describe('build start - failed build, interactive log download', () => {
  it('downloads logs of a canceled build after a short wait', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 2, commitId: 'c1' });
    h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '/tmp/logs' });
    const params: any = baseParams();

    const outcome = await runBuildStart(params);

    expectExit(outcome, 1, 'Build failed');
    expect(params.wasCanceled).toBe(true);
    expect(params.path).toBe('/tmp/logs');
    expect(logged()).toContain('Note: Logs for canceled Builds might not be immediately available.');
    expect(svc.downloadBuildLog).toHaveBeenCalledWith(
      { commitId: 'c1', buildId: 'b-latest' },
      '/mock/resolved//tmp/logs',
      expect.any(String)
    );
    expect(logged()).toContain('Build log downloaded successfully.');
  });

  it('downloads logs through the queue item when the build id is empty', async () => {
    svc.getLatestBuildId.mockResolvedValue(null as any);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1, buildId: ZERO_ID });
    h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'q1' }, '/tmp/logs');
    expect(logged()).not.toContain('Note: Logs for canceled Builds might not be immediately available.');
  });

  // Current behaviour: a successful retry also prints "could not download logs" (the fallback's own
  // AppcircleExitError lands in its catch block).
  it('retries through the queue item after a crash', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1, commitId: 'c1' });
    h.state.startFailures.set('Preparing to download Build Logs...', 1);
    h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain('Build failed and log download also failed: spinner unavailable');
    expect(svc.downloadTaskLog).toHaveBeenCalledWith({ taskId: 'q1' }, '/tmp/logs');
    expect(logged()).toContain('Build failed but logs downloaded successfully.');
    expect(logged()).toContain('Build failed and could not download logs.');
  });

  it('reports when the fallback log download also crashes', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1, commitId: 'c1' });
    h.state.startFailures.set('Preparing to download Build Logs...', 2);
    h.prompt.mockResolvedValueOnce({ download: 'yes' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain('Build failed and could not download logs.');
    expect(logged()).not.toContain('Build failed but logs downloaded successfully.');
  });

  it('exits with a failure when the prompt is cancelled', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1 });
    h.prompt.mockRejectedValueOnce(new Error('cancelled'));

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 1, 'Build failed');
    expect(svc.downloadBuildLog).not.toHaveBeenCalled();
    expect(svc.downloadTaskLog).not.toHaveBeenCalled();
  });
});

describe('build start - verbose and steps monitoring', () => {
  it('streams verbose logs through the log processor and flushes them on close', async () => {
    const sse = makeSse();
    svc.openHookSSE.mockResolvedValue(sse);
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 0, '');
    expect(logged().some((l) => /^✔ Build completed successfully ✅ - Total time: \d+s$/.test(l))).toBe(true);
    expect(hasSpinner('Checking Build Status...')).toBe(false);
    expect(sse.close).toHaveBeenCalled();
    expect(svc.triggerBuildLogsStreaming).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't1', browserId: 'browser-1' }));

    sse.handlers.message(JSON.stringify([{ message: 'line 1' }, { message: 'line 2' }]));
    sse.handlers.message(JSON.stringify({ message: 'line 3' }));
    expect(logged().filter((l) => l === '✓ Build logs started streaming!')).toHaveLength(1);
    expect(h.logProcessor.forceStartLogs).toHaveBeenCalledTimes(1);
    expect(h.logProcessor.processMessage).toHaveBeenCalledTimes(3);
    expect(h.logProcessor.processMessage).toHaveBeenLastCalledWith({ message: 'line 3' });

    sse.handlers.message('{not json');
    expect(errored().some((l) => l.startsWith('Error parsing build log data:'))).toBe(true);

    sse.handlers.close();
    expect(h.progressTracker.getBuildStats).toHaveBeenCalled();
    expect(h.renderer.renderSummary).toHaveBeenCalledWith({ steps: 3 });
    expect(h.progressTracker.stop).toHaveBeenCalled();
    expect(h.logProcessor.flushAllMessages).toHaveBeenCalled();
  });

  it('renders step summaries in steps mode without flushing the log processor', async () => {
    const sse = makeSse();
    svc.openHookSSE.mockResolvedValue(sse);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1', hasWarning: true });
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams(), 'steps');

    expectExit(outcome, 0, 'Build completed');
    expect(logged().some((l) => /^✔ Build completed with warnings ⚠️ - Total time: \d+s$/.test(l))).toBe(true);

    sse.handlers.message(JSON.stringify({ workflowStatus: 1, stepName: 'Git Clone', message: '' }));
    expect(logged().some((l) => l.includes('Git Clone') && l.includes('(0s)'))).toBe(true);
    expect(h.logProcessor.processMessage).not.toHaveBeenCalled();

    sse.handlers.close();
    expect(h.renderer.renderSummary).toHaveBeenCalled();
    expect(h.logProcessor.flushAllMessages).not.toHaveBeenCalled();
  });

  it('falls back to a plain message when the verbose success line cannot be printed', async () => {
    let thrown = false;
    logSpy.mockImplementation((msg?: any) => {
      if (!thrown && typeof msg === 'string' && msg.includes('Total time')) {
        thrown = true;
        throw new Error('stdout closed');
      }
    });
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 0, '');
    expect(logged()).toContain('✔ Build completed successfully ✅');
  });

  it('prints the timeout to stderr when there is no progress spinner', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 91 });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 1, 'Build monitoring timed out');
    expect(errored()).toContain('Build monitoring timed out after 900 seconds.');
  });

  it.each([
    [1, '✗ Build completed, but failed.'],
    [2, '✗ Build was canceled.'],
    [3, '✗ Build timed out.'],
    [7, '✗ Build completed with status code: 7.'],
  ])('prints status %s directly and closes the stream before prompting', async (status, message) => {
    const sse = makeSse();
    svc.openHookSSE.mockResolvedValue(sse);
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: status });
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain(message);
    expect(sse.close).toHaveBeenCalled();
  });

  it('reports unavailable status information when the queue returns nothing', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue(null as any);
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const outcome = await runBuildStart(baseParams(), 'steps');

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain('✗ Build completed but status information is unavailable.');
  });

  it('falls back to a generic failure line when the status line cannot be printed', async () => {
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1 });
    let thrown = false;
    logSpy.mockImplementation((msg?: any) => {
      if (!thrown && msg === '✗ Build completed, but failed.') {
        thrown = true;
        throw new Error('stdout closed');
      }
    });
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 1, 'Build failed');
    expect(logged()).toContain('✗ Build completed unsuccessfully.');
  });

  it('works with a stream that has no close method', async () => {
    svc.openHookSSE.mockResolvedValue(makeSse(false));
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 1 });
    h.prompt.mockResolvedValueOnce({ download: 'no' });

    const failed = await runBuildStart(baseParams(), 'verbose');
    expectExit(failed, 1, 'Build failed');

    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0, commitId: 'c1' });
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const succeeded = await runBuildStart(baseParams(), 'verbose');
    expectExit(succeeded, 0, '');
  });

  it('exits right after the log download in verbose mode', async () => {
    h.prompt.mockResolvedValueOnce({ action: 'logs' }).mockResolvedValueOnce({ path: '/tmp/logs' });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 0, '');
    expect(logged()).toContain('Build log downloaded successfully.');
  });

  it('continues with standard monitoring when log streaming cannot be triggered', async () => {
    const sse = makeSse();
    svc.openHookSSE.mockResolvedValue(sse);
    svc.triggerBuildLogsStreaming.mockRejectedValue(new Error('hook down'));
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams(), 'steps');

    expectExit(outcome, 0, 'Build completed');
    expect(errored()).toContain('❌ Failed to trigger build logs: hook down');
    expect(logged()).toContain('Continuing with standard monitoring...');
    expect(sse.onMessage).not.toHaveBeenCalled();
  });

  it('queues the build normally when enhanced monitoring cannot be set up', async () => {
    svc.openHookSSE.mockRejectedValue(new Error('sse refused'));
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams(), 'verbose');

    expectExit(outcome, 0, '');
    expect(svc.triggerBuildLogsStreaming).not.toHaveBeenCalled();
    expect(spinner('Starting Build...').succeed).toHaveBeenLastCalledWith('Build successfully added to queue.\n\nTaskId: t1');
  });

  it('logs a monitoring setup failure and keeps monitoring the build', async () => {
    const failure = new Error('writer failed');
    vi.mocked(commandWriter).mockImplementationOnce(() => {
      throw failure;
    });
    h.prompt.mockResolvedValueOnce({ action: 'continue' });

    const outcome = await runBuildStart(baseParams());

    expectExit(outcome, 0, 'Build completed');
    expect(errorSpy).toHaveBeenCalledWith('Monitoring setup failed:', failure);
    expect(svc.getBuildStatusFromQueue).toHaveBeenCalled();
  });
});

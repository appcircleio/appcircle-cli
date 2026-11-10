/**
 * Tests for handleBuildCommand: name-to-id resolution (profile, branch, workflow, configuration,
 * variable group) and the "build start" flow (monitor mode parsing, parameter compatibility checks,
 * "none" mode, immediate return, SSE based steps/verbose monitoring and summary monitoring).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const svc = vi.hoisted(() => ({
  getBuildProfiles: vi.fn(),
  getBranches: vi.fn(),
  getWorkflows: vi.fn(),
  getConfigurations: vi.fn(),
  getEnvironmentVariableGroups: vi.fn(),
  startBuild: vi.fn(),
  resolveIdentityFromToken: vi.fn(),
  getHookAccessToken: vi.fn(),
  openHookSSE: vi.fn(),
  triggerBuildLogsStreaming: vi.fn(),
  triggerStopBuildLogsStreaming: vi.fn(),
  getBuildStatusFromQueue: vi.fn(),
  getLatestBuildId: vi.fn(),
  downloadArtifact: vi.fn(),
  downloadBuildLog: vi.fn(),
}));

const spinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  text: '',
}));

const cfg = vi.hoisted(() => ({
  getConsoleOutputType: vi.fn(),
  readEnviromentConfigVariable: vi.fn(),
}));

const util = vi.hoisted(() => ({ selectBuildMonitorMode: vi.fn() }));

// Monitoring components loaded through dynamic import() inside handleBuildCommand
const mon = vi.hoisted(() => {
  const state: { logCallback: ((m: any) => void) | null } = { logCallback: null };
  const logProcessor = { forceStartLogs: vi.fn(), processMessage: vi.fn(), flushAllMessages: vi.fn() };
  const renderer = { renderMessage: vi.fn(), renderSummary: vi.fn() };
  const tracker = { updateProgress: vi.fn(), getBuildStats: vi.fn(), stop: vi.fn() };
  return {
    state,
    logProcessor,
    renderer,
    tracker,
    LogProcessor: vi.fn(function (cb: (m: any) => void) {
      state.logCallback = cb;
      return logProcessor;
    }),
    TerminalRenderer: vi.fn(function () {
      return renderer;
    }),
    ProgressTracker: vi.fn(function () {
      return tracker;
    }),
  };
});

vi.mock('../../../src/services', () => svc);
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => spinner) }));
vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config')>();
  return { ...actual, getConsoleOutputType: cfg.getConsoleOutputType, readEnviromentConfigVariable: cfg.readEnviromentConfigVariable };
});
vi.mock('../../../src/core/command-runner-utilities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/command-runner-utilities')>();
  return { ...actual, selectBuildMonitorMode: util.selectBuildMonitorMode };
});
vi.mock('../../../src/utils/LogProcessor', () => ({ LogProcessor: mon.LogProcessor }));
vi.mock('../../../src/utils/TerminalRenderer', () => ({ TerminalRenderer: mon.TerminalRenderer }));
vi.mock('../../../src/utils/ProgressTracker', () => ({ ProgressTracker: mon.ProgressTracker }));

import { handleBuildCommand } from '../../../src/core/command-runner';
import { commandWriter } from '../../../src/core/writer';
import enquirer from 'enquirer';
import { ProgramError } from '../../../src/core/ProgramError';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { Commands, CommandTypes } from '../../../src/core/commands';
import { BuildMonitorMode } from '../../../src/core/command-runner-utilities';

const prompt = vi.mocked(enquirer.prompt);
const startCmd = (opts: Record<string, any> = {}) => ({ fullCommandName: 'appcircle-build-start', opts: () => opts }) as any;
const base = () => ({ profileId: 'p1', branchId: 'b1', workflowId: 'w1' }) as any;

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
/** Yield to the event loop and advance fake time in small steps until `cond` holds. */
async function until(cond: () => boolean, step = 10) {
  for (let i = 0; i < 5000; i++) {
    if (cond()) return;
    await tick();
    await vi.advanceTimersByTimeAsync(step);
  }
  throw new Error('condition was not reached');
}

async function run(params: any, opts: Record<string, any> = {}) {
  let done = false;
  let outcome: any;
  handleBuildCommand(startCmd(opts), params).then(
    () => { outcome = 'resolved'; done = true; },
    (e) => { outcome = e; done = true; }
  );
  await until(() => done);
  return outcome;
}

type Sse = { browserId: string; onMessage: any; onClose: any; close: any; handlers: { message?: (d: string) => void; close?: () => void } };
const makeSse = (): Sse => {
  const handlers: Sse['handlers'] = {};
  return {
    browserId: 'browser-1',
    handlers,
    onMessage: vi.fn((cb: (d: string) => void) => { handlers.message = cb; }),
    onClose: vi.fn((cb: () => void) => { handlers.close = cb; }),
    close: vi.fn(),
  };
};

const errorLines = () => vi.mocked(console.error).mock.calls.map((c) => c.join(' '));
const logLines = () => vi.mocked(console.log).mock.calls.map((c) => c.join(' '));

describe('handleBuildCommand', () => {
  const originalArgv = process.argv;
  let env: Record<string, string | undefined>;
  let sse: Sse;
  const restorers: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    process.argv = ['node', 'appcircle'];
    restorers.push(vi.spyOn(process.stdout, 'write').mockImplementation(() => true));
    restorers.push(vi.spyOn(process.stderr, 'write').mockImplementation(() => true));

    spinner.start.mockReturnValue(spinner);
    spinner.text = '';
    env = { AC_ACCESS_TOKEN: 'acc-token', API_HOSTNAME: 'https://api.test', HOOK_HOSTNAME: 'https://hook.test' };
    cfg.getConsoleOutputType.mockReturnValue('plain');
    cfg.readEnviromentConfigVariable.mockImplementation((key: string) => env[key]);
    util.selectBuildMonitorMode.mockResolvedValue({ mode: BuildMonitorMode.SUMMARY, cancelled: false });

    sse = makeSse();
    svc.startBuild.mockResolvedValue({ taskId: 't1', queueItemId: 'q1' });
    svc.getBuildStatusFromQueue.mockResolvedValue({ buildStatus: 0 });
    svc.getLatestBuildId.mockResolvedValue('build-1');
    svc.resolveIdentityFromToken.mockReturnValue({ sub: 'user-1', currentOrganizationId: 'org-1' });
    svc.getHookAccessToken.mockResolvedValue('hook-token');
    svc.openHookSSE.mockResolvedValue(sse);
    svc.triggerBuildLogsStreaming.mockResolvedValue(undefined);
    svc.triggerStopBuildLogsStreaming.mockResolvedValue(undefined);
    prompt.mockResolvedValue({ action: 'continue' } as any);
    mon.state.logCallback = null;
  });

  afterEach(() => {
    restorers.splice(0).forEach((r) => r.mockRestore());
    process.argv = originalArgv;
    vi.useRealTimers();
  });

  describe('name resolution', () => {
    const other = { fullCommandName: 'appcircle-build-zzz', opts: () => ({}) } as any;

    it('resolves profile, branch, workflow, configuration and variable group names to ids', async () => {
      svc.getBuildProfiles.mockResolvedValue([{ id: 'p0', name: 'Other' }, { id: 'p1', name: 'Prof' }]);
      svc.getBranches.mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
      svc.getWorkflows.mockResolvedValue([{ id: 'w1', workflowName: 'Default' }]);
      svc.getConfigurations.mockResolvedValue([{ item1: { id: 'c0', configurationName: 'Debug' } }, { item1: { id: 'c1', configurationName: 'Release' } }]);
      svc.getEnvironmentVariableGroups.mockResolvedValue([{ id: 'g1', name: 'Vars' }]);
      const params: any = { profile: 'Prof', branch: 'main', workflow: 'Default', configuration: 'Release', variableGroup: 'Vars' };
      await handleBuildCommand(other, params);
      expect(params).toMatchObject({ profileId: 'p1', branchId: 'b1', workflowId: 'w1', configurationId: 'c1', variableGroupId: 'g1' });
      expect(svc.getBranches).toHaveBeenCalledWith({ profileId: 'p1' });
      expect(svc.getWorkflows).toHaveBeenCalledWith({ profileId: 'p1' });
      expect(svc.getConfigurations).toHaveBeenCalledWith({ profileId: 'p1' });
      expect(console.error).toHaveBeenCalledWith('"appcircle build zzz ..." command not found.');
    });

    it('skips lookups when ids are already given or no profile is known', async () => {
      await handleBuildCommand(other, { profile: 'P', profileId: 'p1', branch: 'b', branchId: 'b1', workflow: 'w', workflowId: 'w1', configuration: 'c', configurationId: 'c1', variableGroup: 'v', variableGroupId: 'v1' });
      await handleBuildCommand(other, { branch: 'b', workflow: 'w', configuration: 'c' });
      expect(svc.getBuildProfiles).not.toHaveBeenCalled();
      expect(svc.getBranches).not.toHaveBeenCalled();
      expect(svc.getWorkflows).not.toHaveBeenCalled();
      expect(svc.getConfigurations).not.toHaveBeenCalled();
      expect(svc.getEnvironmentVariableGroups).not.toHaveBeenCalled();
    });

    it('throws with available profiles when the profile name is unknown', async () => {
      svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Prof' }]);
      const err = await handleBuildCommand(other, { profile: 'Nope' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('Build profile "Nope" not found.');
      expect(err.message).toContain('  - Prof');
    });

    it('throws with available branches, or "No branches found" when the list is missing', async () => {
      svc.getBranches.mockResolvedValueOnce({ branches: [{ id: 'b1', name: 'main' }] });
      let err = await handleBuildCommand(other, { profileId: 'p1', branch: 'dev' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('Branch "dev" not found for build profile.');
      expect(err.message).toContain('  - main');

      svc.getBranches.mockResolvedValueOnce({});
      err = await handleBuildCommand(other, { profileId: 'p1', branch: 'dev' }).catch((e) => e);
      expect(err.message).toContain('No branches found');
    });

    it('throws with available workflows when the workflow name is unknown', async () => {
      svc.getWorkflows.mockResolvedValue([{ id: 'w1', workflowName: 'Default' }]);
      const err = await handleBuildCommand(other, { profileId: 'p1', workflow: 'X' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('Workflow "X" not found for build profile.');
      expect(err.message).toContain('  - Default');
    });

    it('throws with available configurations, naming entries without item1 "Unknown"', async () => {
      svc.getConfigurations.mockResolvedValue([{ item1: { id: 'c1', configurationName: 'Release' } }, {}]);
      const err = await handleBuildCommand(other, { profileId: 'p1', configuration: 'X' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('Configuration "X" not found for build profile.');
      expect(err.message).toContain('  - Release');
      expect(err.message).toContain('  - Unknown');
    });

    it('throws with available variable groups when the group name is unknown', async () => {
      svc.getEnvironmentVariableGroups.mockResolvedValue([{ id: 'g1', name: 'Vars' }]);
      const err = await handleBuildCommand(other, { variableGroup: 'X' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('Variable group "X" not found.');
      expect(err.message).toContain('  - Vars');
    });
  });

  describe('build start parameter checks', () => {
    it('prints the command help and exits when profile/workflow are missing', async () => {
      const err = await run({});
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(1);
      expect(errorLines()).toHaveLength(1);
      expect(svc.startBuild).not.toHaveBeenCalled();
    });

    it('exits without help text when the command has no description', async () => {
      const startEntry = Commands.find((c) => c.command === CommandTypes.BUILD)!.subCommands!.find((c) => c.command === 'start')!;
      const saved = { description: startEntry.description, longDescription: startEntry.longDescription };
      startEntry.description = '';
      startEntry.longDescription = undefined;
      try {
        const err = await run({});
        expect(err).toBeInstanceOf(AppcircleExitError);
        expect(console.error).not.toHaveBeenCalled();
      } finally {
        Object.assign(startEntry, saved);
      }
    });

    const expectInvalid = (err: any, ...reasons: string[]) => {
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.message).toBe('Invalid parameter combination');
      const lines = errorLines().join('\n');
      for (const r of reasons) expect(lines).toContain(r);
      expect(svc.startBuild).not.toHaveBeenCalled();
    };

    it('rejects a --monitor flag without a value (last argument or followed by another flag)', async () => {
      process.argv = ['node', 'appcircle', 'build', 'start', '--monitor'];
      expectInvalid(await run(base()), "Invalid value for --monitor: '(missing)'");

      vi.mocked(console.error).mockClear();
      process.argv = ['node', 'appcircle', 'build', 'start', '--monitor', '--profileId'];
      expectInvalid(await run(base()), "Invalid value for --monitor: '(missing)'");
    });

    it('rejects unknown and non-string --monitor values', async () => {
      expectInvalid(await run(base(), { monitor: 'bogus' }), "Invalid value for --monitor: 'bogus'");
      vi.mocked(console.error).mockClear();
      expectInvalid(await run(base(), { monitor: true }), "Invalid value for --monitor: 'true'");
    });

    it('rejects --monitor and download options together with --no-wait', async () => {
      process.argv = ['node', 'appcircle', '--no-wait', '--monitor', 'steps'];
      expectInvalid(
        await run({ ...base(), downloadArtifacts: true }, { monitor: 'steps' }),
        '1. Cannot use --monitor with --no-wait',
        '2. Cannot use --download-artifacts or --download-logs with --no-wait'
      );
    });

    it('rejects download options with --monitor none (all spellings of the download flags)', async () => {
      for (const extra of [{ 'download-artifacts': true }, { downloadLogs: true }, { 'download-logs': true }]) {
        vi.mocked(console.error).mockClear();
        expectInvalid(await run({ ...base(), ...extra }, { monitor: 'none' }), 'Cannot use --download-artifacts or --download-logs with --monitor none');
      }
    });

    it('maps the legacy --execution-mode "skip" to none', async () => {
      expectInvalid(await run({ ...base(), downloadLogs: true }, { executionMode: 'SKIP' }), 'with --monitor none');
    });
  });

  describe('none monitor mode', () => {
    it('prints the task id and exits with code 0', async () => {
      const err = await run(base(), { monitor: 'NONE' });
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.message).toBe('Task ID generated');
      expect(err.code).toBe(0);
      expect(spinner.succeed).toHaveBeenCalledWith('Task ID generated successfully.\n\nTaskId: t1');
      expect(logLines()).toHaveLength(0);
    });

    it('also prints JSON in JSON output mode', async () => {
      cfg.getConsoleOutputType.mockReturnValue('json');
      const err = await run(base(), { monitor: 'none' });
      expect(err.code).toBe(0);
      expect(console.log).toHaveBeenCalledWith(JSON.stringify({ taskId: 't1', queueItemId: 'q1', mode: 'none' }));
    });

    it('forces none mode with --no-wait', async () => {
      process.argv = ['node', 'appcircle', '--no-wait'];
      const err = await run(base(), { monitor: 'verbose' });
      expect(err.message).toBe('Task ID generated');
      expect(svc.openHookSSE).not.toHaveBeenCalled();
    });

    it('uses the interactively selected mode', async () => {
      util.selectBuildMonitorMode.mockResolvedValue({ mode: BuildMonitorMode.NONE, cancelled: false });
      const err = await run(base());
      expect(util.selectBuildMonitorMode).toHaveBeenCalled();
      expect(err.message).toBe('Task ID generated');
    });

    it('prompts when --monitor is followed by a value Commander did not parse', async () => {
      process.argv = ['node', 'appcircle', '--monitor', 'steps'];
      util.selectBuildMonitorMode.mockResolvedValue({ mode: BuildMonitorMode.NONE, cancelled: false });
      const err = await run(base());
      expect(util.selectBuildMonitorMode).toHaveBeenCalled();
      expect(err.message).toBe('Task ID generated');
    });

    it('exits with code 0 when the interactive selection is cancelled', async () => {
      util.selectBuildMonitorMode.mockResolvedValue({ mode: BuildMonitorMode.SUMMARY, cancelled: true });
      const err = await run(base());
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.message).toBe('Build cancelled');
      expect(err.code).toBe(0);
      expect(console.log).toHaveBeenCalledWith('\nBuild cancelled by user.');
      expect(svc.startBuild).not.toHaveBeenCalled();
    });
  });

  describe('legacy --execution-mode mapping', () => {
    beforeEach(() => {
      svc.startBuild.mockRejectedValue(new Error('stop after mode selection'));
    });

    it.each([
      ['normal', false, undefined],
      ['detailed', true, true],
      ['step-summary', true, false],
    ])('maps %s', async (mode, usesSse, verbose) => {
      const err = await run(base(), { executionMode: mode });
      expect(err.message).toBe('stop after mode selection');
      expect(spinner.fail).toHaveBeenCalledWith('Failed to start build');
      if (usesSse) {
        expect(mon.TerminalRenderer).toHaveBeenCalledWith(expect.objectContaining({ verboseMode: verbose, noColor: false }));
      } else {
        expect(svc.openHookSSE).not.toHaveBeenCalled();
      }
    });

    it('warns about an unknown mode and falls back to summary', async () => {
      const err = await run(base(), { executionMode: 'weird' });
      expect(err.message).toBe('stop after mode selection');
      expect(console.warn).toHaveBeenCalledWith("Warning: Unknown execution mode 'weird'. Using 'summary' mode.");
      expect(svc.openHookSSE).not.toHaveBeenCalled();
    });
  });

  describe('immediate return after starting the build', () => {
    // --no-wait normally forces "none" mode before startBuild; here it only becomes visible to the
    // later wait-behaviour check, which exercises the immediate-return handling after startBuild.
    beforeEach(() => {
      svc.startBuild.mockImplementation(async () => {
        process.argv = [...process.argv, '--no-wait'];
        return { taskId: 't1', queueItemId: 'q1' };
      });
    });

    it('prints JSON and exits in JSON mode', async () => {
      cfg.getConsoleOutputType.mockReturnValue('json');
      const err = await run(base());
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(0);
      expect(spinner.stop).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(JSON.stringify({ taskId: 't1', queueItemId: 'q1' }));
      expect(spinner.fail).not.toHaveBeenCalled();
    });

    it('writes the queued build and exits in plain mode', async () => {
      const err = await run(base(), { monitor: 'summary' });
      expect(err.message).toBe('Build queued successfully');
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: 'appcircle-build-start',
        data: { taskId: 't1', queueItemId: 'q1' },
      });
      expect(spinner.succeed).toHaveBeenCalledWith('Build successfully added to queue.\n\nTaskId: t1');
      expect(spinner.fail).not.toHaveBeenCalled();
    });
  });

  describe('summary monitoring', () => {
    it('queues, monitors until success and ends after "continue"', async () => {
      const err = await run(base(), { monitor: 'summary' });
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.message).toBe('Build completed');
      expect(err.code).toBe(0);
      expect(spinner.succeed).toHaveBeenCalledWith('Build successfully added to queue.\n\nTaskId: t1');
      expect(svc.getBuildStatusFromQueue).toHaveBeenCalledWith({ taskId: 'q1' });
      expect(svc.openHookSSE).not.toHaveBeenCalled();
    });

    it('in JSON mode returns right after starting the build, without queue output or monitoring', async () => {
      cfg.getConsoleOutputType.mockReturnValue('json');
      const outcome = await run(base());
      expect(outcome).toBe('resolved');
      expect(svc.startBuild).toHaveBeenCalledTimes(1);
      expect(commandWriter).not.toHaveBeenCalled();
      expect(spinner.succeed).not.toHaveBeenCalled();
      expect(spinner.fail).not.toHaveBeenCalled();
      expect(svc.getBuildStatusFromQueue).not.toHaveBeenCalled();
    });
  });

  describe('enhanced (SSE) monitoring', () => {
    it('steps mode: streams step events, triggers cleanup on completion and closes the connection', async () => {
      svc.startBuild.mockResolvedValue({ queueItemId: 'q1' });
      env.HOOK_HOSTNAME = undefined;
      svc.triggerStopBuildLogsStreaming.mockRejectedValue(new Error('stop failed'));
      svc.getBuildStatusFromQueue.mockImplementation(async () => {
        sse.handlers.message!(
          JSON.stringify([
            { workflowStatus: 1, stepName: 'Completing workflow' },
            { workflowStatus: 2, stepName: 'Completing workflow' },
          ])
        );
        sse.handlers.close!();
        return { buildStatus: 0 };
      });

      const err = await run(base(), { monitor: 'steps' });
      expect(err.message).toBe('Build completed');

      expect(svc.openHookSSE).toHaveBeenCalledWith({ hookHostname: 'https://hook.appcircle.io', userId: 'user-1', organizationId: 'org-1', token: 'hook-token' });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('SSE connection established with browserId: browser-1'));
      expect(spinner.succeed).toHaveBeenCalledWith('Build successfully added to queue with step monitoring enabled.\n\nTaskId: undefined');
      expect(svc.triggerBuildLogsStreaming).toHaveBeenCalledWith({
        apiHostname: 'https://api.test',
        hookHostname: 'https://hook.appcircle.io',
        accessToken: 'acc-token',
        taskId: 'q1',
        browserId: 'browser-1',
        userId: 'user-1',
        organizationId: 'org-1',
      });
      expect(logLines().some((l) => l.includes('Build logs started streaming!'))).toBe(true);
      // onClose: summary rendered from the tracker, no verbose flush in steps mode
      expect(mon.tracker.getBuildStats).toHaveBeenCalled();
      expect(mon.renderer.renderSummary).toHaveBeenCalled();
      expect(mon.tracker.stop).toHaveBeenCalled();
      expect(mon.logProcessor.flushAllMessages).not.toHaveBeenCalled();

      // "Completing workflow" finished -> formatter fires the completion callback after 100ms
      await until(() => errorLines().some((l) => l.includes('Warning during cleanup: stop failed')));
      expect(svc.triggerStopBuildLogsStreaming).toHaveBeenCalledWith({
        hookHostname: 'https://hook.appcircle.io',
        accessToken: 'acc-token',
        taskId: 'q1',
        browserId: 'browser-1',
        userId: 'user-1',
        organizationId: 'org-1',
      });
      expect(sse.close).toHaveBeenCalled();
    });

    it('steps mode: completion cleanup succeeds silently', async () => {
      svc.getBuildStatusFromQueue.mockImplementation(async () => {
        sse.handlers.message!(JSON.stringify([
          { workflowStatus: 1, stepName: 'Completing workflow' },
          { workflowStatus: 2, stepName: 'Completing workflow' },
        ]));
        return { buildStatus: 0 };
      });
      const err = await run(base(), { monitor: 'steps' });
      expect(err.message).toBe('Build completed');
      await until(() => svc.triggerStopBuildLogsStreaming.mock.calls.length > 0);
      await tick();
      expect(svc.triggerStopBuildLogsStreaming).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't1' }));
      expect(errorLines().some((l) => l.includes('Warning during cleanup'))).toBe(false);
    });

    it('verbose mode: forwards events to the log processor and renders processed messages', async () => {
      mon.renderer.renderMessage.mockReturnValueOnce('formatted line').mockReturnValueOnce('').mockReturnValueOnce('   ');
      svc.getBuildStatusFromQueue.mockImplementation(async () => {
        sse.handlers.message!(JSON.stringify({ message: 'first' }));
        sse.handlers.message!(JSON.stringify({ message: 'second' }));
        sse.handlers.message!('not json');
        mon.state.logCallback!({ id: 1 });
        mon.state.logCallback!({ id: 2 });
        mon.state.logCallback!({ id: 3 });
        sse.handlers.close!();
        return { buildStatus: 0 };
      });

      const err = await run(base(), { monitor: 'verbose' });
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.message).toBe('');
      expect(err.code).toBe(0);

      expect(mon.TerminalRenderer).toHaveBeenCalledWith(expect.objectContaining({ verboseMode: true, timestamps: false }));
      expect(mon.ProgressTracker).toHaveBeenCalled();
      expect(spinner.succeed).toHaveBeenCalledWith('Build successfully added to queue with verbose monitoring enabled.\n\nTaskId: t1');
      expect(svc.triggerBuildLogsStreaming).toHaveBeenCalledWith(expect.objectContaining({ hookHostname: 'https://hook.test', taskId: 't1' }));
      expect(mon.logProcessor.forceStartLogs).toHaveBeenCalledTimes(1);
      expect(mon.logProcessor.processMessage).toHaveBeenNthCalledWith(1, { message: 'first' });
      expect(mon.logProcessor.processMessage).toHaveBeenNthCalledWith(2, { message: 'second' });
      expect(logLines().filter((l) => l.includes('Build logs started streaming!'))).toHaveLength(1);
      expect(errorLines().some((l) => l.includes('Error parsing build log data:'))).toBe(true);
      // log processor callback: progress always updated, only non-blank rendered output printed
      expect(mon.tracker.updateProgress).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith('formatted line');
      expect(console.log).not.toHaveBeenCalledWith('   ');
      // the only empty line is the separator printed after "Build logs started streaming!"
      expect(vi.mocked(console.log).mock.calls.filter((c) => c[0] === '')).toHaveLength(1);
      expect(mon.logProcessor.flushAllMessages).toHaveBeenCalled();
      expect(sse.close).toHaveBeenCalled();
    });

    it('continues with standard monitoring when triggering the log stream fails', async () => {
      svc.triggerBuildLogsStreaming.mockRejectedValue(new Error('trigger failed'));
      const err = await run(base(), { monitor: 'steps' });
      expect(err.message).toBe('Build completed');
      expect(errorLines().some((l) => l.includes('Failed to trigger build logs: trigger failed'))).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Continuing with standard monitoring...'));
      expect(sse.onMessage).not.toHaveBeenCalled();
    });

    it('falls back to normal output when the SSE setup fails', async () => {
      svc.openHookSSE.mockRejectedValue(new Error('sse down'));
      const err = await run(base(), { monitor: 'steps' });
      expect(err.message).toBe('Build completed');
      expect(errorLines().some((l) => l.includes('Failed to setup enhanced monitoring: sse down'))).toBe(true);
      expect(svc.triggerBuildLogsStreaming).not.toHaveBeenCalled();
      expect(spinner.succeed).toHaveBeenCalledWith('Build successfully added to queue with step monitoring enabled.\n\nTaskId: t1');
    });
  });
});

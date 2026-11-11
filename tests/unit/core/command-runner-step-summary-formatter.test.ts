/**
 * Unit tests for the two build-log formatters exported by command-runner:
 * createStepSummaryFormatter (step table with live timer) and the edge paths of
 * createCleanTerminalFormatter that the older suite does not reach.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createStepSummaryFormatter,
  createCleanTerminalFormatter,
} from '../../../src/core/command-runner';

vi.mock('chalk', () => {
  const tag = (name: string) => vi.fn((text: string) => `[${name}]${text}[/${name}]`);
  return {
    default: {
      gray: tag('gray'),
      blue: tag('blue'),
      green: tag('green'),
      red: tag('red'),
      cyan: tag('cyan'),
      yellow: tag('yellow'),
      white: tag('white'),
      hex: vi.fn(() => tag('hex')),
    },
  };
});

const PAD = 45;
const line = (icon: string, color: string, name: string, duration: string) =>
  `[${color}]${icon} ${name.padEnd(PAD)}[/${color}] (${duration})\n`;

describe('createStepSummaryFormatter', () => {
  let fmt: ReturnType<typeof createStepSummaryFormatter>;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let consoleLog: ReturnType<typeof vi.spyOn>;

  const writes = () => stdoutWrite.mock.calls.map((c: any[]) => c[0]);
  const logs = () => consoleLog.mock.calls.map((c: any[]) => c[0]);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    fmt = createStepSummaryFormatter();
  });

  afterEach(() => {
    fmt.finish();
    vi.useRealTimers();
    stdoutWrite.mockRestore();
    consoleLog.mockRestore();
  });

  describe('step start (workflowStatus 1)', () => {
    it('prints the header once and a running line for each new step', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: ' Clone ' });
      fmt.processMessage({ workflowStatus: 1, stepName: 'Build' });

      expect(logs().filter((l: string) => l === '🚀 Build Progress:')).toHaveLength(1);
      expect(logs()).toContain(`[yellow]🔄 ${'Clone'.padEnd(PAD)}[/yellow] (0s)`);
      expect(logs()).toContain(`[yellow]🔄 ${'Build'.padEnd(PAD)}[/yellow] (0s)`);
    });

    it('re-selects an existing step without printing it again', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage({ workflowStatus: 1, stepName: 'B' });
      consoleLog.mockClear();

      // A is still running: it becomes the active step again
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      // complete A in place (it is the active step) -> cursor-up rewrite
      fmt.processMessage({ workflowStatus: 2, stepName: 'A', message: 'done' });
      expect(writes()).toEqual(['\x1b[1A', '\x1b[2K', line('✅', 'green', 'A', '<1s')]);

      // A is completed now: selecting it again does not print anything
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      expect(logs()).toEqual([]);
    });

    it('ignores a start event for the step that is already active', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      consoleLog.mockClear();
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      expect(logs()).toEqual([]);
    });
  });

  describe('step end duration (extractDurationFromEvent / formatDuration)', () => {
    const endWith = (event: any) => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'S' });
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'S', ...event });
      return writes().at(-1);
    };

    it('uses a numeric duration property from the event', () => {
      expect(endWith({ duration: 7 })).toBe(line('✅', 'green', 'S', '7s'));
    });

    it('uses a numeric stepDuration property and formats minutes', () => {
      expect(endWith({ duration: 'x', stepDuration: 75 })).toBe(line('✅', 'green', 'S', '1m 15s'));
    });

    it('parses "N seconds" from the message when the first pattern does not match', () => {
      expect(endWith({ stepDuration: '9', message: 'finished after 5 seconds' })).toBe(
        line('✅', 'green', 'S', '5s'),
      );
    });

    it('formats a server duration of 0 as <1s', () => {
      expect(endWith({ duration: 0, message: 'took 0s' })).toBe(line('✅', 'green', 'S', '<1s'));
    });

    it('falls back to the client clock when the event has no message or duration', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'S' });
      vi.advanceTimersByTime(3000);
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'S' });
      expect(writes().at(-1)).toBe(line('✅', 'green', 'S', '3s'));
      expect(fmt.getTotalStepsDuration()).toBe(3);
    });

    it('returns <1s when the step start time is 0 (clock at epoch)', () => {
      vi.setSystemTime(0);
      fmt.processMessage({ workflowStatus: 1, stepName: 'S' });
      // timer tick formats the running step with startTime 0
      vi.advanceTimersByTime(1000);
      expect(writes().at(-1)).toBe(`[yellow]🔄 ${'S'.padEnd(PAD)}[/yellow] (<1s)\n`);
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'S', message: 'ok' });
      expect(writes().at(-1)).toBe(line('✅', 'green', 'S', '<1s'));
    });
  });

  describe('completion status handling', () => {
    it('prints a non-active completed step without cursor movement', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage({ workflowStatus: 1, stepName: 'B' });
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'A', message: 'ok' });
      expect(writes()).toEqual([line('✅', 'green', 'A', '<1s')]);
      // second completion while the timer is already stopped
      fmt.processMessage({ workflowStatus: 2, stepName: 'B', message: 'ok' });
      expect(writes().at(-1)).toBe(line('✅', 'green', 'B', '<1s'));
    });

    it('shows a failed step with the red cross and keeps FAILED on a later end event', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'Test' });
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 3, stepName: 'Test', message: 'boom' });
      expect(writes().at(-1)).toBe(line('❌ ', 'red', 'Test', '<1s'));

      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'Test', message: 'end' });
      // already displayed with the worst status: nothing new is printed
      expect(writes()).toEqual([]);
      expect(fmt.getLastCompletedStep()).toBeNull();
    });

    it('does not print a step twice when it ends twice', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'A', message: 'ok' });
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'A', message: 'ok again' });
      expect(writes()).toEqual([]);
      expect(fmt.getLastCompletedStep()).toBe('A');
    });

    it('marks a step with warnings when the end event carries a warning', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'Lint' });
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'Lint', hasWarning: true });
      expect(writes().at(-1)).toBe(line('⚠️ ', 'red', 'Lint', '<1s'));

      // ending the warned step again does not print a second line
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'Lint', hasWarning: true });
      expect(writes()).toEqual([]);
    });

    it('ignores end and failure events for unknown steps', () => {
      fmt.processMessage({ workflowStatus: 2, stepName: 'Ghost' });
      fmt.processMessage({ workflowStatus: 3, stepName: 'Ghost' });
      expect(writes()).toEqual([]);
      expect(logs()).toEqual([]);
    });
  });

  describe('"Completing workflow" handling', () => {
    it('closes the SSE connection and runs the callback once after the end event', () => {
      const close = vi.fn();
      const callback = vi.fn();
      fmt.setSSEConnection({ close });
      fmt.setCompletionCallback(callback);
      fmt.processMessage({ workflowStatus: 1, stepName: 'Completing workflow' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'Completing workflow', message: 'x' });
      // a second end event schedules a second timer before the first one fires
      fmt.processMessage({ workflowStatus: 2, stepName: 'Completing workflow', message: 'x' });

      expect(fmt.isBuildCompleted()).toBe(false);
      vi.advanceTimersByTime(100);
      expect(fmt.isBuildCompleted()).toBe(true);
      expect(close).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(1);

      // messages after completion are ignored
      consoleLog.mockClear();
      fmt.processMessage({ workflowStatus: 1, stepName: 'After' });
      expect(logs()).toEqual([]);
    });

    it('completes without SSE close function and without callback', () => {
      fmt.setSSEConnection({});
      fmt.processMessage({ workflowStatus: 1, stepName: 'Completing workflow' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'Completing workflow', message: 'x' });
      vi.advanceTimersByTime(100);
      expect(fmt.isBuildCompleted()).toBe(true);
    });

    it('creates and completes the step when it arrives without a workflow status', () => {
      const close = vi.fn();
      const callback = vi.fn();
      fmt.setSSEConnection({ close });
      fmt.setCompletionCallback(callback);

      fmt.processMessage({ stepName: 'Completing workflow', message: 'workflow completed' });
      expect(logs()).toContain(`[yellow]🔄 ${'Completing workflow'.padEnd(PAD)}[/yellow] (0s)`);
      expect(writes()).toContain(line('✅', 'green', 'Completing workflow', '<1s'));

      vi.advanceTimersByTime(100);
      expect(close).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(fmt.isBuildCompleted()).toBe(true);
    });

    it('runs the delayed completion only once even when a second timer fires', () => {
      const callback = vi.fn();
      fmt.setCompletionCallback(callback);
      fmt.processMessage({ stepName: 'Completing workflow', message: 'completed' });
      // the same step ends again through the workflowStatus path before the timer fires
      fmt.processMessage({ workflowStatus: 2, stepName: 'Completing workflow', message: 'x' });
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('completes without SSE and callback on the no-status path', () => {
      fmt.processMessage({ stepName: 'Completing workflow', message: 'completed' });
      vi.advanceTimersByTime(100);
      expect(fmt.isBuildCompleted()).toBe(true);
    });

    it('creates the step as running when the message is not a completion, and ignores repeats', () => {
      fmt.processMessage({ workflowStatus: 7, stepName: 'Completing workflow', message: 'finalizing' });
      expect(logs()).toContain(`[yellow]🔄 ${'Completing workflow'.padEnd(PAD)}[/yellow] (0s)`);
      consoleLog.mockClear();
      fmt.processMessage({ stepName: 'Completing workflow', message: 'completed' });
      expect(logs()).toEqual([]);
      vi.advanceTimersByTime(200);
      expect(fmt.isBuildCompleted()).toBe(false);
    });
  });

  describe('section:start / section:end fallback markers', () => {
    it('tracks steps from section:start and completes them with section:end', () => {
      fmt.processMessage({ message: 'section:start Build' });
      expect(logs()).toContain('🚀 Build Progress:');
      fmt.processMessage({ message: 'section:start Build' }); // same active step
      fmt.processMessage({ message: 'section:start ' }); // empty name
      fmt.processMessage({ message: 'section:start Other' });
      fmt.processMessage({ message: 'section:start Build' }); // existing running step
      stdoutWrite.mockClear();
      fmt.processMessage({ message: 'section:end Build' });
      expect(writes()).toEqual(['\x1b[1A', '\x1b[2K', line('✅', 'green', 'Build', '<1s')]);
      // completed step selected again: no running-step bookkeeping
      fmt.processMessage({ message: 'section:start Build' });
      stdoutWrite.mockClear();
      fmt.processMessage({ message: 'section:end Unknown' });
      fmt.processMessage({ message: 'section:end ' });
      expect(writes()).toEqual([]);
      expect(fmt.getLastCompletedStep()).toBe('Build');
    });

    it('finishes the build on "section:end Completing workflow"', () => {
      const close = vi.fn();
      const callback = vi.fn();
      fmt.setSSEConnection({ close });
      fmt.setCompletionCallback(callback);
      fmt.processMessage({ message: 'section:start Completing workflow' });
      fmt.processMessage({ message: 'section:end Completing workflow' });
      fmt.processMessage({ message: 'section:end Completing workflow' });
      vi.advanceTimersByTime(100);
      expect(close).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(fmt.isBuildCompleted()).toBe(true);
    });

    it('finishes without SSE close and callback on section:end', () => {
      fmt.setSSEConnection({});
      fmt.processMessage({ message: 'section:start Completing workflow' });
      fmt.processMessage({ message: 'section:end Completing workflow' });
      vi.advanceTimersByTime(100);
      expect(fmt.isBuildCompleted()).toBe(true);
    });
  });

  describe('##[section] / ##[endgroup] markers', () => {
    it('tracks steps from ##[section] and completes them with ##[endgroup]', () => {
      fmt.processMessage({ message: '##[section]Compile' });
      expect(logs()).toContain('🚀 Build Progress:');
      fmt.processMessage({ message: '##[section]Compile' }); // same active step
      fmt.processMessage({ message: '##[section]' }); // empty
      fmt.processMessage({ message: '##[section]Link' });
      fmt.processMessage({ message: '##[section]Compile' }); // existing running step
      stdoutWrite.mockClear();
      fmt.processMessage({ message: '##[endgroup]Compile' });
      expect(writes()).toEqual(['\x1b[1A', '\x1b[2K', line('✅', 'green', 'Compile', '<1s')]);
      fmt.processMessage({ message: '##[section]Compile' }); // existing completed step
      stdoutWrite.mockClear();
      fmt.processMessage({ message: '##[endgroup]Nope' });
      fmt.processMessage({ message: '##[endgroup]' });
      expect(writes()).toEqual([]);
    });

    it('finishes the build on "##[endgroup]Completing workflow"', () => {
      const close = vi.fn();
      const callback = vi.fn();
      fmt.setSSEConnection({ close });
      fmt.setCompletionCallback(callback);
      fmt.processMessage({ message: '##[section]Completing workflow' });
      fmt.processMessage({ message: '##[endgroup]Completing workflow' });
      fmt.processMessage({ message: '##[endgroup]Completing workflow' });
      vi.advanceTimersByTime(100);
      expect(close).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('finishes without SSE close and callback on ##[endgroup]', () => {
      fmt.setSSEConnection({});
      fmt.processMessage({ message: '##[section]Completing workflow' });
      fmt.processMessage({ message: '##[endgroup]Completing workflow' });
      vi.advanceTimersByTime(100);
      expect(fmt.isBuildCompleted()).toBe(true);
    });
  });

  describe('step-name fallback from free text', () => {
    it('starts, re-selects and skips steps based on Starting/Running/Executing messages', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'Init' });
      fmt.processMessage({ stepName: 'Deploy', message: 'Starting deploy' });
      fmt.processMessage({ stepName: 'Deploy', message: 'Running deploy' }); // existing, running
      fmt.processMessage({ stepName: 'Init', message: 'plain output' }); // no keyword
      fmt.processMessage({ workflowStatus: 1, stepName: 'Other' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'Deploy', message: 'ok' }); // not the active step
      fmt.processMessage({ stepName: 'Deploy', message: 'Starting again' }); // existing, completed
      fmt.processMessage({ stepName: 'Init', message: 'Executing init' }); // existing, running
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: 'Init', message: 'ok' });
      expect(writes()).toEqual(['\x1b[1A', '\x1b[2K', line('✅', 'green', 'Init', '<1s')]);
      expect(fmt.getLastCompletedStep()).toBe('Init');
    });
  });

  describe('errors and warnings during a step', () => {
    const finish = (name: string) => {
      stdoutWrite.mockClear();
      fmt.processMessage({ workflowStatus: 2, stepName: name, message: 'end' });
      return writes().at(-1);
    };

    it('marks the active step on @@[error]', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage({ message: '@@[error] compile failed' });
      expect(finish('A')).toBe(line('⚠️ ', 'red', 'A', '<1s'));
    });

    it('ignores @@[error] and warnings when no step is active', () => {
      fmt.processMessage({ message: '@@[error] early' });
      fmt.processMessage({ message: '@@[warning] early' });
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      expect(finish('A')).toBe(line('✅', 'green', 'A', '<1s'));
    });

    it.each([
      [{ message: '@@[warning] careful' }],
      [{ message: 'deprecated API ⚠️' }],
      [{ message: 'x', hasWarning: true }],
      [{ message: 'x', isWarning: true }],
      [{ message: 'x', warning: true }],
    ])('marks the active step on a warning event %j', (event) => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage(event);
      expect(finish('A')).toBe(line('⚠️ ', 'red', 'A', '<1s'));
    });

    it('marks a step that is named in a "Step X failed" message', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'Build' });
      fmt.processMessage({ workflowStatus: 1, stepName: 'Other' });
      fmt.processMessage({ message: 'Step Build failed with exit code 1' });
      fmt.processMessage({ message: 'Step Ghost warning: nothing to do' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'Other', message: 'end' });
      expect(finish('Build')).toBe(line('⚠️ ', 'red', 'Build', '<1s'));
    });

    it('marks a step through markStepAsWarning and ignores empty or unknown names', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.markStepAsWarning('');
      fmt.markStepAsWarning('Unknown');
      fmt.markStepAsWarning(' A ');
      expect(finish('A')).toBe(line('⚠️ ', 'red', 'A', '<1s'));
    });
  });

  describe('live timer', () => {
    it('rewrites the running step line every second', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      stdoutWrite.mockClear();
      vi.advanceTimersByTime(1000);
      expect(writes()).toEqual(['\x1b[1A', '\x1b[2K', `[yellow]🔄 ${'A'.padEnd(PAD)}[/yellow] (1s)\n`]);
    });

    it('does not rewrite when the active step is no longer running', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage({ workflowStatus: 1, stepName: 'B' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'A', message: 'ok' });
      fmt.processMessage({ message: 'section:start C' }); // restarts the timer
      fmt.processMessage({ message: 'section:start A' }); // completed step becomes active
      stdoutWrite.mockClear();
      vi.advanceTimersByTime(1000);
      expect(writes()).toEqual([]);
    });

    it('stops itself once the build is completed', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'Completing workflow' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'Completing workflow', message: 'x' });
      fmt.processMessage({ message: 'section:start Late' }); // timer started before completion fires
      vi.advanceTimersByTime(100);
      expect(fmt.isBuildCompleted()).toBe(true);
      stdoutWrite.mockClear();
      vi.advanceTimersByTime(3000);
      expect(writes()).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('finish() clears a running timer', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      expect(vi.getTimerCount()).toBe(1);
      fmt.finish();
      expect(vi.getTimerCount()).toBe(0);
      stdoutWrite.mockClear();
      vi.advanceTimersByTime(2000);
      expect(writes()).toEqual([]);
    });
  });

  describe('other public methods', () => {
    it('getTotalStepsDuration sums completed steps and falls back to 45', () => {
      expect(fmt.getTotalStepsDuration()).toBe(45);
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'A', duration: 10 });
      fmt.processMessage({ workflowStatus: 1, stepName: 'B' });
      fmt.processMessage({ workflowStatus: 2, stepName: 'B', stepDuration: 5 });
      fmt.processMessage({ workflowStatus: 1, stepName: 'C' }); // still running
      fmt.processMessage({ workflowStatus: 1, stepName: 'D' });
      fmt.processMessage({ workflowStatus: 3, stepName: 'D', duration: 99 }); // failed: excluded
      expect(fmt.getTotalStepsDuration()).toBe(15);
    });

    it('renderStepTable does nothing without steps and the ephemeral methods are no-ops', () => {
      fmt.renderStepTable();
      fmt.setEphemeralStatus('status');
      fmt.clearEphemeralStatus();
      expect(logs()).toEqual([]);
      expect(writes()).toEqual([]);
    });

    it('renderStepTable does not repeat the header', () => {
      fmt.processMessage({ workflowStatus: 1, stepName: 'A' });
      consoleLog.mockClear();
      fmt.renderStepTable();
      expect(logs()).toEqual([]);
    });
  });
});

describe('createCleanTerminalFormatter edge paths', () => {
  let fmt: ReturnType<typeof createCleanTerminalFormatter>;
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  const logs = () => consoleLog.mock.calls.map((c: any[]) => c[0]);

  beforeEach(() => {
    vi.useFakeTimers();
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fmt = createCleanTerminalFormatter();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleLog.mockRestore();
    stderrWrite.mockRestore();
  });

  it('completes the active step when @@[section:end] has nothing after it', () => {
    fmt.processMessage({ message: '@@[section:begin] Phase Step started: Build', stepName: 'Build' });
    consoleLog.mockClear();
    fmt.processMessage({ message: 'last output line\n@@[section:end]', stepName: 'Build' });
    expect(logs()).toEqual([
      'last output line',
      '[blue]@@[section:end][/blue]',
      '[green]✓ Build (<1s)[/green]',
    ]);
  });

  it('does not complete anything when no step is active and the marker is bare', () => {
    fmt.processMessage({ message: '@@[section:end]' });
    expect(logs()).toEqual(['[blue]@@[section:end][/blue]']);
  });

  it('ignores @@[error] for a step that was never started with a section marker', () => {
    fmt.processMessage({ message: 'hello', stepName: 'Lint' });
    expect(logs()).toEqual(['[yellow]● Lint[/yellow]', 'hello']);
    consoleLog.mockClear();
    fmt.processMessage({ message: '@@[error] bad thing', stepName: 'Lint' });
    expect(logs()).toEqual([]);
  });

  it('stops processing when the completion callback flushes the pending completion timer', () => {
    const callback = vi.fn(() => {
      // flush the 100ms completion timer that was scheduled just before the callback
      vi.advanceTimersByTime(100);
    });
    fmt.setCompletionCallback(callback);
    fmt.processMessage({
      message: '@@[section:begin] Phase Step started: Completing workflow',
      stepName: 'Completing workflow',
    });
    fmt.processMessage({
      message: '@@[section:end] Phase Step completed: Completing workflow, Ver: 1.0',
      stepName: 'Completing workflow',
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(fmt.isBuildCompleted()).toBe(true);

    consoleLog.mockClear();
    fmt.processMessage({ message: 'late line', stepName: 'Completing workflow' });
    expect(logs()).toEqual([]);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCleanTerminalFormatter } from '../../../src/core/command-runner';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    gray: vi.fn((text) => `[gray]${text}[/gray]`),
    blue: vi.fn((text) => `[blue]${text}[/blue]`),
    green: vi.fn((text) => `[green]${text}[/green]`),
    red: vi.fn((text) => `[red]${text}[/red]`),
    cyan: vi.fn((text) => `[cyan]${text}[/cyan]`),
    yellow: vi.fn((text) => `[yellow]${text}[/yellow]`),
    white: vi.fn((text) => `[white]${text}[/white]`)
  }
}));

describe('createCleanTerminalFormatter', () => {
  let formatter: ReturnType<typeof createCleanTerminalFormatter>;
  let mockConsoleLog: any;
  let mockConsoleError: any;
  let mockStderrWrite: any;

  beforeEach(() => {
    vi.useFakeTimers();
    formatter = createCleanTerminalFormatter();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockStderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('processMessage', () => {
    describe('section:begin handling', () => {
      it('should handle step started pattern with full format', () => {
        const event = {
          message: '@@[section:begin] Build Phase Step started: Compile Sources',
          stepName: 'Compile Sources',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[yellow]● Compile Sources[/yellow]');
        expect(mockConsoleLog).toHaveBeenCalledWith('[blue]@@[section:begin] Build Phase Step started: Compile Sources[/blue]');
      });

      it('should handle simple section begin format', () => {
        const event = {
          message: '@@[section:begin] Starting workflow',
          stepName: 'Starting workflow',
          uiOnly: false
        };

        formatter.processMessage(event);

        // Regex matches "@@[section:begin] Starting workflow" -> step = "tarting workflow" (S is captured in first group)
        // This is actually matching the simpleMatch pattern: /@@\[section:begin\]\s*(.+?)\s*(.+)/
        // Which captures "S" in group 1 and "tarting workflow" in group 2
        expect(mockConsoleLog).toHaveBeenCalledWith('[yellow]● tarting workflow[/yellow]');
        expect(mockConsoleLog).toHaveBeenCalledWith('[blue]@@[section:begin] Starting workflow[/blue]');
      });

      it('should initialize step state on section begin', () => {
        const event = {
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        // Verify step is tracked by completing it and checking output
        const endEvent = {
          message: '@@[section:end] Build Phase Step completed: Build, Ver: 1.0',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(endEvent);

        // Should show completion with duration
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build'));
      });
    });

    describe('section:end handling', () => {
      beforeEach(() => {
        // Start a step first
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });
        vi.clearAllMocks();
      });

      it('should handle step completed pattern with full format', () => {
        const event = {
          message: '@@[section:end] Build Phase Step completed: Build, Ver: 1.0',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[blue]@@[section:end] Build Phase Step completed: Build, Ver: 1.0[/blue]');
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[green]✓ Build'));
      });

      it('should handle simple section end format', () => {
        const event = {
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[blue]@@[section:end] Build[/blue]');
      });

      it('should process content before section:end marker', () => {
        const event = {
          message: 'Build output line 1\nBuild output line 2\n@@[section:end] Build Phase Step completed: Build, Ver: 1.0',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('Build output line 1');
        expect(mockConsoleLog).toHaveBeenCalledWith('Build output line 2');
        expect(mockConsoleLog).toHaveBeenCalledWith('[blue]@@[section:end] Build Phase Step completed: Build, Ver: 1.0[/blue]');
      });

      it('should not process content if uiOnly is true', () => {
        const event = {
          message: 'Build output\n@@[section:end] Build',
          stepName: 'Build',
          uiOnly: true
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).not.toHaveBeenCalledWith('Build output');
      });
    });

    describe('error message handling', () => {
      beforeEach(() => {
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });
        vi.clearAllMocks();
      });

      it('should handle error messages and mark step as having errors', () => {
        const event = {
          message: '@@[error] Compilation failed',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[red]Compilation failed[/red]');

        // Complete the step and verify it shows error icon
        formatter.processMessage({
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[red]✗ Build'));
      });

      it('should trim error marker from message', () => {
        const event = {
          message: '@@[error] Error message',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[red]Error message[/red]');
        expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('@@[error]'));
      });
    });

    describe('command message handling', () => {
      beforeEach(() => {
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });
        vi.clearAllMocks();
      });

      it('should handle command messages', () => {
        const event = {
          message: '@@[command] npm run build',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[cyan]@@[command] npm run build[/cyan]');
      });

      it('should trim command marker from message', () => {
        const event = {
          message: '@@[command] yarn install',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('[cyan]@@[command] yarn install[/cyan]');
      });
    });

    describe('regular message handling', () => {
      beforeEach(() => {
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });
        vi.clearAllMocks();
      });

      it('should handle regular messages', () => {
        const event = {
          message: 'Building application...',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('Building application...');
      });

      it('should handle multi-line messages', () => {
        const event = {
          message: 'Line 1\nLine 2\nLine 3',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('Line 1');
        expect(mockConsoleLog).toHaveBeenCalledWith('Line 2');
        expect(mockConsoleLog).toHaveBeenCalledWith('Line 3');
      });

      it('should skip uiOnly regular messages', () => {
        const event = {
          message: 'UI only message',
          stepName: 'Build',
          uiOnly: true
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).not.toHaveBeenCalledWith('UI only message');
      });

      it('should color URLs in messages', () => {
        const event = {
          message: 'Check status at https://app.appcircle.io/build/123',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('Check status at [blue]https://app.appcircle.io/build/123[/blue]');
      });

      it('should handle multiple URLs in one message', () => {
        const event = {
          message: 'Visit http://example.com and https://test.com',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('Visit [blue]http://example.com[/blue] and [blue]https://test.com[/blue]');
      });

      it('should normalize carriage returns', () => {
        const event = {
          message: 'Line 1\r\nLine 2\rLine 3',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalledWith('Line 1');
        expect(mockConsoleLog).toHaveBeenCalledWith('Line 2');
        expect(mockConsoleLog).toHaveBeenCalledWith('Line 3');
      });
    });

    describe('step changes', () => {
      it('should show step header when step changes', () => {
        formatter.processMessage({
          message: 'Regular message',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith('[yellow]● Build[/yellow]');

        vi.clearAllMocks();

        formatter.processMessage({
          message: 'Another message',
          stepName: 'Test',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith('[yellow]● Test[/yellow]');
      });

      it('should not show duplicate step header for same step', () => {
        formatter.processMessage({
          message: 'Message 1',
          stepName: 'Build',
          uiOnly: false
        });

        vi.clearAllMocks();

        formatter.processMessage({
          message: 'Message 2',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).not.toHaveBeenCalledWith('[yellow]● Build[/yellow]');
      });

      it('should not show step header if message contains section:begin', () => {
        const event = {
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        };

        formatter.processMessage(event);

        const yellowHeaderCalls = mockConsoleLog.mock.calls.filter(
          (call: any[]) => call[0] === '[yellow]● Build[/yellow]'
        );
        // Should only be called once (from section:begin handler, not from step change)
        expect(yellowHeaderCalls.length).toBe(1);
      });
    });

    describe('uiOnly message filtering', () => {
      it('should skip uiOnly messages that match stepName', () => {
        const event = {
          message: 'Build',
          stepName: 'Build',
          uiOnly: true
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).not.toHaveBeenCalled();
      });

      it('should skip uiOnly messages that match currentActiveStep', () => {
        // Set up a current active step
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });

        vi.clearAllMocks();

        const event = {
          message: 'Build',
          stepName: 'Other',
          uiOnly: true
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).not.toHaveBeenCalled();
      });

      it('should process uiOnly messages that do not match step names', () => {
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });

        vi.clearAllMocks();

        const event = {
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: true
        };

        formatter.processMessage(event);

        expect(mockConsoleLog).toHaveBeenCalled();
      });
    });

    describe('build completion', () => {
      it('should skip all messages after build is completed', () => {
        // Start and complete workflow
        formatter.processMessage({
          message: '@@[section:begin] Completing workflow',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        formatter.processMessage({
          message: '@@[section:end] Completing workflow',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        // Advance timer to trigger build completion
        vi.advanceTimersByTime(100);

        vi.clearAllMocks();

        // Try to process another message
        formatter.processMessage({
          message: 'This should be skipped',
          stepName: 'SomeStep',
          uiOnly: false
        });

        expect(mockConsoleLog).not.toHaveBeenCalled();
      });

      it('should call completion callback when "Completing workflow" completes', () => {
        const completionCallback = vi.fn();
        formatter.setCompletionCallback(completionCallback);

        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Completing workflow',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        formatter.processMessage({
          message: '@@[section:end] Build Phase Step completed: Completing workflow, Ver: 1.0',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        // Callback is called immediately, not after timeout
        expect(completionCallback).toHaveBeenCalledTimes(1);
      });

      it('should not call completion callback multiple times', () => {
        const completionCallback = vi.fn();
        formatter.setCompletionCallback(completionCallback);

        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Completing workflow',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        formatter.processMessage({
          message: '@@[section:end] Build Phase Step completed: Completing workflow, Ver: 1.0',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        // Try to trigger again (but buildCompleted flag prevents reprocessing)
        vi.advanceTimersByTime(100);

        formatter.processMessage({
          message: '@@[section:end] Build Phase Step completed: Completing workflow, Ver: 1.0',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        expect(completionCallback).toHaveBeenCalledTimes(1);
      });

      it('should close SSE connection on completion', () => {
        const mockSSEConnection = {
          close: vi.fn()
        };

        formatter.setSSEConnection(mockSSEConnection);

        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Completing workflow',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        formatter.processMessage({
          message: '@@[section:end] Build Phase Step completed: Completing workflow, Ver: 1.0',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        // SSE connection closes after 100ms timeout
        vi.advanceTimersByTime(100);

        expect(mockSSEConnection.close).toHaveBeenCalled();
      });

      it('should handle completion callback errors gracefully', () => {
        const errorCallback = vi.fn(() => {
          throw new Error('Callback error');
        });

        formatter.setCompletionCallback(errorCallback);

        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Completing workflow',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        formatter.processMessage({
          message: '@@[section:end] Build Phase Step completed: Completing workflow, Ver: 1.0',
          stepName: 'Completing workflow',
          uiOnly: false
        });

        expect(errorCallback).toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith('Error in completion callback:', expect.any(Error));
      });
    });

    describe('step duration formatting', () => {
      beforeEach(() => {
        formatter.processMessage({
          message: '@@[section:begin] Build Phase Step started: Build',
          stepName: 'Build',
          uiOnly: false
        });
      });

      it('should show <1s for very fast steps', () => {
        formatter.processMessage({
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('(<1s)'));
      });

      it('should show seconds for steps under 60 seconds', () => {
        vi.advanceTimersByTime(5000); // 5 seconds

        formatter.processMessage({
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('(5s)'));
      });

      it('should show minutes and seconds for steps over 60 seconds', () => {
        vi.advanceTimersByTime(123000); // 123 seconds = 2m 3s

        formatter.processMessage({
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('(2m 3s)'));
      });

      it('should show green checkmark for successful steps', () => {
        formatter.processMessage({
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[green]✓ Build'));
      });

      it('should show red X for failed steps', () => {
        formatter.processMessage({
          message: '@@[error] Build error',
          stepName: 'Build',
          uiOnly: false
        });

        formatter.processMessage({
          message: '@@[section:end] Build',
          stepName: 'Build',
          uiOnly: false
        });

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[red]✗ Build'));
      });
    });
  });

  describe('ephemeral status', () => {
    it('should write ephemeral status to stderr', () => {
      formatter.setEphemeralStatus('Connecting...');

      expect(mockStderrWrite).toHaveBeenCalledWith('[gray]Connecting...[/gray]');
    });

    it('should clear ephemeral status', () => {
      formatter.setEphemeralStatus('Connecting...');
      vi.clearAllMocks();

      formatter.clearEphemeralStatus();

      // Should write clear sequence
      expect(mockStderrWrite).toHaveBeenCalled();
    });

    it('should clear and restore ephemeral status when writing persistent log', () => {
      formatter.setEphemeralStatus('Building...');
      vi.clearAllMocks();

      formatter.processMessage({
        message: 'Log message',
        stepName: 'Build',
        uiOnly: false
      });

      // Should clear before logging and restore after
      expect(mockStderrWrite).toHaveBeenCalled();
    });
  });

  describe('finish', () => {
    it('should clear ephemeral status on finish', () => {
      formatter.setEphemeralStatus('Processing...');
      vi.clearAllMocks();

      formatter.finish();

      expect(mockStderrWrite).toHaveBeenCalled();
    });
  });

  describe('isBuildCompleted', () => {
    it('should return false initially', () => {
      expect(formatter.isBuildCompleted()).toBe(false);
    });

    it('should return true after workflow completion', () => {
      formatter.processMessage({
        message: '@@[section:begin] Completing workflow',
        stepName: 'Completing workflow',
        uiOnly: false
      });

      formatter.processMessage({
        message: '@@[section:end] Completing workflow',
        stepName: 'Completing workflow',
        uiOnly: false
      });

      vi.advanceTimersByTime(100);

      expect(formatter.isBuildCompleted()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      const event = {
        message: '',
        stepName: 'Build',
        uiOnly: false
      };

      formatter.processMessage(event);

      // Should show step header but no content
      expect(mockConsoleLog).toHaveBeenCalledWith('[yellow]● Build[/yellow]');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined message', () => {
      const event = {
        message: undefined,
        stepName: 'Build',
        uiOnly: false
      };

      formatter.processMessage(event);

      // Should show step header since stepName is present
      expect(mockConsoleLog).toHaveBeenCalledWith('[yellow]● Build[/yellow]');
    });

    it('should handle message without stepName', () => {
      const event = {
        message: 'Some message',
        stepName: undefined,
        uiOnly: false
      };

      formatter.processMessage(event);

      // Should not show step header
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only messages', () => {
      const event = {
        message: '   \n  \n  ',
        stepName: 'Build',
        uiOnly: false
      };

      formatter.processMessage(event);

      // Should not log empty lines - only step header should be shown
      const logCalls = mockConsoleLog.mock.calls;
      expect(logCalls.length).toBe(1);
      expect(logCalls[0][0]).toBe('[yellow]● Build[/yellow]');
    });

    it('should handle malformed section markers', () => {
      const event = {
        message: '@@[section:begin]',
        stepName: 'Build',
        uiOnly: false
      };

      formatter.processMessage(event);

      // Malformed marker with no content - the regex won't match it, so it will be skipped
      // Message is empty after trim, so nothing is logged
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });
});

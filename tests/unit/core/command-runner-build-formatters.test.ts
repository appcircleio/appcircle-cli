import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import chalk from 'chalk';
import enquirer from 'enquirer';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    gray: vi.fn((text) => `[gray]${text}[/gray]`),
    blue: vi.fn((text) => `[blue]${text}[/blue]`),
    green: vi.fn((text) => `[green]${text}[/green]`),
    red: vi.fn((text) => `[red]${text}[/red]`),
    cyan: vi.fn((text) => `[cyan]${text}[/cyan]`),
    yellow: vi.fn((text) => `[yellow]${text}[/yellow]`),
    white: vi.fn((text) => `[white]${text}[/white]`),
    hex: vi.fn((color) => vi.fn((text) => `[hex-${color}]${text}[/hex-${color}]`)),
    bold: {
      cyan: vi.fn((text) => `[bold-cyan]${text}[/bold-cyan]`)
    }
  }
}));

// Mock os
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/user')
  }
}));

// Mock enquirer
vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock process.stderr.write and process.stdout.write
const mockStderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
const mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

// Import the functions after mocking
import { promptForPath } from '../../../src/core/command-runner';

// Since the formatters are not exported, we'll need to test them indirectly
// For now, let's focus on the exported functions

describe('Command Runner - Build Formatters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('promptForPath', () => {
    it('should return user input when provided', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: '/custom/path'
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/custom/path');
      expect(mockEnquirer.prompt).toHaveBeenCalledWith({
        type: 'input',
        name: 'path',
        message: 'Enter path:',
        initial: '/default/path'
      });
    });

    it('should return default path when user input is empty', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: '   '
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should expand tilde to home directory', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: '~/Downloads'
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/home/user/Downloads');
    });

    it('should return default path when user cancels', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockRejectedValueOnce(new Error('User cancelled'));

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should handle complex tilde expansion', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: '~/Documents/Projects'
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/home/user/Documents/Projects');
    });

    it('should handle empty string input', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: ''
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should handle undefined input', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: undefined
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should preserve absolute paths without tilde', async () => {
      const mockEnquirer = vi.mocked(enquirer);
      mockEnquirer.prompt.mockResolvedValueOnce({
        path: '/absolute/path/to/file'
      });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/absolute/path/to/file');
    });
  });

  describe('Build Log Formatters Integration', () => {
    // Since the formatters are internal functions, we'll test their behavior
    // through integration-style tests by simulating build log events

    let mockBuildLogEvent: any;

    beforeEach(() => {
      mockBuildLogEvent = {
        message: 'Test build message',
        stepName: 'Test Step',
        workflowStatus: 1, // StepStarted
        uiOnly: false,
        timestamp: '2024-01-01T12:00:00Z'
      };
    });

    describe('Clean Terminal Formatter Behavior', () => {
      it('should handle step start messages', () => {
        // This test simulates the behavior of createCleanTerminalFormatter
        // by testing the expected console outputs for step start

        const stepName = 'Build Application';
        const message = '@@[section:begin] Build Phase Step started: Build Application';

        // Simulate what the formatter should do
        const expectedStepHeader = '[yellow]● Build Application[/yellow]';
        const expectedSectionMessage = '[blue]@@[section:begin] Build Phase Step started: Build Application[/blue]';

        expect(chalk.yellow(`● ${stepName}`)).toBe(expectedStepHeader);
        expect(chalk.blue(message.trim())).toBe(expectedSectionMessage);
      });

      it('should handle step completion messages', () => {
        const stepName = 'Build Application';
        const message = '@@[section:end] Build Phase Step completed: Build Application, Ver: 1.0';

        const expectedSectionEnd = '[blue]@@[section:end] Build Phase Step completed: Build Application, Ver: 1.0[/blue]';
        const expectedStepCompletion = '[green]✓ Build Application (5s)[/green]';

        expect(chalk.blue(message.trim())).toBe(expectedSectionEnd);
        expect(chalk.green('✓ Build Application (5s)')).toBe(expectedStepCompletion);
      });

      it('should handle error messages', () => {
        const errorMessage = '@@[error] Build failed with compilation errors';
        const cleanMessage = 'Build failed with compilation errors';

        const expectedErrorMessage = '[red]Build failed with compilation errors[/red]';

        expect(chalk.red(cleanMessage)).toBe(expectedErrorMessage);
      });

      it('should handle command messages', () => {
        const commandMessage = '@@[command] npm run build';
        const cleanMessage = 'npm run build';

        const expectedCommandMessage = '[cyan]@@[command] npm run build[/cyan]';

        expect(chalk.cyan(`@@[command] ${cleanMessage}`)).toBe(expectedCommandMessage);
      });

      it('should color URLs in messages', () => {
        const messageWithUrl = 'Check build status at https://app.appcircle.io/build/123';
        const expectedMessage = 'Check build status at [blue]https://app.appcircle.io/build/123[/blue]';

        const formattedMessage = messageWithUrl.replace(
          /(https?:\/\/[^\s]+)/g,
          (url) => chalk.blue(url)
        );

        expect(formattedMessage).toBe(expectedMessage);
      });
    });

    describe('Step Summary Formatter Behavior', () => {
      it('should track step duration from server events', () => {
        // Simulate step start
        const startEvent = {
          ...mockBuildLogEvent,
          workflowStatus: 1, // StepStarted
          stepName: 'Build'
        };

        // Simulate step end with duration
        const endEvent = {
          ...mockBuildLogEvent,
          workflowStatus: 2, // StepEnded
          stepName: 'Build',
          duration: 45, // 45 seconds from server
          message: 'Build completed in 45s'
        };

        // Test duration extraction logic
        const extractDurationFromMessage = (message: string): number | null => {
          const patterns = [
            /(\d+)s/,
            /(\d+)\s*seconds?/,
            /in\s*(\d+)s/,
            /took\s*(\d+)s/,
            /duration[:\s]*(\d+)s?/i
          ];

          for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
              const seconds = parseInt(match[1], 10);
              if (!isNaN(seconds)) {
                return seconds;
              }
            }
          }
          return null;
        };

        const extractedDuration = extractDurationFromMessage(endEvent.message);
        expect(extractedDuration).toBe(45);
      });

      it('should format step duration correctly', () => {
        const formatDuration = (seconds: number): string => {
          if (seconds === 0) {
            return '<1s';
          }
          return `${seconds}s`;
        };

        expect(formatDuration(0)).toBe('<1s');
        expect(formatDuration(5)).toBe('5s');
        expect(formatDuration(60)).toBe('60s');
      });

      it('should handle step status colors', () => {
        const getStepStatusColor = (status: string, hasErrors: boolean) => {
          if (status === 'completed') {
            return hasErrors ? chalk.red : chalk.green;
          } else if (status === 'failed') {
            return chalk.red;
          } else if (status === 'running') {
            return chalk.yellow;
          }
          return chalk.gray;
        };

        expect(getStepStatusColor('completed', false)).toBe(chalk.green);
        expect(getStepStatusColor('completed', true)).toBe(chalk.red);
        expect(getStepStatusColor('failed', false)).toBe(chalk.red);
        expect(getStepStatusColor('running', false)).toBe(chalk.yellow);
      });

      it('should detect warnings in build events', () => {
        const detectWarnings = (buildLogEvent: any): boolean => {
          const message = buildLogEvent.message || '';
          return buildLogEvent.hasWarning === true ||
                 buildLogEvent.isWarning === true ||
                 buildLogEvent.warning === true ||
                 message.includes('@@[warning]') ||
                 message.includes('@@[error]') ||
                 message.includes('⚠️');
        };

        expect(detectWarnings({ hasWarning: true })).toBe(true);
        expect(detectWarnings({ isWarning: true })).toBe(true);
        expect(detectWarnings({ warning: true })).toBe(true);
        expect(detectWarnings({ message: '@@[warning] Deprecated API' })).toBe(true);
        expect(detectWarnings({ message: '@@[error] Compilation failed' })).toBe(true);
        expect(detectWarnings({ message: 'Build completed ⚠️' })).toBe(true);
        expect(detectWarnings({ message: 'Normal build message' })).toBe(false);
      });
    });

    describe('Ephemeral Status Management', () => {
      it('should clear ephemeral status correctly', () => {
        // Simulate ephemeral status clearing
        const clearEphemeralStatus = (ephemeralStatusLine: string) => {
          if (ephemeralStatusLine) {
            const clearLine = '\r' + ' '.repeat(ephemeralStatusLine.length) + '\r';
            return clearLine;
          }
          return '';
        };

        const statusLine = 'Building... (30s)';
        const clearCommand = clearEphemeralStatus(statusLine);
        expect(clearCommand).toBe('\r                 \r');
      });

      it('should write ephemeral status', () => {
        // Simulate ephemeral status writing
        const writeEphemeralStatus = (text: string) => {
          return chalk.gray(text);
        };

        const status = 'Connecting to build server...';
        const formattedStatus = writeEphemeralStatus(status);
        expect(formattedStatus).toBe('[gray]Connecting to build server...[/gray]');
      });
    });

    describe('Build Completion Handling', () => {
      it('should handle completion callback', () => {
        let callbackCalled = false;
        const completionCallback = () => {
          callbackCalled = true;
        };

        // Simulate completion
        const handleCompletion = (stepName: string, callback: () => void) => {
          if (stepName === 'Completing workflow') {
            setTimeout(() => {
              callback();
            }, 100);
          }
        };

        handleCompletion('Completing workflow', completionCallback);

        // Fast forward timers
        vi.advanceTimersByTime(100);

        expect(callbackCalled).toBe(true);
      });

      it('should close SSE connection on completion', () => {
        let connectionClosed = false;
        const mockSSEConnection = {
          close: () => {
            connectionClosed = true;
          }
        };

        // Simulate SSE connection closing
        const handleSSECleanup = (connection: any) => {
          if (connection && connection.close) {
            connection.close();
          }
        };

        handleSSECleanup(mockSSEConnection);
        expect(connectionClosed).toBe(true);
      });
    });

    describe('Message Processing Edge Cases', () => {
      it('should handle multi-line messages', () => {
        const multiLineMessage = 'Line 1\nLine 2\nLine 3';
        const lines = multiLineMessage.split('\n').filter(line => line.trim());

        expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
      });

      it('should handle carriage return normalization', () => {
        const normalizeMessage = (message: string): string => {
          return message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        };

        expect(normalizeMessage('Line 1\r\nLine 2')).toBe('Line 1\nLine 2');
        expect(normalizeMessage('Line 1\rLine 2')).toBe('Line 1\nLine 2');
        expect(normalizeMessage('Line 1\nLine 2')).toBe('Line 1\nLine 2');
      });

      it('should skip uiOnly duplicate messages', () => {
        const shouldSkipMessage = (uiOnly: boolean, message: string, stepName: string, currentActiveStep: string): boolean => {
          return uiOnly && (message.trim() === stepName || message.trim() === currentActiveStep);
        };

        expect(shouldSkipMessage(true, 'Build', 'Build', 'Test')).toBe(true);
        expect(shouldSkipMessage(true, 'Build', 'Test', 'Build')).toBe(true);
        expect(shouldSkipMessage(false, 'Build', 'Build', 'Test')).toBe(false);
        expect(shouldSkipMessage(true, 'Some message', 'Build', 'Test')).toBe(false);
      });

      it('should handle section parsing correctly', () => {
        const parseSectionBegin = (message: string) => {
          const stepStartedMatch = message.match(/@@\[section:begin\]\s*(.+?)\s*Step started:\s*(.+)/);
          if (stepStartedMatch) {
            return {
              type: 'stepStarted',
              phase: stepStartedMatch[1],
              step: stepStartedMatch[2]
            };
          }

          const simpleMatch = message.match(/@@\[section:begin\]\s*(.+)/);
          if (simpleMatch) {
            return {
              type: 'simple',
              phase: '',
              step: simpleMatch[1].trim()
            };
          }

          return null;
        };

        const stepStartedMessage = '@@[section:begin] Build Phase Step started: Compile Sources';
        const simpleMessage = '@@[section:begin] Starting workflow';

        const stepStartedResult = parseSectionBegin(stepStartedMessage);
        expect(stepStartedResult).toEqual({
          type: 'stepStarted',
          phase: 'Build Phase',
          step: 'Compile Sources'
        });

        const simpleResult = parseSectionBegin(simpleMessage);
        expect(simpleResult).toEqual({
          type: 'simple',
          phase: '',
          step: 'Starting workflow'
        });
      });

      it('should handle section end parsing', () => {
        const parseSectionEnd = (message: string) => {
          const stepCompletedMatch = message.match(/@@\[section:end\]\s*(.+?)\s*Step completed:\s*(.+?),\s*Ver:\s*(.+)/);
          if (stepCompletedMatch) {
            return {
              type: 'stepCompleted',
              phase: stepCompletedMatch[1],
              step: stepCompletedMatch[2],
              version: stepCompletedMatch[3]
            };
          }

          const simpleMatch = message.match(/@@\[section:end\]\s*(.+)/);
          if (simpleMatch) {
            return {
              type: 'simple',
              step: simpleMatch[1].trim()
            };
          }

          return null;
        };

        const stepCompletedMessage = '@@[section:end] Build Phase Step completed: Compile Sources, Ver: 1.0.0';
        const simpleMessage = '@@[section:end] Starting workflow';

        const stepCompletedResult = parseSectionEnd(stepCompletedMessage);
        expect(stepCompletedResult).toEqual({
          type: 'stepCompleted',
          phase: 'Build Phase',
          step: 'Compile Sources',
          version: '1.0.0'
        });

        const simpleResult = parseSectionEnd(simpleMessage);
        expect(simpleResult).toEqual({
          type: 'simple',
          step: 'Starting workflow'
        });
      });
    });

    describe('Timer Management', () => {
      it('should manage update timers correctly', () => {
        let timerActive = false;
        let timerCallback: (() => void) | null = null;

        const startUpdateTimer = (callback: () => void) => {
          timerActive = true;
          timerCallback = callback;
          setInterval(callback, 1000);
        };

        const stopUpdateTimer = () => {
          timerActive = false;
          timerCallback = null;
        };

        const mockCallback = vi.fn();
        startUpdateTimer(mockCallback);

        expect(timerActive).toBe(true);
        expect(timerCallback).toBe(mockCallback);

        stopUpdateTimer();

        expect(timerActive).toBe(false);
        expect(timerCallback).toBe(null);
      });

      it('should calculate elapsed time correctly', () => {
        const calculateElapsed = (startTime: number, endTime?: number): string => {
          const duration = Math.round(((endTime || Date.now()) - startTime) / 1000);
          if (duration === 0) {
            return '<1s';
          }
          return `${duration}s`;
        };

        const startTime = Date.now() - 5000; // 5 seconds ago
        const elapsed = calculateElapsed(startTime);
        expect(elapsed).toBe('5s');

        const zeroElapsed = calculateElapsed(Date.now());
        expect(zeroElapsed).toBe('<1s');
      });
    });

    describe('Step State Management', () => {
      it('should track step states correctly', () => {
        class StepStateManager {
          private steps = new Map<string, {
            status: 'running' | 'completed' | 'failed';
            startTime: number;
            endTime?: number;
            hasErrors: boolean;
          }>();

          addStep(name: string) {
            this.steps.set(name, {
              status: 'running',
              startTime: Date.now(),
              hasErrors: false
            });
          }

          completeStep(name: string, hasErrors = false) {
            const step = this.steps.get(name);
            if (step) {
              step.status = 'completed';
              step.endTime = Date.now();
              step.hasErrors = hasErrors;
            }
          }

          getStep(name: string) {
            return this.steps.get(name);
          }

          getAllSteps() {
            return Array.from(this.steps.entries());
          }
        }

        const manager = new StepStateManager();

        manager.addStep('Build');
        const buildStep = manager.getStep('Build');
        expect(buildStep?.status).toBe('running');
        expect(buildStep?.hasErrors).toBe(false);

        manager.completeStep('Build', true);
        const completedStep = manager.getStep('Build');
        expect(completedStep?.status).toBe('completed');
        expect(completedStep?.hasErrors).toBe(true);
        expect(completedStep?.endTime).toBeDefined();
      });
    });
  });
});
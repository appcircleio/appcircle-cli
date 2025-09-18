import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalRenderer } from '../../../src/utils/TerminalRenderer';
import { ProcessedLogMessage, WorkflowStatus, BuildLogOptions } from '../../../src/types/build-logs';

// Mock chalk for consistent testing
vi.mock('chalk', () => ({
  default: {
    gray: vi.fn((text) => `[gray]${text}[/gray]`),
    blue: vi.fn((text) => `[blue]${text}[/blue]`),
    green: vi.fn((text) => `[green]${text}[/green]`),
    red: vi.fn((text) => `[red]${text}[/red]`),
    cyan: vi.fn((text) => `[cyan]${text}[/cyan]`),
    yellow: vi.fn((text) => `[yellow]${text}[/yellow]`),
    bold: Object.assign(vi.fn((text) => `[bold]${text}[/bold]`), {
      cyan: vi.fn((text) => `[bold-cyan]${text}[/bold-cyan]`)
    }),
    dim: vi.fn((text) => `[dim]${text}[/dim]`)
  }
}));

// Helper function for creating mock processed log messages
const createMockProcessedMessage = (overrides: Partial<ProcessedLogMessage> = {}): ProcessedLogMessage => ({
  id: 'msg-123',
  taskId: 'task-456',
  message: 'Test message',
  messageIndex: 1,
  stepName: 'Test Step',
  status: 10 as WorkflowStatus, // Log
  timestamp: '2024-01-01T12:00:00.000Z',
  ...overrides
});

describe('TerminalRenderer', () => {
  let renderer: TerminalRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new TerminalRenderer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create TerminalRenderer with default options', () => {
      const defaultRenderer = new TerminalRenderer();
      expect(defaultRenderer).toBeInstanceOf(TerminalRenderer);
    });

    it('should create TerminalRenderer with custom options', () => {
      const options: BuildLogOptions = {
        timestamps: true,
        noColor: true,
        stepFilter: 'Build',
        enableProgress: false
      };
      const customRenderer = new TerminalRenderer(options);
      expect(customRenderer).toBeInstanceOf(TerminalRenderer);
    });
  });

  describe('renderMessage', () => {
    describe('Basic Message Rendering', () => {
      it('should render basic message with status icon', () => {
        const message = createMockProcessedMessage({
          message: 'Build started',
          status: 1 // StepStarted
        });

        const result = renderer.renderMessage(message);

        expect(result).toContain('[blue]●[/blue]'); // Status icon for StepStarted
        expect(result).toContain('[cyan][Test Step][/cyan]'); // Step name
        expect(result).toContain('Build started'); // Message content
      });

      it('should render message with different status icons', () => {
        const statuses: Array<{ status: WorkflowStatus; expectedIcon: string }> = [
          { status: 0, expectedIcon: '[gray]○[/gray]' }, // Information
          { status: 1, expectedIcon: '[blue]●[/blue]' }, // StepStarted
          { status: 2, expectedIcon: '[green]✓[/green]' }, // StepEnded
          { status: 3, expectedIcon: '[red]✗[/red]' }, // StepError
          { status: 9, expectedIcon: '[green]✓[/green]' }, // WorkflowCompleted
          { status: 10, expectedIcon: '[blue]●[/blue]' } // Log
        ];

        statuses.forEach(({ status, expectedIcon }) => {
          const message = createMockProcessedMessage({ status });
          const result = renderer.renderMessage(message);
          expect(result).toContain(expectedIcon);
        });
      });

      it('should skip step echo messages', () => {
        const message = createMockProcessedMessage({
          message: 'Echo message',
          isStepEcho: true
        });

        const result = renderer.renderMessage(message);

        expect(result).toBe('');
      });

      it('should not render step name for "all" step', () => {
        const message = createMockProcessedMessage({
          stepName: 'all',
          message: 'Global message'
        });

        const result = renderer.renderMessage(message);

        expect(result).not.toContain('[cyan][all][/cyan]');
        expect(result).toContain('Global message');
      });
    });

    describe('Options Handling', () => {
      it('should include timestamp when timestamps option is enabled', () => {
        const rendererWithTimestamps = new TerminalRenderer({ timestamps: true });
        const message = createMockProcessedMessage({
          timestamp: '2024-01-01T12:30:45.123Z'
        });

        const result = rendererWithTimestamps.renderMessage(message);

        expect(result).toContain('[gray][12:30:45.123][/gray]');
      });

      it('should not include timestamp when timestamps option is disabled', () => {
        const rendererWithoutTimestamps = new TerminalRenderer({ timestamps: false });
        const message = createMockProcessedMessage({
          timestamp: '2024-01-01T12:30:45.123Z'
        });

        const result = rendererWithoutTimestamps.renderMessage(message);

        expect(result).not.toContain('12:30:45.123');
      });

      it('should filter messages by step when stepFilter is specified', () => {
        const rendererWithFilter = new TerminalRenderer({ stepFilter: 'Build' });

        const buildMessage = createMockProcessedMessage({
          stepName: 'Build',
          message: 'Build message'
        });
        const testMessage = createMockProcessedMessage({
          stepName: 'Test',
          message: 'Test message'
        });

        const buildResult = rendererWithFilter.renderMessage(buildMessage);
        const testResult = rendererWithFilter.renderMessage(testMessage);

        expect(buildResult).toContain('Build message');
        expect(testResult).toBe('');
      });

      it('should handle unknown status gracefully', () => {
        const message = createMockProcessedMessage({
          status: 99 as WorkflowStatus // Invalid status
        });

        const result = renderer.renderMessage(message);

        expect(result).toContain('[gray]○[/gray]'); // Default icon
      });
    });

    describe('Message Formatting', () => {
      it('should format section markers', () => {
        const message = createMockProcessedMessage({
          message: '@@[section: Build Phase'
        });

        const result = renderer.renderMessage(message);

        expect(result).toContain('[yellow]@@[section:[/yellow]');
      });

      it('should format command markers', () => {
        const message = createMockProcessedMessage({
          message: 'Running @@[command]'
        });

        const result = renderer.renderMessage(message);

        expect(result).toContain('[cyan]@@[command][/cyan]');
      });

      it('should format error markers', () => {
        const message = createMockProcessedMessage({
          message: 'Failed @@[error]'
        });

        const result = renderer.renderMessage(message);

        expect(result).toContain('[red]@@[error][/red]');
      });

      it('should format URLs', () => {
        const message = createMockProcessedMessage({
          message: 'Check https://example.com for details'
        });

        const result = renderer.renderMessage(message);

        expect(result).toContain('[blue]https://example.com[/blue]');
      });

      it('should format success patterns', () => {
        const successMessages = [
          'Build ✅ completed',
          'Tests ✓ passed',
          'success: all good',
          'Task completed successfully',
          'All tests passed'
        ];

        successMessages.forEach(messageText => {
          const message = createMockProcessedMessage({ message: messageText });
          const result = renderer.renderMessage(message);
          expect(result).toContain('[green]');
        });
      });

      it('should format error patterns', () => {
        const errorMessages = [
          'Build ❌ failed',
          'Tests ✗ failed',
          'error: something went wrong',
          'Task failed completely',
          'Unexpected exception occurred'
        ];

        errorMessages.forEach(messageText => {
          const message = createMockProcessedMessage({ message: messageText });
          const result = renderer.renderMessage(message);
          expect(result).toContain('[red]');
        });
      });

      it('should format warning patterns', () => {
        const warningMessages = [
          'Build ⚠️ has warnings',
          'warning: deprecated method',
          'warn: potential issue'
        ];

        warningMessages.forEach(messageText => {
          const message = createMockProcessedMessage({ message: messageText });
          const result = renderer.renderMessage(message);
          expect(result).toContain('[yellow]');
        });
      });

      it('should not override existing colors', () => {
        const message = createMockProcessedMessage({
          message: 'Already \u001b[32mcolored\u001b[0m success message'
        });

        const result = renderer.renderMessage(message);

        // Should not wrap in additional green color
        expect(result.split('[green]').length - 1).toBeLessThanOrEqual(1);
      });
    });

    describe('Timestamp Formatting', () => {
      it('should format valid ISO timestamp', () => {
        const rendererWithTimestamps = new TerminalRenderer({ timestamps: true });
        const message = createMockProcessedMessage({
          timestamp: '2024-01-01T12:30:45.123Z'
        });

        const result = rendererWithTimestamps.renderMessage(message);

        expect(result).toContain('12:30:45.123');
      });

      it('should handle invalid timestamp gracefully', () => {
        const rendererWithTimestamps = new TerminalRenderer({ timestamps: true });
        const message = createMockProcessedMessage({
          timestamp: 'invalid-timestamp'
        });

        const result = rendererWithTimestamps.renderMessage(message);

        expect(result).toContain('invalid-timestamp');
      });
    });
  });

  describe('renderStepHeader', () => {
    it('should render colored step header', () => {
      const result = renderer.renderStepHeader('Build Step', 1); // StepStarted

      expect(result).toContain('[blue]●[/blue]'); // Status icon
      expect(result).toContain('[bold-cyan]Build Step[/bold-cyan]'); // Step name
      expect(result).toContain('[gray](loading)[/gray]'); // Status text
      expect(result.startsWith('\n')).toBe(true);
      expect(result.endsWith('\n')).toBe(true);
    });

    it('should render plain step header when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const result = noColorRenderer.renderStepHeader('Build Step', 1);

      expect(result).toBe('\n=== Build Step ===\n');
    });

    it('should handle unknown status in step header', () => {
      const result = renderer.renderStepHeader('Unknown Step', 99 as WorkflowStatus);

      expect(result).toContain('[gray]○[/gray]'); // Default icon
      expect(result).toContain('[gray](unknown)[/gray]'); // Default status text
    });
  });

  describe('renderSummary', () => {
    const mockStats = {
      totalSteps: 5,
      successfulSteps: 4,
      failedSteps: 1,
      duration: '2m 30s'
    };

    it('should render colored success summary', () => {
      const successStats = {
        ...mockStats,
        failedSteps: 0
      };

      const result = renderer.renderSummary(successStats);

      expect(result).toContain('[bold]📊 Build Summary[/bold]');
      expect(result).toContain('[cyan]2m 30s[/cyan]');
      expect(result).toContain('[cyan]5[/cyan]');
      expect(result).toContain('[green]4[/green]');
      expect(result).toContain('[red]0[/red]');
      expect(result).toContain('[green]✅ Build completed successfully[/green]');
    });

    it('should render colored failure summary', () => {
      const result = renderer.renderSummary(mockStats);

      expect(result).toContain('[red]❌ Build failed[/red]');
    });

    it('should render colored warning summary', () => {
      const warningStats = {
        ...mockStats,
        failedSteps: 0,
        hasWarnings: true
      };

      const result = renderer.renderSummary(warningStats);

      expect(result).toContain('[yellow]⚠️ Build completed with warnings[/yellow]');
    });

    it('should render plain summary when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const result = noColorRenderer.renderSummary(mockStats);

      expect(result).toContain('=== Build Summary ===');
      expect(result).toContain('Duration: 2m 30s');
      expect(result).toContain('Total Steps: 5');
      expect(result).toContain('Successful: 4');
      expect(result).toContain('Failed: 1');
      expect(result).toContain('Build failed');
    });

    it('should render plain success summary when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const successStats = {
        ...mockStats,
        failedSteps: 0
      };

      const result = noColorRenderer.renderSummary(successStats);

      expect(result).toContain('Build completed successfully');
    });

    it('should render plain warning summary when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const warningStats = {
        ...mockStats,
        failedSteps: 0,
        hasWarnings: true
      };

      const result = noColorRenderer.renderSummary(warningStats);

      expect(result).toContain('Build completed with warnings');
    });
  });

  describe('renderStepProgress', () => {
    it('should render colored step progress', () => {
      const result = renderer.renderStepProgress('Build Step', 1, 25); // StepStarted, 25 messages

      expect(result).toContain('[blue]●[/blue]'); // Status icon
      expect(result).toContain('[cyan]Build Step[/cyan]'); // Step name
      expect(result).toContain('[gray]loading[/gray]'); // Status text
      expect(result).toContain('[dim](25 messages)[/dim]'); // Message count
    });

    it('should render plain step progress when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const result = noColorRenderer.renderStepProgress('Build Step', 2, 10); // StepEnded, 10 messages

      expect(result).toBe('Build Step: success (10 messages)');
    });

    it('should handle unknown status in step progress', () => {
      const result = renderer.renderStepProgress('Unknown Step', 99 as WorkflowStatus, 5);

      expect(result).toContain('[gray]○[/gray]'); // Default icon
      expect(result).toContain('[gray]unknown[/gray]'); // Default status text
    });
  });

  describe('renderError', () => {
    it('should render colored error message', () => {
      const result = renderer.renderError('Something went wrong');

      expect(result).toBe('[red]❌ Something went wrong[/red]');
    });

    it('should render plain error message when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const result = noColorRenderer.renderError('Something went wrong');

      expect(result).toBe('ERROR: Something went wrong');
    });
  });

  describe('renderInfo', () => {
    it('should render colored info message', () => {
      const result = renderer.renderInfo('Information message');

      expect(result).toBe('[blue]ℹ️ Information message[/blue]');
    });

    it('should render plain info message when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const result = noColorRenderer.renderInfo('Information message');

      expect(result).toBe('INFO: Information message');
    });
  });

  describe('renderWarning', () => {
    it('should render colored warning message', () => {
      const result = renderer.renderWarning('Warning message');

      expect(result).toBe('[yellow]⚠️ Warning message[/yellow]');
    });

    it('should render plain warning message when noColor is enabled', () => {
      const noColorRenderer = new TerminalRenderer({ noColor: true });
      const result = noColorRenderer.renderWarning('Warning message');

      expect(result).toBe('WARNING: Warning message');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete message rendering workflow', () => {
      const options: BuildLogOptions = {
        timestamps: true,
        stepFilter: 'Build'
      };
      const workflowRenderer = new TerminalRenderer(options);

      // Step start
      const startMessage = createMockProcessedMessage({
        stepName: 'Build',
        status: 1, // StepStarted
        message: 'Starting build process',
        timestamp: '2024-01-01T12:00:00.000Z'
      });

      // Step log
      const logMessage = createMockProcessedMessage({
        stepName: 'Build',
        status: 10, // Log
        message: 'Compiling @@[command] files',
        timestamp: '2024-01-01T12:00:05.000Z'
      });

      // Step completion
      const endMessage = createMockProcessedMessage({
        stepName: 'Build',
        status: 2, // StepEnded
        message: 'Build completed ✅',
        timestamp: '2024-01-01T12:00:30.000Z'
      });

      // Filtered out message
      const filteredMessage = createMockProcessedMessage({
        stepName: 'Test',
        status: 10,
        message: 'This should be filtered out'
      });

      const results = [
        workflowRenderer.renderMessage(startMessage),
        workflowRenderer.renderMessage(logMessage),
        workflowRenderer.renderMessage(endMessage),
        workflowRenderer.renderMessage(filteredMessage)
      ];

      // Start message
      expect(results[0]).toContain('[gray][12:00:00.000][/gray]');
      expect(results[0]).toContain('[blue]●[/blue]');
      expect(results[0]).toContain('[cyan][Build][/cyan]');
      expect(results[0]).toContain('Starting build process');

      // Log message with command formatting
      expect(results[1]).toContain('[cyan]@@[command][/cyan]');

      // End message with success formatting
      expect(results[2]).toContain('[green]Build completed ✅[/green]');

      // Filtered message should be empty
      expect(results[3]).toBe('');
    });

    it('should render complete build summary workflow', () => {
      // Step header
      const header = renderer.renderStepHeader('Build', 1);
      expect(header).toContain('[bold-cyan]Build[/bold-cyan]');

      // Step progress
      const progress = renderer.renderStepProgress('Build', 10, 50);
      expect(progress).toContain('[cyan]Build[/cyan]');
      expect(progress).toContain('50 messages');

      // Final summary
      const summary = renderer.renderSummary({
        totalSteps: 3,
        successfulSteps: 2,
        failedSteps: 1,
        duration: '1m 45s'
      });
      expect(summary).toContain('[red]❌ Build failed[/red]');
    });

    it('should handle edge cases gracefully', () => {
      // Empty message
      const emptyMessage = createMockProcessedMessage({ message: '' });
      const emptyResult = renderer.renderMessage(emptyMessage);
      expect(emptyResult).toContain('[blue]●[/blue]'); // Should still have icon

      // Very long message
      const longMessage = createMockProcessedMessage({
        message: 'A'.repeat(1000)
      });
      const longResult = renderer.renderMessage(longMessage);
      expect(longResult).toContain('A'.repeat(1000));

      // Special characters in message
      const specialMessage = createMockProcessedMessage({
        message: 'Message with special chars: !@#$%^&*()[]{}|\\:";\'<>?,./'
      });
      const specialResult = renderer.renderMessage(specialMessage);
      expect(specialResult).toContain('!@#$%^&*()[]{}|\\:";\'<>?,./')

      // Unicode characters
      const unicodeMessage = createMockProcessedMessage({
        message: 'Unicode test: 🚀 🎉 📊 ✨ 🔥'
      });
      const unicodeResult = renderer.renderMessage(unicodeMessage);
      expect(unicodeResult).toContain('🚀 🎉 📊 ✨ 🔥');
    });

    it('should maintain consistent formatting across multiple calls', () => {
      const message = createMockProcessedMessage({
        stepName: 'Consistent Step',
        status: 2,
        message: 'Consistent message'
      });

      const result1 = renderer.renderMessage(message);
      const result2 = renderer.renderMessage(message);

      expect(result1).toBe(result2);
    });
  });
});
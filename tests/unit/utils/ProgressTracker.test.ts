import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressTracker } from '../../../src/utils/ProgressTracker';
import { ProcessedLogMessage, WorkflowStatus, StepProgress, BuildLogStats } from '../../../src/types/build-logs';

// Helper function for creating mock processed log messages
const createMockProcessedMessage = (overrides: Partial<ProcessedLogMessage> = {}): ProcessedLogMessage => ({
  id: 'msg-123',
  taskId: 'task-456',
  message: 'Test message',
  messageIndex: 1,
  stepName: 'Test Step',
  status: 10 as WorkflowStatus, // Log
  timestamp: '2024-01-01T12:00:00Z',
  ...overrides
});

describe('ProgressTracker', () => {
  let progressTracker: ProgressTracker;
  let originalIsTTY: boolean;

  beforeEach(() => {
    // Store original TTY state
    originalIsTTY = process.stdout.isTTY;

    // Mock Date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    progressTracker = new ProgressTracker(true);
  });

  afterEach(() => {
    // Restore original TTY state
    process.stdout.isTTY = originalIsTTY;

    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create ProgressTracker with enabled state in TTY environment', () => {
      process.stdout.isTTY = true;
      const tracker = new ProgressTracker(true);

      const stats = tracker.getProgressStats();
      expect(stats.totalSteps).toBe(0);
      expect(stats.completedSteps).toBe(0);
      expect(stats.progressPercentage).toBe(0);
    });

    it('should create ProgressTracker with disabled state in non-TTY environment', () => {
      process.stdout.isTTY = false;
      const tracker = new ProgressTracker(true);

      // Should still work but internally disabled
      const stats = tracker.getProgressStats();
      expect(stats.totalSteps).toBe(0);
    });

    it('should create ProgressTracker with disabled state when explicitly disabled', () => {
      process.stdout.isTTY = true;
      const tracker = new ProgressTracker(false);

      const stats = tracker.getProgressStats();
      expect(stats.totalSteps).toBe(0);
    });

    it('should set build start time on construction', () => {
      const buildStats = progressTracker.getBuildStats();
      expect(buildStats.startTime).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });

  describe('updateProgress', () => {
    describe('Step Management', () => {
      it('should skip "all" step', () => {
        const message = createMockProcessedMessage({
          stepName: 'all',
          status: 1 // StepStarted
        });

        progressTracker.updateProgress(message);

        const stats = progressTracker.getProgressStats();
        expect(stats.totalSteps).toBe(0);
      });

      it('should add new step on first occurrence', () => {
        const message = createMockProcessedMessage({
          stepName: 'Build Step',
          status: 1 // StepStarted
        });

        progressTracker.updateProgress(message);

        const stats = progressTracker.getProgressStats();
        expect(stats.totalSteps).toBe(1);
        expect(stats.currentStep).toBe('Build Step');

        const step = progressTracker.getStepProgress('Build Step');
        expect(step).toBeDefined();
        expect(step!.name).toBe('Build Step');
        expect(step!.status).toBe(1);
        expect(step!.messageCount).toBe(1);
        expect(step!.startTime).toEqual(new Date('2024-01-01T12:00:00Z'));
        expect(step!.endTime).toBeUndefined();
      });

      it('should update existing step on subsequent messages', () => {
        const step1 = createMockProcessedMessage({
          stepName: 'Build Step',
          status: 1 // StepStarted
        });
        const step2 = createMockProcessedMessage({
          stepName: 'Build Step',
          status: 10 // Log
        });

        progressTracker.updateProgress(step1);
        progressTracker.updateProgress(step2);

        const stepProgress = progressTracker.getStepProgress('Build Step');
        expect(stepProgress!.status).toBe(10);
        expect(stepProgress!.messageCount).toBe(2);
      });

      it('should set end time when step is completed', () => {
        const startMessage = createMockProcessedMessage({
          stepName: 'Build Step',
          status: 1 // StepStarted
        });
        const endMessage = createMockProcessedMessage({
          stepName: 'Build Step',
          status: 2 // StepEnded
        });

        progressTracker.updateProgress(startMessage);

        // Advance time for end message
        vi.advanceTimersByTime(5000);
        progressTracker.updateProgress(endMessage);

        const stepProgress = progressTracker.getStepProgress('Build Step');
        expect(stepProgress!.endTime).toEqual(new Date('2024-01-01T12:00:05Z'));
      });

      it('should not update end time if already set', () => {
        const messages = [
          createMockProcessedMessage({ stepName: 'Build Step', status: 1 }), // StepStarted
          createMockProcessedMessage({ stepName: 'Build Step', status: 2 }), // StepEnded
          createMockProcessedMessage({ stepName: 'Build Step', status: 10 }) // Log
        ];

        progressTracker.updateProgress(messages[0]);
        vi.advanceTimersByTime(5000);
        progressTracker.updateProgress(messages[1]);
        const firstEndTime = progressTracker.getStepProgress('Build Step')!.endTime;

        vi.advanceTimersByTime(3000);
        progressTracker.updateProgress(messages[2]);
        const secondEndTime = progressTracker.getStepProgress('Build Step')!.endTime;

        expect(firstEndTime).toEqual(secondEndTime);
      });
    });

    describe('Workflow Completion', () => {
      it('should set build end time on workflow completion', () => {
        const message = createMockProcessedMessage({
          stepName: 'Final Step',
          status: 9 // WorkflowCompleted
        });

        vi.advanceTimersByTime(10000);
        progressTracker.updateProgress(message);

        const buildStats = progressTracker.getBuildStats();
        expect(buildStats.endTime).toEqual(new Date('2024-01-01T12:00:10Z'));
      });
    });
  });

  describe('getProgressStats', () => {
    beforeEach(() => {
      // Add multiple steps with different statuses
      const steps = [
        { stepName: 'Step1', status: 2 }, // StepEnded (completed)
        { stepName: 'Step2', status: 3 }, // StepError (failed)
        { stepName: 'Step3', status: 1 }, // StepStarted (current)
        { stepName: 'Step4', status: 9 }, // WorkflowCompleted (completed)
        { stepName: 'Step5', status: 10 } // Log (in progress)
      ];

      steps.forEach(({ stepName, status }) => {
        progressTracker.updateProgress(createMockProcessedMessage({
          stepName,
          status: status as WorkflowStatus
        }));
      });
    });

    it('should return correct progress statistics', () => {
      const stats = progressTracker.getProgressStats();

      expect(stats.totalSteps).toBe(5);
      expect(stats.completedSteps).toBe(2); // Step1 (status 2) and Step4 (status 9)
      expect(stats.failedSteps).toBe(1); // Step2 (status 3)
      expect(stats.currentStep).toBe('Step3'); // First step with status 1 or 10
      expect(stats.progressPercentage).toBe(40); // 2/5 * 100 = 40%
    });

    it('should return zero percentage for no steps', () => {
      const emptyTracker = new ProgressTracker();
      const stats = emptyTracker.getProgressStats();

      expect(stats.progressPercentage).toBe(0);
      expect(stats.totalSteps).toBe(0);
      expect(stats.completedSteps).toBe(0);
      expect(stats.currentStep).toBeUndefined();
    });

    it('should find current step with running status (10)', () => {
      const tracker = new ProgressTracker();
      tracker.updateProgress(createMockProcessedMessage({
        stepName: 'Running Step',
        status: 10 // Log
      }));

      const stats = tracker.getProgressStats();
      expect(stats.currentStep).toBe('Running Step');
    });
  });

  describe('getBuildStats', () => {
    it('should return correct build statistics', () => {
      // Add steps with different statuses
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 })); // Success
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 9 })); // Success
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step3', status: 3 })); // Failed

      // Set end time
      vi.advanceTimersByTime(30000); // 30 seconds
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Final', status: 9 }));

      const buildStats = progressTracker.getBuildStats();

      expect(buildStats.totalSteps).toBe(4);
      expect(buildStats.successfulSteps).toBe(3); // Steps with status 2 or 9 (Step1, Step2, Final)
      expect(buildStats.failedSteps).toBe(1); // Steps with status 3 (Step3)
      expect(buildStats.duration).toBe('30s');
      expect(buildStats.startTime).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(buildStats.endTime).toEqual(new Date('2024-01-01T12:00:30Z'));
    });

    it('should use current time as end time when build not completed', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));

      vi.advanceTimersByTime(15000); // 15 seconds
      const buildStats = progressTracker.getBuildStats();

      expect(buildStats.duration).toBe('15s');
      expect(buildStats.endTime).toEqual(new Date('2024-01-01T12:00:15Z'));
    });
  });

  describe('getAllSteps', () => {
    it('should return all steps sorted by start time', () => {
      // Add steps at different times
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));

      vi.advanceTimersByTime(1000);
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 1 }));

      vi.advanceTimersByTime(1000);
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step3', status: 1 }));

      const allSteps = progressTracker.getAllSteps();

      expect(allSteps).toHaveLength(3);
      expect(allSteps[0].name).toBe('Step1');
      expect(allSteps[1].name).toBe('Step2');
      expect(allSteps[2].name).toBe('Step3');

      // Verify chronological order
      expect(allSteps[0].startTime!.getTime()).toBeLessThan(allSteps[1].startTime!.getTime());
      expect(allSteps[1].startTime!.getTime()).toBeLessThan(allSteps[2].startTime!.getTime());
    });

    it('should handle steps without start time', () => {
      const tracker = new ProgressTracker();
      // Force a step without proper initialization
      tracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));

      const allSteps = tracker.getAllSteps();
      expect(allSteps).toHaveLength(1);
    });
  });

  describe('getStepProgress', () => {
    it('should return specific step progress', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Target Step',
        status: 2
      }));

      const stepProgress = progressTracker.getStepProgress('Target Step');

      expect(stepProgress).toBeDefined();
      expect(stepProgress!.name).toBe('Target Step');
      expect(stepProgress!.status).toBe(2);
    });

    it('should return undefined for non-existent step', () => {
      const stepProgress = progressTracker.getStepProgress('Non-existent Step');
      expect(stepProgress).toBeUndefined();
    });
  });

  describe('isBuildCompleted', () => {
    it('should return true when build end time is set', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Final Step',
        status: 9 // WorkflowCompleted
      }));

      expect(progressTracker.isBuildCompleted()).toBe(true);
    });

    it('should return true when any step has WorkflowCompleted status', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step1',
        status: 1
      }));
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step2',
        status: 9 // WorkflowCompleted
      }));

      expect(progressTracker.isBuildCompleted()).toBe(true);
    });

    it('should return false when build is not completed', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step1',
        status: 1
      }));

      expect(progressTracker.isBuildCompleted()).toBe(false);
    });
  });

  describe('hasBuildFailed', () => {
    it('should return true when any step has failed', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step1',
        status: 2
      }));
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step2',
        status: 3 // StepError
      }));

      expect(progressTracker.hasBuildFailed()).toBe(true);
    });

    it('should return false when no steps have failed', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step1',
        status: 1
      }));
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Step2',
        status: 2
      }));

      expect(progressTracker.hasBuildFailed()).toBe(false);
    });
  });

  describe('generateProgressBar', () => {
    it('should generate progress bar with default width', () => {
      // Add steps to get 50% completion
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 })); // Completed
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 1 })); // In progress

      const progressBar = progressTracker.generateProgressBar();

      expect(progressBar).toMatch(/^\[.*\] 50%$/);
      expect(progressBar).toContain('█'); // Should contain filled characters
      expect(progressBar).toContain('░'); // Should contain empty characters
    });

    it('should generate progress bar with custom width', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 }));

      const progressBar = progressTracker.generateProgressBar(10);

      expect(progressBar).toMatch(/^\[.{10}\] 100%$/);
    });

    it('should handle 0% completion', () => {
      const progressBar = progressTracker.generateProgressBar(10);

      expect(progressBar).toBe('[░░░░░░░░░░] 0%');
    });

    it('should handle 100% completion', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 }));

      const progressBar = progressTracker.generateProgressBar(10);

      expect(progressBar).toBe('[██████████] 100%');
    });
  });

  describe('getProgressSummary', () => {
    it('should return summary with completed/total steps', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 })); // Completed
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 1 })); // In progress

      const summary = progressTracker.getProgressSummary();

      expect(summary).toContain('1/2 steps');
    });

    it('should include current step when available', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Current Step', status: 1 }));

      const summary = progressTracker.getProgressSummary();

      expect(summary).toContain('current: Current Step');
    });

    it('should include failed count when there are failures', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 })); // Success
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 3 })); // Failed

      const summary = progressTracker.getProgressSummary();

      expect(summary).toContain('failed: 1');
    });

    it('should return complete summary with all components', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 })); // Success
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 3 })); // Failed
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Current Step', status: 1 })); // Current

      const summary = progressTracker.getProgressSummary();

      expect(summary).toContain('1/3 steps');
      expect(summary).toContain('current: Current Step');
      expect(summary).toContain('failed: 1');
    });
  });

  describe('reset', () => {
    it('should reset all progress tracking state', () => {
      // Add some steps
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 }));
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 9 }));

      // Verify state before reset
      expect(progressTracker.getProgressStats().totalSteps).toBe(2);
      expect(progressTracker.isBuildCompleted()).toBe(true);

      // Reset
      vi.advanceTimersByTime(5000);
      progressTracker.reset();

      // Verify state after reset
      const stats = progressTracker.getProgressStats();
      expect(stats.totalSteps).toBe(0);
      expect(stats.completedSteps).toBe(0);
      expect(progressTracker.isBuildCompleted()).toBe(false);

      const buildStats = progressTracker.getBuildStats();
      expect(buildStats.startTime).toEqual(new Date('2024-01-01T12:00:05Z')); // New start time
      expect(buildStats.endTime).toEqual(new Date('2024-01-01T12:00:05Z')); // Current time as end time
    });
  });

  describe('getCurrentStepStatus', () => {
    it('should return current step status for step with status 1', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Starting Step',
        status: 1 // StepStarted
      }));

      vi.advanceTimersByTime(3000); // 3 seconds

      const currentStatus = progressTracker.getCurrentStepStatus();

      expect(currentStatus).toBeDefined();
      expect(currentStatus!.stepName).toBe('Starting Step');
      expect(currentStatus!.status).toBe('starting');
      expect(currentStatus!.duration).toBe('3s');
    });

    it('should return current step status for step with status 10', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Running Step',
        status: 10 // Log
      }));

      vi.advanceTimersByTime(7000); // 7 seconds

      const currentStatus = progressTracker.getCurrentStepStatus();

      expect(currentStatus).toBeDefined();
      expect(currentStatus!.stepName).toBe('Running Step');
      expect(currentStatus!.status).toBe('running');
      expect(currentStatus!.duration).toBe('7s');
    });

    it('should return null when no current step exists', () => {
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Completed Step',
        status: 2 // StepEnded
      }));

      const currentStatus = progressTracker.getCurrentStepStatus();

      expect(currentStatus).toBeNull();
    });

    it('should return null when step has no start time', () => {
      // This would be an edge case that shouldn't normally happen
      const currentStatus = progressTracker.getCurrentStepStatus();
      expect(currentStatus).toBeNull();
    });
  });

  describe('Duration Formatting', () => {
    it('should format seconds correctly', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));

      vi.advanceTimersByTime(45000); // 45 seconds

      const buildStats = progressTracker.getBuildStats();
      expect(buildStats.duration).toBe('45s');
    });

    it('should format minutes and seconds correctly', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));

      vi.advanceTimersByTime(125000); // 2 minutes 5 seconds

      const buildStats = progressTracker.getBuildStats();
      expect(buildStats.duration).toBe('2m 5s');
    });

    it('should format hours, minutes and seconds correctly', () => {
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));

      vi.advanceTimersByTime(3725000); // 1 hour 2 minutes 5 seconds

      const buildStats = progressTracker.getBuildStats();
      expect(buildStats.duration).toBe('1h 2m 5s');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete build lifecycle', () => {
      // Start build
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Checkout',
        status: 1 // StepStarted
      }));

      vi.advanceTimersByTime(2000);

      // Complete first step and start second
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Checkout',
        status: 2 // StepEnded
      }));
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Build',
        status: 1 // StepStarted
      }));

      vi.advanceTimersByTime(5000);

      // Complete build and start test
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Build',
        status: 2 // StepEnded
      }));
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Test',
        status: 1 // StepStarted
      }));

      vi.advanceTimersByTime(3000);

      // Complete workflow
      progressTracker.updateProgress(createMockProcessedMessage({
        stepName: 'Test',
        status: 9 // WorkflowCompleted
      }));

      // Verify final state
      const stats = progressTracker.getProgressStats();
      expect(stats.totalSteps).toBe(3);
      expect(stats.completedSteps).toBe(3);
      expect(stats.progressPercentage).toBe(100);
      expect(progressTracker.isBuildCompleted()).toBe(true);
      expect(progressTracker.hasBuildFailed()).toBe(false);

      const buildStats = progressTracker.getBuildStats();
      expect(buildStats.duration).toBe('10s');
      expect(buildStats.successfulSteps).toBe(3);
      expect(buildStats.failedSteps).toBe(0);
    });

    it('should handle build with failures', () => {
      // Start and complete first step
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 1 }));
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step1', status: 2 }));

      // Start and fail second step
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 1 }));
      progressTracker.updateProgress(createMockProcessedMessage({ stepName: 'Step2', status: 3 })); // StepError

      expect(progressTracker.hasBuildFailed()).toBe(true);

      const stats = progressTracker.getProgressStats();
      expect(stats.failedSteps).toBe(1);
      expect(stats.completedSteps).toBe(1);
    });

    it('should handle edge cases with multiple status updates', () => {
      const stepName = 'Complex Step';

      // Multiple status updates for the same step
      progressTracker.updateProgress(createMockProcessedMessage({ stepName, status: 1 })); // StepStarted
      progressTracker.updateProgress(createMockProcessedMessage({ stepName, status: 10 })); // Log
      progressTracker.updateProgress(createMockProcessedMessage({ stepName, status: 10 })); // Log
      progressTracker.updateProgress(createMockProcessedMessage({ stepName, status: 2 })); // StepEnded
      progressTracker.updateProgress(createMockProcessedMessage({ stepName, status: 10 })); // Log after completion

      const stepProgress = progressTracker.getStepProgress(stepName);
      expect(stepProgress!.messageCount).toBe(5);
      expect(stepProgress!.status).toBe(10); // Last status
      expect(stepProgress!.endTime).toBeDefined(); // Should have end time from StepEnded
    });
  });
});
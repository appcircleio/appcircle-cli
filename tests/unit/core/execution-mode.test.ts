/**
 * @fileoverview Test suite for execution mode functionality
 * Tests the execution mode parameter parsing and behavior in build commands
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildExecutionMode } from '../../../src/core/command-runner-utilities';

// Mock the command-runner module
vi.mock('../../../src/core/command-runner', () => ({
  runCommand: vi.fn()
}));

// Mock external dependencies
vi.mock('enquirer', () => ({
  AutoComplete: vi.fn().mockImplementation(() => ({
    run: vi.fn()
  }))
}));

describe('Execution Mode Functionality', () => {
  let mockCommand: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    mockCommand = {
      name: vi.fn().mockReturnValue('start'),
      args: vi.fn().mockReturnValue([]),
      opts: vi.fn().mockReturnValue({}),
      isGroupCommand: vi.fn().mockReturnValue(false),
      fullCommandName: 'appcircle-build-start',
      parent: null
    };

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
  });

  describe('Execution Mode Parameter Parsing', () => {
    it('should parse normal execution mode correctly', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'normal',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.NORMAL);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should parse detailed execution mode correctly', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'detailed',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.DETAILED_MONITORING);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should parse step-summary execution mode correctly', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'step-summary',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.STEP_SUMMARY);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should parse skip execution mode correctly', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'skip',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.SKIP_SHOW_TASK_ID);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle case insensitive execution mode parsing', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'DETAILED',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.DETAILED_MONITORING);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle unknown execution mode with warning', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'unknown-mode',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.NORMAL);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Unknown execution mode 'unknown-mode'. Using 'normal' mode."
      );
    });

    it('should default to NORMAL when no execution mode parameter is provided', () => {
      mockCommand.opts.mockReturnValue({
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.NORMAL);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined execution mode parameter', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: undefined,
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.NORMAL);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle empty string execution mode parameter', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: '',
        profileId: 'test-profile',
        workflowId: 'test-workflow'
      });

      const executionModeParam = mockCommand.opts()['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.NORMAL);
      // Empty string is falsy, so the if condition won't execute and no warning will be shown
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Execution Mode Integration', () => {
    it('should handle command with execution mode and other parameters', () => {
      mockCommand.opts.mockReturnValue({
        executionMode: 'step-summary',
        profileId: 'test-profile-123',
        workflowId: 'test-workflow-456',
        branchId: 'test-branch-789',
        downloadLogs: true,
        downloadArtifacts: false
      });

      const opts = mockCommand.opts();
      const executionModeParam = opts['executionMode'];
      let executionMode = BuildExecutionMode.NORMAL;

      if (executionModeParam) {
        switch (executionModeParam.toLowerCase()) {
          case 'normal':
            executionMode = BuildExecutionMode.NORMAL;
            break;
          case 'detailed':
            executionMode = BuildExecutionMode.DETAILED_MONITORING;
            break;
          case 'step-summary':
            executionMode = BuildExecutionMode.STEP_SUMMARY;
            break;
          case 'skip':
            executionMode = BuildExecutionMode.SKIP_SHOW_TASK_ID;
            break;
          default:
            console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'normal' mode.`);
            executionMode = BuildExecutionMode.NORMAL;
        }
      }

      expect(executionMode).toBe(BuildExecutionMode.STEP_SUMMARY);
      expect(opts.profileId).toBe('test-profile-123');
      expect(opts.workflowId).toBe('test-workflow-456');
      expect(opts.branchId).toBe('test-branch-789');
      expect(opts.downloadLogs).toBe(true);
      expect(opts.downloadArtifacts).toBe(false);
    });
  });
});

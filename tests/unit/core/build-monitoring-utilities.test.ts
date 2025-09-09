import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn()
}));

vi.mock('../../../src/config', async () => {
  const actual = await vi.importActual('../../../src/config');
  return {
    ...actual,
    getConsoleOutputType: vi.fn().mockReturnValue('plain'),
    getInteractiveMode: vi.fn().mockReturnValue(false)
  };
});

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((msg) => msg),
    yellow: vi.fn((msg) => msg),
    green: vi.fn((msg) => msg),
    cyan: vi.fn((msg) => msg),
    blue: vi.fn((msg) => msg),
    gray: vi.fn((msg) => msg),
    hex: vi.fn(() => vi.fn((msg) => msg))
  }
}));

vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/test')
  },
  homedir: vi.fn(() => '/home/test')
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((path) => path)
  },
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((path) => path)
}));

// Mock the AppcircleExitError
vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

// Mock console methods - setup will happen in beforeEach
let mockConsoleLog: any;
let mockConsoleError: any;

import { createOra } from '../../../src/utils/orahelper';
import { getConsoleOutputType } from '../../../src/config';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import enquirer from 'enquirer';
import path from 'path';
import os from 'os';

import {
  createProgressSpinner,
  updateBuildStatusMessage,
  monitorBuildProgress,
  handleBuildSuccessCompletion,
  downloadBuildArtifactsWithSpinner,
  downloadBuildLogsWithSpinner,
  promptForDownloadActions,
  downloadBuildLogsInteractive,
  handleBuildFailureCompletion,
  promptForFailedBuildLogs
} from '../../../src/core/command-runner';
import { formatElapsedTime } from '../../../src/core/command-runner-utilities';

describe('Build Monitoring Utilities', () => {
  let mockSpinner: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up console mocks fresh for each test
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);
  });

  afterEach(() => {
    // Restore console methods
    mockConsoleLog?.mockRestore?.();
    mockConsoleError?.mockRestore?.();
    vi.resetAllMocks();
  });

  describe('createProgressSpinner', () => {
    it('should return actual spinner in non-JSON mode', () => {
      (getConsoleOutputType as any).mockReturnValue('plain');
      
      const result = createProgressSpinner('Test message');
      
      expect(createOra).toHaveBeenCalledWith('Test message');
      expect(result).toBe(mockSpinner);
    });

    it('should return mock spinner in JSON mode', () => {
      (getConsoleOutputType as any).mockReturnValue('json');
      
      const result = createProgressSpinner('Test message');
      
      expect(createOra).not.toHaveBeenCalled();
      expect(result).toEqual({
        text: '',
        succeed: expect.any(Function),
        fail: expect.any(Function),
        stop: expect.any(Function)
      });
    });
  });

  describe('formatElapsedTime', () => {
    it('should format time under 1 minute correctly', () => {
      const now = Date.now();
      const startTime = now - 30000; // 30 seconds ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('30s');
    });

    it('should format time over 1 minute correctly', () => {
      const now = Date.now();
      const startTime = now - 125000; // 2 minutes 5 seconds ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('2m 5s');
    });

    it('should handle exactly 1 minute', () => {
      const now = Date.now();
      const startTime = now - 60000; // 1 minute ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('1m 0s');
    });
  });

  describe('updateBuildStatusMessage', () => {
    beforeEach(() => {
      mockSpinner.text = '';
    });

    it('should handle pending build status', () => {
      updateBuildStatusMessage(null, '30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build Status is pending...');
      expect(chalk.gray).toHaveBeenCalled();
    });

    it('should handle success status', () => {
      updateBuildStatusMessage(0, '2m 30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build completed successfully ✅ (2m 30s)');
    });

    it('should handle success with warning', () => {
      updateBuildStatusMessage(0, '2m 30s', mockSpinner, true);
      
      expect(mockSpinner.text).toContain('Build completed with warnings ⚠️ (2m 30s)');
      expect(chalk.hex).toHaveBeenCalledWith('#FFA500');
    });

    it('should handle failed status', () => {
      updateBuildStatusMessage(1, '1m 15s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build failed ❌ (1m 15s)');
      expect(chalk.red).toHaveBeenCalled();
    });

    it('should handle canceled status', () => {
      updateBuildStatusMessage(2, '45s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build canceled 🚫 (45s)');
      expect(chalk.hex).toHaveBeenCalledWith('#FF8C32');
    });

    it('should handle timeout status', () => {
      updateBuildStatusMessage(3, '10m 0s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build timed out ⏱️ (10m 0s)');
      expect(chalk.red).toHaveBeenCalled();
    });

    it('should handle waiting status', () => {
      updateBuildStatusMessage(90, '1m 0s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build waiting in queue ⏳ (1m 0s)');
      expect(chalk.cyan).toHaveBeenCalled();
    });

    it('should handle running status without changing text', () => {
      const originalText = 'Original text';
      mockSpinner.text = originalText;
      
      updateBuildStatusMessage(91, '2m 0s', mockSpinner);
      
      // Running status should not change the spinner text
      expect(mockSpinner.text).toBe(originalText);
    });

    it('should handle completing status', () => {
      updateBuildStatusMessage(92, '3m 30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build finishing... 🔜 (3m 30s)');
      expect(chalk.blue).toHaveBeenCalled();
    });

    it('should handle unknown status', () => {
      updateBuildStatusMessage(999, '1m 30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build Status: 999 (1m 30s)');
      expect(chalk.gray).toHaveBeenCalled();
    });
  });

  describe('monitorBuildProgress', () => {
    let mockGetBuildStatusFromQueue: any;
    let mockGetLatestBuildId: any;
    let mockParams: any;

    beforeEach(() => {
      mockGetBuildStatusFromQueue = vi.fn();
      mockGetLatestBuildId = vi.fn();
      mockParams = {
        branchId: 'branch-123',
        profileId: 'profile-456'
      };
    });

    it('should monitor build until successful completion', async () => {
      const mockQueueResponse = {
        buildStatus: 91, // RUNNING
        hasWarning: false
      };
      const mockCompletedResponse = {
        buildStatus: 0, // SUCCESS
        hasWarning: false,
        commitId: 'commit-123'
      };

      mockGetBuildStatusFromQueue
        .mockResolvedValueOnce(mockQueueResponse)
        .mockResolvedValueOnce(mockCompletedResponse);
      
      mockGetLatestBuildId.mockResolvedValue('build-789');

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(result.buildCompleted).toBe(true);
      expect(result.buildSuccess).toBe(true);
      expect(result.finalStatusResponse.buildStatus).toBe(0);
      expect(result.latestBuildId).toBe('build-789');
      expect(result.timedOut).toBe(false);
    });

    it('should monitor build until failed completion', async () => {
      const mockFailedResponse = {
        buildStatus: 1, // FAILED
        hasWarning: false
      };

      mockGetBuildStatusFromQueue.mockResolvedValue(mockFailedResponse);

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(result.buildCompleted).toBe(true);
      expect(result.buildSuccess).toBe(false);
      expect(result.finalStatusResponse.buildStatus).toBe(1);
    });

    it('should handle canceled build', async () => {
      const mockCanceledResponse = {
        buildStatus: 2, // CANCELED
        hasWarning: false
      };

      mockGetBuildStatusFromQueue.mockResolvedValue(mockCanceledResponse);

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(result.buildCompleted).toBe(true);
      expect(result.buildSuccess).toBe(false);
      expect(result.finalStatusResponse.buildStatus).toBe(2);
      expect(mockParams.wasCanceled).toBe(true);
    });

    it('should handle timeout scenario', async () => {
      mockGetBuildStatusFromQueue.mockResolvedValue({
        buildStatus: 91, // RUNNING - never completes
        hasWarning: false
      });

      // Mock setTimeout to avoid real delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn().mockImplementation((fn: any) => fn()) as any;

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(result.buildCompleted).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(mockGetBuildStatusFromQueue).toHaveBeenCalledTimes(300); // maxRetries

      global.setTimeout = originalSetTimeout;
    }, 20000);

    it('should handle API errors gracefully', async () => {
      mockGetBuildStatusFromQueue
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          buildStatus: 0,
          hasWarning: false
        });

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(result.buildCompleted).toBe(true);
      expect(result.buildSuccess).toBe(true);
    });

    it('should force completion after high retry count for non-running status', async () => {
      let callCount = 0;
      mockGetBuildStatusFromQueue.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          buildStatus: callCount <= 6 ? 90 : 90, // WAITING status
          hasWarning: false
        });
      });

      // Mock setTimeout to avoid real delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn().mockImplementation((fn: any) => fn()) as any;

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(result.buildCompleted).toBe(true);
      expect(mockGetBuildStatusFromQueue).toHaveBeenCalledTimes(7); // Should stop after retry count > 5

      global.setTimeout = originalSetTimeout;
    }, 10000);

    it('should get latest build ID when available', async () => {
      const mockResponse = {
        buildStatus: 0,
        hasWarning: false
      };

      mockGetBuildStatusFromQueue.mockResolvedValue(mockResponse);
      mockGetLatestBuildId.mockResolvedValue('latest-build-id');

      const result = await monitorBuildProgress('task-123', mockParams, mockGetBuildStatusFromQueue, mockGetLatestBuildId);

      expect(mockGetLatestBuildId).toHaveBeenCalledWith({
        branchId: 'branch-123',
        profileId: 'profile-456'
      });
      expect(result.latestBuildId).toBe('latest-build-id');
      expect(result.finalStatusResponse.buildId).toBe('latest-build-id');
    });
  });

  describe('downloadBuildArtifactsWithSpinner', () => {
    let mockDownloadArtifact: any;
    const originalSetTimeout = global.setTimeout;

    beforeEach(() => {
      mockDownloadArtifact = vi.fn();
      vi.spyOn(Date, 'now').mockReturnValue(1234567890);
      // Mock setTimeout to avoid real delays
      global.setTimeout = vi.fn().mockImplementation((fn: any) => fn()) as any;
    });

    afterEach(() => {
      global.setTimeout = originalSetTimeout;
    });

    it('should download artifacts successfully', async () => {
      mockDownloadArtifact.mockResolvedValue(undefined);
      const params = { branchId: 'branch-123', profileId: 'profile-456' };

      await downloadBuildArtifactsWithSpinner('commit-123', 'build-456', params, '/download/path', mockDownloadArtifact);

      expect(mockDownloadArtifact).toHaveBeenCalledWith(
        {
          commitId: 'commit-123',
          buildId: 'build-456',
          branchId: 'branch-123',
          profileId: 'profile-456'
        },
        '/download/path',
        'artifacts-1234567890.zip'
      );
      expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('Artifacts downloaded successfully'));
    });

    it('should handle download errors', async () => {
      mockDownloadArtifact.mockRejectedValue(new Error('Download failed'));
      const params = { branchId: 'branch-123', profileId: 'profile-456' };

      await downloadBuildArtifactsWithSpinner('commit-123', 'build-456', params, '/download/path', mockDownloadArtifact);

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download artifact since the build failed: Download failed');
    });
  });

  describe('downloadBuildLogsWithSpinner', () => {
    let mockDownloadBuildLogs: any;
    let mockResponseData: any;

    beforeEach(() => {
      mockDownloadBuildLogs = vi.fn();
      mockResponseData = { queueItemId: 'queue-123' };
    });

    it('should download logs with commit and build ID', async () => {
      mockDownloadBuildLogs.mockResolvedValue(undefined);
      const params = { branchId: 'branch-123', profileId: 'profile-456' };

      await downloadBuildLogsWithSpinner('commit-123', 'build-456', params, '/download/path', mockDownloadBuildLogs, mockResponseData);

      expect(mockDownloadBuildLogs).toHaveBeenCalledWith({
        commitId: 'commit-123',
        buildId: 'build-456',
        branchId: 'branch-123',
        profileId: 'profile-456',
        path: '/download/path'
      });
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Build logs downloaded successfully');
    });

    it('should fallback to queue item ID when build ID is invalid', async () => {
      mockDownloadBuildLogs.mockResolvedValue(undefined);
      const params = { branchId: 'branch-123', profileId: 'profile-456' };

      await downloadBuildLogsWithSpinner('commit-123', '00000000-0000-0000-0000-000000000000', params, '/download/path', mockDownloadBuildLogs, mockResponseData);

      expect(mockDownloadBuildLogs).toHaveBeenCalledWith('queue-123', { path: '/download/path' });
    });

    it('should handle download errors', async () => {
      mockDownloadBuildLogs.mockRejectedValue(new Error('Log download failed'));
      const params = { branchId: 'branch-123', profileId: 'profile-456' };

      await downloadBuildLogsWithSpinner('commit-123', 'build-456', params, '/download/path', mockDownloadBuildLogs, mockResponseData);

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download logs since the build failed: Log download failed');
    });
  });

  describe('handleBuildSuccessCompletion', () => {
    let mockFinalStatusResponse: any;
    let mockParams: any;
    let mockResponseData: any;
    let mockDownloadArtifact: any;
    let mockDownloadBuildLogs: any;

    beforeEach(() => {
      mockFinalStatusResponse = {
        commitId: 'commit-123',
        hasWarning: false
      };
      mockParams = {
        branchId: 'branch-123',
        profileId: 'profile-456'
      };
      mockResponseData = {
        taskId: 'task-123',
        queueItemId: 'queue-456'
      };
      mockDownloadArtifact = vi.fn();
      mockDownloadBuildLogs = vi.fn();

      (os.homedir as any).mockReturnValue('/home/test');
      (path.join as any).mockReturnValue('/home/test/Downloads');
    });

    it('should return JSON output in JSON mode', async () => {
      (getConsoleOutputType as any).mockReturnValue('json');

      await expect(async () => {
        await handleBuildSuccessCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadArtifact, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify({
        taskId: 'task-123',
        queueItemId: 'queue-456',
        status: 'success',
        message: 'Build completed successfully'
      }));
    });

    it('should handle automatic artifact download', async () => {
      mockParams.downloadArtifacts = true;
      mockDownloadArtifact.mockResolvedValue(undefined);

      await expect(async () => {
        await handleBuildSuccessCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadArtifact, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockDownloadArtifact).toHaveBeenCalled();
    });

    it('should handle automatic log download', async () => {
      mockParams.downloadLogs = true;
      mockDownloadBuildLogs.mockResolvedValue(undefined);

      await expect(async () => {
        await handleBuildSuccessCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadArtifact, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockDownloadBuildLogs).toHaveBeenCalled();
    });

    it('should prompt for interactive downloads when no auto-download flags', async () => {
      // This will trigger the interactive prompt path
      (enquirer.prompt as any).mockResolvedValue({ action: 'continue' });

      await expect(async () => {
        await handleBuildSuccessCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadArtifact, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(enquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('promptForDownloadActions', () => {
    let mockFinalStatusResponse: any;
    let mockParams: any;
    let mockResponseData: any;
    let mockDownloadArtifact: any;
    let mockDownloadBuildLogs: any;

    beforeEach(() => {
      mockFinalStatusResponse = { commitId: 'commit-123' };
      mockParams = { branchId: 'branch-123', profileId: 'profile-456' };
      mockResponseData = { queueItemId: 'queue-456' };
      mockDownloadArtifact = vi.fn();
      mockDownloadBuildLogs = vi.fn();
    });

    it('should handle artifacts download choice', async () => {
      (enquirer.prompt as any)
        .mockResolvedValueOnce({ action: 'artifacts' })
        .mockResolvedValueOnce({ path: '/custom/path' });
      mockDownloadArtifact.mockResolvedValue(undefined);

      await expect(async () => {
        await promptForDownloadActions(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadArtifact, mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockDownloadArtifact).toHaveBeenCalled();
    });

    it('should handle logs download choice', async () => {
      (enquirer.prompt as any)
        .mockResolvedValueOnce({ action: 'logs' })
        .mockResolvedValueOnce({ path: '/custom/path' });
      mockDownloadBuildLogs.mockResolvedValue(undefined);

      await expect(async () => {
        await promptForDownloadActions(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadArtifact, mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockDownloadBuildLogs).toHaveBeenCalled();
    });

    it('should handle continue choice', async () => {
      (enquirer.prompt as any).mockResolvedValue({ action: 'continue' });

      await expect(async () => {
        await promptForDownloadActions(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadArtifact, mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build completed successfully.'));
    });

    it('should handle missing artifact information', async () => {
      const mockFinalStatusResponseEmpty = {}; // No commitId
      (enquirer.prompt as any)
        .mockResolvedValueOnce({ action: 'artifacts' })
        .mockResolvedValueOnce({ path: '/custom/path' });

      await expect(async () => {
        await promptForDownloadActions(mockFinalStatusResponseEmpty, null, mockParams, '/default/path', mockDownloadArtifact, mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build completed successfully but could not get artifact information.'));
    });

    it('should handle prompt errors gracefully', async () => {
      (enquirer.prompt as any).mockRejectedValue(new Error('Prompt failed'));

      await expect(async () => {
        await promptForDownloadActions(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadArtifact, mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build completed successfully.'));
    });
  });

  describe('handleBuildFailureCompletion', () => {
    let mockFinalStatusResponse: any;
    let mockParams: any;
    let mockResponseData: any;
    let mockDownloadBuildLogs: any;

    beforeEach(() => {
      mockFinalStatusResponse = { buildStatus: 1, commitId: 'commit-123' };
      mockParams = { branchId: 'branch-123', profileId: 'profile-456' };
      mockResponseData = { taskId: 'task-123', queueItemId: 'queue-456' };
      mockDownloadBuildLogs = vi.fn();
    });

    it('should return JSON output in JSON mode', async () => {
      (getConsoleOutputType as any).mockReturnValue('json');

      await expect(async () => {
        await handleBuildFailureCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify({
        taskId: 'task-123',
        queueItemId: 'queue-456',
        status: 'failed',
        message: 'Build failed'
      }));
    });

    it('should handle automatic log download on failure', async () => {
      mockParams.downloadLogs = true;
      mockDownloadBuildLogs.mockResolvedValue(undefined);

      await expect(async () => {
        await handleBuildFailureCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockDownloadBuildLogs).toHaveBeenCalled();
    });

    it('should prompt for log download when no auto-download flags', async () => {
      (enquirer.prompt as any).mockResolvedValue({ download: 'no' });

      await expect(async () => {
        await handleBuildFailureCompletion(mockFinalStatusResponse, 'build-789', mockParams, mockResponseData, mockDownloadBuildLogs);
      }).rejects.toThrow(AppcircleExitError);

      expect(enquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('promptForFailedBuildLogs', () => {
    let mockFinalStatusResponse: any;
    let mockParams: any;
    let mockResponseData: any;
    let mockDownloadBuildLogs: any;

    beforeEach(() => {
      mockFinalStatusResponse = { commitId: 'commit-123' };
      mockParams = { branchId: 'branch-123', profileId: 'profile-456' };
      mockResponseData = { queueItemId: 'queue-456' };
      mockDownloadBuildLogs = vi.fn();
    });

    it('should download logs when user chooses yes', async () => {
      (enquirer.prompt as any)
        .mockResolvedValueOnce({ download: 'yes' })
        .mockResolvedValueOnce({ path: '/custom/path' });
      mockDownloadBuildLogs.mockResolvedValue(undefined);

      await expect(async () => {
        await promptForFailedBuildLogs(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(AppcircleExitError);

      expect(mockDownloadBuildLogs).toHaveBeenCalled();
    });

    it('should exit when user chooses no', async () => {
      (enquirer.prompt as any).mockResolvedValue({ download: 'no' });

      await expect(async () => {
        await promptForFailedBuildLogs(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(new AppcircleExitError('Build failed', 1));
    });

    it('should handle prompt errors', async () => {
      (enquirer.prompt as any).mockRejectedValue(new Error('Prompt failed'));

      await expect(async () => {
        await promptForFailedBuildLogs(mockFinalStatusResponse, 'build-789', mockParams, '/default/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(new AppcircleExitError('Build failed, user chose to exit', 1));
    });
  });

  describe('downloadBuildLogsInteractive', () => {
    let mockFinalStatusResponse: any;
    let mockParams: any;
    let mockResponseData: any;
    let mockDownloadBuildLogs: any;

    beforeEach(() => {
      mockFinalStatusResponse = { commitId: 'commit-123', buildStatus: 0 };
      mockParams = { branchId: 'branch-123', profileId: 'profile-456' };
      mockResponseData = { queueItemId: 'queue-456' };
      mockDownloadBuildLogs = vi.fn();
    });

    it('should download logs successfully with commit and build ID', async () => {
      mockDownloadBuildLogs.mockResolvedValue(undefined);

      await expect(async () => {
        await downloadBuildLogsInteractive(mockFinalStatusResponse, 'build-789', mockParams, '/download/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(new AppcircleExitError('', 0));

      expect(mockDownloadBuildLogs).toHaveBeenCalledWith({
        commitId: 'commit-123',
        buildId: 'build-789',
        branchId: 'branch-123',
        profileId: 'profile-456'
      }, '/download/path');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build completed successfully with logs downloaded.'));
    });

    it('should handle canceled build status', async () => {
      mockFinalStatusResponse.buildStatus = 2; // CANCELED
      mockDownloadBuildLogs.mockResolvedValue(undefined);

      await expect(async () => {
        await downloadBuildLogsInteractive(mockFinalStatusResponse, 'build-789', mockParams, '/download/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(new AppcircleExitError('', 0));

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Note: Logs for canceled Builds might not be immediately available.'));
      expect(mockParams.wasCanceled).toBe(true);
    });

    it('should fallback to queue item ID on download failure', async () => {
      mockDownloadBuildLogs
        .mockRejectedValueOnce(new Error('Download failed'))
        .mockResolvedValueOnce(undefined);

      await expect(async () => {
        await downloadBuildLogsInteractive(mockFinalStatusResponse, 'build-789', mockParams, '/download/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(new AppcircleExitError('Build failed', 1));

      expect(mockDownloadBuildLogs).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build failed but logs downloaded successfully.'));
    });

    it('should handle complete download failure', async () => {
      mockDownloadBuildLogs.mockRejectedValue(new Error('Download failed'));

      await expect(async () => {
        await downloadBuildLogsInteractive(mockFinalStatusResponse, 'build-789', mockParams, '/download/path', mockDownloadBuildLogs, mockResponseData);
      }).rejects.toThrow(new AppcircleExitError('Build failed', 1));

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build failed and could not download logs.'));
    });
  });
});
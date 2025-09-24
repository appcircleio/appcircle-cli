import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('chalk', () => ({
  default: {
    gray: vi.fn((msg) => `gray(${msg})`),
    red: vi.fn((msg) => `red(${msg})`),
    cyan: vi.fn((msg) => `cyan(${msg})`),
    blue: vi.fn((msg) => `blue(${msg})`),
    yellow: vi.fn((msg) => `yellow(${msg})`),
    hex: vi.fn((color) => (msg: string) => `${color}(${msg})`)
  }
}));

vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
    text: ''
  }))
}));

vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getConsoleOutputType: vi.fn().mockReturnValue('plain')
  };
});

// Import functions to test
import {
  createSpinnerWithMessage,
  handleSpinnerSuccess,
  handleSpinnerFailure,
  downloadWithSpinner,
  createDirectoryWithFallback,
  createProgressSpinner,
  updateBuildStatusMessage,
  downloadBuildArtifactsWithSpinner,
  downloadBuildLogsWithSpinner
} from '../../../src/core/command-runner';

import { createOra } from '../../../src/utils/orahelper';
import { getConsoleOutputType } from '../../../src/config';

describe('Command Runner Build Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (path.resolve as any).mockImplementation((...parts: string[]) => parts.join('/'));
    (path.join as any).mockImplementation((...parts: string[]) => parts.join('/'));
  });

  describe('createSpinnerWithMessage', () => {
    it('should create and start spinner by default', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);

      const result = createSpinnerWithMessage('Test message');

      expect(createOra).toHaveBeenCalledWith('Test message');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should create and start spinner when type is start', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);

      const result = createSpinnerWithMessage('Test message', 'start');

      expect(createOra).toHaveBeenCalledWith('Test message');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should create spinner without starting when type is succeed', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);

      const result = createSpinnerWithMessage('Test message', 'succeed');

      expect(createOra).toHaveBeenCalledWith('Test message');
      expect(mockSpinner.start).not.toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should create spinner without starting when type is fail', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);

      const result = createSpinnerWithMessage('Test message', 'fail');

      expect(createOra).toHaveBeenCalledWith('Test message');
      expect(mockSpinner.start).not.toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should handle empty message', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);

      createSpinnerWithMessage('');

      expect(createOra).toHaveBeenCalledWith('');
    });

    it('should handle special characters in message', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);

      createSpinnerWithMessage('Message with special chars: !@#$%');

      expect(createOra).toHaveBeenCalledWith('Message with special chars: !@#$%');
    });
  });

  describe('handleSpinnerSuccess', () => {
    it('should call succeed on spinner with message', () => {
      const mockSpinner = {
        succeed: vi.fn()
      };

      handleSpinnerSuccess(mockSpinner, 'Success message');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Success message');
    });

    it('should handle empty success message', () => {
      const mockSpinner = {
        succeed: vi.fn()
      };

      handleSpinnerSuccess(mockSpinner, '');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('');
    });

    it('should handle special characters in success message', () => {
      const mockSpinner = {
        succeed: vi.fn()
      };

      handleSpinnerSuccess(mockSpinner, 'Success! ✅ 🎉');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Success! ✅ 🎉');
    });
  });

  describe('handleSpinnerFailure', () => {
    it('should call fail on spinner with message', () => {
      const mockSpinner = {
        fail: vi.fn()
      };

      handleSpinnerFailure(mockSpinner, 'Failure message');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failure message');
    });

    it('should handle empty failure message', () => {
      const mockSpinner = {
        fail: vi.fn()
      };

      handleSpinnerFailure(mockSpinner, '');

      expect(mockSpinner.fail).toHaveBeenCalledWith('');
    });

    it('should handle special characters in failure message', () => {
      const mockSpinner = {
        fail: vi.fn()
      };

      handleSpinnerFailure(mockSpinner, 'Failed! ❌ 💥');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed! ❌ 💥');
    });
  });

  describe('downloadWithSpinner', () => {
    it('should successfully download file and show success message', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      
      (path.resolve as any).mockReturnValue('/absolute/downloads/test.zip');
      (path.join as any).mockReturnValue('/downloads/test.zip');

      const result = await downloadWithSpinner(mockDownloadFunction, downloadPath, fileName);

      expect(createOra).toHaveBeenCalledWith('Downloading file...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockDownloadFunction).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('file downloaded successfully: file:///absolute/downloads/test.zip');
      expect(result).toBe('/absolute/downloads/test.zip');
    });

    it('should handle download failure and show error message', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const downloadError = new Error('Download failed');
      const mockDownloadFunction = vi.fn().mockRejectedValue(downloadError);

      await expect(downloadWithSpinner(mockDownloadFunction, '/downloads', 'test.zip'))
        .rejects.toThrow('Download failed');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download file: Download failed');
    });

    it('should handle download with custom item type', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      
      await downloadWithSpinner(mockDownloadFunction, '/downloads', 'artifact.zip', 'artifact');

      expect(createOra).toHaveBeenCalledWith('Downloading artifact...');
    });

    it('should handle error without message', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const downloadError = { message: undefined };
      const mockDownloadFunction = vi.fn().mockRejectedValue(downloadError);

      await expect(downloadWithSpinner(mockDownloadFunction, '/downloads', 'test.zip'))
        .rejects.toThrow();

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download file: Unknown error');
    });

    it('should handle empty download path and filename', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      (path.resolve as any).mockReturnValue('/');
      (path.join as any).mockReturnValue('/');

      const result = await downloadWithSpinner(mockDownloadFunction, '', '');

      expect(result).toBe('/');
    });
  });

  describe('createDirectoryWithFallback', () => {
    it('should create directory when it does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});

      const result = createDirectoryWithFallback('/new/directory', '/home/user');

      expect(fs.existsSync).toHaveBeenCalledWith('/new/directory');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/new/directory', { recursive: true });
      expect(result).toBe('/new/directory');
    });

    it('should return directory path when it already exists', () => {
      (fs.existsSync as any).mockReturnValue(true);

      const result = createDirectoryWithFallback('/existing/directory', '/home/user');

      expect(fs.existsSync).toHaveBeenCalledWith('/existing/directory');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe('/existing/directory');
    });

    it('should fallback to home directory on creation error', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = createDirectoryWithFallback('/restricted/directory', '/home/user');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/restricted/directory', { recursive: true });
      expect(result).toBe('/home/user');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not create directory at /restricted/directory')
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty paths', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});

      const result = createDirectoryWithFallback('', '/home/user');

      expect(result).toBe('');
    });

    it('should handle mkdirSync throwing non-Error object', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw 'String error';
      });

      const result = createDirectoryWithFallback('/directory', '/home/user');

      expect(result).toBe('/home/user');

      consoleSpy.mockRestore();
    });
  });

  describe('createProgressSpinner', () => {
    it('should create and start ora spinner in plain mode', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        text: ''
      };
      (createOra as any).mockReturnValue(mockSpinner);
      (getConsoleOutputType as any).mockReturnValue('plain');

      const result = createProgressSpinner('Building...');

      expect(createOra).toHaveBeenCalledWith('Building...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should return dummy spinner in JSON mode', () => {
      (getConsoleOutputType as any).mockReturnValue('json');

      const result = createProgressSpinner('Building...');

      expect(result).toEqual({
        text: '',
        succeed: expect.any(Function),
        fail: expect.any(Function),
        stop: expect.any(Function)
      });
      expect(createOra).not.toHaveBeenCalled();
    });

    it('should handle empty message in plain mode', () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      (getConsoleOutputType as any).mockReturnValue('plain');

      createProgressSpinner('');

      expect(createOra).toHaveBeenCalledWith('');
    });

    it('should handle empty message in JSON mode', () => {
      (getConsoleOutputType as any).mockReturnValue('json');

      const result = createProgressSpinner('');

      expect(result.text).toBe('');
    });
  });

  describe('updateBuildStatusMessage', () => {
    let mockSpinner: any;

    beforeEach(() => {
      mockSpinner = { text: '' };
    });

    it('should handle null build status', () => {
      updateBuildStatusMessage(null, '5m 30s', mockSpinner);

      expect(mockSpinner.text).toBe('gray(Build Status is pending...)');
    });

    it('should handle undefined build status', () => {
      updateBuildStatusMessage(undefined as any, '5m 30s', mockSpinner);

      expect(mockSpinner.text).toBe('gray(Build Status is pending...)');
    });

    it('should handle SUCCESS status without warnings', () => {
      updateBuildStatusMessage(0, '10m 15s', mockSpinner, false);

      expect(mockSpinner.text).toBe('Build completed successfully ✅ (10m 15s)');
    });

    it('should handle SUCCESS status with warnings', () => {
      updateBuildStatusMessage(0, '10m 15s', mockSpinner, true);

      expect(mockSpinner.text).toBe('#FFA500(Build completed with warnings ⚠️ (10m 15s))');
    });

    it('should handle FAILED status', () => {
      updateBuildStatusMessage(1, '8m 45s', mockSpinner);

      expect(mockSpinner.text).toBe('red(Build failed ❌ (8m 45s))');
    });

    it('should handle CANCELED status', () => {
      updateBuildStatusMessage(2, '3m 20s', mockSpinner);

      expect(mockSpinner.text).toBe('#FF8C32(Build canceled 🚫 (3m 20s))');
    });

    it('should handle TIMEOUT status', () => {
      updateBuildStatusMessage(3, '30m 00s', mockSpinner);

      expect(mockSpinner.text).toBe('red(Build timed out ⏱️ (30m 00s))');
    });

    it('should handle WAITING status', () => {
      updateBuildStatusMessage(90, '1m 30s', mockSpinner);

      expect(mockSpinner.text).toBe('cyan(Build waiting in queue ⏳ (1m 30s))');
    });

    it('should handle RUNNING status (no text change)', () => {
      const initialText = 'Previous text';
      mockSpinner.text = initialText;
      
      updateBuildStatusMessage(91, '5m 00s', mockSpinner);

      // RUNNING status should not change the text
      expect(mockSpinner.text).toBe(initialText);
    });

    it('should handle COMPLETING status', () => {
      updateBuildStatusMessage(92, '12m 10s', mockSpinner);

      expect(mockSpinner.text).toBe('blue(Build finishing... 🔜 (12m 10s))');
    });

    it('should handle unknown status', () => {
      updateBuildStatusMessage(999, '7m 25s', mockSpinner);

      expect(mockSpinner.text).toBe('gray(Build Status: 999 (7m 25s))');
    });

    it('should handle empty elapsed text', () => {
      updateBuildStatusMessage(0, '', mockSpinner);

      expect(mockSpinner.text).toBe('Build completed successfully ✅ ()');
    });

    it('should handle long elapsed text', () => {
      updateBuildStatusMessage(1, '1h 45m 30s', mockSpinner);

      expect(mockSpinner.text).toBe('red(Build failed ❌ (1h 45m 30s))');
    });
  });

  describe('downloadBuildArtifactsWithSpinner', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should download artifacts successfully', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        text: ''
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadArtifact = vi.fn().mockResolvedValue(undefined);
      const params = { branchId: 'branch-123', profileId: 'profile-123' };
      
      (path.resolve as any).mockReturnValue('/downloads/artifacts-1234567890.zip');
      (path.join as any).mockReturnValue('/downloads/artifacts-1234567890.zip');
      
      vi.spyOn(Date, 'now').mockReturnValue(1234567890);

      const promise = downloadBuildArtifactsWithSpinner('commit-123', 'build-123', params, '/downloads', mockDownloadArtifact);
      
      // Fast-forward through the 10 second delay
      vi.advanceTimersByTime(10000);
      await promise;

      expect(createOra).toHaveBeenCalledWith('Waiting for artifacts to be ready...');
      expect(mockSpinner.text).toBe('Downloading artifacts...');
      expect(mockDownloadArtifact).toHaveBeenCalledWith({
        commitId: 'commit-123',
        buildId: 'build-123',
        branchId: 'branch-123',
        profileId: 'profile-123'
      }, '/downloads', 'artifacts-1234567890.zip');
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        'Artifacts downloaded successfully: file:///downloads/artifacts-1234567890.zip'
      );
    });

    it('should handle download failure with failed build status', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        text: ''
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const downloadError = new Error('Download failed');
      const mockDownloadArtifact = vi.fn().mockRejectedValue(downloadError);
      const params = { branchId: 'branch-123', profileId: 'profile-123' };

      const promise = downloadBuildArtifactsWithSpinner('commit-123', 'build-123', params, '/downloads', mockDownloadArtifact, 1); // FAILED status
      
      vi.advanceTimersByTime(10000);
      await promise;

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download artifact since the build failed: Download failed');
    });

    it('should handle download failure without error message and unknown status', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        text: ''
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadArtifact = vi.fn().mockRejectedValue({ message: undefined });
      const params = { branchId: 'branch-123', profileId: 'profile-123' };

      const promise = downloadBuildArtifactsWithSpinner('commit-123', 'build-123', params, '/downloads', mockDownloadArtifact, null); // Unknown status
      
      vi.advanceTimersByTime(10000);
      await promise;

      expect(mockSpinner.fail).toHaveBeenCalledWith('No artifacts were found for this build.');
    });

    it('should generate unique artifact filename with timestamp', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        text: ''
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadArtifact = vi.fn().mockResolvedValue(undefined);
      const params = { branchId: 'branch-123', profileId: 'profile-123' };
      
      vi.spyOn(Date, 'now').mockReturnValue(9876543210);

      const promise = downloadBuildArtifactsWithSpinner('commit-123', 'build-123', params, '/downloads', mockDownloadArtifact);
      
      vi.advanceTimersByTime(10000);
      await promise;

      expect(mockDownloadArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          commitId: 'commit-123',
          buildId: 'build-123'
        }),
        '/downloads',
        'artifacts-9876543210.zip'
      );
    });
  });

  describe('downloadBuildLogsWithSpinner', () => {
    it('should download logs with valid commit and build ID', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadBuildLogs = vi.fn().mockResolvedValue(undefined);
      const params = { branchId: 'branch-123', profileId: 'profile-123' };
      const responseData = { queueItemId: 'queue-123' };

      await downloadBuildLogsWithSpinner('commit-123', 'build-123', params, '/downloads', mockDownloadBuildLogs, responseData);

      expect(createOra).toHaveBeenCalledWith('Downloading build logs...');
      expect(mockDownloadBuildLogs).toHaveBeenCalledWith({
        commitId: 'commit-123',
        buildId: 'build-123',
        branchId: 'branch-123',
        profileId: 'profile-123',
        path: '/downloads'
      });
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Build logs downloaded successfully');
    });

    it('should fallback to queue item ID when build ID is invalid', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadBuildLogs = vi.fn().mockResolvedValue(undefined);
      const params = {};
      const responseData = { queueItemId: 'queue-123' };

      await downloadBuildLogsWithSpinner('commit-123', '00000000-0000-0000-0000-000000000000', params, '/downloads', mockDownloadBuildLogs, responseData);

      expect(mockDownloadBuildLogs).toHaveBeenCalledWith('queue-123', { path: '/downloads' });
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Build logs downloaded successfully');
    });

    it('should handle download failure', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const downloadError = new Error('Download failed');
      const mockDownloadBuildLogs = vi.fn().mockRejectedValue(downloadError);
      const params = {};
      const responseData = { queueItemId: 'queue-123' };

      await downloadBuildLogsWithSpinner('commit-123', 'build-123', params, '/downloads', mockDownloadBuildLogs, responseData);

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Cannot download logs since the build failed')
      );
    });

    it('should handle empty commit ID', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadBuildLogs = vi.fn().mockResolvedValue(undefined);
      const params = {};
      const responseData = { queueItemId: 'queue-123' };

      await downloadBuildLogsWithSpinner('', 'build-123', params, '/downloads', mockDownloadBuildLogs, responseData);

      expect(mockDownloadBuildLogs).toHaveBeenCalledWith('queue-123', { path: '/downloads' });
    });

    it('should handle empty build ID', async () => {
      const mockSpinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn()
      };
      (createOra as any).mockReturnValue(mockSpinner);
      
      const mockDownloadBuildLogs = vi.fn().mockResolvedValue(undefined);
      const params = {};
      const responseData = { queueItemId: 'queue-123' };

      await downloadBuildLogsWithSpinner('commit-123', '', params, '/downloads', mockDownloadBuildLogs, responseData);

      expect(mockDownloadBuildLogs).toHaveBeenCalledWith('queue-123', { path: '/downloads' });
    });
  });
});
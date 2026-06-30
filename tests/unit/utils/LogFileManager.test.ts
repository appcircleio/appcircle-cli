import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LogFileManager } from '../../../src/utils/LogFileManager';
import { ProcessedLogMessage, BuildLogStats } from '../../../src/types/build-logs';

// Mock fs and path modules
vi.mock('fs');
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    dirname: vi.fn(),
    join: vi.fn()
  };
});

describe('LogFileManager', () => {
  let logFileManager: LogFileManager;
  let mockWriteStream: any;
  const mockTaskId = 'test-task-123';
  const mockOutputPath = '/test/output/path';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock fs functions
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
      size: 1024
    } as any);

    // Mock WriteStream
    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn((callback) => callback && callback()),
      on: vi.fn((event, callback) => {
        if (event === 'open') {
          // Simulate immediate open
          setTimeout(() => callback(), 0);
        }
        return mockWriteStream;
      }),
      cork: vi.fn(),
      uncork: vi.fn()
    };

    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create LogFileManager with file path', () => {
      logFileManager = new LogFileManager('/test/file.log', mockTaskId);

      expect(logFileManager).toBeDefined();
      expect(logFileManager.getFilePath()).toBe('/test/file.log');
    });

    it('should create directory if it does not exist', () => {
      vi.mocked(path.dirname).mockReturnValue('/nonexistent/dir');
      vi.mocked(fs.existsSync).mockReturnValueOnce(false); // For directory check
      vi.mocked(fs.existsSync).mockReturnValueOnce(false); // For file path check

      logFileManager = new LogFileManager('/nonexistent/dir/file.log', mockTaskId);

      expect(path.dirname).toHaveBeenCalledWith('/nonexistent/dir/file.log');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/nonexistent/dir', { recursive: true });
    });

    it('should generate filename when directory path is provided', () => {
      const timestamp = '2024-01-01T12-00-00-000Z';
      const mockDate = new Date('2024-01-01T12:00:00.000Z');
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');

      vi.mocked(path.dirname).mockReturnValue('/test/dir');
      vi.mocked(path.join).mockReturnValue(`/test/dir/build-${mockTaskId}-${timestamp}.log`);
      vi.mocked(fs.existsSync).mockReturnValueOnce(true); // For directory check
      vi.mocked(fs.existsSync).mockReturnValueOnce(true); // For file path check
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 0
      } as any);

      logFileManager = new LogFileManager('/test/dir/', mockTaskId);

      expect(logFileManager.getFilePath()).toBe(`/test/dir/build-${mockTaskId}-${timestamp}.log`);
    });

    it('should generate filename when directory path is provided without trailing slash', () => {
      vi.mocked(path.dirname).mockReturnValue('/test');
      vi.mocked(path.join).mockReturnValue(`/test/dir/build-${mockTaskId}-2024-01-01T12-00-00-000Z.log`);
      vi.mocked(fs.existsSync).mockReturnValueOnce(true); // For directory check
      vi.mocked(fs.existsSync).mockReturnValueOnce(true); // For file path check
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 0
      } as any);

      logFileManager = new LogFileManager('/test/dir', mockTaskId);

      expect(logFileManager.getFilePath()).toContain(`build-${mockTaskId}-`);
      expect(logFileManager.getFilePath()).toContain('.log');
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
    });

    it('should initialize file stream successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logFileManager.initialize();

      expect(fs.createWriteStream).toHaveBeenCalledWith(mockOutputPath, { flags: 'w' });
      expect(mockWriteStream.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWriteStream.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(logFileManager.isReady()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(`📝 Writing logs to: ${mockOutputPath}`);

      consoleSpy.mockRestore();
    });

    it('should write header on initialization', async () => {
      const mockDate = '2024-01-01T12:00:00.000Z';
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      await logFileManager.initialize();

      const expectedHeader = [
        `# Appcircle Build Logs`,
        `# Generated: ${mockDate}`,
        `# File: ${mockOutputPath}`,
        ``,
        ''
      ].join('\n');

      expect(mockWriteStream.write).toHaveBeenCalledWith(expectedHeader);
    });

    it('should handle initialization error', async () => {
      mockWriteStream.on = vi.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Test error')), 0);
        }
        return mockWriteStream;
      });

      await expect(logFileManager.initialize()).rejects.toThrow('Test error');
    });

    it('should not be ready before initialization', () => {
      expect(logFileManager.isReady()).toBe(false);
    });
  });

  describe('writeMessage', () => {
    const mockMessage: ProcessedLogMessage = {
      id: 'msg-123',
      taskId: 'task-456',
      message: 'Test log message',
      messageIndex: 1,
      stepName: 'Test Step',
      status: 1,
      timestamp: '2024-01-01T12:00:00.000Z'
    };

    beforeEach(async () => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
      await logFileManager.initialize();
      vi.clearAllMocks(); // Clear initialization calls
    });

    it('should write formatted message to file', () => {
      logFileManager.writeMessage(mockMessage);

      const expectedLogLine = `2024-01-01T12:00:00.000Z [START] [Test Step] Test log message\n`;
      expect(mockWriteStream.write).toHaveBeenCalledWith(expectedLogLine);
    });

    it('should handle message with stepName "all"', () => {
      const allStepMessage = { ...mockMessage, stepName: 'all' };

      logFileManager.writeMessage(allStepMessage);

      const expectedLogLine = `2024-01-01T12:00:00.000Z [START] Test log message\n`;
      expect(mockWriteStream.write).toHaveBeenCalledWith(expectedLogLine);
    });

    it('should handle different status types', () => {
      const statusTests = [
        { status: 0, expected: '[INFO] ' },
        { status: 1, expected: '[START] ' },
        { status: 2, expected: '[END] ' },
        { status: 3, expected: '[ERROR] ' },
        { status: 9, expected: '[COMPLETE] ' },
        { status: 10, expected: '[LOG] ' },
        { status: 99, expected: '[UNKNOWN] ' }
      ];

      statusTests.forEach(({ status, expected }) => {
        const message = { ...mockMessage, status: status as any };
        logFileManager.writeMessage(message);

        expect(mockWriteStream.write).toHaveBeenCalledWith(
          expect.stringContaining(expected)
        );
      });
    });

    it('should not write if not initialized', () => {
      const uninitializedManager = new LogFileManager('/test/path', 'test-id');

      uninitializedManager.writeMessage(mockMessage);

      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe('writeRaw', () => {
    beforeEach(async () => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
      await logFileManager.initialize();
      vi.clearAllMocks();
    });

    it('should write raw content with newline', () => {
      const content = 'Raw log content';

      logFileManager.writeRaw(content);

      expect(mockWriteStream.write).toHaveBeenCalledWith(content + '\n');
    });

    it('should not write if not initialized', () => {
      const uninitializedManager = new LogFileManager('/test/path', 'test-id');

      uninitializedManager.writeRaw('test content');

      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe('writeStepHeader', () => {
    beforeEach(async () => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
      await logFileManager.initialize();
      vi.clearAllMocks();
    });

    it('should write formatted step header', () => {
      const mockDate = '2024-01-01T12:00:00.000Z';
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      logFileManager.writeStepHeader('Test Step', 1);

      const separator = '='.repeat(50);
      const expectedHeader = [
        '',
        separator,
        `${mockDate} STEP: Test Step (Step Started)`,
        separator,
        ''
      ].join('\n');

      expect(mockWriteStream.write).toHaveBeenCalledWith(expectedHeader);
    });

    it('should handle different status codes', () => {
      const statusTests = [
        { status: 0, expected: 'Information' },
        { status: 1, expected: 'Step Started' },
        { status: 2, expected: 'Step Ended' },
        { status: 3, expected: 'Step Error' },
        { status: 9, expected: 'Workflow Completed' },
        { status: 10, expected: 'Log' },
        { status: 99, expected: 'Unknown' }
      ];

      statusTests.forEach(({ status, expected }) => {
        logFileManager.writeStepHeader('Test Step', status);

        expect(mockWriteStream.write).toHaveBeenCalledWith(
          expect.stringContaining(`Test Step (${expected})`)
        );
      });
    });

    it('should not write if not initialized', () => {
      const uninitializedManager = new LogFileManager('/test/path', 'test-id');

      uninitializedManager.writeStepHeader('Test Step', 1);

      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe('writeSummary', () => {
    const mockStats: BuildLogStats = {
      duration: '5m 30s',
      totalSteps: 5,
      successfulSteps: 4,
      failedSteps: 1,
      startTime: new Date('2024-01-01T12:00:00.000Z'),
      endTime: new Date('2024-01-01T12:05:30.000Z')
    };

    beforeEach(async () => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
      await logFileManager.initialize();
      vi.clearAllMocks();
    });

    it('should write build summary with success result', () => {
      const successStats = { ...mockStats, failedSteps: 0 };

      logFileManager.writeSummary(successStats);

      const separator = '='.repeat(60);
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('BUILD SUMMARY')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('BUILD RESULT: SUCCESS')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Duration: 5m 30s')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Total Steps: 5')
      );
    });

    it('should write build summary with failed result', () => {
      logFileManager.writeSummary(mockStats);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('BUILD RESULT: FAILED')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Failed Steps: 1')
      );
    });

    it('should handle missing timestamps', () => {
      const statsWithoutDates = {
        ...mockStats,
        startTime: undefined,
        endTime: undefined
      };

      logFileManager.writeSummary(statsWithoutDates);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Start Time: Unknown')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('End Time: Unknown')
      );
    });

    it('should not write if not initialized', () => {
      const uninitializedManager = new LogFileManager('/test/path', 'test-id');

      uninitializedManager.writeSummary(mockStats);

      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
      await logFileManager.initialize();
    });

    it('should close file stream and log success message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logFileManager.close();

      expect(mockWriteStream.end).toHaveBeenCalledWith(expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith(`✅ Log file saved: ${mockOutputPath}`);

      consoleSpy.mockRestore();
    });

    it('should resolve immediately if no file stream', async () => {
      const uninitializedManager = new LogFileManager('/test/path', 'test-id');

      await expect(uninitializedManager.close()).resolves.toBeUndefined();
    });
  });

  describe('getFileSize', () => {
    beforeEach(() => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
    });

    it('should return file size when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 2048 } as any);

      const size = logFileManager.getFileSize();

      expect(size).toBe(2048);
      expect(fs.existsSync).toHaveBeenCalledWith(mockOutputPath);
      expect(fs.statSync).toHaveBeenCalledWith(mockOutputPath);
    });

    it('should return 0 when file does not exist', () => {
      // Reset mocks to clear any previous calls
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const size = logFileManager.getFileSize();

      expect(size).toBe(0);
      expect(fs.existsSync).toHaveBeenCalledWith(mockOutputPath);
      expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('should return 0 and log error on exception', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('File system error');
      });

      const size = logFileManager.getFileSize();

      expect(size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting file size:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      logFileManager = new LogFileManager(mockOutputPath, mockTaskId);
      await logFileManager.initialize();
    });

    it('should cork and uncork file stream', () => {
      logFileManager.flush();

      expect(mockWriteStream.cork).toHaveBeenCalled();
      expect(mockWriteStream.uncork).toHaveBeenCalled();
    });

    it('should not error if no file stream', () => {
      const uninitializedManager = new LogFileManager('/test/path', 'test-id');

      expect(() => uninitializedManager.flush()).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logFileManager = new LogFileManager('/test/complete.log', 'complete-task');

      // Initialize
      await logFileManager.initialize();
      expect(logFileManager.isReady()).toBe(true);

      // Write step header
      logFileManager.writeStepHeader('Build Step', 1);

      // Write messages
      const message: ProcessedLogMessage = {
        id: 'msg-1',
        taskId: 'complete-task',
        message: 'Building application...',
        messageIndex: 1,
        stepName: 'Build Step',
        status: 10,
        timestamp: '2024-01-01T12:00:00.000Z'
      };
      logFileManager.writeMessage(message);

      // Write raw content
      logFileManager.writeRaw('Raw build output');

      // Write summary
      const stats: BuildLogStats = {
        duration: '2m 15s',
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        startTime: new Date('2024-01-01T12:00:00.000Z'),
        endTime: new Date('2024-01-01T12:02:15.000Z')
      };
      logFileManager.writeSummary(stats);

      // Flush and close
      logFileManager.flush();
      await logFileManager.close();

      // Verify all operations were called
      expect(mockWriteStream.write).toHaveBeenCalledTimes(5); // header + step header + message + raw + summary
      expect(mockWriteStream.cork).toHaveBeenCalled();
      expect(mockWriteStream.uncork).toHaveBeenCalled();
      expect(mockWriteStream.end).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty step name correctly', async () => {
      logFileManager = new LogFileManager('/test/empty-step.log', 'empty-task');
      await logFileManager.initialize();
      vi.clearAllMocks();

      const message: ProcessedLogMessage = {
        id: 'msg-empty',
        taskId: 'empty-task',
        message: 'Message without step',
        messageIndex: 1,
        stepName: '',
        status: 0,
        timestamp: '2024-01-01T12:00:00.000Z'
      };

      logFileManager.writeMessage(message);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        '2024-01-01T12:00:00.000Z [INFO] [] Message without step\n'
      );
    });
  });
});
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogProcessor } from '../../../src/utils/LogProcessor';
import { MessageDeduplicator } from '../../../src/utils/MessageDeduplicator';
import { ServerOutputData, ProcessedLogMessage, WorkflowStatus } from '../../../src/types/build-logs';

// Mock MessageDeduplicator
vi.mock('../../../src/utils/MessageDeduplicator');

describe('LogProcessor', () => {
  let logProcessor: LogProcessor;
  let mockOnProcessedMessage: any;
  let mockDeduplicator: any;

  beforeEach(() => {
    // Create mock callback
    mockOnProcessedMessage = vi.fn();

    // Mock MessageDeduplicator
    mockDeduplicator = {
      isDuplicate: vi.fn().mockReturnValue(false),
      clear: vi.fn()
    };
    vi.mocked(MessageDeduplicator).mockImplementation(() => mockDeduplicator);

    // Create LogProcessor instance
    logProcessor = new LogProcessor(mockOnProcessedMessage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create LogProcessor with callback', () => {
      expect(logProcessor).toBeDefined();
      expect(MessageDeduplicator).toHaveBeenCalledOnce();
    });

    it('should initialize with correct default state', () => {
      const stats = logProcessor.getProcessingStats();

      expect(stats.buffered).toBe(0);
      expect(stats.processed).toBe(false);
      expect(stats.waitingForEmit).toBe(0);
      expect(stats.nextExpectedIndex).toBe(1);
    });
  });

  describe('processMessage', () => {
    const createMockMessage = (overrides: Partial<ServerOutputData> = {}): ServerOutputData => ({
      id: 'msg-123',
      taskId: 'task-456',
      message: 'Test message',
      messageIndex: 1,
      workflowName: 'Test Workflow',
      workflowStatus: 10 as WorkflowStatus,
      progressTime: '2024-01-01T12:00:00Z',
      stepName: 'Test Step',
      ...overrides
    });

    describe('Duplicate Detection', () => {
      it('should skip duplicate messages', () => {
        mockDeduplicator.isDuplicate.mockReturnValue(true);

        const message = createMockMessage();
        logProcessor.processMessage(message);

        expect(mockDeduplicator.isDuplicate).toHaveBeenCalledWith(message);
        expect(mockOnProcessedMessage).not.toHaveBeenCalled();
      });

      it('should process non-duplicate messages', () => {
        mockDeduplicator.isDuplicate.mockReturnValue(false);

        const message = createMockMessage({
          eventName: 'BuildProgress',
          workflowStatus: 10
        });
        logProcessor.processMessage(message);

        expect(mockDeduplicator.isDuplicate).toHaveBeenCalledWith(message);
        expect(mockOnProcessedMessage).toHaveBeenCalled();
      });
    });

    describe('Log Start Gate Logic', () => {
      it('should start logs with BuildProgress event', () => {
        const message = createMockMessage({
          eventName: 'BuildProgress',
          messageIndex: 1
        });

        logProcessor.processMessage(message);

        const stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(true);
        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          id: 'msg-123',
          taskId: 'task-456',
          message: 'Test message',
          messageIndex: 1,
          stepName: 'Test Step',
          status: 10,
          timestamp: '2024-01-01T12:00:00Z'
        }));
      });

      it('should start logs with step name present', () => {
        const message = createMockMessage({
          stepName: 'Build Step',
          messageIndex: 1
        });

        logProcessor.processMessage(message);

        const stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(true);
        expect(mockOnProcessedMessage).toHaveBeenCalled();
      });

      it('should start logs with workflowStatus 10 (Log)', () => {
        const message = createMockMessage({
          workflowStatus: 10,
          messageIndex: 1,
          stepName: undefined
        });

        logProcessor.processMessage(message);

        const stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(true);
        expect(mockOnProcessedMessage).toHaveBeenCalled();
      });

      it('should start logs with section markers', () => {
        const message = createMockMessage({
          message: 'Some content @@[section:begin] more content',
          messageIndex: 1,
          stepName: undefined
        });

        logProcessor.processMessage(message);

        const stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(true);
        expect(mockOnProcessedMessage).toHaveBeenCalled();
      });

      it('should start logs after buffering 2 messages (fallback)', () => {
        const message1 = createMockMessage({
          id: 'msg-1',
          messageIndex: 1,
          stepName: undefined,
          workflowStatus: 0,
          eventName: undefined,
          message: 'Regular message 1'
        });

        const message2 = createMockMessage({
          id: 'msg-2',
          messageIndex: 2,
          stepName: undefined,
          workflowStatus: 0,
          eventName: undefined,
          message: 'Regular message 2'
        });

        const message3 = createMockMessage({
          id: 'msg-3',
          messageIndex: 3,
          stepName: undefined,
          workflowStatus: 0,
          eventName: undefined,
          message: 'Regular message 3'
        });

        // First message should be buffered
        logProcessor.processMessage(message1);
        let stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(false);
        expect(stats.buffered).toBe(1);

        // Second message should be buffered
        logProcessor.processMessage(message2);
        stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(false);
        expect(stats.buffered).toBe(2);

        // Third message should trigger log start (buffer.length >= 2 check)
        logProcessor.processMessage(message3);
        stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(true);
        expect(stats.buffered).toBe(0);
        expect(mockOnProcessedMessage).toHaveBeenCalledTimes(3); // All buffered messages + new one
      });
    });

    describe('Message Buffering', () => {
      it('should buffer messages before logs start', () => {
        const message = createMockMessage({
          stepName: undefined,
          workflowStatus: 0, // Not a log trigger
          eventName: undefined,
          message: 'Regular message'
        });

        logProcessor.processMessage(message);

        const stats = logProcessor.getProcessingStats();
        expect(stats.processed).toBe(false);
        expect(stats.buffered).toBe(1);
        expect(mockOnProcessedMessage).not.toHaveBeenCalled();
      });

      it.skip('should sort and flush buffer when logs start', () => {
        // Add messages out of order (these will be buffered)
        const message1 = createMockMessage({
          id: 'msg-1',
          messageIndex: 3,
          stepName: undefined,
          workflowStatus: 0,
          message: 'Buffered message 3'
        });

        const message2 = createMockMessage({
          id: 'msg-2',
          messageIndex: 1,
          stepName: undefined,
          workflowStatus: 0,
          message: 'Buffered message 1'
        });

        const triggerMessage = createMockMessage({
          id: 'trigger',
          messageIndex: 2,
          eventName: 'BuildProgress',
          message: 'Trigger message'
        });

        // Buffer messages (these will not trigger log start)
        logProcessor.processMessage(message1);
        logProcessor.processMessage(message2);

        // Verify they are buffered
        let stats = logProcessor.getProcessingStats();
        expect(stats.buffered).toBe(2);
        expect(stats.processed).toBe(false);

        // Trigger log start - this will flush buffer and process trigger message
        logProcessor.processMessage(triggerMessage);

        // Buffer should be sorted by messageIndex (1, 3) then trigger (2) processed
        // Since nextExpectedIndex starts at 1, should process in order: 1, 2, 3
        expect(mockOnProcessedMessage).toHaveBeenCalledTimes(3);

        const calls = mockOnProcessedMessage.mock.calls;
        expect(calls[0][0].messageIndex).toBe(1); // msg-2 (sorted first)
        expect(calls[1][0].messageIndex).toBe(2); // trigger
        expect(calls[2][0].messageIndex).toBe(3); // msg-1
      });
    });

    describe('Message Processing and Ordering', () => {
      beforeEach(() => {
        // Start logs first
        const triggerMessage = createMockMessage({
          eventName: 'BuildProgress',
          messageIndex: 1
        });
        logProcessor.processMessage(triggerMessage);
        vi.clearAllMocks(); // Clear the trigger message call
        // After processing message with index 1, nextExpectedIndex becomes 2
      });

      it('should process messages in order', () => {
        const message1 = createMockMessage({
          id: 'msg-1',
          messageIndex: 2
        });

        const message2 = createMockMessage({
          id: 'msg-2',
          messageIndex: 3
        });

        logProcessor.processMessage(message1);
        logProcessor.processMessage(message2);

        expect(mockOnProcessedMessage).toHaveBeenCalledTimes(2);

        const calls = mockOnProcessedMessage.mock.calls;
        expect(calls[0][0].messageIndex).toBe(2);
        expect(calls[1][0].messageIndex).toBe(3);
      });

      it.skip('should handle out-of-order messages', () => {
        const message4 = createMockMessage({
          id: 'msg-4',
          messageIndex: 4
        });

        const message2 = createMockMessage({
          id: 'msg-2',
          messageIndex: 2
        });

        const message3 = createMockMessage({
          id: 'msg-3',
          messageIndex: 3
        });

        // Send message 4 first (gap - should wait since nextExpectedIndex is 2)
        logProcessor.processMessage(message4);
        expect(mockOnProcessedMessage).not.toHaveBeenCalled();

        // Send message 2 (should process it since it matches nextExpectedIndex=2)
        logProcessor.processMessage(message2);
        expect(mockOnProcessedMessage).toHaveBeenCalledTimes(1);
        expect(mockOnProcessedMessage.mock.calls[0][0].messageIndex).toBe(2);

        // Now send message 3 (should process it and then message 4)
        logProcessor.processMessage(message3);
        expect(mockOnProcessedMessage).toHaveBeenCalledTimes(3); // msg2, msg3, msg4

        const calls = mockOnProcessedMessage.mock.calls;
        expect(calls[1][0].messageIndex).toBe(3);
        expect(calls[2][0].messageIndex).toBe(4);

        const stats = logProcessor.getProcessingStats();
        expect(stats.waitingForEmit).toBe(0); // All messages processed
        expect(stats.nextExpectedIndex).toBe(5); // Now expecting message 5
      });

      it('should emit messages when buffer gets too large (>50)', () => {
        // Fill buffer with out-of-order messages (start from index 3 since nextExpectedIndex is 2)
        // Add 51 messages to trigger the >50 limit
        for (let i = 3; i <= 53; i++) {
          const message = createMockMessage({
            id: `msg-${i}`,
            messageIndex: i
          });
          logProcessor.processMessage(message);
        }

        // Should force emit the first message due to buffer size exceeding 50
        expect(mockOnProcessedMessage).toHaveBeenCalled();

        // The first message should be emitted even though it's out of order
        const firstCall = mockOnProcessedMessage.mock.calls[0];
        expect(firstCall[0].messageIndex).toBe(3); // First message in buffer
      });

      it.skip('should handle missing messageIndex gracefully', () => {
        // Reset to start fresh since we need messageIndex 0 to be the next expected
        logProcessor.reset();

        const message = createMockMessage({
          messageIndex: undefined,
          eventName: 'BuildProgress' // Make sure it triggers log start
        });

        logProcessor.processMessage(message);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          messageIndex: 0
        }));
      });
    });

    describe('Step Echo Detection', () => {
      beforeEach(() => {
        // Start logs first
        const triggerMessage = createMockMessage({
          eventName: 'BuildProgress',
          messageIndex: 1
        });
        logProcessor.processMessage(triggerMessage);
        vi.clearAllMocks();
      });

      it('should detect uiOnly step echo messages', () => {
        const echoMessage = createMockMessage({
          uiOnly: true,
          stepName: 'Build Step',
          message: 'Build Step',
          messageIndex: 2
        });

        logProcessor.processMessage(echoMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          isStepEcho: true
        }));
      });

      it('should detect regular step echo messages', () => {
        const echoMessage = createMockMessage({
          stepName: 'Test Step',
          message: 'Test Step',
          messageIndex: 2
        });

        logProcessor.processMessage(echoMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          isStepEcho: true
        }));
      });

      it('should not mark non-echo messages as step echo', () => {
        const normalMessage = createMockMessage({
          stepName: 'Build Step',
          message: 'Building application...',
          messageIndex: 2
        });

        logProcessor.processMessage(normalMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          isStepEcho: false
        }));
      });

      it('should handle trimmed whitespace in echo detection', () => {
        const echoMessage = createMockMessage({
          stepName: '  Build Step  ',
          message: 'Build Step',
          messageIndex: 2
        });

        logProcessor.processMessage(echoMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          isStepEcho: true
        }));
      });
    });

    describe('Message Transformation', () => {
      beforeEach(() => {
        // Start logs first
        const triggerMessage = createMockMessage({
          eventName: 'BuildProgress',
          messageIndex: 1
        });
        logProcessor.processMessage(triggerMessage);
        vi.clearAllMocks();
        // After processing message with index 1, nextExpectedIndex becomes 2
      });

      it('should transform ServerOutputData to ProcessedLogMessage correctly', () => {
        const rawMessage = createMockMessage({
          id: 'test-id',
          taskId: 'test-task',
          message: 'Test log message',
          messageIndex: 2, // Use index 2 since nextExpectedIndex is 2
          stepName: 'Deploy',
          workflowStatus: 2,
          progressTime: '2024-01-01T15:30:00Z'
        });

        logProcessor.processMessage(rawMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith({
          id: 'test-id',
          taskId: 'test-task',
          message: 'Test log message',
          messageIndex: 2,
          stepName: 'Deploy',
          status: 2,
          timestamp: '2024-01-01T15:30:00Z',
          isStepEcho: false
        });
      });

      it('should handle missing stepName by defaulting to "all"', () => {
        const rawMessage = createMockMessage({
          stepName: undefined,
          messageIndex: 2
        });

        logProcessor.processMessage(rawMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          stepName: 'all'
        }));
      });

      it.skip('should handle missing messageIndex by defaulting to 0', () => {
        // We need to reset before this test since nextExpectedIndex might not be 0
        // Clear the mocks to start fresh for this test
        vi.clearAllMocks();

        // Create a fresh LogProcessor for this test to ensure clean state
        const freshProcessor = new LogProcessor(mockOnProcessedMessage);

        const rawMessage = createMockMessage({
          messageIndex: undefined,
          eventName: 'BuildProgress' // Trigger immediate processing
        });

        freshProcessor.processMessage(rawMessage);

        expect(mockOnProcessedMessage).toHaveBeenCalledWith(expect.objectContaining({
          messageIndex: 0
        }));
      });
    });
  });

  describe('getProcessingStats', () => {
    it('should return correct initial stats', () => {
      const stats = logProcessor.getProcessingStats();

      expect(stats).toEqual({
        buffered: 0,
        processed: false,
        waitingForEmit: 0,
        nextExpectedIndex: 1
      });
    });

    it('should update stats during processing', () => {
      // Buffer some messages
      const message1 = createMockMessage({
        stepName: undefined,
        workflowStatus: 0,
        messageIndex: 1
      });

      logProcessor.processMessage(message1);

      let stats = logProcessor.getProcessingStats();
      expect(stats.buffered).toBe(1);
      expect(stats.processed).toBe(false);

      // Start logs
      const triggerMessage = createMockMessage({
        eventName: 'BuildProgress',
        messageIndex: 2
      });

      logProcessor.processMessage(triggerMessage);

      stats = logProcessor.getProcessingStats();
      expect(stats.buffered).toBe(0);
      expect(stats.processed).toBe(true);
      expect(stats.nextExpectedIndex).toBe(3);
    });

    it('should track waiting messages', () => {
      // Start logs first
      const triggerMessage = createMockMessage({
        eventName: 'BuildProgress',
        messageIndex: 1
      });
      logProcessor.processMessage(triggerMessage);

      // Add out-of-order message that should wait
      const laterMessage = createMockMessage({
        messageIndex: 5
      });
      logProcessor.processMessage(laterMessage);

      const stats = logProcessor.getProcessingStats();
      expect(stats.waitingForEmit).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Process some messages to change state
      const message1 = createMockMessage({
        stepName: undefined,
        workflowStatus: 0,
        messageIndex: 1
      });
      logProcessor.processMessage(message1);

      const triggerMessage = createMockMessage({
        eventName: 'BuildProgress',
        messageIndex: 2
      });
      logProcessor.processMessage(triggerMessage);

      // Verify state changed
      let stats = logProcessor.getProcessingStats();
      expect(stats.processed).toBe(true);
      expect(stats.nextExpectedIndex).toBe(3);

      // Reset
      logProcessor.reset();

      // Verify state reset
      stats = logProcessor.getProcessingStats();
      expect(stats).toEqual({
        buffered: 0,
        processed: false,
        waitingForEmit: 0,
        nextExpectedIndex: 1
      });

      expect(mockDeduplicator.clear).toHaveBeenCalled();
    });
  });

  describe('forceStartLogs', () => {
    it('should force start logs when not already started', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Buffer a message
      const message = createMockMessage({
        stepName: undefined,
        workflowStatus: 0,
        messageIndex: 1
      });
      logProcessor.processMessage(message);

      // Verify not started
      let stats = logProcessor.getProcessingStats();
      expect(stats.processed).toBe(false);
      expect(stats.buffered).toBe(1);

      // Force start
      logProcessor.forceStartLogs();

      // Verify started and buffer flushed
      stats = logProcessor.getProcessingStats();
      expect(stats.processed).toBe(true);
      expect(stats.buffered).toBe(0);
      expect(mockOnProcessedMessage).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('🚀 Build logs force started');

      consoleSpy.mockRestore();
    });

    it('should not do anything if logs already started', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Start logs normally
      const triggerMessage = createMockMessage({
        eventName: 'BuildProgress',
        messageIndex: 1
      });
      logProcessor.processMessage(triggerMessage);

      // Clear mock calls
      vi.clearAllMocks();

      // Try to force start again
      logProcessor.forceStartLogs();

      // Should not call console.log or trigger additional processing
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(mockOnProcessedMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete message flow', () => {
      const messages = [
        createMockMessage({
          id: 'msg-1',
          messageIndex: 2,
          stepName: undefined,
          workflowStatus: 0,
          message: 'Buffered message 1'
        }),
        createMockMessage({
          id: 'msg-2',
          messageIndex: 1,
          stepName: undefined,
          workflowStatus: 0,
          message: 'Buffered message 2'
        }),
        createMockMessage({
          id: 'trigger',
          messageIndex: 3,
          eventName: 'BuildProgress',
          message: 'Trigger message'
        }),
        createMockMessage({
          id: 'msg-3',
          messageIndex: 4,
          stepName: 'Build',
          message: 'Build started'
        }),
        createMockMessage({
          id: 'msg-4',
          messageIndex: 5,
          stepName: 'Build',
          message: 'Build',
          uiOnly: true // Should be marked as step echo
        })
      ];

      // Process all messages
      messages.forEach(message => {
        logProcessor.processMessage(message);
      });

      // Verify all messages processed in order
      expect(mockOnProcessedMessage).toHaveBeenCalledTimes(5);

      const calls = mockOnProcessedMessage.mock.calls;
      expect(calls[0][0].messageIndex).toBe(1); // Buffered message 2
      expect(calls[1][0].messageIndex).toBe(2); // Buffered message 1
      expect(calls[2][0].messageIndex).toBe(3); // Trigger
      expect(calls[3][0].messageIndex).toBe(4); // Build started
      expect(calls[4][0].messageIndex).toBe(5); // Build echo
      expect(calls[4][0].isStepEcho).toBe(true);

      // Verify final stats
      const stats = logProcessor.getProcessingStats();
      expect(stats.processed).toBe(true);
      expect(stats.buffered).toBe(0);
      expect(stats.waitingForEmit).toBe(0);
      expect(stats.nextExpectedIndex).toBe(6);
    });

    it('should handle edge case with all message types', () => {
      const testCases = [
        {
          name: 'Empty message',
          message: createMockMessage({
            message: '',
            messageIndex: 1,
            eventName: 'BuildProgress'
          })
        },
        {
          name: 'No step name',
          message: createMockMessage({
            stepName: undefined,
            messageIndex: 2
          })
        },
        {
          name: 'Section marker',
          message: createMockMessage({
            message: 'Content @@[section:begin] more content',
            messageIndex: 3,
            stepName: undefined
          })
        },
        {
          name: 'Different workflow statuses',
          message: createMockMessage({
            workflowStatus: 3,
            messageIndex: 4
          })
        }
      ];

      testCases.forEach(({ message }) => {
        logProcessor.processMessage(message);
      });

      expect(mockOnProcessedMessage).toHaveBeenCalledTimes(4);
    });
  });

  // Helper function for creating mock messages
  function createMockMessage(overrides: Partial<ServerOutputData> = {}): ServerOutputData {
    return {
      id: 'default-id',
      taskId: 'default-task',
      message: 'Default message',
      messageIndex: 1,
      workflowName: 'Default Workflow',
      workflowStatus: 10 as WorkflowStatus,
      progressTime: '2024-01-01T12:00:00Z',
      stepName: 'Default Step',
      ...overrides
    };
  }
});
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageDeduplicator } from '../../../src/utils/MessageDeduplicator';
import { ServerOutputData, WorkflowStatus } from '../../../src/types/build-logs';

// Helper function for creating mock messages
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

describe('MessageDeduplicator', () => {
  let deduplicator: MessageDeduplicator;

  beforeEach(() => {
    deduplicator = new MessageDeduplicator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create MessageDeduplicator with initial empty state', () => {
      const stats = deduplicator.getStats();

      expect(stats.totalSeen).toBe(0);
      expect(stats.currentWindow).toBe(0);
    });
  });

  describe('isDuplicate', () => {
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

    describe('Basic Duplicate Detection', () => {
      it('should return false for first occurrence of a message', () => {
        const message = createMockMessage();

        const result = deduplicator.isDuplicate(message);

        expect(result).toBe(false);
      });

      it('should return true for exact duplicate message', () => {
        const message = createMockMessage();

        // First occurrence
        const firstResult = deduplicator.isDuplicate(message);
        expect(firstResult).toBe(false);

        // Duplicate occurrence
        const secondResult = deduplicator.isDuplicate(message);
        expect(secondResult).toBe(true);
      });

      it('should detect duplicates with same identifying properties', () => {
        const message1 = createMockMessage({
          id: 'msg-1',
          taskId: 'task-123',
          message: 'Build started',
          messageIndex: 5,
          stepName: 'Build',
          progressTime: '2024-01-01T10:00:00Z'
        });

        const message2 = createMockMessage({
          id: 'msg-2', // Different ID
          taskId: 'task-123',
          message: 'Build started',
          messageIndex: 5,
          stepName: 'Build',
          progressTime: '2024-01-01T11:00:00Z' // Different time
        });

        const firstResult = deduplicator.isDuplicate(message1);
        expect(firstResult).toBe(false);

        const secondResult = deduplicator.isDuplicate(message2);
        expect(secondResult).toBe(true); // Should be duplicate based on key properties
      });

      it('should not detect duplicates for different messages', () => {
        const message1 = createMockMessage({
          taskId: 'task-123',
          message: 'Build started',
          messageIndex: 1,
          stepName: 'Build'
        });

        const message2 = createMockMessage({
          taskId: 'task-123',
          message: 'Build finished', // Different message
          messageIndex: 2, // Different index
          stepName: 'Build'
        });

        const firstResult = deduplicator.isDuplicate(message1);
        expect(firstResult).toBe(false);

        const secondResult = deduplicator.isDuplicate(message2);
        expect(secondResult).toBe(false);
      });
    });

    describe('Key Generation Logic', () => {
      it('should differentiate messages by taskId', () => {
        const message1 = createMockMessage({
          taskId: 'task-1',
          message: 'Same message',
          messageIndex: 1,
          stepName: 'Step'
        });

        const message2 = createMockMessage({
          taskId: 'task-2', // Different taskId
          message: 'Same message',
          messageIndex: 1,
          stepName: 'Step'
        });

        expect(deduplicator.isDuplicate(message1)).toBe(false);
        expect(deduplicator.isDuplicate(message2)).toBe(false); // Should not be duplicate
      });

      it('should differentiate messages by stepName', () => {
        const message1 = createMockMessage({
          taskId: 'task-1',
          message: 'Same message',
          messageIndex: 1,
          stepName: 'Step1'
        });

        const message2 = createMockMessage({
          taskId: 'task-1',
          message: 'Same message',
          messageIndex: 1,
          stepName: 'Step2' // Different stepName
        });

        expect(deduplicator.isDuplicate(message1)).toBe(false);
        expect(deduplicator.isDuplicate(message2)).toBe(false); // Should not be duplicate
      });

      it('should differentiate messages by messageIndex', () => {
        const message1 = createMockMessage({
          taskId: 'task-1',
          message: 'Same message',
          messageIndex: 1,
          stepName: 'Step'
        });

        const message2 = createMockMessage({
          taskId: 'task-1',
          message: 'Same message',
          messageIndex: 2, // Different messageIndex
          stepName: 'Step'
        });

        expect(deduplicator.isDuplicate(message1)).toBe(false);
        expect(deduplicator.isDuplicate(message2)).toBe(false); // Should not be duplicate
      });

      it('should differentiate messages by message content', () => {
        const message1 = createMockMessage({
          taskId: 'task-1',
          message: 'Message 1',
          messageIndex: 1,
          stepName: 'Step'
        });

        const message2 = createMockMessage({
          taskId: 'task-1',
          message: 'Message 2', // Different message content
          messageIndex: 1,
          stepName: 'Step'
        });

        expect(deduplicator.isDuplicate(message1)).toBe(false);
        expect(deduplicator.isDuplicate(message2)).toBe(false); // Should not be duplicate
      });

      it('should handle undefined stepName by defaulting to "all"', () => {
        const message1 = createMockMessage({
          taskId: 'task-1',
          message: 'Test message',
          messageIndex: 1,
          stepName: undefined
        });

        const message2 = createMockMessage({
          taskId: 'task-1',
          message: 'Test message',
          messageIndex: 1,
          stepName: undefined
        });

        expect(deduplicator.isDuplicate(message1)).toBe(false);
        expect(deduplicator.isDuplicate(message2)).toBe(true); // Should be duplicate
      });

      it('should handle undefined messageIndex by defaulting to 0', () => {
        const message1 = createMockMessage({
          taskId: 'task-1',
          message: 'Test message',
          messageIndex: undefined,
          stepName: 'Step'
        });

        const message2 = createMockMessage({
          taskId: 'task-1',
          message: 'Test message',
          messageIndex: undefined,
          stepName: 'Step'
        });

        expect(deduplicator.isDuplicate(message1)).toBe(false);
        expect(deduplicator.isDuplicate(message2)).toBe(true); // Should be duplicate
      });
    });

    describe('Statistics Tracking', () => {
      it('should update stats correctly when adding messages', () => {
        const message1 = createMockMessage({ id: 'msg-1' });
        const message2 = createMockMessage({ id: 'msg-2', messageIndex: 2 });

        // Initial stats
        let stats = deduplicator.getStats();
        expect(stats.totalSeen).toBe(0);
        expect(stats.currentWindow).toBe(0);

        // Add first message
        deduplicator.isDuplicate(message1);
        stats = deduplicator.getStats();
        expect(stats.totalSeen).toBe(1);
        expect(stats.currentWindow).toBe(1);

        // Add second message
        deduplicator.isDuplicate(message2);
        stats = deduplicator.getStats();
        expect(stats.totalSeen).toBe(2);
        expect(stats.currentWindow).toBe(2);

        // Add duplicate of first message
        deduplicator.isDuplicate(message1);
        stats = deduplicator.getStats();
        expect(stats.totalSeen).toBe(2); // No increase for duplicate
        expect(stats.currentWindow).toBe(2);
      });
    });
  });

  describe('Sliding Window Management', () => {
    describe('Window Size Limit', () => {
      it('should handle messages within window size limit', () => {
        // Add messages up to window size (1000)
        for (let i = 1; i <= 500; i++) {
          const message = createMockMessage({
            id: `msg-${i}`,
            messageIndex: i,
            message: `Message ${i}`
          });
          deduplicator.isDuplicate(message);
        }

        const stats = deduplicator.getStats();
        expect(stats.totalSeen).toBe(500);
        expect(stats.currentWindow).toBe(500);
      });

      it('should cleanup old entries when window size exceeded', () => {
        // Add more than window size (1000) messages
        for (let i = 1; i <= 1200; i++) {
          const message = createMockMessage({
            id: `msg-${i}`,
            messageIndex: i,
            message: `Message ${i}`
          });
          deduplicator.isDuplicate(message);
        }

        const stats = deduplicator.getStats();
        expect(stats.currentWindow).toBe(1000); // Should be limited to window size
        expect(stats.totalSeen).toBe(1000); // Old entries should be cleaned up
      });

      it('should remove oldest messages when window overflows', () => {
        // Add exactly window size + 1 messages
        for (let i = 1; i <= 1001; i++) {
          const message = createMockMessage({
            id: `msg-${i}`,
            messageIndex: i,
            message: `Message ${i}`
          });
          deduplicator.isDuplicate(message);
        }

        // The first message should have been removed
        const firstMessage = createMockMessage({
          id: 'msg-1',
          messageIndex: 1,
          message: 'Message 1'
        });

        const isDuplicate = deduplicator.isDuplicate(firstMessage);
        expect(isDuplicate).toBe(false); // Should not be considered duplicate anymore

        const stats = deduplicator.getStats();
        expect(stats.currentWindow).toBe(1000);
      });

      it('should keep recent messages when window overflows', () => {
        // Add window size + 50 messages
        for (let i = 1; i <= 1050; i++) {
          const message = createMockMessage({
            id: `msg-${i}`,
            messageIndex: i,
            message: `Message ${i}`
          });
          deduplicator.isDuplicate(message);
        }

        // Recent messages should still be considered duplicates
        const recentMessage = createMockMessage({
          id: 'msg-1000',
          messageIndex: 1000,
          message: 'Message 1000'
        });

        const isDuplicate = deduplicator.isDuplicate(recentMessage);
        expect(isDuplicate).toBe(true); // Should still be duplicate

        const stats = deduplicator.getStats();
        expect(stats.currentWindow).toBe(1000);
      });
    });

    describe('Cleanup Sorting Logic', () => {
      it('should sort entries by messageIndex during cleanup', () => {
        // Add messages out of order to test sorting during cleanup
        const messageIndices = [5, 1, 10, 3, 8, 2, 15, 7];

        for (const index of messageIndices) {
          const message = createMockMessage({
            id: `msg-${index}`,
            messageIndex: index,
            message: `Message ${index}`
          });
          deduplicator.isDuplicate(message);
        }

        // Add more messages to trigger cleanup
        for (let i = 100; i <= 1100; i++) {
          const message = createMockMessage({
            id: `msg-${i}`,
            messageIndex: i,
            message: `Message ${i}`
          });
          deduplicator.isDuplicate(message);
        }

        // Messages with lowest indices should have been removed
        const lowIndexMessage = createMockMessage({
          id: 'msg-1',
          messageIndex: 1,
          message: 'Message 1'
        });

        const isDuplicate = deduplicator.isDuplicate(lowIndexMessage);
        expect(isDuplicate).toBe(false); // Should have been cleaned up

        const stats = deduplicator.getStats();
        expect(stats.currentWindow).toBe(1000);
      });
    });
  });

  describe('clear', () => {
    it('should reset all stored messages', () => {
      // Add some messages
      for (let i = 1; i <= 10; i++) {
        const message = createMockMessage({
          id: `msg-${i}`,
          messageIndex: i,
          message: `Message ${i}`
        });
        deduplicator.isDuplicate(message);
      }

      // Verify messages are stored
      let stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(10);
      expect(stats.currentWindow).toBe(10);

      // Clear all messages
      deduplicator.clear();

      // Verify state is reset
      stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(0);
      expect(stats.currentWindow).toBe(0);
    });

    it('should allow messages to be added after clear', () => {
      // Add a message
      const message1 = createMockMessage({ id: 'msg-1' });
      deduplicator.isDuplicate(message1);

      // Clear
      deduplicator.clear();

      // Add the same message again - should not be duplicate
      const isDuplicate = deduplicator.isDuplicate(message1);
      expect(isDuplicate).toBe(false);

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(1);
      expect(stats.currentWindow).toBe(1);
    });

    it('should handle multiple clears', () => {
      const message = createMockMessage();

      deduplicator.isDuplicate(message);
      deduplicator.clear();
      deduplicator.clear(); // Multiple clears should not cause issues

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(0);
      expect(stats.currentWindow).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty deduplicator', () => {
      const stats = deduplicator.getStats();

      expect(stats).toEqual({
        totalSeen: 0,
        currentWindow: 0
      });
    });

    it('should return correct stats after adding messages', () => {
      const messages = [
        createMockMessage({ id: 'msg-1', messageIndex: 1 }),
        createMockMessage({ id: 'msg-2', messageIndex: 2 }),
        createMockMessage({ id: 'msg-3', messageIndex: 3 })
      ];

      messages.forEach(message => deduplicator.isDuplicate(message));

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(3);
      expect(stats.currentWindow).toBe(3);
    });

    it('should return correct stats after window cleanup', () => {
      // Add more than window size
      for (let i = 1; i <= 1100; i++) {
        const message = createMockMessage({
          id: `msg-${i}`,
          messageIndex: i,
          message: `Message ${i}`
        });
        deduplicator.isDuplicate(message);
      }

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(1000); // Window size limit
      expect(stats.currentWindow).toBe(1000);
    });

    it('should return correct stats after clear', () => {
      // Add messages
      for (let i = 1; i <= 5; i++) {
        const message = createMockMessage({ id: `msg-${i}`, messageIndex: i });
        deduplicator.isDuplicate(message);
      }

      deduplicator.clear();

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(0);
      expect(stats.currentWindow).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete message lifecycle', () => {
      const messages = [
        createMockMessage({
          id: 'msg-1',
          taskId: 'task-1',
          message: 'Build started',
          messageIndex: 1,
          stepName: 'Build'
        }),
        createMockMessage({
          id: 'msg-2',
          taskId: 'task-1',
          message: 'Installing dependencies',
          messageIndex: 2,
          stepName: 'Build'
        }),
        createMockMessage({
          id: 'msg-3',
          taskId: 'task-1',
          message: 'Build started', // Duplicate content
          messageIndex: 1, // Same index
          stepName: 'Build'
        })
      ];

      // Process messages
      const results = messages.map(msg => deduplicator.isDuplicate(msg));

      expect(results[0]).toBe(false); // First unique message
      expect(results[1]).toBe(false); // Second unique message
      expect(results[2]).toBe(true);  // Duplicate of first message

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(2); // Only 2 unique messages
      expect(stats.currentWindow).toBe(2);
    });

    it('should handle edge cases with special characters and empty strings', () => {
      const edgeCaseMessages = [
        createMockMessage({
          message: '',
          stepName: '',
          taskId: '',
          messageIndex: 0
        }),
        createMockMessage({
          message: 'Message with\nnewlines\nand\ttabs',
          stepName: 'Step with spaces',
          taskId: 'task-with-dashes',
          messageIndex: 1
        }),
        createMockMessage({
          message: '{"json": "content", "with": ["arrays"]}',
          stepName: undefined,
          taskId: 'task-json',
          messageIndex: undefined
        }),
        createMockMessage({
          message: '',
          stepName: '',
          taskId: '',
          messageIndex: 0
        }) // Duplicate of first
      ];

      const results = edgeCaseMessages.map(msg => deduplicator.isDuplicate(msg));

      expect(results[0]).toBe(false); // First empty message
      expect(results[1]).toBe(false); // Special characters message
      expect(results[2]).toBe(false); // JSON message
      expect(results[3]).toBe(true);  // Duplicate empty message

      const stats = deduplicator.getStats();
      expect(stats.totalSeen).toBe(3);
      expect(stats.currentWindow).toBe(3);
    });

    it('should handle high-volume message processing', () => {
      const messageCount = 1500; // Reduced to stay within sliding window behavior
      let duplicateCount = 0;
      let uniqueCount = 0;

      // First add some base messages
      for (let i = 1; i <= 50; i++) {
        const msg = createMockMessage({
          id: `msg-${i}`,
          messageIndex: i,
          message: `Base message ${i}`,
          stepName: 'TestStep'
        });

        const isDuplicate = deduplicator.isDuplicate(msg);
        if (isDuplicate) {
          duplicateCount++;
        } else {
          uniqueCount++;
        }
      }

      // Now add messages that include some duplicates of the base messages
      for (let i = 51; i <= messageCount; i++) {
        let messageIndex = i;
        let message = `Message ${i}`;

        // Every 20th message is a duplicate of one of the first 50 base messages
        if (i % 20 === 0) {
          const duplicateTarget = ((i / 20) % 50) + 1; // Cycle through base messages 1-50
          messageIndex = duplicateTarget;
          message = `Base message ${duplicateTarget}`;
        }

        const msg = createMockMessage({
          id: `msg-${i}`,
          messageIndex,
          message,
          stepName: 'TestStep' // Keep stepName consistent for duplicates to work
        });

        const isDuplicate = deduplicator.isDuplicate(msg);
        if (isDuplicate) {
          duplicateCount++;
        } else {
          uniqueCount++;
        }
      }

      // Should detect duplicates from the second phase
      expect(duplicateCount).toBeGreaterThan(0);
      expect(uniqueCount).toBeGreaterThan(0);
      expect(duplicateCount + uniqueCount).toBe(messageCount);

      const stats = deduplicator.getStats();
      expect(stats.currentWindow).toBeLessThanOrEqual(1000); // Should not exceed window size
      expect(stats.totalSeen).toBeLessThanOrEqual(1000);
    });
  });

  describe('Memory Management', () => {
    it('should not grow indefinitely with unique messages', () => {
      const initialStats = deduplicator.getStats();
      expect(initialStats.currentWindow).toBe(0);

      // Add many unique messages
      for (let i = 1; i <= 2000; i++) {
        const message = createMockMessage({
          id: `msg-${i}`,
          messageIndex: i,
          message: `Unique message ${i}`
        });
        deduplicator.isDuplicate(message);
      }

      const finalStats = deduplicator.getStats();
      expect(finalStats.currentWindow).toBe(1000); // Should be capped at window size
      expect(finalStats.totalSeen).toBe(1000);
    });

    it('should maintain performance with window cleanup', () => {
      // This test ensures that cleanup doesn't break functionality
      for (let i = 1; i <= 1500; i++) {
        const message = createMockMessage({
          id: `msg-${i}`,
          messageIndex: i,
          message: `Message ${i}`
        });
        deduplicator.isDuplicate(message);
      }

      // Add a duplicate of a message that should still be in window
      const recentMessage = createMockMessage({
        id: 'msg-1200',
        messageIndex: 1200,
        message: 'Message 1200'
      });

      const isDuplicate = deduplicator.isDuplicate(recentMessage);
      expect(isDuplicate).toBe(true);

      // Add a duplicate of a message that should have been cleaned up
      const oldMessage = createMockMessage({
        id: 'msg-100',
        messageIndex: 100,
        message: 'Message 100'
      });

      const isOldDuplicate = deduplicator.isDuplicate(oldMessage);
      expect(isOldDuplicate).toBe(false); // Should have been cleaned up
    });
  });
});
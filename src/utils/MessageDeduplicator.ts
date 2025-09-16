/**
 * MessageDeduplicator
 * Handles duplicate detection for build log messages using a sliding window approach
 */

import { ServerOutputData } from '../types/build-logs';

export class MessageDeduplicator {
  private seenMessages = new Set<string>();
  private slidingWindow = new Map<string, number>();
  private readonly windowSize = 1000; // Keep track of last 1000 messages

  /**
   * Check if a message is a duplicate
   */
  isDuplicate(message: ServerOutputData): boolean {
    const key = this.generateKey(message);
    
    if (this.seenMessages.has(key)) {
      return true;
    }

    this.addToWindow(key, message.messageIndex || 0);
    return false;
  }

  /**
   * Generate a unique key for a message based on its identifying properties
   */
  private generateKey(message: ServerOutputData): string {
    return `${message.taskId}:${message.stepName || 'all'}:${message.messageIndex || 0}:${message.message}`;
  }

  /**
   * Add a message to the sliding window and clean up old entries
   */
  private addToWindow(key: string, messageIndex: number): void {
    this.seenMessages.add(key);
    this.slidingWindow.set(key, messageIndex);

    // Clean up old entries if window size exceeded
    if (this.slidingWindow.size > this.windowSize) {
      const entries = Array.from(this.slidingWindow.entries());
      entries.sort((a, b) => a[1] - b[1]); // Sort by messageIndex
      
      const toRemove = entries.slice(0, entries.length - this.windowSize);
      toRemove.forEach(([key]) => {
        this.seenMessages.delete(key);
        this.slidingWindow.delete(key);
      });
    }
  }

  /**
   * Clear all stored messages (useful for testing or reset)
   */
  clear(): void {
    this.seenMessages.clear();
    this.slidingWindow.clear();
  }

  /**
   * Get current window statistics
   */
  getStats(): { totalSeen: number; currentWindow: number } {
    return {
      totalSeen: this.seenMessages.size,
      currentWindow: this.slidingWindow.size
    };
  }
}

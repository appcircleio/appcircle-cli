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
    // Create a more robust key that includes messageIndex to differentiate messages
    // Use a combination of taskId, stepName, messageIndex, and message content hash
    const messageHash = this.hashString(message.message);
    return `${message.taskId}:${message.stepName || 'all'}:${message.messageIndex || 0}:${messageHash}`;
  }
  
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
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

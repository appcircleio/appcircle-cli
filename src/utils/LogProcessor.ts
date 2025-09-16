/**
 * LogProcessor
 * Handles buffering, ordering, and processing of build log messages from SSE
 */

import { ServerOutputData, ProcessedLogMessage, WorkflowStatus } from '../types/build-logs';
import { MessageDeduplicator } from './MessageDeduplicator';

export class LogProcessor {
  private buffer: ServerOutputData[] = [];
  private logsStarted = false;
  private deduplicator = new MessageDeduplicator();
  private messageBuffer: ProcessedLogMessage[] = [];
  private nextExpectedIndex = 1; // Track the next expected messageIndex

  constructor(private onProcessedMessage: (message: ProcessedLogMessage) => void) {}

  /**
   * Process an incoming raw message from SSE
   */
  processMessage(rawMessage: ServerOutputData): void {
    // Check for duplicates
    if (this.deduplicator.isDuplicate(rawMessage)) {
      return;
    }

    // Check if logs should start (gate logic)
    if (!this.logsStarted && this.shouldStartLogs(rawMessage)) {
      this.logsStarted = true;
      console.log('🚀 Build logs started - processing buffered messages');
      
      // Process buffered messages
      this.flushBuffer();
    }

    if (this.logsStarted) {
      this.processAndEmit(rawMessage);
    } else {
      // Buffer the message until logs start
      this.buffer.push(rawMessage);
    }
  }

  /**
   * Determine if logs should start based on the gate logic
   * Logs start when eventName contains "Progress" or "Start", or after the first message
   */
  private shouldStartLogs(message: ServerOutputData): boolean {
    // Start immediately if we have "BuildProgress" event
    if (message.eventName && message.eventName.includes('BuildProgress')) {
      return true;
    }
    
    // Start if there's a step name or workflow status indicates log content (10)
    if (message.stepName || message.workflowStatus === 10) {
      return true;
    }
    
    // Start if this looks like a workflow message with section markers
    if (message.message && message.message.includes('@@[section:')) {
      return true;
    }
    
    // Start after buffering a few messages (fallback)
    return this.buffer.length >= 2;
  }

  /**
   * Flush all buffered messages when logs start
   */
  private flushBuffer(): void {
    // Sort buffer by messageIndex to ensure correct order
    this.buffer.sort((a, b) => (a.messageIndex || 0) - (b.messageIndex || 0));
    
    // Process all buffered messages
    this.buffer.forEach(message => this.processAndEmit(message));
    this.buffer = [];
  }

  /**
   * Process a raw message and convert it to a processed message
   */
  private processAndEmit(rawMessage: ServerOutputData): void {
    const processed: ProcessedLogMessage = {
      id: rawMessage.id,
      taskId: rawMessage.taskId,
      message: rawMessage.message,
      messageIndex: rawMessage.messageIndex || 0,
      stepName: rawMessage.stepName || 'all',
      status: rawMessage.workflowStatus,
      timestamp: rawMessage.progressTime,
      isStepEcho: this.isStepEcho(rawMessage)
    };

    // Insert in correct order and emit when ready
    this.insertInOrder(processed);
  }

  /**
   * Insert message in correct order based on messageIndex
   */
  private insertInOrder(message: ProcessedLogMessage): void {
    // Find correct position based on messageIndex
    let insertIndex = this.messageBuffer.length;
    for (let i = this.messageBuffer.length - 1; i >= 0; i--) {
      if (this.messageBuffer[i].messageIndex <= message.messageIndex) {
        insertIndex = i + 1;
        break;
      }
    }

    this.messageBuffer.splice(insertIndex, 0, message);
    
    // Emit messages that are now in order
    this.emitOrderedMessages();
  }

  /**
   * Emit messages in order, handling gaps in messageIndex sequence
   */
  private emitOrderedMessages(): void {
    while (this.messageBuffer.length > 0) {
      const message = this.messageBuffer[0];
      
      // Check if this message is the next expected one or if we should emit anyway
      if (message.messageIndex === this.nextExpectedIndex || 
          this.messageBuffer.length > 50) { // Don't buffer too many messages
        
        this.messageBuffer.shift();
        this.nextExpectedIndex = Math.max(this.nextExpectedIndex, message.messageIndex + 1);
        this.onProcessedMessage(message);
      } else {
        // Wait for missing messages
        break;
      }
    }
  }

  /**
   * Check if a message is just echoing the step name (should be skipped)
   */
  private isStepEcho(message: ServerOutputData): boolean {
    // Skip uiOnly messages that just repeat the step name
    if (message.uiOnly && message.stepName && message.message && 
        message.message.trim() === message.stepName.trim()) {
      return true;
    }
    
    // Skip messages that are just step name repetitions
    return !!(message.stepName && message.message && message.message.trim() === message.stepName.trim());
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): { 
    buffered: number; 
    processed: boolean; 
    waitingForEmit: number;
    nextExpectedIndex: number;
  } {
    return {
      buffered: this.buffer.length,
      processed: this.logsStarted,
      waitingForEmit: this.messageBuffer.length,
      nextExpectedIndex: this.nextExpectedIndex
    };
  }

  /**
   * Reset the processor state (useful for new builds or testing)
   */
  reset(): void {
    this.buffer = [];
    this.logsStarted = false;
    this.deduplicator.clear();
    this.messageBuffer = [];
    this.nextExpectedIndex = 1;
  }

  /**
   * Force start logs processing (bypass gate logic)
   */
  forceStartLogs(): void {
    if (!this.logsStarted) {
      this.logsStarted = true;
      console.log('🚀 Build logs force started');
      this.flushBuffer();
    }
  }
}

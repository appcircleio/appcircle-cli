/**
 * LogFileManager
 * Handles optional file output for build logs
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProcessedLogMessage, BuildLogStats } from '../types/build-logs';

export class LogFileManager {
  private fileStream: fs.WriteStream | null = null;
  private filePath: string;
  private isInitialized = false;

  constructor(outputPath: string, taskId: string) {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate filename if directory provided
    if (outputPath.endsWith('/') || (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory())) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.filePath = path.join(outputPath, `build-${taskId}-${timestamp}.log`);
    } else {
      this.filePath = outputPath;
    }
  }

  /**
   * Initialize the file stream for writing
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fileStream = fs.createWriteStream(this.filePath, { flags: 'w' });
      
      this.fileStream.on('open', () => {
        console.log(`📝 Writing logs to: ${this.filePath}`);
        this.isInitialized = true;
        
        // Write header
        const header = [
          `# Appcircle Build Logs`,
          `# Generated: ${new Date().toISOString()}`,
          `# File: ${this.filePath}`,
          ``,
          ''
        ].join('\n');
        
        this.fileStream!.write(header);
        resolve();
      });

      this.fileStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Write a processed log message to file
   */
  writeMessage(message: ProcessedLogMessage): void {
    if (!this.fileStream || !this.isInitialized) return;

    const timestamp = new Date(message.timestamp).toISOString();
    const stepInfo = message.stepName !== 'all' ? `[${message.stepName}] ` : '';
    const statusInfo = this.getStatusPrefix(message.status);
    const logLine = `${timestamp} ${statusInfo}${stepInfo}${message.message}\n`;

    this.fileStream.write(logLine);
  }

  /**
   * Write raw content to file
   */
  writeRaw(content: string): void {
    if (!this.fileStream || !this.isInitialized) return;
    this.fileStream.write(content + '\n');
  }

  /**
   * Write a step header to file
   */
  writeStepHeader(stepName: string, status: number): void {
    if (!this.fileStream || !this.isInitialized) return;

    const timestamp = new Date().toISOString();
    const statusText = this.getStatusText(status);
    const separator = '='.repeat(50);
    
    const header = [
      '',
      separator,
      `${timestamp} STEP: ${stepName} (${statusText})`,
      separator,
      ''
    ].join('\n');

    this.fileStream.write(header);
  }

  /**
   * Write build summary to file
   */
  writeSummary(stats: BuildLogStats): void {
    if (!this.fileStream || !this.isInitialized) return;

    const separator = '='.repeat(60);
    const summary = [
      '',
      separator,
      'BUILD SUMMARY',
      separator,
      `Duration: ${stats.duration}`,
      `Total Steps: ${stats.totalSteps}`,
      `Successful Steps: ${stats.successfulSteps}`,
      `Failed Steps: ${stats.failedSteps}`,
      `Start Time: ${stats.startTime?.toISOString() || 'Unknown'}`,
      `End Time: ${stats.endTime?.toISOString() || 'Unknown'}`,
      '',
      stats.failedSteps > 0 ? 'BUILD RESULT: FAILED' : 'BUILD RESULT: SUCCESS',
      separator,
      ''
    ].join('\n');

    this.fileStream.write(summary);
  }

  /**
   * Close the file stream
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.fileStream) {
        this.fileStream.end(() => {
          console.log(`✅ Log file saved: ${this.filePath}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the file path
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Check if file manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get file size in bytes
   */
  getFileSize(): number {
    try {
      if (fs.existsSync(this.filePath)) {
        return fs.statSync(this.filePath).size;
      }
    } catch (error) {
      console.error('Error getting file size:', error);
    }
    return 0;
  }

  /**
   * Get status prefix for log entries
   */
  private getStatusPrefix(status: number): string {
    switch (status) {
      case 0: return '[INFO] ';
      case 1: return '[START] ';
      case 2: return '[END] ';
      case 3: return '[ERROR] ';
      case 9: return '[COMPLETE] ';
      case 10: return '[LOG] ';
      default: return '[UNKNOWN] ';
    }
  }

  /**
   * Get human readable status text
   */
  private getStatusText(status: number): string {
    switch (status) {
      case 0: return 'Information';
      case 1: return 'Step Started';
      case 2: return 'Step Ended';
      case 3: return 'Step Error';
      case 9: return 'Workflow Completed';
      case 10: return 'Log';
      default: return 'Unknown';
    }
  }

  /**
   * Flush any buffered writes
   */
  flush(): void {
    if (this.fileStream) {
      this.fileStream.cork();
      this.fileStream.uncork();
    }
  }
}

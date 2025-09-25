/**
 * TerminalRenderer
 * Handles colored terminal output for build logs with status icons and formatting
 */

import chalk from 'chalk';
import { ProcessedLogMessage, WorkflowStatus, StatusMapping, BuildLogOptions } from '../types/build-logs';

export class TerminalRenderer {
  private readonly statusIcons = {
    0: chalk.gray('○'),   // Information/waiting
    1: chalk.blue('●'),   // StepStarted  
    2: chalk.green('✓'),  // StepEnded
    3: chalk.red('✗'),    // StepError
    9: chalk.green('✓'),  // WorkflowCompleted
    10: chalk.blue('●')   // Log
  };

  private readonly statusTexts = {
    0: 'waiting',
    1: 'loading', 
    2: 'success',
    3: 'failed',
    9: 'success',
    10: 'loading'
  };

  constructor(private options: BuildLogOptions = {}) {}

  /**
   * Render a single log message with formatting
   */
  renderMessage(message: ProcessedLogMessage): string {
    // Skip step echo messages (redundant)
    if (message.isStepEcho) {
      return '';
    }

    // Apply step filter if specified
    if (this.options.stepFilter && message.stepName !== this.options.stepFilter) {
      return '';
    }

    const parts: string[] = [];

    // Add timestamp if enabled
    if (this.options.timestamps) {
      const timestamp = this.formatTimestamp(message.timestamp);
      parts.push(chalk.gray(`[${timestamp}]`));
    }

    // Add status icon only if not in verbose mode
    // In verbose mode, we show only the raw message without icons or step names
    if (!this.options.verboseMode) {
      const icon = this.statusIcons[message.status] || chalk.gray('○');
      parts.push(icon);

      // Add step name if not 'all'
      if (message.stepName !== 'all') {
        parts.push(chalk.cyan(`[${message.stepName}]`));
      }
    }

    // Format and add message
    const formattedMessage = this.formatMessage(message.message);
    parts.push(formattedMessage);

    return parts.join(' ');
  }

  /**
   * Render a step header when a new step starts
   */
  renderStepHeader(stepName: string, status: WorkflowStatus): string {
    if (this.options.noColor) {
      return `\n=== ${stepName} ===\n`;
    }

    const icon = this.statusIcons[status] || chalk.gray('○');
    const statusText = this.statusTexts[status] || 'unknown';
    
    return `\n${icon} ${chalk.bold.cyan(stepName)} ${chalk.gray(`(${statusText})`)}\n`;
  }

  /**
   * Render build completion summary
   */
  renderSummary(stats: { 
    totalSteps: number; 
    successfulSteps: number; 
    failedSteps: number; 
    duration: string;
    hasWarnings?: boolean;
  }): string {
    const { totalSteps, successfulSteps, failedSteps, duration, hasWarnings } = stats;
    
    if (this.options.noColor) {
      const lines = [
        '',
        '=== Build Summary ===',
        `Duration: ${duration}`,
        `Total Steps: ${totalSteps}`,
        `Successful: ${successfulSteps}`,
        `Failed: ${failedSteps}`,
        ''
      ];

      if (failedSteps > 0) {
        lines.push('Build failed');
      } else if (hasWarnings) {
        lines.push('Build completed with warnings');
      } else {
        lines.push('Build completed successfully');
      }

      return lines.join('\n');
    }

    const lines = [
      '',
      chalk.bold('📊 Build Summary'),
      `Duration: ${chalk.cyan(duration)}`,
      `Total Steps: ${chalk.cyan(totalSteps.toString())}`,
      `Successful: ${chalk.green(successfulSteps.toString())}`,
      `Failed: ${chalk.red(failedSteps.toString())}`,
      ''
    ];

    if (failedSteps > 0) {
      lines.push(chalk.red('❌ Build failed'));
    } else if (hasWarnings) {
      lines.push(chalk.yellow('⚠️ Build completed with warnings'));
    } else {
      lines.push(chalk.green('✅ Build completed successfully'));
    }

    return lines.join('\n');
  }

  /**
   * Format log message content with special markers
   */
  private formatMessage(message: string): string {
    if (this.options.noColor) {
      return message;
    }

    let formatted = message;

    // Apply formatting rules from the UI mapping
    // @@[section: -> Yellow
    formatted = formatted.replace(/@@\[section:/g, chalk.yellow('@@[section:'));
    
    // @@[command] -> Cyan  
    formatted = formatted.replace(/@@\[command\]/g, chalk.cyan('@@[command]'));
    
    // @@[error] -> Red (only exact match)
    formatted = formatted.replace(/@@\[error\]/g, chalk.red('@@[error]'));
    
    // URLs -> Blue (simple regex for http/https URLs)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, (url) => chalk.blue(url));

    // Additional formatting for common patterns
    // Success patterns
    if (/✅|✓|success|completed|passed/i.test(formatted)) {
      // Don't override if already colored
      if (!formatted.includes('\u001b[')) {
        formatted = chalk.green(formatted);
      }
    }
    // Error patterns - only for specific error markers, not general "error" text
    else if (/❌|✗|@@error:/i.test(formatted)) {
      if (!formatted.includes('\u001b[')) {
        formatted = chalk.red(formatted);
      }
    }
    // Warning patterns
    else if (/⚠️|warning|warn/i.test(formatted)) {
      if (!formatted.includes('\u001b[')) {
        formatted = chalk.yellow(formatted);
      }
    }

    return formatted;
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toISOString().substring(11, 23); // HH:MM:SS.sss format
    } catch (error) {
      return timestamp;
    }
  }

  /**
   * Render a progress line for a specific step
   */
  renderStepProgress(stepName: string, status: WorkflowStatus, messageCount: number): string {
    const icon = this.statusIcons[status] || chalk.gray('○');
    const statusText = this.statusTexts[status] || 'unknown';
    
    if (this.options.noColor) {
      return `${stepName}: ${statusText} (${messageCount} messages)`;
    }

    return `${icon} ${chalk.cyan(stepName)}: ${chalk.gray(statusText)} ${chalk.dim(`(${messageCount} messages)`)}`;
  }

  /**
   * Render error message
   */
  renderError(error: string): string {
    if (this.options.noColor) {
      return `ERROR: ${error}`;
    }
    return chalk.red(`❌ ${error}`);
  }

  /**
   * Render info message
   */
  renderInfo(info: string): string {
    if (this.options.noColor) {
      return `INFO: ${info}`;
    }
    return chalk.blue(`ℹ️ ${info}`);
  }

  /**
   * Render warning message
   */
  renderWarning(warning: string): string {
    if (this.options.noColor) {
      return `WARNING: ${warning}`;
    }
    return chalk.yellow(`⚠️ ${warning}`);
  }
}

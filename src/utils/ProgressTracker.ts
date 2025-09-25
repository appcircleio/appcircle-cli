/**
 * ProgressTracker
 * Tracks build step progress and provides progress visualization
 */

import { ProcessedLogMessage, WorkflowStatus, StepProgress, BuildLogStats } from '../types/build-logs';

export class ProgressTracker {
  private steps = new Map<string, StepProgress>();
  private isEnabled: boolean;
  private buildStartTime?: Date;
  private buildEndTime?: Date;

  constructor(enabled: boolean = true) {
    // Only enable progress tracking in TTY environments
    this.isEnabled = enabled && process.stdout.isTTY;
    this.buildStartTime = new Date();
  }

  /**
   * Update progress based on a log message
   */
  updateProgress(message: ProcessedLogMessage): void {
    const stepName = message.stepName;
    
    // Skip 'all' step as it's not a real step
    if (stepName === 'all') {
      return;
    }

    const existingStep = this.steps.get(stepName);

    if (!existingStep) {
      // New step discovered
      this.steps.set(stepName, {
        name: stepName,
        status: message.status,
        startTime: new Date(),
        messageCount: 1
      });
    } else {
      // Update existing step
      existingStep.status = message.status;
      existingStep.messageCount++;
      
      // Mark end time for completed steps
      if (this.isStepCompleted(message.status) && !existingStep.endTime) {
        existingStep.endTime = new Date();
      }
    }

    // Update build end time for workflow completion
    if (message.status === 9) { // WorkflowCompleted
      this.buildEndTime = new Date();
    }
  }

  /**
   * Get current progress statistics
   */
  getProgressStats(): {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    currentStep?: string;
    progressPercentage: number;
  } {
    const totalSteps = this.steps.size;
    const completedSteps = Array.from(this.steps.values())
      .filter(step => this.isStepCompleted(step.status)).length;
    const failedSteps = Array.from(this.steps.values())
      .filter(step => step.status === 3).length;

    const currentStep = Array.from(this.steps.values())
      .find(step => step.status === 1 || step.status === 10)?.name;

    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      totalSteps,
      completedSteps,
      failedSteps,
      currentStep,
      progressPercentage
    };
  }

  /**
   * Get detailed build statistics
   */
  getBuildStats(): BuildLogStats {
    const steps = Array.from(this.steps.values());
    const totalSteps = steps.length;
    const successfulSteps = steps.filter(s => s.status === 2 || s.status === 9).length;
    const failedSteps = steps.filter(s => s.status === 3).length;

    const startTime = this.buildStartTime || new Date();
    const endTime = this.buildEndTime || new Date();
    const duration = this.formatDuration(endTime.getTime() - startTime.getTime());

    return {
      totalSteps,
      successfulSteps,
      failedSteps,
      duration,
      startTime,
      endTime
    };
  }

  /**
   * Get all step details
   */
  getAllSteps(): StepProgress[] {
    return Array.from(this.steps.values()).sort((a, b) => {
      const aTime = a.startTime?.getTime() || 0;
      const bTime = b.startTime?.getTime() || 0;
      return aTime - bTime;
    });
  }

  /**
   * Get a specific step's progress
   */
  getStepProgress(stepName: string): StepProgress | undefined {
    return this.steps.get(stepName);
  }

  /**
   * Check if the build is completed
   */
  isBuildCompleted(): boolean {
    return !!this.buildEndTime || Array.from(this.steps.values()).some(step => step.status === 9);
  }

  /**
   * Check if the build has any failures
   */
  hasBuildFailed(): boolean {
    return Array.from(this.steps.values()).some(step => step.status === 3);
  }

  /**
   * Generate a simple progress bar string
   */
  generateProgressBar(width: number = 30): string {
    const stats = this.getProgressStats();
    const filledWidth = Math.round((stats.progressPercentage / 100) * width);
    const emptyWidth = width - filledWidth;
    
    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(emptyWidth);
    
    return `[${filled}${empty}] ${stats.progressPercentage}%`;
  }

  /**
   * Get a summary line for current progress
   */
  getProgressSummary(): string {
    const stats = this.getProgressStats();
    const parts = [
      `${stats.completedSteps}/${stats.totalSteps} steps`
    ];

    if (stats.currentStep) {
      parts.push(`current: ${stats.currentStep}`);
    }

    if (stats.failedSteps > 0) {
      parts.push(`failed: ${stats.failedSteps}`);
    }

    return parts.join(', ');
  }

  /**
   * Reset progress tracking for a new build
   */
  reset(): void {
    this.steps.clear();
    this.buildStartTime = new Date();
    this.buildEndTime = undefined;
  }

  /**
   * Check if a workflow status represents a completed step
   */
  private isStepCompleted(status: WorkflowStatus): boolean {
    return status === 2 || status === 9; // StepEnded or WorkflowCompleted
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get current step status for display
   */
  getCurrentStepStatus(): { stepName: string; status: string; duration: string } | null {
    const currentStep = Array.from(this.steps.values())
      .find(step => step.status === 1 || step.status === 10);

    if (!currentStep || !currentStep.startTime) {
      return null;
    }

    const duration = new Date().getTime() - currentStep.startTime.getTime();
    const statusText = currentStep.status === 1 ? 'starting' : 'running';

    return {
      stepName: currentStep.name,
      status: statusText,
      duration: this.formatDuration(duration)
    };
  }
}

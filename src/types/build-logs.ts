/**
 * Build Logs Types
 * TypeScript interfaces for real-time build log events and processing
 */

export type WorkflowStatus = 0 | 1 | 2 | 3 | 9 | 10;
// 0: Information, 1: StepStarted, 2: StepEnded, 3: StepError, 9: WorkflowCompleted, 10: Log

export interface ServerOutputData {
  userId?: string;
  organizationId?: string;
  status?: number;
  id: string;
  taskId: string;
  message: string;
  messageIndex?: number;
  workflowName: string;
  workflowStatus: WorkflowStatus;
  commitId?: string;
  agentId?: string;
  buildId?: string;
  branchId?: string;
  profileId?: string;
  progressTime: string;
  eventName?: string;
  stepName?: string;
  stepIndex?: number;
  uiOnly?: boolean;
  branchName?: string;
  metadata?: Record<string, any>;
}

export interface ProcessedLogMessage {
  id: string;
  taskId: string;
  message: string;
  messageIndex: number;
  stepName: string;
  status: WorkflowStatus;
  timestamp: string;
  isStepEcho?: boolean;
}

export type StatusMapping = 'waiting' | 'loading' | 'success' | 'failed';

export interface StepProgress {
  name: string;
  status: WorkflowStatus;
  startTime?: Date;
  endTime?: Date;
  messageCount: number;
}

export interface BuildLogStats {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  duration: string;
  startTime?: Date;
  endTime?: Date;
}

export interface BuildLogOptions {
  timestamps?: boolean;
  noColor?: boolean;
  stepFilter?: string;
  enableProgress?: boolean;
  saveToFile?: boolean;
  outputPath?: string;
}


export enum MissionStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  VERIFYING = 'VERIFYING',
  FIXING = 'FIXING',
  RETRYING = 'RETRYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum StepStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  FIXING = 'FIXING'
}

export enum LogType {
  INFO = 'INFO',
  PLAN = 'PLAN',
  ACTION = 'ACTION',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  SYSTEM = 'SYSTEM'
}

export interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  result?: string;
  verificationFeedback?: string;
  attempts: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: LogType;
  stepId?: string;
}

export interface Artifact {
  id: string;
  name: string;
  content: string;
  type: 'code' | 'markdown' | 'plan' | 'json';
  timestamp: Date;
}

export interface MissionState {
  id: string;
  goal: string;
  status: MissionStatus;
  currentStepIndex: number;
  steps: Step[];
  logs: LogEntry[];
  artifacts: Artifact[];
  lastExecutionOutput?: string;
  memory: {
    decisionLog: string[];
    learnedContext: string;
  };
}

export interface AIResponsePlan {
  steps: Array<{
    title: string;
    description: string;
  }>;
}

export interface AIExecutionResult {
  output: string;
  artifact?: {
    name: string;
    content: string;
    type: 'code' | 'markdown' | 'json';
  };
}

export interface AIVerificationResult {
  passed: boolean;
  feedback: string;
}

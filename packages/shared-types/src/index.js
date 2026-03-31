export const RunStatus = {
  CREATED: 'created',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD_LETTERED: 'dead_lettered',
  CANCELLED: 'cancelled'
};

export const TaskStatus = {
  CREATED: 'created',
  QUEUED: 'queued',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const ApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export const WorkflowTemplate = {
  DEFAULT: 'planner_builder_verifier',
  BUILDER_ONLY: 'builder_only'
};

export const WorkerRole = {
  PLANNER: 'planner',
  BUILDER: 'builder',
  VERIFIER: 'verifier'
};

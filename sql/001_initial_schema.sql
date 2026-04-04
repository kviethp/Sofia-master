CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  template_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  risk TEXT NOT NULL,
  workflow_template TEXT NOT NULL DEFAULT 'planner_builder_verifier',
  current_phase TEXT NOT NULL DEFAULT 'planner',
  parent_task_id TEXT REFERENCES tasks(id),
  graph JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  status TEXT NOT NULL,
  worker_role TEXT,
  model_profile TEXT,
  phase_index INT NOT NULL DEFAULT 0,
  storage_mode TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  dead_letter_reason TEXT,
  dead_lettered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  kind TEXT NOT NULL,
  uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  outcome TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  requested_by_run_id TEXT REFERENCES runs(id),
  phase_name TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT,
  target TEXT,
  decision_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS provider_usage (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  model_profile TEXT NOT NULL,
  provider TEXT,
  fallback_depth INT NOT NULL DEFAULT 0,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE runs ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS phase_index INT NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS template_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_template TEXT NOT NULL DEFAULT 'planner_builder_verifier';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_phase TEXT NOT NULL DEFAULT 'planner';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id TEXT REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS graph JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id TEXT REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS graph JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_lease_recovery ON runs(status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_approvals_task_id ON approvals(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_run_steps_run_id ON run_steps(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_run_id ON decisions(run_id, created_at);

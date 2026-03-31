import fs from 'node:fs/promises';
import path from 'node:path';

import {runDoctor} from '../src/doctor.js';
import {getRuntimePaths} from '../src/paths.js';

const doctor = await runDoctor();
const runtime = getRuntimePaths();
const preflight = {
  timestamp: new Date().toISOString(),
  result: doctor.summary.status === 'pass' ? 'pass' : 'needs-attention',
  checks: [
    {
      name: 'doctor_summary',
      ok: doctor.summary.status === 'pass',
      note: `doctor status: ${doctor.summary.status}`
    },
    {
      name: 'risk_profile_mapping',
      ok: doctor.summary.requiredProfilesPresent,
      note: doctor.summary.requiredProfilesPresent ? 'required profiles present' : 'missing required profiles'
    },
    {
      name: 'storage_and_queue_connectivity',
      ok: doctor.summary.storageMode === 'postgres-redis',
      note:
        doctor.summary.storageMode === 'postgres-redis'
          ? 'postgres and redis are reachable'
          : `runtime mode is ${doctor.summary.storageMode}`
    },
    {
      name: 'approval_gate_readiness',
      ok: doctor.summary.approvalTransportReady && doctor.summary.approvalPendingTargetsPresent,
      note: doctor.summary.approvalTransportReady
        ? doctor.summary.approvalPendingTargetsPresent
          ? 'approval transport is configured and pending approvals are addressable'
          : 'approval transport exists but some pending approvals have no direct target'
        : 'approval transport is not configured for gated workflows'
    },
    {
      name: 'skill_bundle_readiness',
      ok: doctor.summary.skillRegistryReady && doctor.summary.requiredRuntimeSkillsPresent,
      note: doctor.summary.skillRegistryReady
        ? doctor.summary.requiredRuntimeSkillsPresent
          ? `runtime skills ready: ${(doctor.skills?.requiredRuntimeSkills || []).join(', ')}`
          : 'compiled skill registry exists but required runtime skills are missing or not trusted'
        : 'compiled skill registry is not ready'
    },
    {
      name: 'policy_guardrails_visible',
      ok: true,
      note: `denyProviders=${(doctor.policy?.denyProviders || []).join(',') || 'none'}; tokenBudgets=${JSON.stringify(doctor.policy?.tokenBudgets || {})}`
    }
  ],
  note: 'Preflight validates storage, queue connectivity, skill bundle readiness, and approval-gate readiness before runtime rollout.'
};

await fs.mkdir(runtime.reportDir, {recursive: true});
await fs.writeFile(
  path.join(runtime.reportDir, 'preflight-report.json'),
  JSON.stringify(preflight, null, 2),
  'utf8'
);

console.log(JSON.stringify(preflight, null, 2));

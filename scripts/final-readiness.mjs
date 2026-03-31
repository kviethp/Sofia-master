import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, '.sofia', 'reports');

async function readJson(filename) {
  const fullPath = path.join(reportDir, filename);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function hasConformanceScenario(conformance, name) {
  return Array.isArray(conformance?.scenarios) && conformance.scenarios.some((scenario) => scenario.name === name && scenario.ok);
}

function hasSelfHostStep(acceptance, name) {
  return Array.isArray(acceptance?.steps) && acceptance.steps.some((step) => step.name === name && step.ok);
}

function phaseResult(phase, checks) {
  return {
    phase,
    passed: checks.every((check) => check.ok),
    checks
  };
}

function reportPresent(report) {
  return Boolean(report);
}

function percentComplete(phases) {
  const allChecks = phases.flatMap((phase) => phase.checks);
  const passedChecks = allChecks.filter((check) => check.ok).length;
  return Math.round((passedChecks / allChecks.length) * 100);
}

function toMarkdown(report) {
  const lines = [
    '# Sofia Final Readiness',
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Result: ${report.result}`,
    `- Completion: ${report.completionPercent}%`,
    ''
  ];

  for (const phase of report.phases) {
    lines.push(`## ${phase.phase}`, '');
    lines.push(`- status: ${phase.passed ? 'pass' : 'needs-attention'}`);
    for (const check of phase.checks) {
      lines.push(`- ${check.name}: ${check.ok ? 'ok' : 'fail'}${check.note ? ` (${check.note})` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  await fs.mkdir(reportDir, {recursive: true});

  const [doctor, smoke, conformance, releaseReadiness, selfHostAcceptance, agentSystemConformance] = await Promise.all([
    readJson('doctor-report.json'),
    readJson('smoke-report.json'),
    readJson('conformance-report.json'),
    readJson('release-readiness.json'),
    readJson('self-host-acceptance.json'),
    readJson('agent-system-conformance.json')
  ]);

  const phases = [
    phaseResult('Phase B', [
      {name: 'services_boot', ok: hasSelfHostStep(selfHostAcceptance, 'migrate') && hasSelfHostStep(selfHostAcceptance, 'doctor')},
      {name: 'doctor_works', ok: doctor.summary?.status === 'pass'},
      {name: 'smoke_works', ok: String(smoke.result || '').includes('pass')},
      {name: 'synthetic_task_passes', ok: smoke.task?.status === 'completed' && smoke.run?.status === 'completed'}
    ]),
    phaseResult('Phase C', [
      {name: 'golden_path_real_runtime', ok: hasConformanceScenario(conformance, 'multi_phase_golden_path')},
      {name: 'artifacts_persisted', ok: Array.isArray(smoke.artifacts) && smoke.artifacts.length > 0},
      {
        name: 'routing_policy_enforced',
        ok:
          hasConformanceScenario(conformance, 'policy_critical_never_free') &&
          hasConformanceScenario(conformance, 'policy_provider_denylist_blocks_execution') &&
          hasConformanceScenario(conformance, 'skill_gate_blocks_missing_runtime_skill')
      },
      {name: 'compatibility_suite_covers_target_matrix', ok: reportPresent(conformance) && conformance.summary?.status === 'pass', note: reportPresent(conformance) ? '' : 'missing conformance-report.json'}
    ]),
    phaseResult('Phase D', [
      {name: 'retries_safe', ok: hasConformanceScenario(conformance, 'completed_retry_idempotent') && hasConformanceScenario(conformance, 'failed_retry_idempotent')},
      {name: 'resume_works', ok: hasConformanceScenario(conformance, 'approval_resume_queues_builder')},
      {name: 'state_survives_worker_failure', ok: hasConformanceScenario(conformance, 'stale_running_recovered') && hasConformanceScenario(conformance, 'lease_heartbeat_preserves_run')},
      {name: 'audit_and_usage_reliable', ok: Array.isArray(smoke.steps) && smoke.steps.length > 0 && Array.isArray(smoke.decisions) && smoke.decisions.length > 0 && Boolean(smoke.usage?.id)}
    ]),
    phaseResult('Phase E', [
      {name: 'multiple_project_templates', ok: Boolean(smoke.smokeTemplateId)},
      {name: 'dashboard_useful', ok: hasSelfHostStep(selfHostAcceptance, 'operator_diagnostics')},
      {name: 'approval_gates_functional', ok: hasConformanceScenario(conformance, 'approval_gate_blocks_high_risk_builder')},
      {name: 'upgrade_path_defined', ok: hasSelfHostStep(selfHostAcceptance, 'release_bundle') && hasSelfHostStep(selfHostAcceptance, 'release_acceptance')}
    ]),
    phaseResult('Phase F', [
      {name: 'docs_complete', ok: releaseReadiness.result === 'pass'},
      {name: 'install_path_smooth', ok: hasSelfHostStep(selfHostAcceptance, 'release_acceptance')},
      {name: 'public_demo_clean', ok: hasConformanceScenario(conformance, 'multi_phase_golden_path')},
      {name: 'contributor_workflow_proven', ok: hasSelfHostStep(selfHostAcceptance, 'release_readiness')},
      {name: 'agent_system_control_plane', ok: agentSystemConformance?.summary?.status === 'pass'}
    ]),
    phaseResult('Phase G', [
      {name: 'monitoring', ok: hasSelfHostStep(selfHostAcceptance, 'operator_diagnostics')},
      {name: 'backup_restore', ok: releaseReadiness.result === 'pass'},
      {name: 'release_discipline', ok: hasSelfHostStep(selfHostAcceptance, 'release_bundle') && hasSelfHostStep(selfHostAcceptance, 'release_acceptance')},
      {name: 'migration_scripts', ok: hasSelfHostStep(selfHostAcceptance, 'migrate')},
      {name: 'incident_and_rollback_playbooks', ok: releaseReadiness.result === 'pass'},
      {
        name: 'skill_runtime_enforced',
        ok: doctor.summary?.skillRegistryReady === true && doctor.summary?.requiredRuntimeSkillsPresent === true
      }
    ])
  ];

  const completionPercent = percentComplete(phases);
  const report = {
    timestamp: new Date().toISOString(),
    result: phases.every((phase) => phase.passed) ? 'pass' : 'needs-attention',
    completionPercent,
    phases
  };

  await fs.writeFile(path.join(reportDir, 'final-readiness.json'), JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(path.join(reportDir, 'final-readiness.md'), `${toMarkdown(report)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));

  if (report.result !== 'pass') {
    process.exit(1);
  }
}

await main();

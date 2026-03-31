import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {listModels} from '../../../packages/router-client/src/index.js';
import {validateOpenClawConfig} from '../../../packages/openclaw-adapter/src/index.js';
import {resolveCompiledSkillRegistry} from '../../../packages/skill-compiler/src/index.js';
import {compareDesiredVsActual} from '../../../packages/config-audit/src/index.js';
import {
  evaluateSkillGate,
  getAllowedSkillTrustLevels,
  getDeniedProviders,
  getTokenBudgetCaps,
  resolveRequiredSkillIds
} from '../../../packages/policy-engine/src/index.js';

import {getRuntimePaths} from './paths.js';
import {listApprovals, probeRuntimeServices} from './runtime-backend.js';

function toMarkdown(report) {
  const lines = [
    '# Sofia Doctor Report',
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Status: ${report.summary.status}`,
    `- Router reachable: ${report.summary.routerReachable}`,
    `- OpenClaw config valid: ${report.summary.openClawConfigValid}`,
    `- Artifact directory writable: ${report.summary.artifactDirWritable}`,
    `- Required profiles present: ${report.summary.requiredProfilesPresent}`,
    `- Skill registry ready: ${report.summary.skillRegistryReady}`,
    `- Required runtime skills present: ${report.summary.requiredRuntimeSkillsPresent}`,
    `- Approval transport ready: ${report.summary.approvalTransportReady}`,
    `- Runtime snapshot: Node ${report.runtimeSnapshot.nodeVersion}, Sofia ${report.runtimeSnapshot.sofiaVersion}`,
    ''
  ];

  lines.push('## Checks', '');
  for (const check of report.checks) {
    lines.push(`- ${check.name}: ${check.ok ? 'ok' : 'fail'}${check.note ? ` (${check.note})` : ''}`);
  }

  if (report.conflicts.length > 0) {
    lines.push('', '## Conflicts', '');
    for (const conflict of report.conflicts) {
      lines.push(`- [${conflict.severity}] ${conflict.code}: ${conflict.message}`);
    }
  }

  return lines.join('\n');
}

export async function runDoctor() {
  const runtime = getRuntimePaths();
  await fs.mkdir(runtime.reportDir, {recursive: true});
  await fs.mkdir(runtime.artifactDir, {recursive: true});
  const packageJson = JSON.parse(
    await fs.readFile(path.join(runtime.rootDir, 'package.json'), 'utf8')
  );

  const checks = [];
  const requiredProfiles = ['sofia-hard', 'sofia-fast', 'sofia-free-fallback'];
  const reportChannel = String(process.env.SOFIA_REPORT_CHANNEL || 'telegram').trim().toLowerCase();
  const approvalTarget = process.env.SOFIA_REPORT_TARGET || null;

  let router = {
    ok: false,
    baseUrl: runtime.routerBaseUrl,
    models: [],
    errors: []
  };

  try {
    router = await listModels(runtime.routerBaseUrl, runtime.routerApiKey);
  } catch (error) {
    router = {
      ok: false,
      baseUrl: runtime.routerBaseUrl,
      models: [],
      errors: [String(error.message || error)]
    };
  }

  const openClaw = await validateOpenClawConfig(runtime.openClawConfigPath);
  const runtimeServices = await probeRuntimeServices();
  let skillRegistry;
  try {
    skillRegistry = await resolveCompiledSkillRegistry({
      rootDir: runtime.rootDir,
      sourceDir: runtime.skillSourceDir,
      outputDir: runtime.skillOutputDir,
      manifestPath: runtime.skillManifestPath,
      autoCompile: runtime.skillAutoCompile
    });
  } catch (error) {
    skillRegistry = {
      ok: false,
      status: 'error',
      autoCompiled: false,
      manifestPath: runtime.skillManifestPath,
      outputDir: runtime.skillOutputDir,
      sourceDir: runtime.skillSourceDir,
      skillCount: 0,
      skills: [],
      errors: [error?.message ?? String(error)]
    };
  }
  const requiredRuntimeSkills = resolveRequiredSkillIds({
    workerRole: 'builder',
    executionMode: (process.env.SOFIA_EXECUTION_MODE || 'scaffold') === 'openclaw' ? 'openclaw' : 'scaffold',
    storageMode: runtimeServices.mode
  });
  const skillGate = evaluateSkillGate({
    requiredSkillIds: requiredRuntimeSkills,
    skillRegistry
  });
  const pendingApprovals = runtimeServices.mode === 'postgres-redis'
    ? await listApprovals({status: 'pending', limit: 100})
    : [];

  const desired = {
    routerBaseUrl: runtime.routerBaseUrl,
    openClawRouterBaseUrl: openClaw.router?.providers?.[0]?.baseUrl || runtime.routerBaseUrl,
    gatewayPort: 18789,
    gatewayMode: 'local',
    gatewayBind: 'loopback'
  };

  const actual = {
    routerBaseUrl: router.baseUrl,
    openClawConfigPath: openClaw.configPath,
    openClawRouterBaseUrl: openClaw.router?.providers?.[0]?.baseUrl || null,
    openClawPrimaryModel: openClaw.agents?.primaryModel || null,
    gatewayPort: openClaw.gateway?.port || null,
    gatewayMode: openClaw.gateway?.mode || null,
    gatewayBind: openClaw.gateway?.bind || null
  };

  const audit = compareDesiredVsActual(
    {
      routerBaseUrl: actual.routerBaseUrl,
      openClawRouterBaseUrl: actual.openClawRouterBaseUrl,
      gatewayPort: actual.gatewayPort,
      gatewayMode: actual.gatewayMode,
      gatewayBind: actual.gatewayBind
    },
    desired
  );

  const routerModelIds = new Set(router.models?.map((model) => model.id) || []);
  const missingProfiles = requiredProfiles.filter((profile) => !routerModelIds.has(profile));

  checks.push({
    name: 'router_reachable',
    ok: Boolean(router.ok),
    note: router.ok ? runtime.routerBaseUrl : (router.errors || []).join('; ')
  });
  checks.push({
    name: 'openclaw_config_valid',
    ok: Boolean(openClaw.ok),
    note: openClaw.ok ? openClaw.configPath : openClaw.note
  });

  try {
    const probePath = path.join(runtime.artifactDir, '.write-test');
    await fs.writeFile(probePath, 'ok\n', 'utf8');
    await fs.rm(probePath, {force: true});
    checks.push({name: 'artifact_dir_writable', ok: true});
  } catch (error) {
    checks.push({
      name: 'artifact_dir_writable',
      ok: false,
      note: String(error.message || error)
    });
  }

  checks.push({
    name: 'required_profiles_present',
    ok: missingProfiles.length === 0,
    note: missingProfiles.length === 0 ? 'all required profiles found' : `missing: ${missingProfiles.join(', ')}`
  });
  checks.push({
    name: 'skill_registry_ready',
    ok: Boolean(skillRegistry.ok),
    note: skillRegistry.ok
      ? `skills=${skillRegistry.skillCount}; manifest=${skillRegistry.manifestPath}`
      : (skillRegistry.errors || []).join('; ') || 'compiled skill registry unavailable'
  });
  checks.push({
    name: 'required_runtime_skills_present',
    ok: Boolean(skillGate.ok),
    note: skillGate.ok
      ? `required=${requiredRuntimeSkills.join(', ')}`
      : skillGate.violations.map((entry) => entry.message).join('; ')
  });
  checks.push({
    name: 'postgres_reachable',
    ok: Boolean(runtimeServices.postgres.ok),
    note: runtimeServices.postgres.ok
      ? `database=${runtimeServices.postgres.database}`
      : runtimeServices.postgres.error?.message || 'postgres unavailable'
  });
  checks.push({
    name: 'redis_reachable',
    ok: Boolean(runtimeServices.redis.ok),
    note: runtimeServices.redis.ok
      ? runtimeServices.redis.response
      : runtimeServices.redis.error?.message || 'redis unavailable'
  });
  checks.push({
    name: 'approval_transport_configured',
    ok:
      reportChannel !== 'telegram' ||
      (Boolean(openClaw.telegram?.enabled) && Boolean(approvalTarget || openClaw.telegram?.defaultTo)),
    note:
      reportChannel !== 'telegram'
        ? `approval transport deferred to channel=${reportChannel}`
        : approvalTarget || openClaw.telegram?.defaultTo
          ? `telegram target=${approvalTarget || openClaw.telegram?.defaultTo}`
          : 'telegram enabled but no approval target is configured'
  });
  checks.push({
    name: 'approval_exec_policy_visible',
    ok: reportChannel !== 'telegram' || Boolean(openClaw.telegram?.execApprovalsEnabled),
    note:
      reportChannel !== 'telegram'
        ? `approval exec policy not required for channel=${reportChannel}`
        : openClaw.telegram?.execApprovalsEnabled
          ? 'telegram exec approvals are enabled in OpenClaw config'
          : 'telegram exec approvals are not enabled in OpenClaw config'
  });
  checks.push({
    name: 'approval_pending_targets_present',
    ok:
      reportChannel !== 'telegram' ||
      pendingApprovals.every((approval) => Boolean(approval.target || approvalTarget || openClaw.telegram?.defaultTo)),
    note:
      reportChannel !== 'telegram'
        ? `approval pending target check deferred to channel=${reportChannel}`
        : pendingApprovals.every((approval) => Boolean(approval.target || approvalTarget || openClaw.telegram?.defaultTo))
          ? `pending approvals checked=${pendingApprovals.length}`
          : `${pendingApprovals.filter((approval) => !approval.target).length} pending approvals have no direct target`
  });

  const report = {
    timestamp: new Date().toISOString(),
    runtime,
    policy: {
      denyProviders: getDeniedProviders(),
      tokenBudgets: getTokenBudgetCaps(),
      allowedSkillTrustLevels: getAllowedSkillTrustLevels()
    },
    skills: {
      registry: {
        ok: skillRegistry.ok,
        status: skillRegistry.status,
        autoCompiled: skillRegistry.autoCompiled,
        manifestPath: skillRegistry.manifestPath,
        outputDir: skillRegistry.outputDir,
        sourceDir: skillRegistry.sourceDir,
        skillCount: skillRegistry.skillCount,
        errors: skillRegistry.errors || []
      },
      requiredRuntimeSkills,
      gate: skillGate
    },
    runtimeSnapshot: {
      nodeVersion: process.version,
      sofiaVersion: packageJson.version,
      packageManager: packageJson.packageManager || null
    },
    runtimeServices,
    router,
    openClaw,
    checks,
    conflicts: audit.conflicts || [],
    warnings: audit.warnings || [],
    summary: {
      status: checks.every((check) => check.ok) && (audit.conflicts || []).length === 0 ? 'pass' : 'needs-attention',
      routerReachable: Boolean(router.ok),
      openClawConfigValid: Boolean(openClaw.ok),
      artifactDirWritable: checks.find((check) => check.name === 'artifact_dir_writable')?.ok || false,
      requiredProfilesPresent: missingProfiles.length === 0,
      skillRegistryReady: checks.find((check) => check.name === 'skill_registry_ready')?.ok || false,
      requiredRuntimeSkillsPresent:
        checks.find((check) => check.name === 'required_runtime_skills_present')?.ok || false,
      approvalTransportReady:
        checks.find((check) => check.name === 'approval_transport_configured')?.ok || false,
      approvalPendingTargetsPresent:
        checks.find((check) => check.name === 'approval_pending_targets_present')?.ok || false,
      storageMode: runtimeServices.mode
    }
  };

  const jsonPath = path.join(runtime.reportDir, 'doctor-report.json');
  const mdPath = path.join(runtime.reportDir, 'doctor-report.md');

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(mdPath, `${toMarkdown(report)}\n`, 'utf8');

  return report;
}

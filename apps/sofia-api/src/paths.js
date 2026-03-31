import os from 'node:os';
import path from 'node:path';

export function expandHome(value) {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

export function getRuntimePaths() {
  const rootDir = process.cwd();
  const reportDir = path.resolve(rootDir, '.sofia', 'reports');
  const artifactDir = path.resolve(
    rootDir,
    process.env.SOFIA_ARTIFACT_DIR || '.sofia/artifacts'
  );
  const skillOutputDir = path.resolve(
    rootDir,
    process.env.SOFIA_SKILL_OUTPUT_DIR || '.sofia/skills'
  );
  const stateDir = path.resolve(rootDir, '.sofia', 'state');
  const taskDir = path.join(stateDir, 'tasks');
  const runDir = path.join(stateDir, 'runs');
  const usageDir = path.join(stateDir, 'provider-usage');

  return {
    rootDir,
    reportDir,
    artifactDir,
    skillSourceDir: path.resolve(
      rootDir,
      process.env.SOFIA_SKILL_SOURCE_DIR || 'skills'
    ),
    skillOutputDir,
    skillManifestPath: path.resolve(
      rootDir,
      process.env.SOFIA_SKILL_MANIFEST_PATH || path.join(skillOutputDir, 'manifest.json')
    ),
    skillAutoCompile: String(process.env.SOFIA_SKILL_AUTO_COMPILE || 'true').trim().toLowerCase() !== 'false',
    stateDir,
    taskDir,
    runDir,
    usageDir,
    routerBaseUrl: process.env.SOFIA_ROUTER_BASE_URL || 'http://127.0.0.1:20128/v1',
    openClawConfigPath: expandHome(
      process.env.SOFIA_OPENCLAW_CONFIG_PATH || '~/.openclaw/openclaw.json'
    ),
    openClawGatewayUrl:
      process.env.SOFIA_OPENCLAW_BASE_URL || 'http://127.0.0.1:18789',
    routerApiKey: process.env.SOFIA_ROUTER_API_KEY || '',
    openClawGatewayToken: process.env.SOFIA_OPENCLAW_GATEWAY_TOKEN || ''
  };
}

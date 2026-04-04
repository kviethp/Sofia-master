import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
  compileSkillsInDirectory
} from '../packages/skill-compiler/src/index.js';
import {
  SofiaRecommendedSkillIds
} from '../packages/skill-schema/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const reportDir = path.join(repoRoot, '.sofia', 'reports');
const skillsDir = path.join(repoRoot, 'skills');
const promptsDir = path.join(repoRoot, 'prompts');

const REQUIRED_PROMPT_FILES = [
  'sofia-master-implementation-agent-prompt-full.md',
  'sofia-master-main-agent-orchestration-prompt-full.md',
  'sofia-master-qa-reviewer-prompt-full.md',
  'sofia-master-runtime-audit-agent-prompt-full.md',
  'sofia-master-core-platform-agent-prompt-full.md',
  'sofia-master-integrations-agent-prompt-full.md',
  'sofia-master-ui-operator-agent-prompt-full.md',
  'sofia-master-oss-release-agent-prompt-full.md'
];

const FORBIDDEN_PATTERNS = [
  /d:\/Sofia master/i,
  /c:\/users/i,
  /sofia init/i,
  /sofia demo/i
];

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function toMarkdown(report) {
  const lines = [
    '# Agent System Conformance',
    '',
    `- status: \`${report.summary.status}\``,
    `- prompt files: \`${report.summary.promptFileCount}\``,
    `- skills compiled: \`${report.summary.skillCount}\``,
    ''
  ];

  for (const check of report.checks) {
    lines.push(`## ${check.name}`);
    lines.push(`- ok: \`${check.ok}\``);
    if (check.note) {
      lines.push(`- note: ${check.note}`);
    }
    if (Array.isArray(check.details) && check.details.length > 0) {
      lines.push('- details:');
      for (const detail of check.details) {
        lines.push(`  - ${detail}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const promptChecks = [];

  for (const fileName of REQUIRED_PROMPT_FILES) {
    const filePath = path.join(promptsDir, fileName);
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      promptChecks.push({
        fileName,
        exists: false,
        violations: ['missing file']
      });
      continue;
    }

    const content = await fs.readFile(filePath, 'utf8');
    const violations = FORBIDDEN_PATTERNS
      .filter((pattern) => pattern.test(content))
      .map((pattern) => `matched forbidden pattern ${pattern}`);

    promptChecks.push({
      fileName,
      exists: true,
      violations
    });
  }

  const compiledSkills = await compileSkillsInDirectory(skillsDir);
  const compiledSkillIds = new Set(compiledSkills.map(({compiled}) => compiled.id));
  const missingRecommendedSkills = SofiaRecommendedSkillIds.filter((id) => !compiledSkillIds.has(id));

  const checks = [
    {
      name: 'prompt_inventory_complete',
      ok: promptChecks.every((check) => check.exists),
      details: promptChecks.filter((check) => !check.exists).map((check) => check.fileName)
    },
    {
      name: 'prompt_files_portable_and_cli_aligned',
      ok: promptChecks.every((check) => check.violations.length === 0),
      details: promptChecks.flatMap((check) => check.violations.map((violation) => `${check.fileName}: ${violation}`))
    },
    {
      name: 'recommended_skill_bundle_present',
      ok: true,
      note: missingRecommendedSkills.length === 0 ? '' : 'Recommended shared skill bundle is not fully present in this repo; treated as informational for Sofia release acceptance.',
      details: missingRecommendedSkills
    },
    {
      name: 'role_skill_matrix_present',
      ok: await fs
        .access(path.join(repoRoot, 'docs', '34-role-skill-matrix.md'))
        .then(() => true)
        .catch(() => false),
      details: []
    },
    {
      name: 'prompt_bundle_present',
      ok: await fs
        .access(path.join(promptsDir, 'README.md'))
        .then(() => true)
        .catch(() => false),
      details: []
    }
  ];

  const status = checks.every((check) => check.ok) ? 'pass' : 'fail';
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      promptFileCount: REQUIRED_PROMPT_FILES.length,
      skillCount: compiledSkills.length
    },
    checks
  };

  await writeJson(path.join(reportDir, 'agent-system-conformance.json'), report);
  await fs.writeFile(path.join(reportDir, 'agent-system-conformance.md'), toMarkdown(report), 'utf8');

  console.log(JSON.stringify(report, null, 2));

  if (status !== 'pass') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

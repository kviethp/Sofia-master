import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {compileSkillsInDirectory} from '../packages/skill-compiler/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const skillsDir = process.env.SOFIA_SKILL_SOURCE_DIR
  ? path.resolve(repoRoot, process.env.SOFIA_SKILL_SOURCE_DIR)
  : path.join(repoRoot, 'skills');
const reportDir = path.join(repoRoot, '.sofia', 'reports');

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const startedAt = new Date().toISOString();
  const compiledSkills = await compileSkillsInDirectory(skillsDir);
  const finishedAt = new Date().toISOString();
  const report = {
    status: 'pass',
    startedAt,
    finishedAt,
    skillCount: compiledSkills.length,
    skills: compiledSkills.map(({compiled}) => ({
      id: compiled.id,
      version: compiled.version,
      owner: compiled.owner,
      trustLevel: compiled.trustLevel,
      signatureHash: compiled.source.signatureHash
    }))
  };

  await writeJson(path.join(reportDir, 'skills-validate-report.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

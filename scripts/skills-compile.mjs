import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildSkillManifest,
  compileSkillsInDirectory,
  writeSkillManifest
} from '../packages/skill-compiler/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const skillsDir = process.env.SOFIA_SKILL_SOURCE_DIR
  ? path.resolve(repoRoot, process.env.SOFIA_SKILL_SOURCE_DIR)
  : path.join(repoRoot, 'skills');
const outputDir = process.env.SOFIA_SKILL_OUTPUT_DIR
  ? path.resolve(repoRoot, process.env.SOFIA_SKILL_OUTPUT_DIR)
  : path.join(repoRoot, '.sofia', 'skills');
const manifestPath = process.env.SOFIA_SKILL_MANIFEST_PATH
  ? path.resolve(repoRoot, process.env.SOFIA_SKILL_MANIFEST_PATH)
  : path.join(outputDir, 'manifest.json');

async function main() {
  const compiledSkills = await compileSkillsInDirectory(skillsDir, {outputDir});
  const manifest = buildSkillManifest(compiledSkills, {
    rootDir: repoRoot,
    sourceDir: skillsDir,
    outputDir
  });
  await writeSkillManifest(manifest, manifestPath);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

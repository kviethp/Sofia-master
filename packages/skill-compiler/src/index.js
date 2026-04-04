import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {assertSkillSpec, SkillSchemaVersion} from '../../skill-schema/src/index.js';

const DEFAULT_SOURCE_DIR = 'skills';
const DEFAULT_OUTPUT_DIR = path.join('.sofia', 'skills');
const DEFAULT_MANIFEST_NAME = 'manifest.json';

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

export function parseSkillMarkdown(markdown, {sourcePath = 'inline'} = {}) {
  const normalizedMarkdown = normalizeLineEndings(markdown);

  if (!normalizedMarkdown.startsWith('---\n')) {
    throw new Error(`Skill file "${sourcePath}" must start with JSON frontmatter enclosed by --- markers.`);
  }

  const frontmatterEnd = normalizedMarkdown.indexOf('\n---\n', 4);

  if (frontmatterEnd === -1) {
    throw new Error(`Skill file "${sourcePath}" is missing the closing --- frontmatter marker.`);
  }

  const frontmatterText = normalizedMarkdown.slice(4, frontmatterEnd).trim();
  const body = normalizedMarkdown.slice(frontmatterEnd + 5).trim();

  let metadata;

  try {
    metadata = JSON.parse(frontmatterText);
  } catch (error) {
    throw new Error(`Skill file "${sourcePath}" has invalid JSON frontmatter: ${error.message}`);
  }

  return {
    metadata,
    body
  };
}

export function compileSkill(markdown, {sourcePath = 'inline', compiledAt = new Date().toISOString()} = {}) {
  const parsed = parseSkillMarkdown(markdown, {sourcePath});
  const spec = assertSkillSpec(parsed.metadata);
  const instructions = parsed.body.trim();

  if (!instructions) {
    throw new Error(`Skill file "${sourcePath}" must contain instructions after the frontmatter.`);
  }

  const signatureHash = crypto
    .createHash('sha256')
    .update(stableStringify({spec, instructions}))
    .digest('hex');

  return {
    schemaVersion: SkillSchemaVersion,
    id: spec.id,
    version: spec.version,
    owner: spec.owner,
    description: spec.description,
    intent: spec.intent,
    trustLevel: spec.trustLevel,
    inputs: spec.inputs,
    constraints: spec.constraints,
    requiredTools: spec.requiredTools,
    expectedOutputs: spec.expectedOutputs,
    qualityGates: spec.qualityGates,
    references: spec.references || [],
    instructions,
    source: {
      path: sourcePath,
      compiledAt,
      signatureHash
    }
  };
}

async function collectSkillFiles(dirPath) {
  const entries = await fs.readdir(dirPath, {withFileTypes: true});
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function pathExists(targetPath) {
  return fs.access(targetPath).then(() => true).catch(() => false);
}

function toPortablePath(targetPath, {rootDir} = {}) {
  if (!targetPath) {
    return '';
  }

  if (!rootDir) {
    return targetPath;
  }

  return path.relative(rootDir, targetPath).replace(/\\/g, '/');
}

export function resolveSkillPaths({
  rootDir = process.cwd(),
  sourceDir = DEFAULT_SOURCE_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  manifestPath = ''
} = {}) {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedSourceDir = path.resolve(resolvedRootDir, sourceDir);
  const resolvedOutputDir = path.resolve(resolvedRootDir, outputDir);
  const resolvedManifestPath = manifestPath
    ? path.resolve(resolvedRootDir, manifestPath)
    : path.join(resolvedOutputDir, DEFAULT_MANIFEST_NAME);

  return {
    rootDir: resolvedRootDir,
    sourceDir: resolvedSourceDir,
    outputDir: resolvedOutputDir,
    manifestPath: resolvedManifestPath
  };
}

export function buildSkillManifest(compiledSkills, {
  rootDir = process.cwd(),
  sourceDir = DEFAULT_SOURCE_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  generatedAt = new Date().toISOString()
} = {}) {
  const paths = resolveSkillPaths({rootDir, sourceDir, outputDir});

  return {
    schemaVersion: SkillSchemaVersion,
    generatedAt,
    sourceDir: toPortablePath(paths.sourceDir, {rootDir: paths.rootDir}),
    outputDir: toPortablePath(paths.outputDir, {rootDir: paths.rootDir}),
    skillCount: compiledSkills.length,
    skills: compiledSkills.map(({compiled, outputPath}) => ({
      id: compiled.id,
      version: compiled.version,
      owner: compiled.owner,
      trustLevel: compiled.trustLevel,
      requiredTools: compiled.requiredTools,
      sourcePath: toPortablePath(compiled.source?.path || '', {rootDir: paths.rootDir}),
      outputFile: outputPath ? path.basename(outputPath) : `${compiled.id}.json`,
      signatureHash: compiled.source?.signatureHash || null
    }))
  };
}

export async function writeSkillManifest(manifest, manifestPath) {
  await fs.mkdir(path.dirname(manifestPath), {recursive: true});
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function loadSkillManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

export async function resolveCompiledSkillRegistry({
  rootDir = process.cwd(),
  sourceDir = DEFAULT_SOURCE_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  manifestPath = '',
  autoCompile = true
} = {}) {
  const paths = resolveSkillPaths({rootDir, sourceDir, outputDir, manifestPath});
  let autoCompiled = false;

  if (!(await pathExists(paths.manifestPath))) {
    if (!autoCompile) {
      return {
        ok: false,
        status: 'missing',
        rootDir: paths.rootDir,
        sourceDir: paths.sourceDir,
        outputDir: paths.outputDir,
        manifestPath: paths.manifestPath,
        autoCompiled: false,
        skillCount: 0,
        skills: [],
        skillIndex: new Map(),
        errors: [`Skill manifest not found at ${paths.manifestPath}`]
      };
    }

    if (!(await pathExists(paths.sourceDir))) {
      return {
        ok: false,
        status: 'missing',
        rootDir: paths.rootDir,
        sourceDir: paths.sourceDir,
        outputDir: paths.outputDir,
        manifestPath: paths.manifestPath,
        autoCompiled: false,
        skillCount: 0,
        skills: [],
        skillIndex: new Map(),
        errors: [
          `Skill manifest not found at ${paths.manifestPath}`,
          `Skill source directory not found at ${paths.sourceDir}`
        ]
      };
    }

    const compiledSkills = await compileSkillsInDirectory(paths.sourceDir, {
      outputDir: paths.outputDir
    });
    const manifest = buildSkillManifest(compiledSkills, {
      rootDir: paths.rootDir,
      sourceDir: paths.sourceDir,
      outputDir: paths.outputDir
    });
    await writeSkillManifest(manifest, paths.manifestPath);
    autoCompiled = true;
  }

  const manifest = await loadSkillManifest(paths.manifestPath);
  const compiledSkills = [];
  const errors = [];

  for (const entry of manifest.skills || []) {
    const outputFile = entry.outputFile || `${entry.id}.json`;
    const compiledPath = path.join(paths.outputDir, outputFile);

    try {
      const compiled = JSON.parse(await fs.readFile(compiledPath, 'utf8'));
      compiledSkills.push(compiled);
    } catch (error) {
      errors.push(`Failed to load compiled skill ${entry.id} from ${compiledPath}: ${error.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'ready' : 'needs-attention',
    rootDir: paths.rootDir,
    sourceDir: paths.sourceDir,
    outputDir: paths.outputDir,
    manifestPath: paths.manifestPath,
    autoCompiled,
    generatedAt: manifest.generatedAt || null,
    skillCount: compiledSkills.length,
    skills: compiledSkills,
    skillIndex: new Map(compiledSkills.map((skill) => [skill.id, skill])),
    manifest,
    errors
  };
}

export async function compileSkillFile(filePath, {outputDir} = {}) {
  const markdown = await fs.readFile(filePath, 'utf8');
  const compiled = compileSkill(markdown, {sourcePath: filePath});
  let outputPath = null;

  if (outputDir) {
    await fs.mkdir(outputDir, {recursive: true});
    outputPath = path.join(outputDir, `${compiled.id}.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf8');
  }

  return {compiled, outputPath};
}

export async function compileSkillsInDirectory(dirPath, {outputDir} = {}) {
  const files = await collectSkillFiles(dirPath);
  const compiledSkills = [];

  for (const filePath of files) {
    const result = await compileSkillFile(filePath, {outputDir});
    compiledSkills.push(result);
  }

  return compiledSkills;
}

export const SkillSchemaVersion = '1.0.0';

export const SkillTrustLevels = Object.freeze([
  'internal-trusted',
  'reviewed-third-party',
  'quarantined-experimental'
]);

export const SofiaRecommendedSkillIds = Object.freeze([
  'runtime-ops',
  'openclaw-9router',
  'postgres-redis-runtime',
  'conformance',
  'release-deploy',
  'docs-bilingual',
  'secret-scan',
  'ui-operator-flows'
]);

const REQUIRED_STRING_FIELDS = Object.freeze([
  'id',
  'version',
  'owner',
  'description',
  'intent',
  'trustLevel'
]);

const REQUIRED_ARRAY_FIELDS = Object.freeze([
  'inputs',
  'constraints',
  'requiredTools',
  'expectedOutputs',
  'qualityGates'
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  }

  if (isNonEmptyString(value)) {
    return [value.trim()];
  }

  return [];
}

export function normalizeSkillSpec(spec) {
  if (!isRecord(spec)) {
    return null;
  }

  const normalized = {
    schemaVersion: isNonEmptyString(spec.schemaVersion) ? spec.schemaVersion.trim() : SkillSchemaVersion,
    id: isNonEmptyString(spec.id) ? spec.id.trim() : '',
    version: isNonEmptyString(spec.version) ? spec.version.trim() : '',
    owner: isNonEmptyString(spec.owner) ? spec.owner.trim() : '',
    description: isNonEmptyString(spec.description) ? spec.description.trim() : '',
    intent: isNonEmptyString(spec.intent) ? spec.intent.trim() : '',
    trustLevel: isNonEmptyString(spec.trustLevel) ? spec.trustLevel.trim() : '',
    inputs: normalizeStringArray(spec.inputs),
    constraints: normalizeStringArray(spec.constraints),
    requiredTools: normalizeStringArray(spec.requiredTools),
    expectedOutputs: normalizeStringArray(spec.expectedOutputs),
    qualityGates: normalizeStringArray(spec.qualityGates)
  };

  if (spec.references !== undefined) {
    normalized.references = normalizeStringArray(spec.references);
  }

  return normalized;
}

export function validateSkillSpec(spec) {
  const errors = [];
  const warnings = [];

  if (!isRecord(spec)) {
    return {
      ok: false,
      errors: ['Skill spec must be an object.'],
      warnings,
      normalized: null
    };
  }

  const normalized = normalizeSkillSpec(spec);

  if (normalized.schemaVersion !== SkillSchemaVersion) {
    errors.push(
      `Unsupported skill schema version "${normalized.schemaVersion}". Expected "${SkillSchemaVersion}".`
    );
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(normalized[field])) {
      errors.push(`Missing required string field "${field}".`);
    }
  }

  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(normalized[field]) || normalized[field].length === 0) {
      errors.push(`Missing required array field "${field}" or field is empty.`);
    }
  }

  if (!SkillTrustLevels.includes(normalized.trustLevel)) {
    errors.push(
      `Invalid trust level "${normalized.trustLevel}". Expected one of: ${SkillTrustLevels.join(', ')}.`
    );
  }

  if (normalized.id && !/^[a-z0-9-]+$/.test(normalized.id)) {
    errors.push('Skill id must use lowercase letters, digits, and hyphens only.');
  }

  if (normalized.version && !/^\d+\.\d+\.\d+$/.test(normalized.version)) {
    errors.push('Skill version must use semantic version format, for example 1.0.0.');
  }

  if (normalized.requiredTools.includes('shell') && !normalized.constraints.some((entry) => /destructive|rollback|backup/i.test(entry))) {
    warnings.push('Shell-capable skills should usually declare at least one safety or rollback constraint.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized
  };
}

export function assertSkillSpec(spec) {
  const result = validateSkillSpec(spec);

  if (!result.ok) {
    const message = result.errors.join(' ');
    throw new Error(message);
  }

  return result.normalized;
}

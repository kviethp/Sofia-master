const PROFILE_FAST = 'sofia-fast';
const PROFILE_HARD = 'sofia-hard';
const PROFILE_FREE = 'sofia-free-fallback';
const VALID_PROFILES = new Set([PROFILE_FAST, PROFILE_HARD, PROFILE_FREE]);
const DEFAULT_ALLOWED_SKILL_TRUST_LEVELS = ['internal-trusted', 'reviewed-third-party'];

function normalizeRisk(risk) {
  return String(risk || 'medium').trim().toLowerCase();
}

function normalizeRole(role) {
  return String(role || 'builder').trim().toLowerCase();
}

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseIntegerEnv(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

function normalizeProvider(provider) {
  return String(provider || '').trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getTokenBudgetCaps() {
  return {
    input: parseIntegerEnv(process.env.SOFIA_MAX_TOKENS_IN),
    output: parseIntegerEnv(process.env.SOFIA_MAX_TOKENS_OUT),
    total: parseIntegerEnv(process.env.SOFIA_MAX_TOKENS_TOTAL)
  };
}

export function getDeniedProviders() {
  return parseCsvEnv(process.env.SOFIA_DENY_PROVIDERS);
}

export function getAllowedSkillTrustLevels() {
  const configured = parseCsvEnv(process.env.SOFIA_SKILL_TRUST_LEVELS);
  return configured.length > 0 ? configured : [...DEFAULT_ALLOWED_SKILL_TRUST_LEVELS];
}

export function resolveRequiredSkillIds({
  workerRole,
  executionMode = 'openclaw',
  storageMode = 'postgres-redis'
} = {}) {
  const normalizedRole = normalizeRole(workerRole);
  const baseSkills = parseCsvEnv(process.env.SOFIA_REQUIRED_RUNTIME_SKILLS);
  const requiredSkillIds = baseSkills.length > 0 ? [...baseSkills] : ['runtime-ops'];

  if (executionMode === 'openclaw') {
    requiredSkillIds.push('openclaw-9router');
  }

  if (storageMode === 'postgres-redis') {
    requiredSkillIds.push('postgres-redis-runtime');
  }

  if (normalizedRole === 'planner' || normalizedRole === 'verifier') {
    requiredSkillIds.push('conformance');
  }

  if (normalizedRole === 'ui' || normalizedRole === 'operator') {
    requiredSkillIds.push('ui-operator-flows');
  }

  return unique(requiredSkillIds);
}

export function evaluateSkillGate({
  requiredSkillIds = [],
  skillRegistry = null
} = {}) {
  const allowedTrustLevels = getAllowedSkillTrustLevels();
  const violations = [];
  const selectedSkills = [];

  if (!skillRegistry?.ok) {
    violations.push({
      code: 'skill_registry_unavailable',
      message: 'Compiled skill registry is unavailable.',
      details: {
        status: skillRegistry?.status || 'missing',
        errors: skillRegistry?.errors || []
      }
    });
  }

  for (const skillId of requiredSkillIds) {
    const skill = skillRegistry?.skillIndex?.get(skillId) || null;
    if (!skill) {
      violations.push({
        code: 'required_skill_missing',
        message: `Required skill ${skillId} is missing from the compiled registry.`,
        details: {
          skillId
        }
      });
      continue;
    }

    selectedSkills.push({
      id: skill.id,
      version: skill.version,
      trustLevel: skill.trustLevel,
      requiredTools: skill.requiredTools || []
    });

    if (!allowedTrustLevels.includes(String(skill.trustLevel || '').trim().toLowerCase())) {
      violations.push({
        code: 'skill_trust_not_allowed',
        message: `Skill ${skill.id} uses disallowed trust level ${skill.trustLevel}.`,
        details: {
          skillId: skill.id,
          trustLevel: skill.trustLevel,
          allowedTrustLevels
        }
      });
    }
  }

  return {
    ok: violations.length === 0,
    allowedTrustLevels,
    requiredSkillIds: unique(requiredSkillIds),
    selectedSkills,
    registryStatus: skillRegistry?.status || 'missing',
    skillCount: skillRegistry?.skillCount || 0,
    autoCompiled: Boolean(skillRegistry?.autoCompiled),
    violations
  };
}

export function isFreeTierAllowed({risk} = {}) {
  const normalizedRisk = normalizeRisk(risk);
  return normalizedRisk === 'low' || normalizedRisk === 'medium';
}


function estimatePromptComplexity({title = '', workerRole = '', workflowTemplate = '', currentPhase = ''} = {}) {
  const combined = [title, workerRole, workflowTemplate, currentPhase].filter(Boolean).join(' ');
  const length = combined.length;
  if (length >= 180) return 'high';
  if (length >= 90) return 'medium';
  return 'low';
}

function inferLatencyTarget({risk, workerRole} = {}) {
  const normalizedRisk = normalizeRisk(risk);
  const normalizedRole = normalizeRole(workerRole);
  if (normalizedRisk === 'low' && (normalizedRole === 'triage' || normalizedRole === 'classifier' || normalizedRole === 'extractor')) {
    return 'low-latency';
  }
  if (normalizedRisk === 'critical' || normalizedRisk === 'high') {
    return 'high-quality';
  }
  return 'balanced';
}

export function resolveAdaptiveModelProfile({task = null, run = null, degraded = false} = {}) {
  const role = run?.workerRole || task?.currentPhase || 'builder';
  const risk = task?.risk || 'medium';
  const normalizedRisk = normalizeRisk(risk);
  const normalizedRole = normalizeRole(role);
  const complexity = estimatePromptComplexity({
    title: task?.title || '',
    workerRole: normalizedRole,
    workflowTemplate: task?.workflowTemplate || '',
    currentPhase: task?.currentPhase || ''
  });
  const latencyTarget = inferLatencyTarget({risk, workerRole: normalizedRole});
  const reasons = [];

  if (degraded) {
    const profile = isFreeTierAllowed({risk}) ? PROFILE_FREE : PROFILE_HARD;
    reasons.push(`degraded_mode:${profile}`);
    return {profile, reasons, complexity, latencyTarget};
  }

  if (normalizedRisk in {critical:1, high:1}) {
    reasons.push(`risk:${normalizedRisk}`);
    return {profile: PROFILE_HARD, reasons, complexity, latencyTarget};
  }

  if (normalizedRole === 'planner' || normalizedRole === 'verifier') {
    reasons.push(`phase:${normalizedRole}`);
    return {profile: PROFILE_HARD, reasons, complexity, latencyTarget};
  }

  if (complexity == 'high') {
    reasons.push('complexity:high');
    return {profile: PROFILE_HARD, reasons, complexity, latencyTarget};
  }

  if (normalizedRole === 'triage' || normalizedRole === 'classifier' || normalizedRole === 'extractor') {
    reasons.push(`phase:${normalizedRole}`);
    reasons.push(`latency:${latencyTarget}`);
    return {profile: PROFILE_FAST, reasons, complexity, latencyTarget};
  }

  if (normalizedRisk in {low:1, medium:1}) {
    reasons.push(`risk:${normalizedRisk}`);
    reasons.push(`complexity:${complexity}`);
    reasons.push(`latency:${latencyTarget}`);
    return {profile: PROFILE_FAST, reasons, complexity, latencyTarget};
  }

  reasons.push('fallback:hard');
  return {profile: PROFILE_HARD, reasons, complexity, latencyTarget};
}

export function resolveModelProfile({role, risk, degraded = false} = {}) {
  const forcedProfile = String(process.env.SOFIA_FORCE_MODEL_PROFILE || '').trim();
  if (VALID_PROFILES.has(forcedProfile)) {
    return forcedProfile;
  }

  if (degraded) {
    return isFreeTierAllowed({risk}) ? PROFILE_FREE : PROFILE_HARD;
  }

  const normalizedRisk = normalizeRisk(risk);
  const normalizedRole = normalizeRole(role);

  if (normalizedRisk === 'critical' || normalizedRisk === 'high') {
    return PROFILE_HARD;
  }

  if (normalizedRole === 'planner' || normalizedRole === 'verifier') {
    return PROFILE_HARD;
  }

  if (normalizedRole === 'triage' || normalizedRole === 'classifier' || normalizedRole === 'extractor') {
    return PROFILE_FAST;
  }

  return normalizedRisk === 'low' || normalizedRisk === 'medium' ? PROFILE_FAST : PROFILE_HARD;
}

export function evaluateExecutionGuardrails({
  risk,
  requestedProfile,
  actualProvider,
  actualModel,
  usage
} = {}) {
  const deniedProviders = getDeniedProviders();
  const normalizedProvider = normalizeProvider(actualProvider);
  const budgetCaps = getTokenBudgetCaps();
  const inputTokens = Math.max(0, Number(usage?.input || usage?.tokensIn || 0));
  const outputTokens = Math.max(0, Number(usage?.output || usage?.tokensOut || 0));
  const totalTokens = inputTokens + outputTokens;
  const violations = [];

  if (requestedProfile === PROFILE_FREE && !isFreeTierAllowed({risk})) {
    violations.push({
      code: 'free_tier_not_allowed',
      message: `Profile ${PROFILE_FREE} is not allowed for risk=${normalizeRisk(risk)}`,
      details: {
        risk: normalizeRisk(risk),
        requestedProfile
      }
    });
  }

  if (normalizedProvider && deniedProviders.includes(normalizedProvider)) {
    violations.push({
      code: 'provider_denied',
      message: `Provider ${normalizedProvider} is denied by policy`,
      details: {
        provider: normalizedProvider,
        deniedProviders
      }
    });
  }

  if (budgetCaps.input !== null && inputTokens > budgetCaps.input) {
    violations.push({
      code: 'input_token_budget_exceeded',
      message: `Input tokens ${inputTokens} exceed budget ${budgetCaps.input}`,
      details: {
        inputTokens,
        maxInputTokens: budgetCaps.input
      }
    });
  }

  if (budgetCaps.output !== null && outputTokens > budgetCaps.output) {
    violations.push({
      code: 'output_token_budget_exceeded',
      message: `Output tokens ${outputTokens} exceed budget ${budgetCaps.output}`,
      details: {
        outputTokens,
        maxOutputTokens: budgetCaps.output
      }
    });
  }

  if (budgetCaps.total !== null && totalTokens > budgetCaps.total) {
    violations.push({
      code: 'total_token_budget_exceeded',
      message: `Total tokens ${totalTokens} exceed budget ${budgetCaps.total}`,
      details: {
        totalTokens,
        maxTotalTokens: budgetCaps.total
      }
    });
  }

  return {
    ok: violations.length === 0,
    requestedProfile: requestedProfile || null,
    actualProvider: normalizedProvider || null,
    actualModel: actualModel || null,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens
    },
    deniedProviders,
    budgetCaps,
    violations
  };
}

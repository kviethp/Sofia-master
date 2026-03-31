function normalizeBaseUrl(baseUrl) {
  const candidate = (baseUrl || '').trim();
  if (!candidate) {
    return 'http://127.0.0.1:20128/v1';
  }

  return candidate.replace(/\/+$/, '');
}

function normalizeModelEntry(entry, index) {
  if (entry == null) {
    return {
      id: `model-${index}`,
      name: `model-${index}`,
      raw: null
    };
  }

  if (typeof entry === 'string') {
    return {
      id: entry,
      name: entry,
      raw: entry
    };
  }

  const id = entry.id ?? entry.model ?? entry.name ?? `model-${index}`;
  return {
    id,
    name: entry.name ?? id,
    provider: entry.provider ?? entry.vendor ?? null,
    contextWindow: entry.contextWindow ?? entry.context_window ?? null,
    maxTokens: entry.maxTokens ?? entry.max_tokens ?? null,
    reasoning: entry.reasoning ?? null,
    input: Array.isArray(entry.input) ? entry.input : null,
    raw: entry
  };
}

function extractModels(payload) {
  if (Array.isArray(payload)) {
    return payload.map((entry, index) => normalizeModelEntry(entry, index));
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data.map((entry, index) => normalizeModelEntry(entry, index));
  }

  if (payload && Array.isArray(payload.models)) {
    return payload.models.map((entry, index) => normalizeModelEntry(entry, index));
  }

  return [];
}

function summarizeResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      kind: Array.isArray(payload) ? 'array' : typeof payload,
      keys: []
    };
  }

  return {
    kind: 'object',
    keys: Object.keys(payload).sort()
  };
}

function toErrorObject(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code ?? null
  };
}

export async function listModels(baseUrl = process.env.SOFIA_ROUTER_BASE_URL || 'http://127.0.0.1:20128/v1') {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoint = new URL('models', `${normalizedBaseUrl}/`).toString();
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/json'
      }
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    const models = extractModels(payload);
    return {
      ok: response.ok,
      status: response.status,
      baseUrl: normalizedBaseUrl,
      endpoint,
      durationMs: Date.now() - startedAt,
      modelCount: models.length,
      models,
      response: summarizeResponse(payload),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      baseUrl: normalizedBaseUrl,
      endpoint,
      durationMs: Date.now() - startedAt,
      modelCount: 0,
      models: [],
      response: null,
      error: toErrorObject(error)
    };
  }
}

export { normalizeBaseUrl, extractModels };

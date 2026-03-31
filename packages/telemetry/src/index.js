export function createTrace(label, metadata = {}) {
  const startedAt = new Date().toISOString();
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    traceId,
    label,
    metadata,
    startedAt,
    finish(extra = {}) {
      return {
        traceId,
        label,
        metadata,
        startedAt,
        finishedAt: new Date().toISOString(),
        ...extra
      };
    }
  };
}

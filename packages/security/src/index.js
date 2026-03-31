function redactString(value) {
  return value
    .replace(/(sk-[A-Za-z0-9_-]+)/g, '[REDACTED]')
    .replace(/([A-Za-z0-9]{16,})/g, '[REDACTED]');
}

export function redact(value) {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redact(entry)])
    );
  }

  return value;
}

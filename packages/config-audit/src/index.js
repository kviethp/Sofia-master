function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeComparableString(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .trim()
    .replace(/\/+$/, '')
    .replace('localhost', '127.0.0.1');
}

function describeValue(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value)) return `[array(${value.length})]`;
  if (isPlainObject(value)) return '{object}';
  return String(value);
}

function addConflict(target, path, expected, actual, severity, message) {
  target.push({
    path,
    expected,
    actual,
    severity,
    message
  });
}

function compareNode(actual, desired, path, conflicts, warnings, matches) {
  if (desired === actual) {
    matches.push(path);
    return;
  }

  if (typeof desired === 'string' && typeof actual === 'string') {
    const normalizedDesired = normalizeComparableString(desired);
    const normalizedActual = normalizeComparableString(actual);
    if (normalizedDesired === normalizedActual) {
      warnings.push({
        path,
        expected: desired,
        actual,
        severity: 'low',
        message: 'Values differ only by a common host alias or trailing slash'
      });
      matches.push(path);
      return;
    }
  }

  if (Array.isArray(desired) || Array.isArray(actual)) {
    if (!Array.isArray(desired) || !Array.isArray(actual)) {
      addConflict(
        conflicts,
        path,
        describeValue(desired),
        describeValue(actual),
        'high',
        'Array shape does not match'
      );
      return;
    }

    const maxLength = Math.max(desired.length, actual.length);
    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = `${path}[${index}]`;
      if (index >= desired.length) {
        warnings.push({
          path: nextPath,
          expected: undefined,
          actual: actual[index],
          severity: 'low',
          message: 'Unexpected extra entry present in actual configuration'
        });
        continue;
      }
      if (index >= actual.length) {
        addConflict(
          conflicts,
          nextPath,
          desired[index],
          undefined,
          'high',
          'Missing required array entry'
        );
        continue;
      }
      compareNode(actual[index], desired[index], nextPath, conflicts, warnings, matches);
    }
    return;
  }

  const actualIsObject = isPlainObject(actual);
  const desiredIsObject = isPlainObject(desired);
  if (actualIsObject || desiredIsObject) {
    if (!actualIsObject || !desiredIsObject) {
      addConflict(
        conflicts,
        path,
        describeValue(desired),
        describeValue(actual),
        'high',
        'Object shape does not match'
      );
      return;
    }

    const desiredKeys = Object.keys(desired);
    for (const key of desiredKeys) {
      const nextPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        addConflict(
          conflicts,
          nextPath,
          desired[key],
          undefined,
          'high',
          'Missing required key in actual configuration'
        );
        continue;
      }
      compareNode(actual[key], desired[key], nextPath, conflicts, warnings, matches);
    }

    for (const key of Object.keys(actual)) {
      if (!(key in desired)) {
        warnings.push({
          path: path ? `${path}.${key}` : key,
          expected: undefined,
          actual: actual[key],
          severity: 'low',
          message: 'Extra key present in actual configuration'
        });
      }
    }
    return;
  }

  addConflict(
    conflicts,
    path,
    desired,
    actual,
    'medium',
    `Value mismatch: expected ${describeValue(desired)} but found ${describeValue(actual)}`
  );
}

export function compareDesiredVsActual(actual, desired) {
  const conflicts = [];
  const warnings = [];
  const matches = [];

  compareNode(actual, desired, '', conflicts, warnings, matches);

  return {
    actual,
    desired,
    conflicts,
    warnings,
    matches,
    summary: {
      conflictCount: conflicts.length,
      warningCount: warnings.length,
      matchCount: matches.length
    }
  };
}

export { compareNode, normalizeComparableString, isPlainObject };

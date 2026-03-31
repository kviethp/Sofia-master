---
{
  "id": "secret-scan",
  "version": "1.0.0",
  "owner": "QA Reviewer",
  "description": "Scan tracked changes and public docs for secrets or machine-specific leakage.",
  "intent": "Prevent accidental publication of tokens, passwords, hostnames, or local paths.",
  "inputs": ["public docs", "env examples", "release artifacts"],
  "constraints": ["Do not print live secrets into reports.", "Redact sensitive values when evidence is needed.", "Treat machine-specific paths as leakage in public docs."],
  "requiredTools": ["shell", "docs"],
  "expectedOutputs": ["secret scan result", "redaction notes", "publish-safe confirmation"],
  "qualityGates": ["No live credential remains in tracked files.", "No machine-specific leakage remains in public docs.", "Redactions are documented."],
  "trustLevel": "internal-trusted"
}
---
# Secret Scan

1. Scan public-facing surfaces first.
2. Redact rather than echo live secrets.
3. Treat local paths, hostnames, and user identifiers as publish hygiene issues.

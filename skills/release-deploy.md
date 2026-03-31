---
{
  "id": "release-deploy",
  "version": "1.0.0",
  "owner": "OSS and Release",
  "description": "Prepare release bundles and validate deployable artifacts.",
  "intent": "Keep public release claims aligned with runnable artifacts.",
  "inputs": ["release docs", "bundle scripts", "acceptance reports"],
  "constraints": ["Do not claim public readiness without acceptance evidence.", "Surface unsupported areas clearly.", "Keep public docs safe for external users."],
  "requiredTools": ["node", "shell", "docs"],
  "expectedOutputs": ["release notes", "bundle evidence", "acceptance evidence"],
  "qualityGates": ["Release bundle exists.", "Acceptance checks pass.", "Public docs match actual support."],
  "trustLevel": "internal-trusted"
}
---
# Release and Deploy

1. Validate bundle generation before release claims.
2. Check acceptance on the artifact, not only on the source tree.
3. Keep install and deploy docs aligned with what actually runs.

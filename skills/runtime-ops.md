---
{
  "id": "runtime-ops",
  "version": "1.0.0",
  "owner": "Runtime Audit and Reconciliation",
  "description": "Audit and reconcile Sofia, OpenClaw, and 9Router runtime state.",
  "intent": "Produce safe runtime evidence before invasive changes.",
  "inputs": ["runtime config files", "service status", "doctor and preflight outputs"],
  "constraints": ["Do not overwrite live config without backup.", "Document rollback notes.", "Mark unverified behavior explicitly."],
  "requiredTools": ["shell", "config-audit", "docs"],
  "expectedOutputs": ["runtime-inventory.md", "conflict-report.md", "migration-reconciliation-plan.md"],
  "qualityGates": ["Every claim cites evidence.", "Rollback path is documented.", "No destructive change is implied."],
  "trustLevel": "internal-trusted"
}
---
# Runtime Ops

1. Inspect the active runtime first.
2. Compare desired and actual configuration.
3. Record conflicts, drift, and rollback notes before broader implementation depends on the runtime.

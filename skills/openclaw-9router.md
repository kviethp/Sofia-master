---
{
  "id": "openclaw-9router",
  "version": "1.0.0",
  "owner": "Integrations",
  "description": "Implement and validate OpenClaw and 9Router integration surfaces.",
  "intent": "Keep adapter behavior small, explicit, and evidenced.",
  "inputs": ["OpenClaw config", "9Router endpoints", "routing policy docs"],
  "constraints": ["Do not hardcode provider-specific behavior when abstraction is possible.", "Do not claim support without an exercised path.", "Prefer normalized responses."],
  "requiredTools": ["shell", "docs", "node"],
  "expectedOutputs": ["adapter evidence", "compatibility notes", "normalized integration behavior"],
  "qualityGates": ["Target endpoint was exercised.", "Fallback or normalization is explicit.", "Compatibility risk is recorded when present."],
  "trustLevel": "internal-trusted"
}
---
# OpenClaw and 9Router

1. Validate both ends before changing integration code.
2. Normalize outputs behind stable internal contracts.
3. Emit evidence for provider, model, fallback, and risk.

---
{
  "id": "conformance",
  "version": "1.0.0",
  "owner": "QA Reviewer",
  "description": "Run the smallest validation lane that proves the current slice.",
  "intent": "Prevent fake progress while keeping validation proportional.",
  "inputs": ["changed paths", "target runtime mode", "risk level"],
  "constraints": ["Prefer targeted validation for narrow slices.", "Run full conformance at checkpoints.", "Do not skip required runtime-backed checks at milestones."],
  "requiredTools": ["node", "shell", "docs"],
  "expectedOutputs": ["validation summary", "report artifacts", "checkpoint verdict support"],
  "qualityGates": ["Lane matches risk.", "Failures are actionable.", "Reports are recorded when required."],
  "trustLevel": "internal-trusted"
}
---
# Conformance

1. Choose patch, feature, checkpoint, or milestone lane deliberately.
2. Record the exact lane used.
3. Do not promote a slice if the evidence does not match the claim.

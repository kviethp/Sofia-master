---
{
  "id": "docs-bilingual",
  "version": "1.0.0",
  "owner": "OSS and Release",
  "description": "Maintain bilingual documentation structure without source-of-truth drift.",
  "intent": "Keep English and Vietnamese documentation navigable and aligned.",
  "inputs": ["English docs", "Vietnamese docs", "docs indexes"],
  "constraints": ["Do not leave broken cross-language links.", "Mark canonical English sources clearly.", "Update indexes when adding numbered docs."],
  "requiredTools": ["docs", "shell"],
  "expectedOutputs": ["updated docs indexes", "paired EN and VI docs", "parity notes when needed"],
  "qualityGates": ["Links resolve.", "New docs are indexed.", "Canonical source is explicit."],
  "trustLevel": "internal-trusted"
}
---
# Docs Bilingual

1. Keep English canonical unless a stricter bilingual rule is adopted.
2. Add or update the Vietnamese counterpart when a public doc changes.
3. Update indexes immediately when the numbered doc set changes.

---
{
  "id": "postgres-redis-runtime",
  "version": "1.0.0",
  "owner": "Core Platform",
  "description": "Implement durable state in Postgres and coordination in Redis.",
  "intent": "Keep Sofia state explicit, recoverable, and concurrency-aware.",
  "inputs": ["schema files", "runtime state model", "queue and lease requirements"],
  "constraints": ["Keep authoritative state in Postgres.", "Use Redis only for ephemeral coordination.", "Document migration impact."],
  "requiredTools": ["node", "shell", "docs"],
  "expectedOutputs": ["migrations", "state behavior", "queue or lease evidence"],
  "qualityGates": ["Migration impact is stated.", "Idempotency and recovery behavior are validated.", "No silent state coupling is introduced."],
  "trustLevel": "internal-trusted"
}
---
# Postgres and Redis Runtime

1. Treat Postgres as the source of truth.
2. Use Redis for queue and coordination only.
3. Validate lease, retry, replay, and recovery behavior whenever semantics change.

---
{
  "schemaVersion": "1.0.0",
  "id": "sofia-memory",
  "version": "1.0.0",
  "owner": "sofia-master",
  "description": "Maintain Sofia Master durable working-memory state for long-running tasks, task continuity, context compaction, resume flows, conversation state storage, and structured progress snapshots.",
  "intent": "Use when Sofia needs durable task continuity, compact resumable context, or structured working-memory state updates for active tasks.",
  "trustLevel": "internal-trusted",
  "inputs": [
    "task title",
    "structured summary",
    "recent turns if available",
    "current progress/decisions/constraints"
  ],
  "constraints": [
    "Keep working memory compact and task-oriented",
    "Do not treat working memory as long-term memory",
    "Prefer structured summaries over raw transcript dumps"
  ],
  "requiredTools": [
    "read",
    "write",
    "exec"
  ],
  "expectedOutputs": [
    "Updated working-memory state",
    "Resume-ready compact task context",
    "Clear next steps/open loops preserved"
  ],
  "qualityGates": [
    "Produces compact, resume-ready state rather than raw transcript dumps",
    "Preserves active goals, constraints, and unresolved loops",
    "Keeps output scoped to working memory, not long-term memory"
  ]
}
---

# Sofia Memory

Use this skill when Sofia needs durable task continuity.

## Purpose

Persist active working context into a compact state that can survive context resets.

## Recommended fast path

For most integrations, prefer the orchestration command:

```bash
./tools/sofia-memory-cycle \
  --task "<task title>" \
  --task-slug "<task-slug>" \
  --summary <summary.md> \
  --turns <n> \
  --tokens <estimated>
```

This handles:
- task initialization
- trigger check
- validation
- patching if needed
- compaction
- resume block generation

## Preserve these layers

1. latest full turns
2. rolling summary
3. unresolved goals
4. decisions / constraints
5. file/task references
6. active task state

## Notes

- This is working memory, not long-term memory.
- Keep state compact and task-oriented.
- Prefer structured summaries over large raw transcript dumps.
- Update after major milestones or before likely compaction.
- Use the runtime hook contract in `docs/sofia-runtime-hooks.md` when integrating with Sofia core.

---
name: sofia-memory
description: Maintain Sofia Master's durable working-memory state for long-running tasks, task continuity, context compaction, resume flows, conversation state storage, task-scoped memory, compaction trigger checks, validation, summary patching, and orchestration cycles. Use when Sofia risks losing active task context or needs to preserve recent turns, rolling summary, unresolved goals, decisions, constraints, next steps, or file/task references across context resets.
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

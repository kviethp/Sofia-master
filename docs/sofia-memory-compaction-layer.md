# Sofia Memory Compaction Layer (v4-v6)

## Why this exists

Sofia currently has no reliable auto context compression layer. That means a long task can lose continuity when the active context window fills up.

This layer adds a **durable working-memory and conversation-state foundation** for Sofia Master.

It still does not replace full runtime integration yet. Instead, it now provides:
- state format
- merge logic
- resume rendering
- trigger helper
- quality validator
- task-scoped memory manager
- orchestration cycle command
- runtime hook contract

---

## Primary commands

### 1. Task registry

```bash
./tools/sofia-task-memory init "<task title>" --activate
./tools/sofia-task-memory list
```

### 2. Decide whether to compact

```bash
./tools/sofia-memory-should-compact --turns <n> --tokens <estimated>
```

### 3. Validate summary quality

```bash
./tools/sofia-validate-summary --input <summary.md|summary.json>
```

### 4. Patch incomplete summary

```bash
./tools/sofia-patch-summary --input <summary.md> --output <patched.md>
```

### 5. Compact working memory

```bash
./tools/sofia-memory-compact \
  --input <summary.md|summary.json> \
  --state <working-memory.json> \
  --task "<current task>" \
  --markdown-out <working-memory.md>
```

### 6. Render resume block

```bash
./tools/sofia-memory-resume \
  --state <working-memory.json> \
  --recent-turns <recent-turns.json>
```

### 7. Run the full cycle

```bash
./tools/sofia-memory-cycle \
  --task "<task title>" \
  --task-slug "<task-slug>" \
  --summary <summary.md> \
  --turns <n> \
  --tokens <estimated>
```

---

## What the cycle does

1. initialize/activate task container
2. check compaction trigger
3. validate summary
4. patch summary if required
5. compact into task-scoped working memory
6. ensure recent-turn store exists
7. emit a resume block

---

## Runtime integration boundary

Use `docs/sofia-runtime-hooks.md` as the contract for future Sofia core integration.

Runtime still needs to own:
- recent-turn capture
- token estimation
- summary generation
- actual hook invocation timing

Memory layer now owns:
- compaction state
- validation
- patch/retry helper
- task-scoped storage
- resume rendering
- single-command memory cycle

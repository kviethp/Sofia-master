# Sofia Runtime Hook Interface (v7)

## Goal

Provide a minimal hook contract so Sofia core can integrate the memory layer without depending on implementation details.

---

## Hook points

### 1. `before_compaction`
Called when runtime predicts context pressure.

Inputs:
- current task title
- optional task slug
- structured summary path
- estimated turn count
- estimated token count

Action:
- run `./tools/sofia-memory-cycle`
- refresh task-scoped resume artifacts
- refresh the compact memory timeline artifact

### 2. `after_resume`
Called when a new request/session needs compact context restoration.

Inputs:
- active task slug

Action:
- render resume block from task-scoped memory
- refresh task timeline for operator-visible continuity

### 3. `after_milestone`
Called after important decisions, branch changes, or plan updates.

Inputs:
- current task
- updated structured summary path

Action:
- refresh compacted working memory
- update the task timeline with the latest objective / blocker / next action / artifact

---

## Suggested command contract

### before_compaction

```bash
./tools/sofia-memory-cycle \
  --task "<task title>" \
  --task-slug "<task-slug>" \
  --summary <summary.md> \
  --turns <n> \
  --tokens <estimated>
```

### after_resume

```bash
./tools/sofia-memory-resume \
  --state memory/sofia/tasks/<task-slug>/working-memory.json \
  --recent-turns memory/sofia/tasks/<task-slug>/recent-turns.json
```

---

## Runtime responsibilities still outside this repo

- capture recent turns continuously
- estimate tokens and turn pressure
- generate the structured summary before compaction
- decide when to invoke hooks
- inject the resume block into the next request payload

---

## Timeline artifact

Each active task may emit a compact `timeline.md` artifact alongside working memory and the resume block.

Suggested contents:
- current objective
- rolling summary
- last decision
- active blocker
- next safe action
- latest milestone
- latest artifact reference

This gives operators a fast, low-token continuity surface even before richer explainability UI exists.

---

## Integration note

This hook interface is intentionally narrow:
- runtime owns orchestration triggers
- memory layer owns storage, compaction merge, validation, resume rendering, and lightweight timeline generation

# Sofia Conversation State Store (v3 design)

## Objective

Make Sofia avoid losing important work state without carrying the full chat transcript.

The runtime should preserve:
- latest full turns
- rolling summary
- unresolved goals
- decisions / constraints
- file/task references

---

## Store layout

### 1. Recent turns store
Path:
- `memory/sofia/recent-turns.json`
- later: `memory/sofia/tasks/<task-slug>/recent-turns.json`

Suggested shape:

```json
{
  "version": 1,
  "updatedAt": "2026-04-01T00:00:00Z",
  "turns": [
    { "role": "user", "text": "...", "timestamp": "..." },
    { "role": "assistant", "text": "...", "timestamp": "..." }
  ]
}
```

Keep only the latest full turns, for example the last 6-12 turns depending on token budget.

### 2. Compacted working memory
Paths:
- `memory/sofia/working-memory.json`
- `memory/sofia/working-memory.md`
- later: `memory/sofia/tasks/<task-slug>/working-memory.json`

This is the carry-forward state.

Suggested core fields:
- `currentTask`
- `goal`
- `rollingSummary`
- `unresolvedGoals`
- `decisions`
- `constraints`
- `preferences`
- `progress.done`
- `progress.in_progress`
- `progress.blocked`
- `fileTaskReferences`
- `openLoops`
- `criticalContext`
- `history`

### 3. Task-scoped state manager
Registry:
- `memory/sofia/tasks/index.json`

Command:

```bash
./tools/sofia-task-memory init "<task title>" --activate
./tools/sofia-task-memory list
./tools/sofia-task-memory activate <task-slug>
```

---

## Compaction trigger

Trigger compaction when either condition is met:
- token usage crosses a threshold
- turn count crosses a threshold

### Suggested trigger policy

```json
{
  "maxRecentTurns": 8,
  "compactAfterTurns": 10,
  "compactAtEstimatedTokens": 24000,
  "hardLimitEstimatedTokens": 32000
}
```

Helper:

```bash
./tools/sofia-memory-should-compact --turns 12 --tokens 26000
```

### Trigger behavior

When triggered:
1. summarize the oldest active context into a condensed summary
2. validate the summary with the quality guard
3. merge important facts into working memory
4. keep only recent turns in the live prompt window
5. carry forward the compacted memory block

---

## Resume protocol

Do **not** resend the full history on a new request.

Send only:
1. recent turns
2. compacted memory block
3. active task state

### Resume block shape

- active task
- current goal
- rolling summary
- unresolved goals
- key decisions
- key constraints
- next steps
- important file/path references

Command:

```bash
./tools/sofia-memory-resume \
  --state memory/sofia/working-memory.json \
  --recent-turns memory/sofia/recent-turns.json
```

---

## Quality guard

Every condensed summary must preserve:
- mục tiêu đang làm
- quyết định đã chốt
- việc dở dang
- constraint quan trọng
- file/path liên quan

Validation helper:

```bash
./tools/sofia-validate-summary --input <summary.md|summary.json>
```

If validation fails, regenerate or patch the summary before saving it.

---

## Recommended runtime flow

```text
new turn arrives
-> append to recent-turn store
-> estimate token pressure / turn count
-> if threshold exceeded:
     summarize old context
     validate summary with quality guard
     merge into working memory
     trim recent turns
-> on resume:
     send recent turns + compacted memory block + active task state
```

---

## Relationship to current implementation

Current repo status:
- working-memory compaction merge exists
- resume helper exists
- recent-turn store schema exists
- task-scoped registry exists
- should-compact helper exists
- summary validator exists

Still to automate later in runtime:
- automatic recent-turn capture
- automatic trigger evaluation in the chat loop
- automatic summary generation
- automatic quality-guard retry loop

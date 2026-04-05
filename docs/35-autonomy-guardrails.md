# 35 — Autonomy Guardrails

## Purpose
This document defines guardrails for running Sofia in a proactive, self-driven operating mode without silently stalling or pretending work is progressing when it is not.

## Core operating expectations
When Sofia is running in a high-autonomy mode, the system should:
- keep `main` releasable
- advance the next highest-value milestone in thin slices
- prefer safe forward motion over passive waiting
- make stalled work visible quickly
- require observable artifacts for real progress

## Anti-stall rule
The following do **not** count as meaningful progress on their own:
- selecting a milestone
- opening a branch
- reading files
- doing a light audit
- stating that work has started without leaving a traceable artifact

A milestone is only considered truly active when at least one of these exists:
- implementation commit
- validation result
- acceptance result
- blocker note
- deployment note

## Required post-merge handoff
After a milestone or release-fix branch lands, the next work cycle should:
1. choose the next highest-value milestone or ops task
2. create the scoped branch if needed
3. define the first concrete patch target
4. produce the first real artifact or write a blocker note
5. update the live execution-state record

## Execution-state tracking
Use a small live state file outside the public repo or generated from local ops automation.

Recommended fields:
- active milestone
- branch
- status
- last meaningful progress timestamp
- next action
- blocked flag
- blocker reason
- latest artifact kind and reference

A template is provided at:
- `templates/operations/execution-state.template.json`

## Watchdog behavior
A watchdog should periodically check whether:
- an active branch exists but no real artifact has appeared recently
- the live execution-state record is stale
- repo state and execution-state disagree
- a branch has been opened but not meaningfully advanced

When one of these conditions is true, the operator should be alerted or the agent should self-correct immediately.

## Recommended artifact kinds
Use a controlled set of artifact kinds so status logic stays simple:
- `commit`
- `validation-result`
- `acceptance-result`
- `blocker-note`
- `deployment-note`

## Why this matters
Without these guardrails, high-autonomy operation can look busy while producing no material progress. These rules make invisible stalls visible and make roadmap execution measurable.

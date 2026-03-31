# Agent Handoff

## Instruction style
Implementation agents should treat this pack as the primary source of truth.

## Rules
- do not bypass policy-as-code
- do not hardcode model slugs without registry mapping
- do not overwrite user runtime config directly
- keep adapters modular
- commit in small vertical slices

## Preferred delivery slices
1. contracts and types
2. policy validator
3. router client
4. OpenClaw adapter
5. DB + API
6. queue + worker
7. doctor + preflight
8. conformance runner
9. demo execution

## Review bar
Every slice should include:
- docs update
- tests
- usage trace consideration
- failure mode note

## Mandatory coordination docs
All implementation and review agents should read:
- `docs/21-implementation-truth-map.md`
- `docs/22-agent-ownership-map.md`
- `docs/23-current-status-matrix.md`
- `docs/24-multi-agent-operating-model.md`

## Handoff package
Every handoff should include:
- checkpoint or slice name
- owned paths
- canonical docs used
- current module status
- evidence produced
- open risks and next owner

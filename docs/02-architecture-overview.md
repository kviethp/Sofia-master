# Architecture Overview

## Layers

### Layer 1: Sofia Core
Responsibilities:
- workflow engine
- policy engine
- memory service
- artifact service
- audit and usage ledger
- approval and gate controller

### Layer 2: Execution Runtime
OpenClaw workers:
- planner worker
- builder worker
- verifier worker

### Layer 3: Model Gateway
9Router:
- provider abstraction
- fallback chain
- account rotation
- model listing
- request forwarding

### Layer 4: External systems
- Git hosting
- CI pipelines
- object storage
- secret managers
- observability stack

## Data flow

1. User submits task
2. Sofia assigns risk, workflow template, required gates
3. Policy engine resolves model profile
4. OpenClaw worker executes through adapter
5. Adapter calls 9Router using normalized request contracts
6. Outputs, logs, tool results, and usage are written back to Sofia
7. Gates run
8. Approval or automated transition advances the workflow

## Design constraints

- keep runtime adapters replaceable
- keep config and policy versioned
- keep routing traceable
- keep decisions replayable

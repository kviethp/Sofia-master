# Risk Treatment Plan

## R1: Config conflict with existing OpenClaw / 9Router setup
Treatment:
- inventory all current config
- compare against Sofia desired state
- produce drift report
- never overwrite runtime config blindly

## R2: Provider compatibility mismatch
Treatment:
- normalize provider contract
- maintain compatibility matrix
- add conformance suite
- gate releases on compatibility coverage

## R3: Model quality degradation during fallback
Treatment:
- risk-to-profile allowlist
- benchmark by task class
- review elevation on trust-tier downgrade

## R4: Skill drift / prompt drift
Treatment:
- schema and compiler
- signed compiled skill artifacts
- CI validation
- ownership metadata

## R5: State loss during worker failure
Treatment:
- PostgreSQL as source of truth
- Redis locks and queues
- resumable run state machine
- artifact snapshots

## R6: External skill trust and prompt injection
Treatment:
- trust levels
- import quarantine
- static scan
- review workflow
- runtime allowlist

## R7: OSS adoption friction
Treatment:
- one-command install path
- clear docs
- demo that works in under 15 minutes
- contributor quickstart

## R8: Upgrade and deprecation drift
Treatment:
- model registry
- provider registry
- migration maps
- release notes discipline
- version targets

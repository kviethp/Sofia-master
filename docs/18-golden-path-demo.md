# Golden Path Demo

## Goal
Prove a clean install can execute a simple, understandable workflow end-to-end.

## Demo scenario
"Add a simple login page scaffold to a demo app and produce a verification report."

## Expected flow
1. user creates a demo project
2. user submits task
3. Sofia resolves workflow template and risk
4. doctor and preflight pass
5. planner worker generates plan
6. builder worker produces scaffold patch or simulated artifact
7. verifier worker produces test/report artifact
8. run closes with ledger, trace, artifacts, and summary

## Required outputs
- task record
- run record
- plan artifact
- build artifact
- verify artifact
- usage ledger record
- summary report

## Public demo constraints
- no secrets
- low-risk paths only
- reproducible in one machine
- clear screenshots or logs

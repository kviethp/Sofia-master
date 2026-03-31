# Runnable Scaffold Plan

## Required runtime pieces for first runnable build
- API starts
- DB migration runs
- Redis connects
- doctor can call 9Router model listing
- smoke can insert and read a task
- worker can consume one queued task and write a simulated artifact
- OpenClaw adapter can validate config without executing live changes

## Definition of scaffold-runnable
A build qualifies as scaffold-runnable when:
- services boot consistently
- health endpoints pass
- doctor creates a report
- one synthetic task goes through created -> queued -> running -> completed
- artifacts and usage ledger rows are written

## First non-goal
Do not attempt full UI polish or advanced workflow automation before scaffold-runnable stability.

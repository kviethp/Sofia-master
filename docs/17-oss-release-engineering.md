# OSS Release Engineering

## Versioning
- use semantic versioning for Sofia Master
- pin tested compatibility versions in release notes

## Release channels
- canary
- stable

## Required release artifacts
- source tarball / Git tag
- changelog
- compatibility notes
- migration notes
- example config diffs

Current pack status:

- changelog: present
- compatibility notes: present
- migration notes: present

## Repository hygiene
- issue templates
- PR template
- codeowners
- CI checks
- license
- security policy

Current pack status:

- bug report template: present
- feature request template: present
- PR template: present
- CODEOWNERS: present
- CI checks: scaffold baseline present
- bootstrap script: present
- pnpm workspace manifest: present

## Open-source acceptance bar
A release should not be promoted as public-ready unless:
- install path works from clean machine
- golden path works
- doctor catches common failures
- contributor quickstart is verified

## Current automation

- `node scripts/skills-validate.mjs`
- `node scripts/skills-compile.mjs`
- `node scripts/agent-system-conformance.mjs`
- `node scripts/release-readiness.mjs`
- `node scripts/release-bundle.mjs`
- `node scripts/release-acceptance.mjs`
- `pnpm skills:validate`
- `pnpm skills:compile`
- `pnpm agent-system:conformance`
- `pnpm release:readiness`
- `pnpm release:acceptance`
- CI now runs release-readiness before doctor/preflight/smoke
- `release-bundle` now also updates `.sofia/releases/latest.json` so acceptance can validate the latest artifact without an explicit label

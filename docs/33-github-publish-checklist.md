# GitHub Publish Checklist

Use this checklist immediately before pushing the repository public.

## Repository hygiene

- [ ] `.env` is not present in the repository root
- [ ] `.sofia/` is not present in the repository root
- [ ] `node_modules/` is not committed
- [ ] no temporary debug files remain
- [ ] `.gitignore` is present and reviewed

## Secrets and private data

- [ ] no real control tokens are in tracked files
- [ ] no Telegram bot token or Telegram user ID is in tracked files
- [ ] no VPS password is in tracked files
- [ ] no production or staging `.env` files are tracked
- [ ] private operator notes remain outside the repository

## Docs and links

- [ ] `README.md` renders correctly on GitHub
- [ ] `docs/public/PRODUCT-OVERVIEW.md` reflects current product state
- [ ] install, operations, and staging/prod docs are linked from the README
- [ ] all public-facing links use relative repository paths

## Packaging and release

- [ ] `docs/public/CHANGELOG.md` includes `v1.0.0`
- [ ] `docs/public/RELEASE-NOTES-v1.0.0.md` is present
- [ ] `pnpm-lock.yaml` and `pnpm-workspace.yaml` are committed
- [ ] systemd and Nginx templates are committed

## Validation evidence

- [ ] source-tree `final-readiness` has passed
- [ ] deployed VPS `final-readiness` has passed
- [ ] deployed VPS `conformance` has passed
- [ ] release bundle path has been exercised at least once

## Suggested push sequence

1. create a clean git branch
2. review `git status`
3. review `git diff --stat`
4. commit publish-ready docs and hygiene changes
5. tag `v1.0.0`
6. push branch and tag
7. publish GitHub release using `docs/public/RELEASE-NOTES-v1.0.0.md`

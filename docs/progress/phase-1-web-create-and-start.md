# Phase 1 Web Create And Start

## Summary

This slice makes the web shell more usable as a thin client over the Sofia API.

## Changes

- added `Create And Start` flow
- added recent-task `Start` action for queued tasks
- kept the shell API-driven and intentionally minimal

## Validation

- syntax/import check passed for `apps/sofia-web/src/index.js`
- rendered HTML includes:
  - `Create And Start`
  - `window.sofiaWeb.startTask`

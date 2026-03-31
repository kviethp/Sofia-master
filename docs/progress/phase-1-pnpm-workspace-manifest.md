# Phase 1 pnpm Workspace Manifest

## Summary

This slice adds `pnpm-workspace.yaml` so self-host installs stop relying on deprecated workspace inference from `package.json`.

## Added

- `pnpm-workspace.yaml`

## Goal

Make production and release installs quieter and more deterministic when using pnpm on the VPS.

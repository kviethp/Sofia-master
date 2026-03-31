# Compatibility Matrix

## Target matrix

| Component | Target policy |
|---|---|
| Node.js | 22.16+ or 24.x |
| OpenClaw | pin tested version in release metadata |
| 9Router | pin tested version or commit window in release metadata |
| API style | OpenAI-compatible `chat/completions` first |
| Responses API | experimental behind adapter feature flag |
| Host binding | prefer `127.0.0.1` for local adapter testing |

## Supported modes

- local dev on single machine
- docker-compose self-host
- CI smoke execution with mocked provider

## Unsupported until validated
- blind assumptions about every OpenAI-compatible server
- unknown provider-specific tool-call dialects
- direct overwrite of user runtime config

## Release metadata requirement

Every release must publish:
- tested OpenClaw version
- tested 9Router version
- tested Node version
- supported model profile defaults
- migration notes

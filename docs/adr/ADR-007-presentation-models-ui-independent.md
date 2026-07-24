# ADR-007 — Studio presentation models are UI-framework independent

Status: Accepted
Date: 2026-07-24

## Context
JSR must serve any renderer (React, mobile, native) without coupling.

## Decision
All Studio outputs (Cards, Timelines, Workspaces, Sessions, Revisions) are
plain immutable data models with no framework, DOM, or rendering imports.
No React, Next, Compose, Flutter, or Web Component code lives in
`src/lib/studio/**`.

## Consequences
- Renderers consume Studio via the public API only.
- Deterministic snapshots enable persistence, replay, and testing.
- Architecture-fitness tests prevent regressions.

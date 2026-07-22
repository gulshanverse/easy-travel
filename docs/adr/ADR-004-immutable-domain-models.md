# ADR-004: Agent domain models remain immutable

- Status: Accepted
- Date: Sprint I-012

## Context

Agent state is inspected concurrently by the manager, event bus, telemetry
sink, governance engine and tests. Mutable models produce action-at-a-distance
bugs and complicate snapshotting.

## Decision

All domain entities (`Agent`, `Intent`, `AgentPlan`, `AgentTask`,
`AgentResponse`, `Session`, `Conversation`, `ConversationTurn`) are
constructed through factories that `Object.freeze` the value and all nested
objects/arrays. Mutation is performed by producing a new frozen value; the
registries hold the latest version keyed by id.

## Consequences

- Snapshots (`AgentSnapshot`, `ConversationSnapshot`) are trivially safe.
- History is a plain append-only list of frozen values.
- Tests can compare deep-equal without defensive copies.

## Alternatives Considered

- Persistent data-structure library. Rejected: overkill; `Object.freeze` and
  copy-on-write are sufficient at current volumes.
- Mutable models with mutex. Rejected: hides races and defeats snapshotting.

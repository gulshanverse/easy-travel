# ADR-015 — Workflow state is deterministic and replayable

**Status:** Accepted (Sprint I-016)

## Context
Debugging, recovery and auditing require the ability to reconstruct any workflow
instance's state without re-executing side effects.

## Decision
Every state change appends an immutable `WorkflowHistoryRecord`. `replayWorkflow()`
rebuilds terminal status, per-step statuses and outputs from history alone, with no
clock access, no randomness and no I/O. Checkpoints and snapshots are derived views of
the same history.

## Consequences
- Domain models are frozen; transitions produce new instances.
- Event routing and queue ordering are deterministic (dueAt → priority → insertion order).
- `replayMatchesState(replay, instance.state)` is asserted in the test suite.

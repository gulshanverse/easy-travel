# ADR-013 — Long-running execution is owned exclusively by WAR

**Status:** Accepted (Sprint I-016)

## Context
Several engines could plausibly host long-running work (CTOR executes DAGs, the Agent
Runtime reasons over multi-step requests, IPCF retries connector calls). Duplicating
timers, waits and retries across them would make behaviour non-deterministic.

## Decision
The Workflow & Automation Runtime (`src/lib/workflow`) is the single owner of
long-running, event-driven execution: workflow definitions and instances, lifecycle
states, scheduling, timers, signals, retries, compensation, checkpointing and history.
No other engine may schedule, suspend or resume long-running work.

## Consequences
- WAR holds all timer/scheduler state in memory behind a `WorkflowClock` abstraction; no OS cron, no persistence, no distributed scheduling.
- CTOR keeps short-lived DAG execution for a single capability request; anything that spans waits or events becomes a workflow.
- Determinism is testable: a `TestClock` fully controls time.

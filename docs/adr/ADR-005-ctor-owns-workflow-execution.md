# ADR-005: CTOR owns workflow execution

- Status: Accepted
- Date: Sprint I-012

## Context

Workflow execution (DAG scheduling, parallel steps, retries, timeouts,
cancellation, tracing) is the sole responsibility of CTOR. The Agent
Runtime must not re-implement any part of it, or the two engines will drift.

## Decision

`AgentManager.handleRequest` produces an `AgentPlan` and hands off execution
to CTOR through `AgentCTORPort.runWorkflow`. The plan carries only
capability/task metadata (id, capabilityId, dependsOn, input). Retries,
backoff, timeouts, cancellation and DAG scheduling are supplied by CTOR at
the far end of the port.

## Consequences

- ARP contains no scheduler, no retry loop and no timeout logic beyond a
  policy `executionBudgetMs` that is passed through to CTOR.
- Failure semantics are single-sourced in CTOR.
- ARP tests use a stub `AgentCTORPort` for deterministic execution.

## Alternatives Considered

- A lightweight ARP-local executor for "trivial" plans. Rejected: creates
  two truths for cancellation and timeouts.
- Passing raw workflow objects into CTOR. Rejected: leaks CTOR types across
  the boundary; the port converts at the composition seam.

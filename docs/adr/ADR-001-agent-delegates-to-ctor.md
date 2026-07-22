# ADR-001: Agent Runtime delegates all execution exclusively to CTOR

- Status: Accepted
- Date: Sprint I-012

## Context

The Agent Runtime Platform (ARP) hosts multiple specialised agents that must
reason over Memory, Journey, Decision, Trust, Goal, Spatial and Knowledge
Graph engines. Allowing agents to invoke those engines directly would create
duplicate scheduling, retry, timeout and observability logic, and would
bypass the frozen Capability & Tool Orchestration Runtime (CTOR).

## Decision

An agent never invokes another engine directly. All capability, tool and
workflow execution occurs through the `AgentCTORPort` interface, which is
fulfilled by an adapter over CTOR at composition time. The Agent Runtime owns
reasoning (intent, planning, selection, response assembly); CTOR owns
execution.

## Consequences

- Uniform scheduling, retry, timeout, cancellation and tracing (CTOR-owned).
- Agent code contains no engine imports and no scheduling logic.
- New engines integrate by publishing capabilities to CTOR; agents pick them
  up through the port with no ARP code changes.
- Testing ARP requires only a CTOR port stub.

## Alternatives Considered

- Direct engine imports in agents. Rejected: duplicates CTOR features, breaks
  boundary, and violates the frozen-engine contract.
- Per-agent capability adapters. Rejected: fragments observability and
  scheduling; increases surface area.

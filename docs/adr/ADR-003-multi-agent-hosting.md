# ADR-003: The Agent Runtime hosts multiple agent types

- Status: Accepted
- Date: Sprint I-012

## Context

Easy Trip needs many specialised agents (booking, visa, budget, safety,
discovery, support) plus a `TravelOrchestrator`. A single chatbot cannot
express the domain. Hosting many agents in the same runtime is required to
share planning, selection, session and conversation infrastructure.

## Decision

`AgentRuntime` hosts a first-class `AgentRegistry` keyed by `AgentIdentity`.
Any conforming `Agent` value can be registered; the runtime provides shared
services (sessions, conversations, intent, planning, selection, governance,
response assembly). One built-in agent (`TravelOrchestratorAgent`) ships
now; future agents are surfaced as interfaces in the capability manifest
under `futureIntegrations`.

## Consequences

- New agents are added by writing a factory that returns an `Agent`; no
  runtime changes are required.
- Delegation between agents is a first-class task kind (`delegate`).
- Governance policies apply per-agent and per-delegation.

## Alternatives Considered

- One agent per process. Rejected: prevents shared session/conversation state
  and complicates delegation.
- Hard-coded agent set. Rejected: prevents third-party or per-tenant agents.

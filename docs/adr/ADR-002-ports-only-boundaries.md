# ADR-002: Engines communicate only through ports

- Status: Accepted
- Date: Sprint I-012

## Context

Every previously delivered engine (Memory, Prompt, Runtime Kernel, Provider,
Graph, Journey, Decision, Trust, Goal, Spatial, CTOR) publishes typed
port interfaces for external interop. Cross-engine imports would re-introduce
hidden coupling, circular dependencies and boundary violations that the
frozen contracts explicitly forbid.

## Decision

The Agent Runtime declares its dependencies only through interfaces defined
in `src/lib/agent/ports.ts` (`AgentCTORPort`, `AgentKernelPort`,
`AgentPolicyPort`, `AgentAuditPort`). No file under `src/lib/agent/**` may
import a concrete engine. Composition happens outside the engine, in
application code, where adapters bind the port to the concrete
implementation.

## Consequences

- ARP source contains zero string references such as `@/lib/ctor`,
  `@/lib/memory`, `@/lib/journey` and so on. This is enforced by an
  architecture-fitness test.
- Adapters live in application composition code, not inside engines.
- Engines can evolve independently; only port signatures are load-bearing.

## Alternatives Considered

- Direct imports from `@/lib/ctor`. Rejected: creates coupling that would
  compound as more engines are added.
- Dependency-injection container. Deferred: unnecessary complexity for the
  current scope; ports + constructor injection are sufficient.

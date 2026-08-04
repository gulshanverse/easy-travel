# ADR-019 — Identity integrates with other engines through ports only

Status: Accepted (Sprint I-018)

## Context
The Identity, Personalization & User Platform must serve Agent, Workflow,
Studio and Memory runtimes without coupling to any of them, and without
importing connectors or providers.

## Decision
Identity declares structural ports (`src/lib/identity/ports.ts`) for every
external subsystem it needs — memory, agent, workflow and studio. Consumers
inject implementations; Identity ships no-op defaults. Identity never imports
a connector, provider, transport or another engine's internals, and exposes
its surface through `IdentityRuntime` plus the engine contract/manifest.

## Consequences
- Identity is testable in isolation with no external subsystem running.
- Other engines depend on the published contract, never on internal modules.
- Adding a new consumer requires a port, not a change to Identity internals.

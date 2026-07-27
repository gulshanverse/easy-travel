# ADR-014 — Workflow execution delegates capabilities to CTOR

**Status:** Accepted (Sprint I-016)

## Context
Workflows must invoke travel capabilities (PNR status, live train, seat availability)
without becoming a second capability runtime or importing connectors.

## Decision
WAR owns orchestration only. Every capability call is delegated through ports:
`WorkflowCtorPort` (capabilities/tools), `WorkflowIntegrationPort` (IPCF connectors) and
`WorkflowAgentPort` (reasoning). WAR contains no business logic, no provider code and no
domain-engine imports.

## Consequences
- Steps carry capability identifiers as opaque strings resolved by CTOR/IPCF at runtime.
- Built-in travel workflows reference railway capability ids without importing the railway suite.
- Architecture fitness tests fail the build on any forbidden import.

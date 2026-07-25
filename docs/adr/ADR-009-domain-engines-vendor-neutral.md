# ADR-009: Domain engines remain vendor-neutral

**Status:** Accepted — Sprint I-014

## Context
Domain engines (Memory, Journey, Decision, Trust, Goal, Spatial, Graph, Prompt,
Studio) model travel intelligence. Embedding vendor names, payload shapes, or
authentication details inside them would couple business reasoning to a supplier.

## Decision
Domain engines MUST NOT reference any provider, vendor, SDK, or wire format.
They express needs as capabilities; IPCF resolves those to connectors.
The architecture fitness suite fails the build if IPCF references a known
provider name, and IPCF may not import any domain engine.

## Consequences
- Suppliers can be swapped without touching intelligence code.
- Vendor quirks live in connector definitions and transformation hooks.
- Tests for domain engines stay deterministic and offline.

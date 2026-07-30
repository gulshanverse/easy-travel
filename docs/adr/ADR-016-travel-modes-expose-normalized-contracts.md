# ADR-016: All travel modes expose normalized contracts

Status: Accepted (Sprint I-017)

## Context

Easy Trip is expanding from railway-only intelligence into a multi-modal travel
platform covering flights, hotels, maps, weather, local transport, currency and
timezones. Each real-world domain has many possible providers, each with its own
payload shape, naming conventions, units and error semantics. If those shapes
leaked into planning, decision or presentation layers, every provider swap would
ripple through the entire platform.

## Decision

Every travel mode exposes a **provider-independent capability contract** and
returns **normalized immutable models**. Contracts live in
`src/lib/multimodal/contracts.ts`; models in `src/lib/multimodal/models.ts`.

- A capability contract declares id, mode, version, inputs, required inputs,
  output model name, cacheability and volatility. It never names a provider.
- Provider payloads are raw and untrusted; `normalization.ts` is the only place
  allowed to translate raw payloads into `Normalized*` models.
- Adding a provider means implementing `TravelProviderAdapter` — never changing
  a contract or a model.

## Alternatives considered

1. **Pass provider payloads through unchanged.** Fastest to build, but couples
   every consumer to a vendor schema. Rejected.
2. **One normalized model per provider family.** Reduces translation code but
   fragments the type system and defeats comparison across modes. Rejected.
3. **Runtime schema negotiation.** Powerful, but non-deterministic and
   untestable offline. Rejected.

## Consequences

- Consumers depend only on contracts, so mock and real providers are
  interchangeable.
- Every new capability requires a contract entry, a model, and a normalization
  branch — deliberate friction that keeps the surface honest.
- Normalization is a hot path; it stays pure and allocation-light.

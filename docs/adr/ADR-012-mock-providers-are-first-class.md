# ADR-012: Mock providers are first-class implementations

**Status:** Accepted — Sprint I-015

## Context
Real railway providers require credentials, captchas and network access, none
of which belong in the platform's development or test loop.

## Decision
`MockRailProvider` is a first-class adapter implementing the full railway
contract surface with a deterministic dataset (1200 stations, 600 trains) and
no network access. Real-operator adapters ship as contract stubs that declare
their capability surface and fail closed until a host supplies transport.

## Consequences
- The whole suite is exercisable offline and deterministically in CI.
- Provider independence is continuously verified against a functional provider.
- Booking, payments, credentials and captcha handling remain out of scope.

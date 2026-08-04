# ADR-020 — Identity never selects, ranks or books travel

Status: Accepted (Sprint I-018)

## Context
Preferences and personalization signals are tempting places to embed travel
decisions, which would duplicate the Decision, Journey and Workflow engines.

## Decision
Identity owns users, profiles, preferences, favorites, saved journeys,
notifications, privacy and statistics only. It produces preferences, signals
and context; it never selects an option, ranks alternatives, prices anything
or initiates a booking. Downstream engines consume Identity output as input.

## Consequences
- No travel option, price or inventory model may enter Identity.
- Personalization output is advisory data, not a decision.
- Removing Identity degrades personalization but never breaks booking flows.

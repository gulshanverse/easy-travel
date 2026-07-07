# Journey Studio — Milestone 6

Journey Studio is the flagship product experience of Easy Trip. It is the
central multi-panel workspace where every trip is created, planned, edited,
managed and experienced. Users should rarely leave Studio.

Route: `/studio` (authenticated).

## Architecture

Studio is a **pure UI layer** that consumes existing SDKs only. It does not
call the database, TIE server modules or AI Core directly.

```
UI (components/studio/*)
  │
  ├─▶ capabilitiesClient   (@/lib/capabilities/sdk)   ← planner, budget, weather, recs…
  ├─▶ tieClient            (@/lib/tie/sdk)            ← journey/timeline/version/export
  └─▶ aiClient             (@/lib/ai/sdk)             ← streaming assistant, memory
```

No new architectural layers were introduced. The platform (Auth, DB, AI
Core, TIE, TIOS, Capabilities) remains frozen.

## Component hierarchy

```
StudioShell                       (routes/_authenticated/studio.tsx)
├── StudioProvider                (client state + undo/redo, snapshots)
├── TopBar                        (search, palette entry, undo/redo, share, export, user)
├── LeftPanel                     (conversations, saved, templates, recents, collections, pins, AI memory)
├── CenterCanvas                  (editable journey → days → activities, DnD, inline edit)
├── RightPanel                    (Intel · Budget · Weather · Risks · Recs · Packing · Visa · Safety)
├── BottomTimeline                (per-day timeline chips + recent version snapshots)
├── AIComposer                    (planner-backed prompt; produces structured cards, never prose)
├── CommandPalette                (⌘K — filterable command list)
└── MobileNav                     (bottom nav + floating AI composer for < xl)
```

### Cards (`components/studio/cards/index.tsx`)
`StudioCard`, `CardHeader`, `ActivityCard`, `TimelineCard`, `JourneyCard`,
`BudgetCard`, `WeatherCard`, `RiskCard`, `RecommendationCard`, `PackingCard`,
`MapCard`, `FlightCard`, `HotelCard`, `AIThinkingCard`.

All cards are presentational. Behaviour lives in panels.

## Interaction map

| Interaction              | Trigger                                | Effect                                          |
|--------------------------|----------------------------------------|-------------------------------------------------|
| Plan a journey           | AIComposer submit / ⌘⏎                 | `plannerClient.run` → replaces journey (snapshot)|
| Edit title inline        | Click journey title                    | `patchJourney` (snapshot)                        |
| Add activity             | Day header "+" or empty state          | `addActivity` (snapshot)                         |
| Move activity            | Drag card → drop on another day        | `moveActivity` (snapshot)                        |
| Remove activity          | Hover → Remove                         | `removeActivity` (snapshot)                      |
| Add recommendation       | Click recommendation card              | `addActivity` into day 1                         |
| Switch intel tab         | Right-panel chip                       | `setRight(tab)`                                  |
| Undo / redo              | ⌘Z / ⌘⇧Z, top-bar buttons              | Rewinds snapshot                                 |
| Command palette          | ⌘K                                     | Fuzzy commands (tabs, panels, add day, undo…)   |
| Collapse a panel         | Chevron in the panel header            | `toggle("left"\|"right"\|"bottom")`             |

## User flows

1. **First-time plan**: Studio boots with an empty journey → user prompts
   the composer → planner capability returns a structured `PlannerOutput` →
   Studio maps it into a `StudioJourney` and pushes a snapshot.
2. **Refine**: User drags/edits activities, tweaks title/summary; every
   change is undoable and visible in the bottom timeline strip.
3. **Explore intelligence**: Right panel exposes Budget/Weather/Risks/Recs/
   Packing/Visa/Safety. Recommendations can be added into the itinerary
   with one click.
4. **Recover**: Command palette (⌘K) exposes destructive-free operations
   including undo/redo, add day, and panel toggles.

## Accessibility report

- **Landmarks**: Single `<main id="studio-main">` inside the shell; header,
  aside (left/right), and footer for the timeline.
- **Skip link** to `#studio-main` from the first tab stop.
- **Keyboard**: ⌘K (palette), ⌘Z / ⌘⇧Z (undo/redo), ⌘/ (toggle right panel),
  Enter/Space activates cards flagged `interactive`, palette navigable via
  Arrow/Enter/Escape.
- **Focus**: Visible focus rings via `focus-visible:ring-*` on interactive
  cards; disabled undo/redo buttons dim opacity.
- **ARIA**: Icon-only buttons carry `aria-label`; the palette container is
  `role="dialog"` with `aria-label`; the mobile nav uses
  `aria-label="Studio quick actions"`.
- **Screen readers**: Composer textarea has an `sr-only` label; drag/drop
  actions are mirrored by the "+ Add" button so the itinerary can be built
  fully by keyboard.
- **Colour**: All tones come from semantic tokens (`primary`, `accent`,
  `muted`, `destructive`); no hardcoded hex.
- **Responsive**: Grid + `min-w-0` + `shrink-0` on the composer row and top
  bar; left/right panels hide below `lg`/`xl` and are replaced by the mobile
  bottom nav plus a floating composer.

## Performance considerations

- **Client-only state**: Undo history capped at 50 entries; future at 50.
- **Optimistic updates**: All edits mutate local state immediately and are
  fully undoable; SDK writes can be layered on later without changing the
  UI contract.
- **Lazy panels**: Right-panel tabs render on demand.
- **Streaming ready**: `aiClient.streamAgent` is available if a future
  release wants token-level streaming in the composer.
- **Virtualization hook**: Day lists render a single `<ul>` per day; when
  itineraries grow, swap the inner list for `react-virtual` without
  touching cards or state.

## State contract

`StudioProvider` (in `components/studio/state/StudioContext.tsx`) exposes:

- `state.journey`, `state.history`, `state.future`
- `state.selectedActivityId`, `state.rightPanel`, panel collapse flags,
  `state.thinking`
- `actions.{replaceJourney, patchJourney, addActivity, updateActivity,
  removeActivity, moveActivity, select, setRight, toggle, undo, redo,
  setThinking, nextActivityId}`
- `plannerOutputToJourney(...)` — maps the `planner` capability output
  into the Studio journey shape.

Studio consumers must go through this provider; never call the DB or
server modules directly.

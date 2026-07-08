# Journey Studio — Product Requirements Document

**Version:** 2.0 (Product Architecture & Workspace Blueprint)
**Status:** Additive extension of PRD v1.0 (Foundation) and v1.1 (Strategy, Trust, Business & Governance). Nothing prior is rewritten.
**Owners:** CPO, Principal UX Architect, Staff Product Designer, Staff Frontend Architect, Systems Designer.
**Governing documents:** Master Vision v1.0, PRD v1.0, PRD v1.1.
**Scope note:** Sections 18–29 only. This is a *blueprint*: object models, states, behaviours, and relationships. It contains no visual design, no component contracts, no code, and no framework choices. IA, UX architecture, motion, and technical design (as distinct future artefacts) will follow only after approval.
**Reading convention:** every object and state is named in `PascalCase` to make them citable in future documents. Relationships use plain English, not code.

---

## Section 18 — Information Architecture

The IA is a tree of first-class *places* plus a graph of first-class *objects* that can appear in more than one place. Places are stable and few; objects are many and travel between places.

### 18.1 Global Navigation (constant across the product)

The top-level surfaces a signed-in traveller can be in:

- **Home** — the editorial landing surface (marketing + entry point for new trips). Not part of Studio; leads *to* Studio.
- **Studio** — the workspace where every trip lives (this document's focus).
- **Library** — the traveller's personal archive: past trips, memoirs, templates, saved places, followed creators.
- **Memory** — the human-readable view of what Studio knows about the traveller (see §25).
- **Inbox** — a single, calm queue of things that need the traveller's attention across all trips (invites, price movements, disruption alerts, replies).
- **Account** — identity, subscription, connected services, privacy, exports.

Global Navigation is deliberately narrow. Every additional top-level item is a tax on the traveller's mental model.

### 18.2 Workspace Navigation (inside Studio)

Inside Studio there are five *permanent* navigation dimensions. They are dimensions, not menus — they should be reachable at all times, not clicked through.

1. **Trip Switcher** — moves between the traveller's active/planned/past trips without leaving Studio.
2. **Chapter Rail** — moves between the 8 journey chapters (Dream → Share, PRD v1.0 §6) of the current trip. The Chapter Rail is the primary narrative navigation.
3. **Panel System** — brings any of the workspaces (§19) into view without leaving the current chapter.
4. **Command Surface** — a keyboard-first way to reach any object, action, or place instantly.
5. **Contextual Actions** — actions attached to the currently-selected object.

There is no traditional sidebar hierarchy. Studio is navigated by *what the trip is doing*, not by folders.

### 18.3 Journey Hierarchy

A traveller's data hierarchy inside Studio:

```
Traveller
  └── Trip (the Journey object, §20)
        ├── Chapters (fixed set: Dream, Discover, Compare, Plan, Book, Travel, Remember, Share)
        ├── Legs         (a leg = a contiguous stay in one place)
        │     ├── Days
        │     │     ├── DayBlocks (Morning / Afternoon / Evening / Night)
        │     │     │     └── Activities
        │     │     └── DayNotes
        │     ├── Accommodation (0..n; typically 1 per leg)
        │     └── Transport in / out of the leg
        ├── Bookings           (cross-cutting; see §18.7)
        ├── Documents          (cross-cutting)
        ├── Budget             (single object per trip, §20)
        ├── Companions         (people on this trip)
        ├── Memories           (moments captured during/after the trip)
        └── Health             (Journey Health, §27)
```

Chapters are *lenses over the same trip*, not folders that contain different data. A day exists once and is *seen* differently in Plan vs. Travel vs. Remember.

### 18.4 Project Structure — the "Trip" is the project

There is exactly one project unit in Studio: the **Trip**. We deliberately reject nested projects, workspaces-inside-workspaces, and folders. If a traveller wants to organise trips, that is a Library concern (tags, collections), not a hierarchy concern.

A Trip owns its own:
- title, dates (soft and hard), traveller list, currency, pace, visibility, and tags;
- state (see §23);
- version history;
- collaborators and their roles;
- AI memory scoped to this trip;
- access control.

### 18.5 Day Structure

A Day is not a container of activities. It is a *shaped span of time* with an editorial identity.

- **Anchor**: the date (may be null in "shape-first" drafts where the trip is dated later).
- **Location**: the city or region for the day (inherited from the Leg unless overridden).
- **Title**: an editorial sentence, human-written or AI-drafted (see §22).
- **DayBlocks**: Morning / Afternoon / Evening / Night. Blocks are ordinal buckets, not clocks — they allow soft planning without forcing timeslots. A Block *may* resolve to precise times when needed (transport, reservations).
- **Tempo**: `slow | balanced | packed` — informs recommendations and Health.
- **DayNotes**: free-form notes and moments (later become Memory material).
- **Weather forecast** for the day (attached, refreshed).
- **Health snapshot** for the day (see §27).

**Recommendation vs. the current codebase:** the existing `trip_days` model can carry the above without schema disruption; DayBlocks are a *presentational grouping* over Activities' ordering, not a new table.

### 18.6 Activity Structure

An **Activity** is the smallest unit of a trip that carries meaning to the traveller.

- **Kind**: `experience | meal | rest | transit | admin | free-time | reservation | booking-anchor`.
- **Title**, **description**, **duration (soft/hard)**, **anchor time (optional)**, **cost (cents + currency)**, **place**, **weather sensitivity**, **energy cost**, **crowd sensitivity**, **kid-friendly / accessibility tags**, **source** (AI-drafted, user-added, imported, template).
- **Reasons** (attached explanation, see §22 & §26): why this activity was suggested.
- **Alternatives** (siblings the AI considered).
- **Links** to Bookings, Documents, and Memories.
- **State**: `draft | confirmed | booked | in-progress | done | skipped | cancelled`.

Activities are the primary unit of drag/drop, undo, and versioning.

### 18.7 Booking Structure

Bookings are **first-class, cross-cutting objects**. They are not children of days. A single Booking may cover multiple days (a hotel), a segment (a flight), or a moment (a reservation).

- **Kind**: `stay | flight | rail | ground | experience | reservation | insurance | visa | other`.
- **State**: `wishlist | held | in-cart | paying | confirmed | changed | cancelled | refunded`.
- **Money**: pre-tax, tax, fees, currency, refundability, cancellation deadline, hold expiry.
- **Provider**: label + neutrality flags (PRD v1.1 §8.4).
- **Attachments**: PNRs, tickets, PDFs, QR codes (Documents).
- **Bindings**: which Activities, Days, or Legs this Booking realises.

A Booking's *lifecycle* is independent of the plan's lifecycle. A trip can be fully planned with zero bookings; a plan can be re-planned around a locked booking.

### 18.8 AI Layer

The AI Layer is *not a place* in the IA. It is a **field that permeates every place** (§22). Architecturally it consists of:

- **Trip AI** — reasoning tied to the current trip's state.
- **Traveller AI** — reasoning tied to the traveller's long-term memory (§25).
- **World AI** — reasoning tied to destination, weather, safety, seasonality (world model).

The IA never places "the AI" as a sidebar tab. Every surface has AI woven in as reasons, drafts, and quiet actions.

### 18.9 Memory Layer

Three tiers, each with its own scope and lifetime (fully specified in §25):

- **Short-term (Session Memory)** — current thought.
- **Trip Memory** — everything about this trip.
- **Long-term Memory (Journey DNA)** — the traveller across trips.

Memory is queryable by every surface but *owned* by the traveller (visible, editable, forgettable).

### 18.10 History Layer

Studio keeps a **continuous, addressable version history** of every Trip:

- **Snapshots** on every meaningful edit (see §21 undo model).
- **Named milestones**: "first draft," "after Meera's edits," "pre-departure," "post-trip."
- **Branches** (Premium/future): "what if we went in October instead."
- **Restore** is a first-class action; History is a place users visit, not a hidden log.

### 18.11 Collaboration Layer

- **Membership** on the Trip (roles in §24).
- **Presence** (who is here now).
- **Comments** anchored to any object (Activity, Day, Booking, Budget line, Memory).
- **Suggestions** — non-destructive proposals awaiting approval.
- **Decisions** — resolved suggestions with an owner and a rationale.
- **Assignments** — tasks assigned to a companion ("book the ferry").

Collaboration objects are *attached to* trip objects, not stored separately.

### 18.12 Settings Layer

Settings are split by scope and each lives where the scope lives, not in one giant settings page:

- **Traveller Settings** (Account): identity, subscription, connected services, privacy, notifications, exports, memory controls.
- **Trip Settings** (inside Studio): title, dates, currency, pace, visibility, collaborators, defaults, integrations for this trip.
- **Chapter Settings** (rare, inside a chapter): what appears in Dream, what the "eve" chapter includes.
- **Workspace Settings** (inside a panel): compactness, units, map style, keyboard bindings.

Every setting has a plain-language name, a reason it exists, and a sensible default. Anything requiring a doc to explain is a design failure.

### 18.13 Relationships summary

- A **Traveller** owns many **Trips**; a Trip has many **Companions** (some non-Travellers via guest links).
- A **Trip** has one **Budget**, one **Health**, one **VersionHistory**, and many of everything else.
- A **Leg** is a stay; **Days** are the leg's time; **Activities** are the day's shape.
- **Bookings** are cross-cutting and bind to Activities / Days / Legs.
- **Memories** are cross-cutting and reference Days, Activities, Bookings, and Companions.
- **Documents** are cross-cutting; anything can point at a Document.
- **Comments/Suggestions/Decisions/Assignments** anchor to any object.
- **Memory** is queryable by any surface with the traveller's consent.
- **Chapters** are lenses; they never fragment the underlying data.

---

## Section 19 — Workspace Blueprint

Studio is a **multi-workspace surface** whose currency is *panels of the same trip*. Panels are places, not modes. Each panel has a stable identity, a purpose, and a small set of promises.

Naming below is architectural (not UI copy).

### 19.1 Journey Canvas
- **Why it exists.** The primary craft surface where a Trip takes shape as an editable, editorial timeline of Legs → Days → DayBlocks → Activities.
- **Primary responsibilities.** Present the trip as a scrollable narrative; accept edits (add / remove / move / retitle / reshape); make first-draft plans one-gesture-accepting.
- **Secondary responsibilities.** Surface reasons for AI suggestions inline; expose alternatives; expose Health at a glance per day; render Memory drafts post-trip.
- **Future extensibility.** Multiple presentations (list, timeline, storyboard); branches; scenario overlays.

### 19.2 Living Map
- **Why it exists.** Geography as a first-class dimension (PRD v1.0 §P5). Every plan has a shape in space, and this shape is a decision input, not decoration.
- **Primary responsibilities.** Show every Activity, Booking, and route in real geography; support cross-linking (hover an activity, see it on the map, and vice versa).
- **Secondary responsibilities.** Route reasoning ("2h train, scenic vs. 45m flight"); density and walkability signals; safety and neighbourhood context; offline tile cache management.
- **Future extensibility.** 3D terrain, AR overlays, custom cartography per destination.

### 19.3 Timeline
- **Why it exists.** Time as a first-class dimension (P14). Compresses the full trip into a single readable strip: transport, sleep, activities, meals, buffer.
- **Primary responsibilities.** Show tempo and rhythm across days; reveal over-packed days; make jetlag, opening hours, and sunset legible.
- **Secondary responsibilities.** Drag-to-reflow; snap to golden hour; expose Health per day.
- **Future extensibility.** Group timeline for collaborators; timezone comparisons; per-companion timelines.

### 19.4 Inspector
- **Why it exists.** Any object selected anywhere gets its full context and actions here without a modal.
- **Primary responsibilities.** Read/edit the selected object; show its reasons, alternatives, dependencies, and comments; expose destructive actions with proper confirmation.
- **Secondary responsibilities.** Pin an object; move it between days; view its version history; branch a scenario.
- **Future extensibility.** Comparison inspector (two objects side by side); AI-assisted refinement in-place.

### 19.5 Travel Intelligence Panel
- **Why it exists.** The single home for *world knowledge* about the trip's destination(s): safety, visa, health, connectivity, currency, culture, seasonality, sustainability.
- **Primary responsibilities.** Present destination briefs sourced and dated; surface changes; propose actions ("visa needed — start now").
- **Secondary responsibilities.** Deep-links into the plan (a visa turns into a Document task; a health advisory adjusts activities).
- **Future extensibility.** Local expert routing; live risk feeds; per-destination editorial partners.

### 19.6 Budget Workspace
- **Why it exists.** Money as a *design material*, not an afterthought. Confidence about total spend is a primary emotional need (PRD v1.0 §7.4, JTBD-5).
- **Primary responsibilities.** Live total across bookings and estimates; per-day, per-category, per-companion views; ranges and confidence.
- **Secondary responsibilities.** Levers ("if we drop this, we save X"); alerts; split accounting for groups.
- **Future extensibility.** Multi-currency wallets; corporate policy overlay; predictive spend from Journey DNA.

### 19.7 Weather Workspace
- **Why it exists.** Weather is the largest exogenous variable in a trip.
- **Primary responsibilities.** Trip-scale forecast; day-scale forecast; per-activity sensitivity; historical seasonality when forecast is out of range.
- **Secondary responsibilities.** Adaptive suggestions ("Tuesday looks wet — swap to indoor"); packing implications; sunset/sunrise for tempo.
- **Future extensibility.** Ensemble models; long-horizon confidence bands; region-specific hazards.

### 19.8 Memory Workspace
- **Why it exists.** A private, human-readable view of what Studio remembers (per trip and lifetime).
- **Primary responsibilities.** Show, edit, forget, and export memory items.
- **Secondary responsibilities.** Reveal how memory influenced a recommendation; capture new preferences explicitly.
- **Future extensibility.** Memoir composition; sharing memory (with granular consent) with a companion or an agent.

### 19.9 Documents
- **Why it exists.** Every trip generates paper: tickets, passes, IDs, insurance, permits. They must live inside the trip, not in email.
- **Primary responsibilities.** Store, label, and surface documents at the right time (at check-in, at the border).
- **Secondary responsibilities.** Extract structured data (dates, PNRs) and link to Bookings; expiry monitoring for passports/visas.
- **Future extensibility.** Wallet integration; verifiable credentials.

### 19.10 Command Palette
- **Why it exists.** A keyboard-first universal input for navigating, editing, and reasoning about a trip.
- **Primary responsibilities.** Fuzzy find any object, chapter, panel, or action; execute commands; invoke AI with structured intents.
- **Secondary responsibilities.** Learn per-traveller frequency; expose recent objects; act as the entry to natural-language commands ("cheaper Tuesday").
- **Future extensibility.** Multi-step commands; scripted commands; scoped scripts (agencies, corporate).

### 19.11 Notifications
- **Why it exists.** The Inbox surface *inside* Studio and across the product. Calm, meaningful, and rare (§10, §11).
- **Primary responsibilities.** Route relevant events to the traveller at the right surface (in-Studio, mobile push, email digest).
- **Secondary responsibilities.** Group and rank; expose "quiet mode" per chapter; carry actionable next steps, not just facts.
- **Future extensibility.** Per-traveller notification personality; disruption escalation to human support.

### 19.12 Version History
- **Why it exists.** Reversibility everywhere (P11). Confidence to explore comes from the certainty that nothing is lost.
- **Primary responsibilities.** Timeline of snapshots and milestones; visual diff of Trip state; restore.
- **Secondary responsibilities.** Named milestones; per-object history; branch/scenario management (future).
- **Future extensibility.** Multi-traveller merge; comment threads on snapshots.

### 19.13 Ambient / cross-cutting workspaces (declared, not detailed)
- **Presence** (who is here), **Comments**, **Suggestions**, **Search**, **Help**, **AI Composer** — these are present throughout Studio, not confined to a single panel.

### 19.14 Panel composition rules
- No panel opens a modal that removes the trip from view.
- Any two panels can be visible side by side; panel arrangements are per-chapter defaults with per-traveller overrides.
- Every panel has a **quiet state** (readable at rest), an **active state** (during interaction), and a **collapsed state** (still glanceable).
- No panel invents its own visual dialect; all follow §11.

---

## Section 20 — Journey Object Model

The Journey is the trip. Every other object exists to serve it.

### 20.1 Journey (Trip)
- **Identity**: id, title, summary, dates (soft / hard), timezone anchor, currency, pace, visibility, tags, created/updated timestamps, owner.
- **State**: see §23.
- **Health**: computed (§27).
- **Ownership**: one Traveller owns; many Companions collaborate.
- **Lifecycle**: `Empty → Draft → Planning → Review → Booking → Travelling → Completed → Archived` (with side-states: Shared, Read-only, Conflict, Offline, Recovery, Loading, Syncing, AI-Thinking, Version-Restore).

### 20.2 City / Region / Place
- **Place** is the atomic geographic object: a point with an address, a category, and metadata (opening hours, price band, kid-friendliness, accessibility, sustainability rating, taste vector).
- **City / Region** are aggregates used for legs, briefs, and search.
- Places are *global* and shared; when the traveller edits a place inside a trip, the edit is trip-local and does not mutate the global place.

### 20.3 Leg
- A stay in one place for a contiguous set of days.
- **Owns**: accommodation slot, in/out transport slots, day range.
- **Lifecycle**: exists as soon as a destination is chosen; refined as dates and stay resolve.

### 20.4 Day
- Anchored to a date (may be null pre-scheduling).
- **Owns**: DayBlocks (ordinal), DayNotes, per-day weather, per-day health.
- **Lifecycle**: created with the Leg; deleted only if the leg shrinks.

### 20.5 Activity
- See §18.6.
- **Ownership**: belongs to exactly one Day; may reference a Booking, a Place, and Memories.
- **Lifecycle**: `draft → confirmed → booked → in-progress → done | skipped | cancelled`.

### 20.6 Transport
- A specialised Activity of `kind: transit` OR a Booking of `kind: flight | rail | ground`, depending on whether it's a plan or a fulfilment.
- **Owns**: origin, destination, mode, duration, cost, refundability, connections.

### 20.7 Hotels / Stays
- Modeled as a Booking of `kind: stay`, bound to a Leg's accommodation slot and to the Days it covers.
- **Owns**: check-in/out, refundability, cancellation deadline, room type, guest count, address, notes.

### 20.8 Flights
- Booking of `kind: flight`.
- **Owns**: PNR, segments (each with airline, flight number, times, terminal), fare class, seat, checked bags, refundability, disruption status.

### 20.9 Restaurants
- Modeled as a Place (global) plus an Activity of `kind: meal` in the trip, optionally with a Booking of `kind: reservation`.

### 20.10 Experiences
- Activity of `kind: experience`, optionally with a Booking of `kind: experience`.
- **Owns**: duration, meeting point, requirements (age, fitness), provider.

### 20.11 Weather
- Not an object owned by a Day; it is a **field** attached to Days and Activities, sourced from the Weather Workspace.
- **Lifecycle**: refreshed on a schedule and on user demand; historical seasonality retained for out-of-range dates.

### 20.12 Documents
- Owned by the Trip; may bind to Traveller, Companion, Booking, or Activity.
- **Lifecycle**: uploaded / imported → parsed (fields extracted) → linked → surfaced at the right moment → archived post-trip.

### 20.13 Companions
- A Companion is either a Traveller (has an account) or a Guest (invited via link).
- **Owns**: role (§24), preferences (opt-in), presence, permissions.
- **Lifecycle**: invited → joined → active → left (with permission fallback).

### 20.14 Budget
- Exactly one Budget per Trip.
- **Owns**: currency, target total (soft/hard), category buckets, per-day / per-companion projections, actuals from Bookings, confidence bands.
- **Lifecycle**: created with the Trip; updated on every plan or booking change; closed at trip completion.

### 20.15 Memories
- A Memory is a *moment* attached to a point in the trip: a photo, a note, a place, a quote, a receipt.
- **Owns**: media, timestamp, place, activity link, companion link, editorial caption (AI-drafted, user-approved).
- **Lifecycle**: captured in-trip or post-trip; curated in Remember chapter; woven into a memoir.

### 20.16 Bookings (recap)
See §18.7. A Booking is not "under" a day; it is a first-class object bound to plan objects.

### 20.17 Ownership summary
- **Trip owns**: Legs, Days, Activities, Budget, Health, Bookings, Documents, Memories, Companions, VersionHistory.
- **Global (referenced, not owned)**: Places, Providers, weather sources, world facts (visa, safety, health).
- **Traveller owns**: identity, memory, subscription, preferences, notification settings.

### 20.18 Rules of the object model
- One source of truth per object.
- All timestamps are stored in UTC; presentation resolves timezone from the relevant Leg or Traveller.
- All money is stored as integer minor units with an explicit currency.
- All spatial data is stored in geo (lng/lat); no address strings as coordinates.
- Every object has a stable id, a created/updated timestamp, a soft-delete field, and a "source" (user, ai, import, template, partner).
- Every mutation produces a versioned event (for §21 undo and §19.12 history).

---

## Section 21 — Interaction Architecture

Interactions are described here as *behaviours*, not motion.

### 21.1 Selecting
- Any object can be selected; selection is *single* by default and *multi* with modifier.
- Selection is preserved across chapter changes when the object still exists.
- The Inspector always reflects current selection.
- Selection has three sources of truth: pointer, keyboard, and command palette. All three must agree.

### 21.2 Dragging
- Every draggable object exposes a stable *grab affordance* and a *drop target contract*.
- Drag never crosses into destructive territory without a confirmation on drop (e.g., dragging into a "remove" area).
- During drag, invalid drop targets are announced (not silently refused).
- Drag preserves relative order among the dragged set (multi-drag).

### 21.3 Dropping
- Drops always land in a *predictable position* (before/after another object, or into a block).
- The system *reflows*: when an Activity moves, times, budget, and Health update immediately.
- If the drop violates a preference or policy, the system asks (§10.4) rather than blocks.

### 21.4 Editing
- Every field is *inline-editable* where the field lives; there is no separate "edit mode."
- Edits commit on blur or explicit confirm; Escape reverts.
- Long text fields autosize.
- Structured fields (dates, money, place) use dedicated editors that surface constraints (currency, timezone, place validation).

### 21.5 Deleting
- Deletes are always *soft*: the object goes into a recoverable state, not oblivion.
- Bulk deletes must summarise ("Delete Day 3 and its 5 activities?").
- Undo restores fully including bindings.

### 21.6 Reordering
- Reordering is available via drag, keyboard (Alt+Arrow), and command palette ("move to Day 4").
- Reordering across parents (Day → Day) is the same interaction as within.

### 21.7 Grouping
- Activities can be grouped into a **Cluster** (e.g., a "morning walk" that contains a café stop, a market, and a viewpoint).
- Groups can be collapsed, moved, split, and renamed as one.
- Groups are ordinary Activities with children; the hierarchy is one level deep.

### 21.8 Splitting
- A Cluster can be split back into constituent Activities without loss.
- A Day can be split (e.g., into "morning in city A / evening in city B" when transport is added mid-day); Studio proposes the split rather than forcing it.

### 21.9 Comparing
- Any two objects of the same kind (Hotels, Flights, Activities, Trips-as-branches) can be compared side by side.
- Comparison uses the Decision Model (§26) to name a winner and reasons.
- Comparison is *escapable* — the user can eject to either option without paperwork.

### 21.10 Undo
- Every meaningful mutation pushes a snapshot; undo rewinds by snapshot, not by keystroke.
- Undo works identically for user edits, AI actions, and imports.
- Undo is *global to the trip* by default and *object-scoped* on demand.
- History depth is generous (100+ snapshots) and pruned by age, not by ceremony.

### 21.11 Redo
- Redo is available until a new mutation branches off; branching is announced ("you have unsaved forward history — keep or discard?").
- Redo is symmetric with undo for every action type.

### 21.12 Search
- Two kinds:
  - **Object search** — within the current Trip: activities, notes, documents, companions.
  - **World search** — beyond the current Trip: places, destinations, templates.
- Search is *incremental*, keyboard-native, and supports natural language ("that rooftop bar Meera suggested").
- Search returns results with reasons and lets the user act on the result inline.

### 21.13 Command Palette
- The universal keyboard interface.
- Commands are typed intents (`add day`, `move activity to Day 4`, `find flights under $500`), scoped to the current selection when relevant.
- Every UI action must also exist as a command; if it doesn't, the UI shouldn't ship (P17.9).
- Palette exposes recent commands and learns per-traveller.

### 21.14 Keyboard-first workflows
- Studio is fully operable from keyboard alone.
- Global bindings (indicative, subject to accessibility & i18n review): open command palette; toggle each panel; undo/redo; move selection with arrows; move object with modifier+arrows; delete with a modifier; escape to release selection.
- Focus is *visible*, ordered, and preserved across chapter transitions.

### 21.15 Behaviour rules
- **Consistency > cleverness.** Same interaction, same result, everywhere.
- **Predictability > delight.** No hidden gestures.
- **Reversibility > confirmation.** Prefer allowing and undoing over blocking with a dialog.
- **Progressive disclosure.** Deep power hides behind command palette and keyboard; the surface stays calm.

---

## Section 22 — AI Behaviour Architecture

The AI is not a place; it is a *behaviour* of every place (PRD v1.1 §10). Architecturally it is composed of several modes that coexist. A mode is not a toggle — it is a role the AI plays in a moment.

### 22.1 Invisible AI
- Runs continuously in the background, doing work the user never sees unless they ask: precomputing budgets, prefetching offline tiles, indexing memory, sanity-checking the plan against opening hours.
- **Rule.** Invisible AI must never produce a UI change on its own. It only makes future interactions faster and better.

### 22.2 Predictive AI
- Anticipates the next likely need and *prepares* it, not surfaces it: pre-drafted next day, pre-computed budget deltas, pre-fetched weather.
- Surfacing happens on user action, not on prediction alone.

### 22.3 Reactive AI
- Responds to user actions with visible, immediate, explainable changes: after a drag, timings rebalance; after a date change, budgets and forecasts update.
- Reactive AI is the AI the user *feels* most.

### 22.4 Memory-driven AI
- Reads Journey DNA (§25) to personalise every reasoning act — from first draft to disruption replan.
- Never *cites* memory pushily ("because you like X"); memory shows up as *tone*, *defaults*, and *pre-selections*.

### 22.5 Decision Support AI
- On any comparison or trade-off, provides:
  - a **named winner**,
  - a **short reason**,
  - **one honest caveat**,
  - **1–2 alternatives** with why-not.
- Uses the Decision Model (§26).

### 22.6 Risk analysis
- Continuously evaluates: tight connections, refund windows, closing hours, visa timing, safety advisories, weather sensitivity, over-packed days.
- Risks are surfaced calmly at the object they concern (never a global "warnings" panel).

### 22.7 Trade-off explanation
- Every recommendation carries its trade-offs: what was traded for what.
- Trade-offs are explicit ("nearer beach, further from old town") not marketing ("perfect location").

### 22.8 Budget optimisation
- Continuously proposes small, reversible changes that meet stated goals ("under €2,000 for two").
- Levers are surfaced in Budget Workspace and in the Inspector when relevant.

### 22.9 Weather adaptation
- Days sensitive to weather earn *soft indoor alternatives* automatically; on forecast change the plan asks (never silently rewrites the itinerary above medium consequence).

### 22.10 Travel disruption
- Detects disruption from providers, weather, and public data.
- Proposes replan; asks before spending money; auto-acts within pre-authorised limits (Premium).

### 22.11 Planning confidence
- Emits a per-day and per-trip **Planning Confidence** score.
- Confidence is expressed as language, not numbers: "solid," "shaping up," "needs work" (see §10.7).

### 22.12 The anti-chatbot posture
- The AI does not sit in a chat panel waiting for prompts.
- Free-text intent lives in the Command Palette (§19.10, §21.13), *not* in a "chat with AI" box.
- Prose responses from the AI are *short*, *acted upon*, and *editorial* — never a wall of markdown.
- The AI does not chit-chat. It answers, drafts, and gets out of the way.
- The AI has no name and no persona (PRD v1.1 §10.14).

### 22.13 Coordinating the modes
At any moment, the AI is choosing between: *do nothing, prepare, propose, ask, act*. The choice is governed by the confidence and reversibility rules in §10.

---

## Section 23 — Workspace States

Studio has a **primary state machine** for a Trip and **overlay states** that can coexist with any primary state.

### 23.1 Primary Trip States

- **Empty** — Trip exists but has no content yet. Studio shows an editorial welcome, not a blank grid (§13).
- **Draft** — Trip has a shape (destination, rough dates) but no committed plan.
- **Planning** — Active editing; the plan is being crafted.
- **Review** — Plan is stable; user (and companions) are checking; comments and suggestions are prominent.
- **Booking** — Bookings are being made; commercial context is prominent; the plan is treated as semi-locked.
- **Travelling** — At least one day of the trip is `now`. Studio shifts to the day view (companion mode).
- **Completed** — All trip days are in the past; Remember chapter takes primacy.
- **Archived** — User has archived the trip; still fully accessible in Library.

### 23.2 Overlay States (compose with any primary state)
- **Offline** — no connection; Studio remains usable on cached data.
- **Shared** — trip has ≥ 1 non-owner participant.
- **Read-only** — the viewer lacks edit rights on this trip (or a specific object).
- **Conflict** — concurrent edits collide (§24).
- **Recovery** — Studio is restoring from a snapshot after a fault.
- **Loading** — a specific slice of data is being fetched; the rest of Studio is usable.
- **Syncing** — local edits are being flushed to the server after offline use.
- **AI Thinking** — a specific reasoning step is in flight; localised to the surface asking.
- **Version Restore** — a prior snapshot is being previewed or restored.

### 23.3 State transition rules
- Primary states are traversed one hop at a time (Empty → Draft → Planning → Review → Booking → Travelling → Completed → Archived), with allowed back-transitions (Booking → Planning, Review → Planning) but never a jump.
- **Travelling** is entered automatically at local midnight of Day 1 and exited automatically at local midnight after the last day.
- **Completed → Archived** is user-initiated or automatic after N months of inactivity, with notice.
- Overlay states can appear/disappear freely; they never block the primary flow.
- Every transition is logged in Version History with an actor (user, ai, system).

### 23.4 State visibility
- The primary state is always readable in Studio's status area, in plain language ("This trip is being planned").
- Overlay states surface only when they matter to the current action (an "offline" banner in the corner during offline; "AI thinking" localised where the AI is asked).

### 23.5 State-dependent defaults
- **Draft** favors exploration surfaces (Dream, Discover).
- **Planning** favors Journey Canvas + Living Map.
- **Booking** raises Budget and Documents.
- **Travelling** collapses everything into a calm day view; other panels are one gesture away.
- **Completed** favors Remember; Budget shows actuals; Memory workspace is emphasized.
- **Archived** is read-only by default; restoring is one action.

---

## Section 24 — Collaboration Architecture

Collaboration is native, not bolted on (P12). Groups plan real trips; solo tools force groups into WhatsApp; we refuse to.

### 24.1 Roles
- **Owner** — the traveller who created the trip. Sole authority to delete, transfer, or archive. Cannot be removed by anyone else.
- **Host** — a co-owner with all rights except deletion/transfer. Multiple hosts allowed.
- **Editor** — can add/edit/remove Activities, Days, Bookings within stated policy; cannot spend money without approval.
- **Viewer** — read-only; can comment and vote if enabled.
- **Guest** — invited via link, no account required; scoped to a subset of the trip; comments and votes allowed; cannot see private notes; auto-expires after trip completion unless promoted.

### 24.2 Presence
- Presence shows *who is here* per object, per panel, and per chapter.
- Presence is subtle (soft indicator, not shouting avatars).
- Focus follows presence hints when useful (e.g., "Meera is editing Day 3").

### 24.3 Comments
- Anchored to any object.
- Threaded, resolvable, and searchable.
- Comments never block edits; they annotate.

### 24.4 Suggestions
- Non-destructive proposals: "swap Hotel A for Hotel B," "move museum to Day 4."
- Suggestions carry a **proposer**, a **rationale**, and a preview of impact (budget, tempo).
- Any Editor or above can act on a suggestion; the suggestion decays if unresolved past its relevance window.

### 24.5 Approvals
- Certain actions *require* approval: any spend above a per-trip threshold, changing the trip title, promoting a Guest, deleting a Day, applying an AI plan wholesale.
- Approval is a lightweight, in-line act, not a workflow tool.

### 24.6 Task assignment
- Any Activity, Booking task, or Document can be assigned to a Companion.
- Tasks have optional due-by dates and appear in the assignee's Inbox.

### 24.7 Shared decision making
- **Polls** attached to comparisons: "Hotel A vs. B" with reasons per option and a suggested pick by the AI.
- Polls close on threshold (majority, quorum, or unanimity — Owner choice).
- Decisions are recorded on the object with an audit trail.

### 24.8 Conflict resolution
- Concurrent edits are merged when non-overlapping (a la CRDT-style intent merging).
- On true conflict (two people editing the same field), the system:
  1. Preserves both versions,
  2. Marks the object with a **Conflict** overlay state,
  3. Presents a side-by-side chooser with the AI recommending a merge,
  4. Records the decision and rationale.
- Never silently drop an edit.

### 24.9 Future real-time editing
- Full CRDT-based real-time editing on Journey Canvas, Inspector, and Documents.
- Presence cursors on maps and timelines.
- Voice/video rooms *inside* a trip (Premium/Business), with the trip as shared context.

### 24.10 Rules
- Collaboration never widens the trust surface: guests see less by default and are opted-in to more, not out.
- Every collaboration act is logged in Version History with an actor.
- Removing a collaborator preserves their contributions with attribution.
- The Owner's departure is a *deliberate transfer* event, never accidental.

---

## Section 25 — Memory Architecture

Memory is the difference between an assistant and a companion (P9, §10.12). It is also the traveller's data, held in trust.

### 25.1 Memory tiers
- **Short-term (Session)** — the current thread of thought within one Studio session. Ephemeral; cleared on close.
- **Trip Memory** — everything about *this* trip: choices, edits, preferences learned, companions' input, budget behaviour, decisions and their outcomes.
- **Long-term (Journey DNA)** — the traveller across trips: taste vectors, patterns, tolerances, budget rhythms, companions, values (sustainability, comfort, adventure), forbidden things (allergies, phobias, blocked destinations), and cadences (usual trip length, seasons).

### 25.2 Personal Preferences (subset of Journey DNA)
- Structured, editable, explicit preferences the traveller sets or the AI infers with high confidence and a visible trail.
- Examples: "prefer quieter neighbourhoods," "no early flights," "vegetarian," "aisle seat," "budget ceiling €X/day," "no political travel content."
- Every preference has a **source** (user-stated or AI-inferred with evidence), a **weight**, and a **reversibility** (edit / delete).

### 25.3 Group Memory
- Attached to a Companion pair or group.
- Includes shared trips, shared preferences (splits, tempo when together), decisions made together.
- Consented by both parties; either can revoke access to Group Memory.

### 25.4 Destination Memory
- What the traveller has *experienced* in a destination: places visited, opinions ("loved," "skipped"), photos, moments.
- Powers "your Lisbon" — a *personal* view of a city that differs from the world view.

### 25.5 Memory lifecycle
- **Capture** — from explicit edits, decisions, ratings, and high-confidence inference with disclosed evidence.
- **Consolidation** — periodically the AI turns a cluster of small signals into a stable preference (with a diff and reason).
- **Recall** — surfaces silently as defaults, tone, and pre-selections.
- **Verification** — the traveller can be prompted, once, to confirm inferred preferences before they harden.
- **Decay** — old memories fade in weight unless refreshed by new evidence; the traveller can pin memories that must never decay.
- **Forgetting** — one-tap "forget this" per item; global "forget everything" preserves the account but wipes memory.
- **Export** — full, human-readable export at any time.

### 25.6 Privacy principles (extending v1.1 §10.13)
- Memory is stored per Traveller; never fed to any third party.
- Memory is not used to train external models.
- Aggregate signals used for product improvement are opt-in and stripped of PII (§8.10.9).
- Memory travels with the account; it is not sold, transferred, or shared with partners.

### 25.7 Editing UX (behaviour, not visual)
- Every memory item has: a plain-language description, a source (evidence), a weight, an "edit," a "forget," and a "why this appears here."
- Editing a memory in place updates its evidence; forgetting removes it and its downstream influence.
- A "memory diff" surfaces after big shifts ("I noticed you now prefer X — keep this?").

### 25.8 Failure modes and their handling
- **Wrong inference.** Any AI-inferred memory the user corrects is *immediately down-weighted and evidence-tagged*; the same inference will not repeat without new evidence.
- **Stale memory.** Old preferences that contradict recent behaviour prompt a soft check-in.
- **Companion memory leaks.** Group memory is quarantined; no personal preference leaks across accounts.

---

## Section 26 — Decision Architecture

Every recommendation is a decision. Every decision is explainable. We formalise the model.

### 26.1 Decision Model (the schema every recommendation carries)
For a decision over N options, Studio produces:
- **Frame**: what is being decided; the constraint set (dates, budget, taste).
- **Options**: the shortlist considered.
- **Attributes**: scored per option:
  - Budget Impact (delta cost, confidence).
  - Weather Impact (fitness given forecast).
  - Time Impact (duration + transit + queueing).
  - Travel Fatigue (energy cost given day tempo and cumulative fatigue).
  - Safety (destination + neighbourhood + time of day).
  - Crowd Density (predicted or seasonal).
  - Distance (from anchor of the day).
  - Comfort (accessibility, kid-friendliness, seat pitch, room size).
  - Cost (absolute).
  - Sustainability (environmental impact estimate).
  - Fit (match with Journey DNA).
- **Weights**: derived from Journey DNA and the traveller's active optimisation (§8.10.4).
- **Score**: computed but not surfaced as a number.
- **Winner**: the top pick.
- **Reasons**: 1 primary + 1 supporting + 1 caveat (§10.5).
- **Alternatives**: 1–2 with why-not.
- **Confidence**: linguistic (§10.7).
- **Decision Cost**: an explicit estimate of how much this decision matters (see §26.4).
- **Trade-offs**: the specific axes traded (nearness vs. price, etc.).

### 26.2 Explanation contract
Every decision, on demand, exposes: what was chosen, why, what wasn't chosen and why not, what the traveller can change to change the answer, and what (if anything) Easy Trip earns from the recommendation (PRD v1.1 §8.10.3).

### 26.3 Traveller overrides (see §10.11)
Overrides update Journey DNA. The next similar decision will honour the new weight; the Decision Model records the override as an input, not a failure.

### 26.4 Decision Cost
- Not every decision matters equally. **Decision Cost** captures reversibility, financial exposure, and time-to-regret.
- Low-cost decisions may be auto-applied (§10.2); high-cost decisions always ask (§10.4).
- Decision Cost is surfaced in Comparisons and Booking flows so the traveller *feels* what's at stake.

### 26.5 Propagation
- A decision that changes a Day's shape *propagates*: Budget recomputes, Health rescores, downstream days rebalance, Bookings that no longer fit are flagged (never silently changed).
- Propagation stops at any user-owned commitment (confirmed Booking, pinned Activity) unless the user opts in.

### 26.6 Learning from decisions
- Accepted decisions weight positively into Journey DNA at the corresponding axes.
- Rejected decisions weight negatively — with a soft ceiling to avoid overreaction to a single mood.
- Decision outcomes ("did they actually enjoy it") feed the AI evals pipeline, with consent.

### 26.7 Multi-traveller decisions
- Weights merge across companions using role-weighted averaging (Owner/Host slightly higher by default; adjustable).
- Polls (§24.7) are the visible surface of multi-traveller decisions.
- A single traveller can never override a group decision silently.

---

## Section 27 — Journey Health Model

A trip has *health* — a composite signal that captures whether the plan is likely to result in a great trip.

### 27.1 Design intent
- **Not a score to gamify.** Health is diagnostic, not competitive.
- **Legible.** Health is exposed in plain language on each factor; a composite exists but is secondary.
- **Actionable.** Every negative signal comes with the smallest possible fix.

### 27.2 Factors (each 0–1, with a linguistic band)

- **Budget Health** — projected total vs. target; refund exposure; hidden fees.
- **Weather Health** — fit between plan and forecast; count of weather-fragile activities on rainy days.
- **Documents Health** — required documents present, valid, and unexpired for the trip window.
- **Transport Health** — connections tight/loose; refundability of segments; over-optimistic transit times.
- **Accommodation Health** — coverage across all trip nights; refundability posture; location fit.
- **Safety Health** — destination + neighbourhood + time-of-day risk; advisory presence.
- **Packing Health** — completeness given climate, activities, and companions.
- **Energy Health** — cumulative fatigue by day given tempo, transit, and prior days.
- **Time Balance** — under/over-packed distribution across the trip.
- **Travel Pace** — match with stated pace (`slow | balanced | packed`).
- **Sustainability** — estimated footprint vs. an honest baseline; opportunities to reduce.
- **Planning Confidence** — the AI's own view of "is this plan solid?" (§22.11).

### 27.3 Scoring philosophy
- Each factor scores on evidence, not vibes; missing evidence is stated ("we can't score X yet — here's why").
- No factor is silently down-weighted; when a factor doesn't apply (e.g., Sustainability on a walking trip), it is omitted with a reason.
- Health *never* gates progress; a "red" Health does not block booking. It informs.
- Health tolerates ambiguity: bands are linguistic ("healthy," "watch," "at risk") rather than false-precise numbers.

### 27.4 Composition
- The composite Trip Health is a policy-defined blend of factors; the policy is visible and adjustable per trip type (business vs. leisure vs. long-stay).
- **We reject a hidden single number as the primary display.** Composite is a secondary readout after the factors.

### 27.5 Where Health surfaces
- Per Day (Journey Canvas, Timeline).
- Per Trip (Studio status, Chapter Rail).
- In the Inspector when a specific object contributes materially to a factor.
- In Notifications only when a factor crosses into "at risk" for a reason the user should act on.

### 27.6 Health-driven suggestions
- Every "watch" or "at risk" factor comes with 1–2 concrete suggestions from the Decision Model (§26).
- Suggestions are optional; declining them is fine and does not lower the traveller's standing with the AI.

---

## Section 28 — Extensibility

Studio must grow without redesign. The blueprint is designed around a small set of **stable extension points**.

### 28.1 Extension points
1. **Trip Kinds.** A Trip carries a `kind` that governs defaults, chapters emphasis, and Health composition — without adding new object types.
2. **Chapter Weights.** The 8 chapters remain fixed; a Trip Kind emphasises or de-emphasises chapters (e.g., a business trip barely uses Dream).
3. **Activity Kinds.** Registered set; new kinds (e.g., `ceremony`, `medical-appointment`) plug in without new tables.
4. **Booking Kinds.** Same: extend by registration, not by schema fork.
5. **Panels (§19).** Additional workspaces (e.g., a Nutrition workspace for medical travel) plug in as first-class panels obeying §19.14.
6. **Decision Attributes (§26.1).** New attributes can be registered per Trip Kind; the Decision Model composes them automatically.
7. **Health Factors (§27).** Same registration model.
8. **Providers.** New supply partners plug into Booking flows through certified providers.
9. **Templates.** Trip templates and Day templates are first-class objects; creators can publish them.
10. **Language / Voice packs.** Editorial voice localises; the personality remains constant.

### 28.2 Future modules (each a Trip Kind, not a separate product)

- **Cruises** — Legs become ports; DayBlocks include on-board vs. on-shore; Bookings include cabin, dining seatings.
- **Road Trips** — Legs become drive-days; Transport becomes primary; fuel/charging integrated into Budget; scenic routing in Living Map.
- **Pilgrimage** — Emphasis on ritual, tempo, and rest; Safety Health tuned to season and crowd; editorial voice adjusts to reverence, not luxury marketing.
- **Festivals** — Trip windowed around a fixed event; Bookings anchor to festival passes; Crowd Density prominence.
- **Business Travel** — Chapter Rail collapses Dream/Compare/Remember; policy and expense fields become mandatory; approval flows in Collaboration.
- **Education (school trips, study abroad)** — Multi-companion (student cohort); consent flows; Documents include permissions; safety and accessibility heightened.
- **Medical Travel** — Documents include medical records; a Nutrition panel appears; recovery days are tempo-enforced; strict privacy posture.
- **Creator Mode** — A traveller's Trips can be published as remixable templates; monetisation and analytics unlock; brand safety review.
- **Agency Mode** — One professional plans on behalf of many clients; client-workspace switching; approval and delivery flows.
- **Enterprise Mode** — Policy, SSO, HRIS, duty-of-care; consolidated billing; per-department analytics.

### 28.3 Extensibility rules
- Every new module must be expressible via extension points; a module that requires new architecture is *not* ready to ship.
- New Trip Kinds obey all governance (§17): design review, AI review, accessibility, performance, and neutrality.
- Modules cannot break the 8-chapter narrative; they may re-weight it.
- Modules cannot introduce a visual dialect of their own; §11 governs.

---

## Section 29 — Acceptance Criteria

Studio is world-class when the following are simultaneously true. This is the acceptance test at the *product* level; feature-level acceptance is in §17.2–17.3.

### 29.1 Emotional
- **Excitement test.** A random sample of authenticated sessions returns ≥ 80% "yes" to "did this make you more excited about your trip?" (v1.1 §7.9).
- **Calm.** Zero interruptions per planning session on average outside of user-initiated actions.
- **Reversibility.** 100% of user-visible actions have a working undo within one gesture.

### 29.2 Product craft
- **Empty states** on every surface designed to editorial standard (§13), reviewed and approved.
- **Error states** on every surface designed to editorial standard (§14), reviewed and approved.
- **Offline** first-class on Studio's day view; nothing spins forever.
- **Reduced-motion** parity across every animation; nothing depends on motion to be understandable.
- **Accessibility** WCAG 2.2 AA across every surface; AAA on type and colour.

### 29.3 Interaction
- **Keyboard parity.** Every action reachable from the mouse is reachable from the keyboard.
- **Command palette coverage.** Every action reachable from the UI is invocable from the Command Palette.
- **Predictability.** Same interaction, same result, everywhere (§21.15).

### 29.4 Intelligence
- **Explainability.** 100% of recommendations expose reasons and alternatives on demand.
- **Neutrality.** Zero ranking influence from commission (auditable at the code level).
- **Hallucination bench.** Blocks any AI change that regresses grounded-facts accuracy.
- **Uncertainty.** The AI has said "I don't know" or "I'm not sure" in ≥ N% of relevant sessions instead of fabricating.

### 29.5 Performance (see §17.8 for budgets)
- Studio boots to a usable Journey Canvas within budget on median hardware.
- Interactions (drag, edit, undo) settle within the INP budget.
- No layout shift on first paint.

### 29.6 Trust
- **Neutrality contract** live and enforced (§8.4/§8.10).
- **Memory** fully visible, editable, forgettable per traveller (§25).
- **Notifications** opt-out rate ≤ 5%/quarter.
- **NPS ≥ 60** at maturity, per-trip and quarterly.

### 29.7 Continuity
- Same trip, same memory, same collaborators across every supported surface (§15.12).
- No surface introduces a visual dialect (§11.17).

### 29.8 The peer bar
Studio must feel worthy of comparison to:
- **Apple** — hardware-grade attention to material and restraint;
- **Notion** — a workspace that becomes the traveller's home;
- **Figma** — real-time collaboration that feels invisible;
- **Linear** — keyboard-first speed with no ceremony;
- **Flighty** — quiet, calm, deeply useful in-trip signal;
- **Arc Browser** — a surface that reorganises a familiar category with taste;
- **Airbnb** — an editorial and photographic voice indistinguishable from a magazine.

A surface that does not survive this comparison ships as "not yet done," regardless of feature completeness.

### 29.9 The one-question test
Before any Studio release, the CPO answers one question in writing:

> *"Does Journey Studio feel like the place a serious traveller wants to plan their next decade of trips?"*

If the honest answer is not "yes," the release is held.

---

**End of v2.0.**

The following artefacts are intentionally *not* included and will follow only after explicit approval:
- UX Architecture (surface-by-surface behavioural specs)
- Component System (semantics, contracts, states)
- Motion System (canonical durations, curves, ambient patterns)
- Technical Design (data schemas, storage, sync, offline, real-time)
- Instrumentation Plan (event taxonomy, dashboards)
- Rollout & Risk

STOP.

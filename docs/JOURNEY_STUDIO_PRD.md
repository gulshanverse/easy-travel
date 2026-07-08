# Journey Studio — Product Requirements Document

**Version:** 1.0 (Foundation)
**Status:** Draft — Foundation sections only. IA, UX architecture, components, motion, and technical design are explicitly out of scope for this version and will follow after approval.
**Owners:** Product, Design, Engineering (Journey Studio pod)
**Governing document:** Easy Trip Master Product Vision v1.0
**Scope note:** This document defines *what* Journey Studio is and *why* it exists. It intentionally contains no UI specifications, no component contracts, and no implementation guidance.

---

## Section 1 — Executive Summary

### 1.1 What Journey Studio is

Journey Studio is Easy Trip's flagship product experience: a single, multi-panel workspace where every trip is dreamt, discovered, designed, decided, booked, lived, remembered, and shared. It is not a page, a chatbot, or a form. It is the *place* a traveller inhabits from the first spark of an idea to the last memory after they return home.

Journey Studio is where the Easy Trip AI Travel Operating System becomes visible to the user. Everything the platform can do — planning, recommending, comparing, budgeting, forecasting, booking, remembering — is expressed through this one surface, in one continuous editorial and spatial language.

### 1.2 Why it exists

Modern travel planning is fragmented across a dozen tools (search engines, review sites, spreadsheets, chat assistants, group threads, notes apps, calendars, wallets, and booking sites). The user carries the burden of integration. The result is stress, anxiety, decision fatigue, and trips that are less than they could have been.

Journey Studio exists to collapse that fragmentation into a single, calm, intelligent surface — one where the traveller thinks about *the trip*, not about the tools.

### 1.3 Why Easy Trip needs it

- The homepage sells the *promise* of the AI Travel OS. Journey Studio must *deliver* it. Without Studio, Easy Trip is marketing without a product.
- Studio is where retention, engagement, and monetisation compound. Bookings, subscriptions, collaboration, and post-trip memory all live here.
- Studio is the moat. Competitors can copy a landing page. They cannot easily copy a workspace whose intelligence, memory, and craftsmanship deepen with every trip.
- Studio is where the brand becomes tangible. Wonder, calm, luxury, trust, and anticipation are felt here, not on the marketing site.

### 1.4 What problem it solves

For the traveller: eliminates the cognitive load of orchestrating a trip across incompatible tools; replaces anxiety with confidence; replaces generic itineraries with a plan that feels personally crafted.

For Easy Trip: creates a defensible, high-frequency product surface that generates data, memory, and network effects, and that turns a one-time visitor into a lifelong traveller on the platform.

### 1.5 Why this becomes Easy Trip's flagship experience

Journey Studio is the only surface that satisfies every emotional promise of the brand — wonder at the dream stage, calm during planning, anticipation before departure, trust while travelling, and reflection afterward — inside one continuous experience. It is therefore, by definition, the flagship. Every other surface (homepage, marketing pages, mobile companion, notifications) exists to lead the user *to* Studio or to extend Studio *outward*.

---

## Section 2 — Product Vision

### 2.1 Long-term vision (3–5 years)

In five years, Journey Studio is the default place hundreds of millions of people go when they think about travelling — the way people open a maps app to navigate or a music app to listen. It is a living, personal travel intelligence: it knows the traveller's history, taste, tolerances, budget rhythms, and companions; it anticipates trips before they are asked for; it can plan, replan, rebook, and reroute in real time; and it produces trips that consistently exceed what the traveller could have designed alone.

Studio is not an app the user visits — it is a *long-running relationship*. Each trip makes the next one better. The archive of past journeys is a living memoir, not a folder of PDFs.

### 2.2 Product philosophy

- **Travel comes before technology.** The interface disappears into the journey.
- **Craft, not fill.** Planning is designing a trip, not completing a form.
- **Calm intelligence.** The AI is proactive but never loud; confident but never bossy.
- **Editorial over dashboard.** The workspace reads like a magazine spread, not an admin console.
- **Memory compounds.** Every interaction teaches Studio something about the traveller.
- **One surface, many chapters.** The user rarely needs to leave Studio; Studio comes to them.
- **Confidence at every step.** Every decision surfaces the reasoning behind it.

### 2.3 Why Journey Studio is different — philosophy, not features

- **vs. ChatGPT.** ChatGPT is a conversation with an assistant who has no place, no memory of the trip as an object, and no spatial or visual grammar for travel. Studio is a *place* the trip lives in. Language is one input, not the entire product.
- **vs. Google Maps.** Google Maps is a utility for navigating physical space. It has no opinion, no taste, no narrative, and no memory of *why* you're going. Studio is opinionated, curatorial, and carries the story of the journey.
- **vs. Google Travel.** Google Travel is an aggregator optimising for transactions. Its emotional register is commercial. Studio's register is editorial and personal; the transaction is a consequence of a well-designed trip, not the goal.
- **vs. Airbnb.** Airbnb owns a single unit of the trip (where you sleep). Its philosophy stops at the door of the property. Studio owns the whole arc — dream to memory — with sleep being one chapter among many.
- **vs. TripIt.** TripIt is an inbox parser: it organises what has already been decided elsewhere. Studio is upstream — it is where the trip is *decided*, and organisation is a by-product.
- **vs. Wanderlog.** Wanderlog is a competent itinerary tool with the aesthetic and emotional temperature of a spreadsheet. Studio treats a trip as a story to be crafted, not a list to be maintained.
- **vs. Notion.** Notion is an empty room and a box of Lego. It asks the user to be the architect. Studio is the architect; the user is the traveller.

In one sentence: every alternative treats travel as a task. Studio treats travel as a life experience worth designing with intention.

---

## Section 3 — Product Principles

These are permanent. Every future decision — visual, interaction, feature, technical — must be tested against them.

**P1. Travel comes before technology.**
Description: The interface must recede so the journey can advance.
Why it matters: Users don't come to Easy Trip to use software; they come to travel. Every visible piece of UI is a tax on the emotion we're trying to create.
Example: A weather forecast for the destination appears as a single line of prose in the day header ("Rain likely Tuesday afternoon — indoor pick added") rather than a chart with axes.

**P2. AI disappears into the workflow.**
Description: Intelligence is felt, not seen. There is no dedicated "AI panel" to visit; AI is a property of everything.
Why it matters: A visible AI feels like a chatbot. Invisible AI feels like magic.
Example: When a user drags an activity to a new day, Studio silently rebalances timing, transport, and cost, and shows only the corrected result.

**P3. Every decision must increase confidence.**
Description: Any recommendation, price, or suggestion is accompanied by a short, human reason.
Why it matters: Confidence is the emotion that converts dreaming into booking.
Example: A hotel recommendation reads "Chosen because you preferred quieter neighbourhoods on your Lisbon trip," not "Recommended for you."

**P4. Planning is crafting, not filling.**
Description: The primary metaphor is a workshop or atelier, not a form.
Why it matters: Forms produce trips that feel mass-produced. Craft produces trips that feel owned.
Example: A day is composed by placing activities on a canvas, not by selecting from dropdowns.

**P5. Maps are first-class citizens.**
Description: Geography is a permanent, integrated dimension of the workspace, not a secondary tab.
Why it matters: Travel is spatial. Divorcing plan from place is a category error.
Example: Hovering an activity in the itinerary highlights and centres it on the map without a click.

**P6. Calm over loud.**
Description: Motion is slow. Colour is restrained. Notifications are rare and meaningful.
Why it matters: Anxiety is the enemy of anticipation. A calm surface produces excited travellers.
Example: A price change is a soft numerical morph, not a red flash or a toast.

**P7. Editorial, not administrative.**
Description: The workspace looks and reads like a travel journal designed by an editor, not a project management tool.
Why it matters: Emotional register defines the brand. Admin aesthetics kill wonder.
Example: A day header reads "Day Two — the coast turns copper at sunset," not "Day 2 · 4 items · 6h 30m."

**P8. One workspace, many chapters.**
Description: Users should almost never need to leave Studio. External flows (payment, ID verification, sign-in) return the user to exactly where they left.
Why it matters: Every context switch erodes the experience and the funnel.
Example: Booking a flight happens in an overlay inside Studio; on completion the itinerary updates in place.

**P9. Memory is a feature.**
Description: Studio remembers preferences, patterns, past trips, companions, and moments — and uses them without being asked.
Why it matters: Memory is the difference between a tool and a companion.
Example: When starting a new trip, Studio quietly pre-fills "traveller: you + Maya" because that pair has travelled together before.

**P10. Recommend, then get out of the way.**
Description: Studio proposes strong defaults; the user can always override, and the override teaches Studio.
Why it matters: Decision fatigue is the largest cost of trip planning. Strong defaults remove it.
Example: A first-draft itinerary is generated on entry; the user reshapes rather than starts from zero.

**P11. Reversibility everywhere.**
Description: Every action is undoable. Nothing feels permanent until the traveller wants it to be.
Why it matters: Reversibility is what makes a workspace feel safe to explore.
Example: Undo works across days, budgets, bookings-in-cart, and AI actions with the same shortcut.

**P12. Collaboration is native, not bolted on.**
Description: Multiple travellers, at different permission levels, can be in the same trip at the same time.
Why it matters: Real trips are rarely planned alone. Solo tools force groups into WhatsApp.
Example: A partner can vote on two hotel options inside Studio without creating an account.

**P13. Every screen answers the excitement test.**
Description: If a screen does not make the traveller more excited about the trip, it must be removed, rewritten, or redesigned.
Why it matters: The Master Vision defines this as the acceptance criterion for every surface.
Example: A "trip settings" screen is redesigned as a "trip preferences" journal page with photography, not a table of toggles.

**P14. Time is a design material.**
Description: Duration, tempo, seasonality, golden hour, jet lag, and travel time are treated as first-class inputs to the plan.
Why it matters: Trips fail on time, not on choice.
Example: Studio refuses to schedule a museum during its closing hour and offers the same museum at its best light instead.

**P15. Trips have a beginning and an end.**
Description: Studio explicitly designs the pre-trip and post-trip chapters, not just the days abroad.
Why it matters: Anticipation and memory are half the value of travel and 100% of retention.
Example: A "departure eve" view surfaces packing, weather, and a short letter from Studio. A "one week later" view invites the user to save three memories.

---

## Section 4 — User Personas

Each persona is a design lens, not a marketing segment. All eight must be viable in Studio from day one, even if optimisation is phased.

### 4.1 Solo Traveller — "Ana, 29, product designer, Berlin"
- **Goals:** Deep, meaningful travel; self-discovery; safety; flexibility to change plans mid-trip.
- **Pain points:** Loneliness at meals; feeling unsafe at night; poor solo-friendly recommendations; dining-for-one awkwardness.
- **Travel behaviour:** 4–6 trips/year, mix of city + nature, 5–10 days, moderate spend.
- **Planning style:** Researches heavily, plans a spine, leaves room for spontaneity.
- **Budget behaviour:** Mid-range with occasional splurges on experiences; tight on accommodation.
- **AI expectations:** A trusted friend who has been everywhere; safety-aware; understands solo dynamics.
- **Technology comfort:** High.
- **Primary use cases:** Discover a destination, build a flexible spine, get local safety context, find solo-friendly experiences and dining, share updates with family.

### 4.2 Couple — "Rohan & Meera, mid-30s, Bangalore"
- **Goals:** Shared decision-making without friction; a trip that reflects both tastes; romance and rest.
- **Pain points:** Endless WhatsApp threads; one partner does all the work; hard to reconcile preferences.
- **Travel behaviour:** 2–4 trips/year, 5–10 days, blend of relaxation and culture.
- **Planning style:** Collaborative, evenings and weekends.
- **Budget behaviour:** Pooled, mid-to-premium, values-driven.
- **AI expectations:** A neutral mediator that offers balanced options and remembers both preferences.
- **Technology comfort:** High.
- **Primary use cases:** Compare two shortlists; vote on options; split planning tasks; a shared living itinerary.

### 4.3 Family — "The Alvarez family, two adults + two kids (6, 11), Madrid"
- **Goals:** A trip everyone enjoys; low stress logistics; safety; educational moments for the kids.
- **Pain points:** Coordinating naps, meals, and moods; long queues; unpredictable weather; over-ambitious itineraries.
- **Travel behaviour:** 2–3 trips/year, 7–14 days, school-calendar constrained.
- **Planning style:** One adult drives; the other reviews.
- **Budget behaviour:** Value-conscious but non-negotiable on safety and comfort.
- **AI expectations:** A patient planner that understands children's tempo and family logistics.
- **Technology comfort:** Medium-high.
- **Primary use cases:** Age-appropriate day plans; realistic tempo; family-friendly stays; contingency for tired days.

### 4.4 Backpacker — "Kaya, 24, on a gap year"
- **Goals:** Long, cheap, transformative travel; freedom; community; stories.
- **Pain points:** Money running out; missed connections; hostel quality variance; visa surprises.
- **Travel behaviour:** Weeks-to-months trips, multi-country, ground transport heavy.
- **Planning style:** Loose skeleton, high spontaneity, mobile-first.
- **Budget behaviour:** Strict; tracks daily spend.
- **AI expectations:** Frugal, honest, real-time; understands overland travel.
- **Technology comfort:** High.
- **Primary use cases:** Route planning across countries; hostel curation; daily budget tracking; visa/entry alerts.

### 4.5 Luxury Traveller — "Elena, 52, private practice lawyer, Milan"
- **Goals:** Effortless, exceptional experiences; privacy; time saved; discretion.
- **Pain points:** Feeling like a mass-market customer; generic "luxury" content; slow, boilerplate concierge replies.
- **Travel behaviour:** 4–8 trips/year, 3–10 days, premium always.
- **Planning style:** Delegates; approves.
- **Budget behaviour:** Value-of-time driven, not price driven.
- **AI expectations:** A concierge that anticipates, remembers, and never asks twice.
- **Technology comfort:** Medium-high (values ease over gadgetry).
- **Primary use cases:** Curated proposals; private experiences; seamless rebooking; discreet, memorable touches.

### 4.6 Business Traveller — "Kenji, 41, enterprise sales, Tokyo"
- **Goals:** Reliable logistics; minimal planning time; policy compliance; small windows of enjoyment.
- **Pain points:** Delays, replans, expense reports, sleep debt, tacked-on leisure time that's wasted.
- **Travel behaviour:** 20–40 trips/year, 1–4 days, repeat cities.
- **Planning style:** Fast, template-driven.
- **Budget behaviour:** Corporate policy bound.
- **AI expectations:** A silent, competent chief-of-staff; disruption-aware.
- **Technology comfort:** High.
- **Primary use cases:** One-tap rebook; standing preferences; policy-safe options; a lightweight "bleisure" extension flow.

### 4.7 Digital Nomad — "Amara, 33, remote engineer"
- **Goals:** Productive, healthy, sustainable long stays; community; reliable connectivity.
- **Pain points:** Wi-Fi lottery; time-zone chaos; visa/tax uncertainty; loneliness on the road.
- **Travel behaviour:** 1–3 month stays, 6–10 base cities/year.
- **Planning style:** Iterative; overlaps with life admin.
- **Budget behaviour:** Monthly-cost thinking (not per-trip).
- **AI expectations:** Understands work life, not just travel; treats a city as a home, not a stop.
- **Technology comfort:** Very high.
- **Primary use cases:** Long-stay housing; workspace curation; visa/timezone planning; local community discovery.

### 4.8 Friends Group — "The 'Goa 2027' chat, 6 people, 20s–30s"
- **Goals:** A trip that actually happens; fair splits; shared memories; low group friction.
- **Pain points:** Herding cats; unequal effort; unclear payments; different budgets and appetites.
- **Travel behaviour:** 1–2 group trips/year, 4–7 days, high-tempo.
- **Planning style:** One organiser, chaotic input from the rest.
- **Budget behaviour:** Mixed; needs transparent splits.
- **AI expectations:** A group facilitator that arbitrates fairly and keeps momentum.
- **Technology comfort:** High.
- **Primary use cases:** Group polls; shared canvas; split-cost accounting; consolidated bookings; a shared post-trip memory.

---

## Section 5 — Jobs To Be Done

Priority scale: P0 (must exist at launch), P1 (must exist within 6 months), P2 (strategic, later).

**JTBD-1. "Turn a vague daydream into a real destination."**
- Situation: The user is scrolling on a Sunday and wants "somewhere warm in February for a week."
- Motivation: Move from unfocused longing to a concrete, exciting candidate.
- Desired outcome: 1–3 shortlisted destinations with reasons and vibes, not a list of 200 flights.
- Current alternatives: Instagram, Reddit, ChatGPT, Google.
- Easy Trip opportunity: A "dream" chapter that translates mood + constraints into curated destinations with narrative.
- Priority: P0.

**JTBD-2. "Decide between two or three places I'm torn about."**
- Situation: Lisbon vs. Marrakech vs. Split.
- Motivation: End decision paralysis with confidence.
- Desired outcome: An honest, personalised comparison that names a winner and explains why.
- Current alternatives: Blog comparisons, spreadsheets, friends' opinions.
- Easy Trip opportunity: A comparison view that judges options against the traveller's values, not generic criteria.
- Priority: P0.

**JTBD-3. "Design a trip that fits me — not a template."**
- Situation: Traveller has a destination and dates but rejects cookie-cutter itineraries.
- Motivation: Own the trip.
- Desired outcome: A first-draft itinerary that already feels 70% right, easy to reshape.
- Current alternatives: Blog itineraries, Wanderlog, ChatGPT.
- Easy Trip opportunity: Craftable canvas with strong defaults and effortless edits.
- Priority: P0.

**JTBD-4. "Plan a trip with the people I'm going with."**
- Situation: Couple, family, or friends group planning together.
- Motivation: Shared ownership; less friction.
- Desired outcome: One living plan; votes, comments, and permissions; no side channels needed.
- Current alternatives: WhatsApp + Google Docs + spreadsheets.
- Easy Trip opportunity: Native, real-time collaboration inside Studio.
- Priority: P0.

**JTBD-5. "Understand what a trip will actually cost."**
- Situation: The user has a draft itinerary and a nervous relationship with the total.
- Motivation: Confidence that they can afford this.
- Desired outcome: Live, honest total with breakdown, ranges, and levers.
- Current alternatives: Spreadsheets and guesswork.
- Easy Trip opportunity: A budget that lives inside the plan and reacts to every change.
- Priority: P0.

**JTBD-6. "Book everything without leaving my plan."**
- Situation: The trip is designed; the traveller wants it real.
- Motivation: Convert intent into confirmations without losing context.
- Desired outcome: Flights, stays, experiences booked from within Studio; confirmations appear in the itinerary.
- Current alternatives: Twelve tabs and a cart on three sites.
- Easy Trip opportunity: Booking as an overlay, not a destination.
- Priority: P0 for stays and experiences; P1 for flights (subject to inventory partnerships).

**JTBD-7. "Feel prepared the night before I leave."**
- Situation: The eve of departure.
- Motivation: Reduce anxiety; increase anticipation.
- Desired outcome: Packing list, weather, documents, first-day map, and a warm human note.
- Current alternatives: Google searches at 11pm.
- Easy Trip opportunity: A dedicated pre-departure chapter.
- Priority: P0.

**JTBD-8. "Navigate the trip once I'm on the ground."**
- Situation: In-trip, often offline, sometimes tired.
- Motivation: Move through the day without stress.
- Desired outcome: A day view that's calm, offline-capable, and reacts to reality.
- Current alternatives: Google Maps + screenshots.
- Easy Trip opportunity: A companion mode of Studio optimised for the day of.
- Priority: P0 (view); P1 (offline).

**JTBD-9. "Recover when something goes wrong."**
- Situation: A cancelled flight, a closed restaurant, a sudden storm.
- Motivation: Restore the plan without panic.
- Desired outcome: A proposed replan in under a minute, with reasons.
- Current alternatives: Airline apps, hotel front desks, luck.
- Easy Trip opportunity: Disruption-aware replanning.
- Priority: P1.

**JTBD-10. "Split money fairly with the people I travelled with."**
- Situation: End of a group trip.
- Motivation: Close the loop without awkwardness.
- Desired outcome: A clear settlement built from the plan itself.
- Current alternatives: Splitwise, mental math.
- Easy Trip opportunity: Splits derived automatically from bookings and shared spend.
- Priority: P1.

**JTBD-11. "Keep the memory of a trip alive."**
- Situation: Home, one week later.
- Motivation: Reflect and share.
- Desired outcome: A beautiful, low-effort memoir of the trip.
- Current alternatives: Instagram, camera roll, no one revisits.
- Easy Trip opportunity: A post-trip chapter that turns the plan into a keepsake.
- Priority: P1.

**JTBD-12. "Plan the next trip using what I learned on this one."**
- Situation: New trip, months later.
- Motivation: Don't start from zero.
- Desired outcome: Studio quietly reuses preferences, companions, and lessons.
- Current alternatives: None — every trip restarts.
- Easy Trip opportunity: Memory-as-feature (see P9).
- Priority: P0 (foundations); P1 (visible).

**JTBD-13. "Travel for work and enjoy a small piece of it."**
- Situation: Business traveller with a spare evening or weekend.
- Motivation: Turn dead time into a delight.
- Desired outcome: A tiny curated plan grafted onto the work trip.
- Current alternatives: Concierge, hotel desk.
- Easy Trip opportunity: A "bleisure" extension flow.
- Priority: P1.

**JTBD-14. "Live in a city for a month, not visit it."**
- Situation: Digital nomad.
- Motivation: Make a home, temporarily.
- Desired outcome: Long-stay housing, workspaces, community, and a slower rhythm.
- Current alternatives: Nomad List + Airbnb + Meetup.
- Easy Trip opportunity: A long-stay mode of Studio.
- Priority: P2.

**JTBD-15. "Have a concierge that already knows me."**
- Situation: Luxury traveller in-trip.
- Motivation: Effortlessness.
- Desired outcome: One request, right answer, no re-explanation.
- Current alternatives: Human concierge, patchy.
- Easy Trip opportunity: Memory + curation + service.
- Priority: P2.

---

## Section 6 — End-to-End User Journey

Each stage is a *chapter* of Studio, not a separate product.

### Stage 1 — Dream
- **User goals:** Explore possibility without commitment.
- **Emotional state:** Wonder, restlessness, escapism.
- **Pain points:** Overwhelm; algorithmic sameness; guilt about "wasting time" browsing.
- **AI opportunities:** Translate mood + constraint into a small, evocative shortlist; surface unfamiliar-but-fitting places.
- **Business opportunities:** Top-of-funnel capture; inspiration-driven ad and partnership placements delivered as *editorial*, never as banners.

### Stage 2 — Research
- **User goals:** Learn enough to shortlist confidently.
- **Emotional state:** Curious, slightly anxious about missing something.
- **Pain points:** Contradictory sources; SEO-farmed listicles; review fatigue.
- **AI opportunities:** Synthesise sources into a trustworthy destination brief tuned to the traveller.
- **Business opportunities:** Deep partnerships with tourism boards, publishers, and creators for licensed premium content.

### Stage 3 — Compare
- **User goals:** Choose between finalists.
- **Emotional state:** Torn; wants permission to decide.
- **Pain points:** Apples-to-oranges options; no personalised judgement.
- **AI opportunities:** Personalised, opinionated comparison with a named winner and reasoning.
- **Business opportunities:** Higher conversion into planning; data on preferences to power memory (P9).

### Stage 4 — Plan
- **User goals:** Turn a chosen destination into a day-by-day trip.
- **Emotional state:** Engaged, protective of the trip.
- **Pain points:** Sequencing, tempo, transport friction, opening hours.
- **AI opportunities:** Strong first draft; effortless reshape; tempo-aware; time-aware.
- **Business opportunities:** The core moat — the plan is the anchor for all bookings.

### Stage 5 — Book
- **User goals:** Convert plan into confirmations.
- **Emotional state:** Committing, wants no surprises.
- **Pain points:** Context switching; hidden fees; scattered confirmations.
- **AI opportunities:** In-context booking; honest totals; policy-aware options.
- **Business opportunities:** Primary revenue: commissions, take-rate, upgrades, insurance, financing.

### Stage 6 — Travel
- **User goals:** Live the day.
- **Emotional state:** Excited, sometimes stressed, often tired.
- **Pain points:** Disruption; unfamiliarity; language; energy management.
- **AI opportunities:** Calm day view; proactive nudges (weather, timing); one-tap replan on disruption.
- **Business opportunities:** In-trip upsell (experiences, transfers, upgrades) framed as helpful, not salesy; deep loyalty.

### Stage 7 — Remember
- **User goals:** Preserve the trip.
- **Emotional state:** Reflective, nostalgic.
- **Pain points:** Effort of curation; photos that never become anything.
- **AI opportunities:** Turn the plan + moments into a low-effort memoir.
- **Business opportunities:** Physical products (prints, books); rekindling for the next trip.

### Stage 8 — Share
- **User goals:** Tell a story; help others.
- **Emotional state:** Generous, a little vain, community-minded.
- **Pain points:** Sharing tools optimised for feeds, not stories.
- **AI opportunities:** Shareable, remixable trip templates.
- **Business opportunities:** Viral acquisition loop; UGC content library; creator economy on-platform.

---

## Section 7 — Success Metrics

All metrics are measurable, cohort-able, and tied to a stage of the journey or a principle. Targets are indicative and will be refined during instrumentation planning.

### 7.1 Activation
- **Time to First Itinerary (TTFI).** Median seconds from Studio entry to a first-draft itinerary being visible. Target ≤ 60s.
- **First-session Plan Completion.** % of new users whose first session ends with a saved trip. Target ≥ 40%.
- **Composer-to-Draft Conversion.** % of AI composer submissions that yield an accepted first-draft plan. Target ≥ 75%.

### 7.2 Engagement
- **Weekly Active Planners (WAP).** Users who edit a trip in a 7-day window.
- **Sessions per Active Trip.** Median sessions per trip between creation and departure. Target ≥ 6.
- **Session Duration (planning phase).** Median minutes/session while a trip is in "plan" state. Target 8–15 min (long enough to be meaningful, short enough to signal low friction).
- **Chapters Touched per Trip.** Median number of the 8 journey chapters engaged per completed trip. Target ≥ 5.

### 7.3 AI Quality
- **AI Recommendation Acceptance Rate.** % of AI-surfaced items added to a plan (per surface). Target ≥ 35% for recs, ≥ 60% for first-draft activities.
- **AI Edit Rate.** % of AI-generated items edited before booking (proxy for "close but not perfect"). Watch, don't optimise blindly.
- **AI Rejection Reason Coverage.** % of rejections with structured feedback captured. Target ≥ 25%.
- **Explanation Read Rate.** % of users who expand the "why" behind at least one recommendation per trip. Target ≥ 50%.

### 7.4 Booking & Revenue
- **Plan-to-Book Conversion.** % of completed plans that result in ≥ 1 booking on-platform. Target ≥ 30% at maturity.
- **In-Studio Booking Share.** % of bookings completed without leaving Studio. Target ≥ 80% (guards P8).
- **Take Rate per Trip.** Blended margin across booking types.
- **Attach Rate.** Additional bookings per trip beyond the first (experiences, transfers, insurance).

### 7.5 Trip Realisation
- **Trip Completion Rate.** % of booked trips marked as travelled. Target ≥ 90%.
- **In-Trip Engagement.** % of travelled trips with ≥ 1 Studio open per travel day. Target ≥ 70%.
- **Disruption Recovery Rate.** % of disruption events resolved via Studio replan without external tools. Target ≥ 50% (once JTBD-9 ships).

### 7.6 Retention & Loyalty
- **Return-for-Next-Trip Rate.** % of completed-trip users who start a second trip within 180 days. Target ≥ 45%.
- **Rolling 12-month Trips per User.** Target ≥ 2.0.
- **Memory Reuse Rate.** % of new trips that use ≥ 1 remembered preference or companion. Target ≥ 60% (validates P9).

### 7.7 Collaboration
- **Trips with ≥ 2 Collaborators.** % of trips with multi-user participation. Target ≥ 35%.
- **Guest-to-Account Conversion.** % of invited guests who create an account. Target ≥ 30%.
- **Group Decision Latency.** Median time from a proposed option to a group decision. Lower is better.

### 7.8 Sharing & Growth
- **Trips Shared.** % of completed trips shared publicly or as templates. Target ≥ 15%.
- **Referral-driven Signups from Shared Trips.** Signups attributable to a shared artifact. Target ≥ 10% of new signups at maturity.

### 7.9 Emotional / Brand
- **NPS (per trip and per user).** Post-trip and quarterly. Target NPS ≥ 60.
- **"Made me more excited" rate.** In-Studio pulse: % answering yes on random session sample. Guards P13. Target ≥ 80%.
- **Perceived Effort (CES).** Post-plan and post-booking. Target ≤ 2 on a 7-point effort scale.
- **Trust Index.** Composite of explanation read rate, override rate, and NPS "trust" sub-score.

### 7.10 Health guardrails (not to optimise, only to protect)
- **Time-to-Anxiety.** % of sessions ending in rage-click, undo storms, or abandonment mid-plan. Target trending down.
- **Notification Fatigue.** Opt-out rate on Studio notifications. Target ≤ 5%/quarter.
- **Support Ticket Rate per Booking.** Target ≤ 3%.

---

**End of Foundation.**

The following sections are intentionally *not* included in this version and will follow only after explicit approval:
- Information Architecture
- UX Architecture
- Component System
- Motion System
- Technical Design
- Instrumentation Plan
- Rollout & Risk

STOP.

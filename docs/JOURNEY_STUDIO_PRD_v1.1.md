# Journey Studio — Product Requirements Document

**Version:** 1.1 (Strategy, Trust, Platform & Product Governance)
**Status:** Additive extension of PRD v1.0 (Foundation). No prior section is rewritten; where v1.1 refines a v1.0 principle it is called out explicitly.
**Owners:** CEO, CPO, Principal Product Designer, Staff UX Architect, AI Product Lead, Platform Architect.
**Governing document:** Easy Trip Master Product Vision v1.0 and PRD v1.0.
**Scope note:** Sections 8–17 only. Information Architecture, UX architecture, components, motion, and technical design remain out of scope until explicitly approved.

---

## Section 8 — Business Strategy & Monetization

### 8.1 Business model (thesis)

Easy Trip is a **consumer travel platform monetised on trust**. The core loop is: help a traveller design a trip they love → earn the right to fulfil the trip (bookings, services, memory) → compound loyalty over a lifetime of trips. Revenue is a *consequence* of a well-designed trip, never the objective of a screen.

We reject three common business models on principle:

1. **Ad-driven inspiration.** Injecting third-party ads into the dream/research chapters destroys the editorial voice and the trust asset.
2. **Dark-pattern urgency.** "3 people are looking at this," red timers, fake scarcity. These are trust taxes with a short-term revenue peak and a long-term brand cost.
3. **Opaque commissions steering recommendations.** The user must never wonder whether Studio recommended something because it was best for them or because it paid more.

### 8.2 Revenue streams (ranked by durability, not size at launch)

| # | Stream | Nature | Notes |
|---|---|---|---|
| R1 | **Booking commissions & take-rate** on stays, experiences, transfers, rail, and (later) flights. | Transactional | Highest volume; must be neutrally applied (see 8.10). |
| R2 | **Easy Trip Premium** — a personal subscription for advanced AI, unlimited memory, offline, priority support, and creator/pro tools. | Recurring | The trust-safe monetisation lever; grows with product depth. |
| R3 | **Easy Trip for Teams / Business** — subscription for small teams, agencies, family offices, and corporate travel with policy, spend, and reporting. | Recurring | High LTV, low CAC via founder-led sales. |
| R4 | **Curated marketplace** — vetted local guides, private experiences, wellness, gastronomy, adventure operators. | Marketplace fee | Aman/Nat Geo-grade curation, not open bazaar. |
| R5 | **Financial products** — travel insurance, FX/multi-currency wallet, trip protection, financing/BNPL for premium trips. | Fee / interchange | Bundled honestly; insurance defaults to a strong, boring choice. |
| R6 | **Physical goods from memory** — photo books, prints, guides derived from completed trips. | Product margin | Small in $, large in retention and brand. |
| R7 | **Editorial & tourism board partnerships** — licensed premium content that appears as editorial, always labelled, never as ads. | Sponsorship, disclosed | Never influences AI recommendations. |
| R8 | **Creator revenue share** — templates, guides, and city studies published on Easy Trip; creators earn a share of Premium and marketplace attribution. | Rev share | Fuels supply of high-quality content. |
| R9 | **Enterprise licensing / white-label of the Studio engine** — for airlines, hotel groups, and luxury travel agencies. | Long-cycle B2B | Only after brand and product maturity. |
| R10 | **Anonymised industry intelligence** — aggregate demand signals sold to destinations and operators. | Data product | Only aggregated, opt-in, zero PII, revocable. |

### 8.3 Subscription philosophy — "Free is generous; Premium is worthy"

- **Free tier** must be genuinely useful: planning, first-class AI drafting, up to N active trips, standard collaboration, standard bookings. Free is not a demo. Free is where trust is earned.
- **Premium** unlocks *depth, not access*: long memory, deep personalisation, unlimited collaborators, offline field mode, disruption auto-replan, private experiences, financial tools, priority human support.
- **No paywalled anxiety.** Safety, disruption, and post-booking support are never gated.
- **Family/group plans** are first-class (couples, families, friend groups). Charging per seat destroys collaboration.
- **Cancel in one click.** No dark patterns. Cancellation preserves data indefinitely; re-subscription restores memory intact.

**Recommended pricing posture:** anchor Premium on *value per trip taken*, not per month. A traveller who takes two thoughtful trips a year should feel Premium paid for itself twice over.

### 8.4 Booking commissions — the neutrality contract

- **Ranking neutrality.** Commission rate never influences the order or presence of a recommendation.
- **Full disclosure.** Any commercial relationship is labelled in plain language on the item itself, not hidden in a footer.
- **Best-price guarantee** or transparent explanation when a partner sells cheaper elsewhere. Never quietly show a worse price.
- **Publisher-grade separation.** The "AI Core" that ranks and the "Commerce Core" that monetises are separate systems. Ranking cannot read commission tables.

This is a first-order product decision, not a compliance footnote. It is the reason the moat in Section 9 exists.

### 8.5 Marketplace opportunities

- **Curated, not open.** Every operator is vetted for quality, safety, ethics, and sustainability before listing.
- **Depth over breadth.** 200 exceptional local guides in a city beat 20,000 mediocre ones. Aman-grade curation.
- **Fair take rate** with visible economics for operators; they see what Easy Trip earns on their bookings.
- **Editorial voice preserved.** Marketplace items appear inside the editorial fabric of the trip, not in an ad-slot grid.

### 8.6 Premium AI capabilities (what Premium unlocks in the AI layer)

- Multi-year memory and deep personalisation.
- Autonomous disruption handling ("rebook me").
- Deep-research mode (long-horizon synthesis across sources).
- Higher-tier models and longer context.
- Concierge-style asynchronous requests with human-in-the-loop review.
- Voice mode with continuous context.
- Creator/pro workflows (multi-trip templates, client sharing).

**Principle:** Premium AI must never make Free AI feel broken. Free AI is world-class; Premium AI is *more*, not *usable*.

### 8.7 Enterprise opportunities

- **Easy Trip for Teams** (5–50 seats): shared workspace, spend controls, policy, consolidated invoicing.
- **Easy Trip for Business** (SMB → mid-market): SSO, HRIS integration, expense export, duty-of-care, travel policy engine.
- **Family Office / Private Client**: white-glove concierge, discretion, multi-household.
- **Enterprise engine licensing** (long-term): airlines/hotels license the Studio planning engine for their own customers.

Enterprise is the second engine; consumer trust is the first. We do not launch enterprise until consumer NPS crosses 60 (see PRD v1.0 §7.9).

### 8.8 Creator economy

- Creators (writers, photographers, guides) publish **remixable trip templates** and **city studies** on Easy Trip.
- Revenue share flows from Premium, marketplace attribution, and physical goods.
- Creators receive analytics, a stable identity page, and a portable audience.
- **Anti-farming rules**: quality bar, editorial review, no listicle spam. This is a garden, not a marketplace of SEO junk.

### 8.9 B2B partnerships

- **Tier 1** (deep integration): airlines, hotel groups, rail networks, tourism boards.
- **Tier 2** (contextual services): insurance, visa, eSIM, FX, ground transport, luggage.
- **Tier 3** (content & inspiration): publishers, national geographic-grade editorial partners.
- **Governance:** every partner is subject to the neutrality contract (§8.4) and the AI trust framework (§10).

### 8.10 Future platform economics — how monetisation stays trust-safe

Codify these as permanent rules:

1. **Ranking is never for sale.** Ever.
2. **The recommender never sees the ledger.** Architectural separation between AI Core and Commerce Core.
3. **Labelled commerce.** Any paid placement is labelled in plain language and cannot masquerade as a recommendation.
4. **User-adjustable optimisation.** The traveller can tell Studio to optimise for price, taste, sustainability, comfort, or time. Studio obeys.
5. **Right to explanation.** Every recommendation exposes its reasons on demand (see §10).
6. **Right to a plain plan.** The user can always request a Studio plan with commerce hidden.
7. **No manufactured urgency.** Real scarcity only, sourced from live inventory, with a source shown.
8. **Refund posture.** Where policy allows, Studio defaults to the traveller's benefit and eats close calls.
9. **No selling behavioural data.** Aggregate industry insights only, opt-in, revocable.
10. **Trust KPIs are board-level metrics** alongside revenue: NPS, CES, override rate, "made me more excited" rate.

> **CEO note:** if a monetisation initiative requires bending any rule above to hit its target, kill the initiative. The moat *is* the rules.

---

## Section 9 — Competitive Moat

### 9.1 Why Easy Trip cannot be copied easily

Competitors can copy features in a quarter. They cannot copy the compound of the following ten assets, which strengthen with every trip and every user.

### 9.2 The ten compounding assets

**M1. Memory.** A private, structured, per-traveller graph of preferences, companions, tolerances, budgets, moods, and lessons. Every trip deepens it. Every deep piece of memory raises the ceiling of the next recommendation. Portable in, non-portable out (by design of quality — a raw export exists for user rights, but the value is in Studio's use of it).

**M2. Network effects.**
- *Traveller ↔ traveller*: remixable templates, shared trips, group planning; each shared trip acquires new users at low cost.
- *Traveller ↔ operator*: better data flows to operators; better operators appear in Studio; both improve together.
- *Companion graph*: pairs and groups that travel together create a soft social graph unique to Easy Trip.

**M3. Travel intelligence.** A proprietary graph of destinations, seasonality, tempo, transport friction, opening hours, weather, safety, and taste — refined by real trips, not by scraping. This is the "world model" no LLM has out of the box.

**M4. User trust.** Trust is earned once and lost once. Our neutrality contract (§8.4), transparency (§10), and calm brand (§11) compound into an emotional switching cost far larger than the functional one.

**M5. Data advantage.** Not raw volume — *labelled outcomes*: which recommendations were accepted, which trips completed, which moments were remembered. Outcome-labelled data is scarce and disproportionately valuable for AI quality.

**M6. Workspace advantage.** Studio is where the trip *lives*. Once a traveller's trip lives here — with collaborators, bookings, memory, and edits — the cost of moving is emotional and practical. This is Notion-like retention applied to travel.

**M7. AI advantage.** Not because our models are proprietary — they are not — but because our *prompts, tools, evals, retrieval, memory, and guardrails* around the models are proprietary and outcome-tuned to travel. The gap between "an LLM" and "Easy Trip's AI" widens quarterly.

**M8. Editorial advantage.** A voice, a curation standard, a photographic direction, and a creator ecosystem that competitors cannot bolt on. Editorial quality is culture, not code.

**M9. Brand advantage.** The Master Vision defines a distinctive emotional register (calm, editorial, luxurious, human). This is defensible because most competitors are structurally unable to be quiet.

**M10. Platform advantage.** As Studio becomes the surface partners want to reach travellers through, we accrue leverage that pure aggregators lack.

### 9.3 What compounds over time

- **Per user:** memory + preferences + companions.
- **Per trip:** outcome-labelled data + moments + templates.
- **Per city:** operator quality + editorial depth + local intelligence.
- **Per year:** brand trust + creator supply + partner integrations.
- **Per decade:** a living archive of humanity's travel — an irreplicable asset.

### 9.4 What would each incumbent struggle to replicate?

- **Google (Search / Travel / Maps).** They can match utility. They cannot match *editorial calm* or *long-horizon memory of a person* — their business model requires ad density and short-session monetisation, which is architecturally opposed to Studio's register. They also carry decades of UI debt.
- **Airbnb.** They own the stay. They struggle to become the *whole trip* without diluting the brand promise that "stay = product." Extending upstream (dream/plan) puts them into direct conflict with the operators they rely on.
- **Booking.com / Expedia.** They are supply-side businesses whose DNA is inventory and conversion. Becoming calm, editorial, and neutral would require dismantling the exact patterns that produce their revenue.
- **OpenAI / general LLM assistants.** They have models; they lack the travel world model (M3), the outcome-labelled data (M5), the workspace (M6), the editorial (M8), the operator network (M9), and the trust posture (M4). A conversational assistant cannot become a *place* without becoming a product, and becoming a product means competing head-on across every asset above.
- **TripIt / Wanderlog / Kayak.** Feature-competent, but structurally downstream of the decision. Cannot rebuild the dream/plan chapters without a brand strategy they don't have.
- **Instagram / TikTok.** Own inspiration but not decision or fulfilment. Adding planning would compromise the feed; the feed is the business.

**Summary:** every incumbent would have to break part of its business model to compete with Studio on its own terms. That is the moat.

---

## Section 10 — AI Trust Framework

This is the most important section of v1.1. Every AI decision surface in Studio must map back to it.

### 10.1 The mental model — "an experienced travel companion, not an assistant"

Studio's AI is a **quiet, knowledgeable companion who has been everywhere and remembers you**. Not a butler awaiting commands. Not a chatbot in a corner. Not a form-filler.

Behavioural implications: it acts when it should, waits when it should, asks when it must, and shuts up when the moment belongs to the traveller.

### 10.2 When AI should act (autonomously, without asking)

- Confidence ≥ **0.90** *and* action is fully **reversible** *and* action carries **no financial or safety cost**.
- Examples: producing a first-draft itinerary, rebalancing timing after a drag-and-drop, pre-computing budget after an edit, quietly caching content likely to be needed offline, preloading a map tile set.
- Auto-actions must be visibly recorded in the timeline and undoable with one action.

### 10.3 When AI should wait

- The user is mid-thought (typing, dragging, scrolling actively). Do not interrupt with suggestions.
- The user has recently rejected the same suggestion. Do not re-surface for a cool-down window.
- The moment is emotional (post-booking celebration, first entry into a destination photo). Do not sell or suggest.
- Signal is ambiguous (confidence 0.60–0.75 and action is not clearly welcome). Wait for a natural asking moment.

### 10.4 When AI should ask

- Confidence **0.60–0.90** and the action is meaningful (adds/removes days, changes budget scope, chooses between two shortlists).
- Any action that spends money, exposes data, or commits a companion.
- Any action that would violate a stated preference or a policy the user set.
- Asking is a designed act — one line, one choice, no modal wall.

### 10.5 When AI should explain

- Every recommendation exposes a "why" on demand — always. There is no such thing as an unexplained recommendation in Studio.
- Explanations are **human, short, honest**: "Chosen because it's quieter, close to Day 3's walk, and matches your Lisbon stay."
- Explanations name **the top reason, one supporting reason, and one honest caveat** ("but it's a 20-min walk from the metro").
- If the AI is uncertain, it says so, in plain language, without hedging jargon.

### 10.6 When AI should recommend vs. remain silent

- Recommend when it demonstrably increases the traveller's confidence, delight, or safety.
- Remain silent when the user is exploring, remembering, or celebrating. Silence is a feature.
- Never recommend more than needed to move the trip forward. A page of options is a failure, not a service.

### 10.7 Confidence levels (canonical scale)

| Level | Range | Behaviour |
|---|---|---|
| Very high | 0.90–1.00 | May act autonomously (subject to reversibility & no-cost gates). |
| High | 0.75–0.90 | Recommend prominently, explain briefly. |
| Medium | 0.60–0.75 | Recommend softly, ask if action is non-trivial. |
| Low | 0.40–0.60 | Offer as an option among alternatives, disclose uncertainty. |
| Very low | < 0.40 | Do not surface as a recommendation. Ask a clarifying question or stay silent. |

Confidence is exposed to the user only when it aids decision-making — never as a naked number. Prefer language: "a strong pick," "a good option," "a possibility."

### 10.8 Uncertainty policy

- The AI is allowed — and encouraged — to say **"I don't know"** or **"I'm not sure"** in human language.
- Uncertainty is preferable to a confident wrong answer. This is a cultural rule, not just a policy.
- Any answer sourced from time-sensitive data (prices, weather, hours) must carry the timestamp and source on demand.

### 10.9 Hallucination policy (zero-tolerance for a specific class)

- **Never invent facts about the physical world**: prices, addresses, opening hours, visa rules, safety, operator identities. These must be retrieval-grounded and sourced.
- **Never invent user history**: preferences, past trips, companions. Memory is grounded in stored facts.
- **Creative generation is permitted** for narrative, editorial copy, day titles, and mood descriptions — clearly labelled as writing, not fact.
- **Automated evals** must include a hallucination bench (grounded facts, memory recall, refusal-on-unknown) that gates every model or prompt change.
- **Any surfaced hallucination is a P1 incident**, regardless of severity — because trust is asymmetric.

### 10.10 Recommendation transparency

Every recommendation carries, on demand:

1. What was recommended.
2. Why (top reason).
3. What was considered and rejected (up to three alternatives, briefly).
4. What Easy Trip earns, if anything, from the recommendation (§8.4).
5. How to change the criteria ("prefer quieter," "prefer cheaper," "prefer closer").

### 10.11 User override behaviour

- Every AI action is **overridable in one gesture** and **undoable in one gesture**.
- Overrides are **learning events**: the memory graph updates, and the AI does not repeat the same suggestion under the same context.
- The user can globally instruct: "stop suggesting X," "always prefer Y," "never plan before 10am." These become durable preferences and are visible & editable.
- The AI never re-litigates an override in the same session.

### 10.12 Memory permissions

- Memory is **opt-in by default at the coarse level** (Studio remembers your trips and preferences) and **granular at the fine level** (user can see, edit, redact, or delete any memory).
- A **Memory page** exposes what the AI thinks it knows about the traveller, in plain language, with an edit and forget action per item.
- Memory is **scoped**: personal memory is never mixed with a collaborator's without explicit consent.
- Memory is **portable out**: full export in a human-readable form.
- Memory is **revocable**: "forget me" wipes memory and disables personalisation, without deleting the account.

### 10.13 Privacy principles

- **Minimum collection.** Collect only what improves the traveller's experience.
- **Purpose limitation.** Data collected for planning is not used for advertising or sold as data (§8.10.9).
- **Local-first where possible.** Sensitive drafts (private notes, journal entries) prefer on-device processing when feasible.
- **Encryption at rest and in transit** for all traveller data; hard separation of PII from analytics.
- **No training on private trips** without explicit, revocable, granular consent.
- **Regional compliance** (GDPR, CCPA, DPDP, and analogues) as a floor, not a ceiling.
- **Transparency reports** published annually.

### 10.14 AI personality (the companion, in five adjectives)

**Calm. Curious. Candid. Cultured. Considerate.**

- Speaks in short, warm sentences.
- Never uses hype words ("amazing," "incredible," "must-see").
- Uses specific, sensory, editorial language ("the light changes on the harbour after 6").
- Admits limits without over-apologising.
- Has taste, and is willing to disagree gently ("I'd skip that one — here's why").
- Never pretends to be human. Never role-plays a persona.
- Is never sycophantic. Compliments are earned by facts.

### 10.15 Ethical boundaries (non-negotiable)

- **No manipulation.** No dark patterns, no false urgency, no engagement-farming.
- **No political, religious, or ideological steering.** Travel choices are the traveller's.
- **Safety first.** Where destinations carry real risks (health, conflict, legal), the AI states them clearly and non-judgementally.
- **Human dignity.** Local people are never described as attractions.
- **Sustainability disclosure.** Where relevant, environmental impact is disclosed; the AI never hides it.
- **No exploitation content.** The AI refuses to recommend experiences involving exploitation of people, wildlife, or protected sites.
- **Refusal is a feature.** The AI refuses politely when asked to violate any of the above.

---

## Section 11 — Brand Experience Principles

These extend, and are consistent with, the Master Vision. They are *permanent* — every future design decision must pass through them.

### 11.1 Typography philosophy
Editorial serif for headlines (Fraunces), clean humanist sans for body (Inter Tight). Type is set large, with generous leading and short measures. **Never shrink to fit.** Typography carries the emotional weight; it is not decoration.

### 11.2 Photography philosophy
Cinematic, real, and honest. Golden or blue hour, mist, architecture, real people, real places. No stock, no oversaturation, no HDR, no clichéd sunsets. Local photographers preferred; every image credited.

### 11.3 Maps philosophy
Maps are **calm, editorial, and legible**, not neon utilities. Custom cartography over generic tiles wherever feasible. Maps reveal *why* a place matters, not just *where* it is. Geography is a first-class dimension of the workspace (P5).

### 11.4 Illustration philosophy
Illustration is used sparingly, only where photography cannot serve — abstract concepts (memory, budget, weather patterns). Style: hand-drawn, muted, editorial. Never mascot-y, never corporate-flat, never "AI-generated" in feel.

### 11.5 Animation philosophy
Motion is **cinema, not UI**. Slow, weighted, natural easing. Fade, parallax, blur, subtle zoom. No bounce, no elastic, no overshoot. Motion serves *continuity of the story*, not delight for its own sake. Fully honours `prefers-reduced-motion`.

### 11.6 Editorial language
Studio *writes* the trip. Day titles are sentences, not labels. Recommendations are reasons, not adjectives. Errors are apologies, not codes. Copy is written by editors, not filled by product managers.

### 11.7 Voice & tone
Warm, quiet, cultured, specific. The voice of a well-travelled friend who does not need to prove they've been everywhere. Never corporate, never salesy, never breathless.

### 11.8 Luxury without excess
Luxury in Studio is **restraint**: fewer options, better ones; less colour, better colour; less motion, better motion. No gold flourishes, no glass morphism gimmicks, no marble textures. Aman, not baroque.

### 11.9 Calm interaction
Interactions confirm quietly. State changes settle rather than snap. Notifications are rare and meaningful. The system's default emotion is *composure*.

### 11.10 Visual hierarchy
One dominant element per view. Whitespace is used to create silence around important things. Hierarchy is expressed with type, scale, and space — rarely with colour or weight alone.

### 11.11 Spacing philosophy
Space is a material, not a leftover. The default posture is generous. Density is a considered choice for specific surfaces (in-trip day view), never the default.

### 11.12 Material language
Surfaces are matte, warm, and lightly textured (paper, linen, ivory, ink). No glossy plastic, no glass, no chrome. Depth is expressed with shadow and layer, not with skeuomorphism.

### 11.13 Icon philosophy
Thin-stroke, consistent geometry, minimal, monochrome. Icons *support* labels; they rarely replace them. No cartoon icons, no filled emoji-style, no colour-coded utility icons that fight the palette.

### 11.14 Colour philosophy
Deep Ocean Navy, Warm Ivory, Copper, Turquoise, Slate, Stone. Colour is used for *meaning* (chapter, mood, destination context), not for decoration. No neon, no gradients-as-a-brand, no rainbow. Restraint = luxury.

### 11.15 Motion philosophy
See §11.5. Additionally: every motion has a *reason* (continuity, orientation, feedback, delight-of-place). Ambient motion (light, weather, environment) is subconscious and slow. Motion is never a substitute for content.

### 11.16 Sound philosophy (future)
When Studio gains sound (voice mode, ambient audio in a memoir), it will be **quiet, natural, and diegetic** (surf, market, train). No UI beeps, no marimba notifications, no synthetic voice with a persona. Silence is the default.

### 11.17 Cross-cutting rule
Every design decision must reduce to two answers: **does it make travel feel more real?** and **does it make the traveller more excited?** If not, remove.

---

## Section 12 — Emotional Journey Framework

The traveller moves through eleven emotions across the trip lifecycle. Each stage names the *desired* emotion, the *risk* of getting the opposite, and the opportunities.

### E1 — Wonder (Dream chapter)
- **Desired emotion:** open-eyed possibility.
- **Current risk:** algorithmic sameness, listicle fatigue, guilt about "wasting time."
- **Product opportunity:** editorial dream surfaces; slow, cinematic imagery; short, evocative narratives.
- **AI opportunity:** translate mood into small evocative shortlists; surface the unfamiliar-but-fitting.
- **Brand opportunity:** own "dream" as the emotion Easy Trip is best at.

### E2 — Curiosity (Research)
- **Desired:** learning that feels like reading a good essay.
- **Risk:** overwhelm, conflicting sources, review fatigue.
- **Product:** synthesised destination briefs; sourced facts; taste-matched depth.
- **AI:** citation-grounded synthesis; refuses to speculate.
- **Brand:** Nat Geo-grade editorial voice.

### E3 — Confidence (Compare)
- **Desired:** permission to decide.
- **Risk:** paralysis, buyer's remorse, comparison fatigue.
- **Product:** opinionated comparison with a named winner and honest caveats.
- **AI:** transparent reasoning; personalised weights the user can adjust.
- **Brand:** "we say what we think" as a trust signal.

### E4 — Excitement (Plan)
- **Desired:** the trip starting to feel real.
- **Risk:** grinding through logistics; losing momentum.
- **Product:** strong first draft; craftable canvas; visible progress.
- **AI:** rebalances silently; explains on demand.
- **Brand:** planning as *design*, not admin.

### E5 — Commitment (Book)
- **Desired:** calm decisiveness.
- **Risk:** anxiety spike; regret; hidden fees.
- **Product:** honest totals; in-context booking; one-click undo where policy allows.
- **AI:** flags risk, unclear policies, and better alternatives *before* purchase.
- **Brand:** the neutrality contract felt as care.

### E6 — Anticipation (Pre-departure)
- **Desired:** growing joy.
- **Risk:** last-minute panic (packing, docs, weather).
- **Product:** a dedicated "eve" chapter — packing, weather, first-day map, warm note.
- **AI:** proactive nudges tuned to *this* trip, not generic.
- **Brand:** ritual around departure; a small paper-like gesture (a "boarding pass" moment).

### E7 — Adventure (In-trip, high energy)
- **Desired:** presence, playfulness, discovery.
- **Risk:** heads-down-in-screen; missing the place.
- **Product:** calm day view; offline-first; get-in-and-get-out interactions.
- **AI:** whispers when needed; silent otherwise; disruption-aware.
- **Brand:** the phone recedes; the trip advances (P1).

### E8 — Relief (Recovery from disruption)
- **Desired:** "I'm okay, this is handled."
- **Risk:** compounding stress; loss of trust.
- **Product:** one-tap replan; preserved plans; clear next step.
- **AI:** proposes a replan with reasons; asks before spending money.
- **Brand:** the moment users tell friends about.

### E9 — Reflection (Post-trip, days later)
- **Desired:** gentle nostalgia.
- **Risk:** the trip disappears into camera roll.
- **Product:** low-effort memoir; three prompts, not thirty; beautiful default artifact.
- **AI:** curates candidate moments; user approves.
- **Brand:** the trip *becomes* a keepsake, not a folder.

### E10 — Nostalgia (Weeks/months later)
- **Desired:** warmth on returning to the trip.
- **Risk:** the archive feels like admin.
- **Product:** editorial archive; on-this-day style resurfacing done tastefully.
- **AI:** offers to plan a "return trip" or a "trip like it" — never pushily.
- **Brand:** the archive as a private travel journal.

### E11 — Belonging (Community, over years)
- **Desired:** "this is where my travelling life lives."
- **Risk:** the platform becomes utility; churn.
- **Product:** companion graph, creator following, private community threads.
- **AI:** learns *who* you travel like, not just *what* you like.
- **Brand:** membership without exclusivity; a *practice*, not a subscription.

**Cross-cutting rule:** the emotional curve is *engineered*. Every chapter has a target emotion and a KPI that proxies it (see PRD v1.0 §7).

---

## Section 13 — Empty State Philosophy

An empty state is not the absence of content — it is a designed moment. Premium products are recognised by them.

**Universal rules**
- Always editorial: one strong image or one strong sentence, never both loud.
- Always inviting: name the next possibility, not the absence.
- Never apologetic: "nothing here yet" is a failure of copy.
- Never a placeholder illustration of a cartoon empty box.
- Always one clear, low-commitment next step.

### 13.1 No trips (first-time in Studio)
- Tone: welcome to a workshop, not onboarding a SaaS.
- Content: a short editorial sentence, an evocative photograph, and a single prompt to describe a place the user has been dreaming of.
- Reject: dashboards, "sample trip" cards that feel like demo data.

### 13.2 No itinerary yet (trip created, canvas empty)
- Show a first-draft *in progress* rather than a blank canvas — even if it's a single "Day 1 — arrive and let the city breathe."
- Offer three doorways: "compose from a feeling," "start from a template," "start from a moment I love."
- Never present an empty grid.

### 13.3 No recommendations
- Studio *should not* run out of recommendations. If it does, the framing is honesty: "I want to think more before I suggest — tell me one thing that matters most to you today."
- Reject: "no results found."

### 13.4 No AI confidence (uncertainty state)
- Studio names it, calmly: "I'm not sure yet. Here's what I'd need to know."
- Offers *the smallest question* to move forward.
- Never fabricates a low-quality answer to fill silence.

### 13.5 No bookings (yet)
- Frame as *pre-departure preparation*, not empty inventory.
- Show what *is* ready (the plan) and what *would* need booking, ordered by leverage.
- Never up-sell.

### 13.6 Offline
- Studio remains *usable*, not *broken*. Cached plan, cached maps, cached day view.
- Clear, calm banner: "You're offline. Everything you saved is here; changes will sync."
- Nothing spins forever. Nothing shouts.

### 13.7 No collaborators
- Frame as an invitation, not an absence. "Invite the people you're travelling with — they can join without an account."
- Never a modal begging for a share.

### 13.8 Network failure
- Distinguish transient (retry silently) vs. persistent (surface calmly).
- Preserve the user's in-progress work. Never lose a keystroke.

### 13.9 Permission denied
- Explain in human terms *why* and *what to do*. Never expose codes.
- Where possible, offer an alternative path (view-only, request access).

### 13.10 No search results
- Never a bare "0 results." Offer:
  - A softened query the AI *would* recommend.
  - The nearest destination that *does* match.
  - An invitation to describe it differently ("in your own words").

---

## Section 14 — Error & Recovery Philosophy

**Core stance:** the system apologises. The user never does. Every failure preserves work. Recovery is a designed moment.

**Universal rules**
- Human copy; no codes; no stack traces.
- Preserve *everything* the user did: text, edits, drafts, selections.
- Offer one primary recovery action; never a wall of options.
- Retry silently when safe; ask when consequential.
- Never blame the user, the network, or a partner by name in copy.

### 14.1 Provider unavailable (e.g., a booking partner is down)
- Detect quickly, degrade gracefully: hide the affected option, show equivalent alternatives, note "temporarily unavailable" only if the user searched for it specifically.
- Never freeze the whole page for one provider.

### 14.2 Booking failed
- Show a single, warm sentence: "The booking didn't go through — no money was moved."
- Preserve the exact cart, the exact prices, the exact traveller details.
- Offer a one-tap retry and a clearly labelled alternative.
- If money *was* moved, escalate to human support proactively and email the user immediately.

### 14.3 Weather unavailable
- Silently omit weather-dependent nudges rather than showing "N/A."
- If a plan depends on weather, state honestly: "I don't have a forecast for that day yet — I'll update your plan when I do."

### 14.4 Payment failed
- Distinguish decline, network, and fraud in language *without exposing the reason source*. E.g., "Your bank didn't approve this — try another card or contact them."
- Never lose the trip context; the user returns to the same view.
- Offer alternative payment methods if configured.

### 14.5 Maps unavailable
- Fall back to a static, cached rendering of the route/points.
- Do not gate the itinerary behind the map.

### 14.6 AI uncertain / AI unavailable
- If uncertain: see §10.8; the AI says so.
- If unavailable: Studio remains fully usable manually. All AI-optional surfaces degrade to manual with a small, calm note ("AI is resting — you can still plan; I'll catch up in a moment").
- Never a spinner without a message.

### 14.7 Connection lost
- Slip into offline mode without ceremony (§13.6).
- Queue changes locally; sync on return; show a discreet "up to date" confirmation.

### 14.8 Cancelled booking (partner-initiated)
- Detect and surface with dignity: "Your hotel cancelled — here's why, and here are three replacements that fit your trip."
- Offer proactive replanning; if Premium, offer automatic rebooking within user-defined limits.
- Always preserve the affected days in the plan.

### 14.9 Structural errors (a whole page fails)
- Global "something went sideways" surface is editorial and calm, not a broken robot.
- One primary recovery action; work is preserved; incident is logged automatically.

### 14.10 The recovery test
Every error state must pass three checks:
1. Would the user's *anxiety* decrease when they see this?
2. Is their *work* preserved?
3. Do they know the *next step*?
If any answer is "no," the error is not shipped.

---

## Section 15 — Ecosystem Vision (5–10 years)

Studio is not a website. It is a **surface-agnostic travel companion**. The traveller meets Studio wherever the trip is happening.

**Principle:** every surface expresses the same voice, the same calm, the same memory. Continuity across devices is a first-class product feature.

### 15.1 Desktop (today)
The workshop. Deep planning, collaboration, editorial reading, memory review. High-density, keyboard-native, comfortable for long sessions.

### 15.2 Mobile
The companion. In-trip day view, quick capture, notifications, one-tap replan. Optimised for gloved-thumb, low-battery, spotty-signal realities.

### 15.3 Tablet
The atlas. Reading and light editing. Perfect for evening planning on the sofa; the map and the plan share the screen naturally.

### 15.4 Watch
The whisper. Only what matters *right now*: next event, gate change, weather change, arrival, tap-to-check-in.

### 15.5 Voice
The companion, out loud. "What's next?" "Any changes for tomorrow?" Voice mode is calm, brief, and never speaks unprompted while the traveller is *in* the experience.

### 15.6 Car
The co-driver. Turn-by-turn tied to the plan; scenic routing when time allows; nothing that requires reading long copy while driving.

### 15.7 AR / spatial
The lens. Overlay reasons ("why this street matters"), not blinking pins. Restraint here is essential; AR is where taste is measured.

### 15.8 Offline
A first-class *mode*, not a fallback. Every trip is designed to be *survivable* without a signal.

### 15.9 Widgets & lockscreens
The glance. Countdown, weather, next event, quiet ambient photography from the trip.

### 15.10 Smart displays / TV
The daydream. Ambient editorial imagery of upcoming trips and past memories; a calm, cinema-scale entry into Dream and Remember chapters.

### 15.11 Future travel devices (glasses, in-seat displays, hotel room screens)
Studio is designed to be *portable to the moment*. As new surfaces emerge, the principle is unchanged: same voice, same memory, same calm.

### 15.12 Continuity contract
- Same trip, same memory, same collaborators — across all surfaces, in real time.
- Every surface knows what the traveller just did on another.
- No surface introduces its own visual dialect; the brand is a single language spoken with different accents.

---

## Section 16 — Platform Strategy

Studio becomes a platform only *after* it earns the right — that is, once its consumer product is loved, trusted, and dense enough that partners want in on our terms.

### 16.1 What remains first-party (permanent)
- The AI Core (models, prompts, tools, memory, evals).
- The recommendation and ranking layer.
- The workspace and editorial fabric.
- The trust posture (neutrality, privacy, safety).
- The brand and voice.
- The memory graph.

These are the moat. They are never delegated.

### 16.2 What becomes extensible
- **Supply integrations**: airlines, hotel groups, rail, ground transport, activities, insurance, visa, eSIM, FX.
- **Content integrations**: creators, tourism boards, publishers.
- **Local services**: guides, private drivers, curated experiences.
- **Financial services**: BNPL, wallets, expense export, corporate policy.
- **Enterprise plug-ins**: SSO, HRIS, expense platforms, duty-of-care providers.

### 16.3 Developer APIs
- **Read APIs** for a user's trip, memory (with consent), and preferences — enable partner apps to be trip-aware.
- **Write APIs** for supply partners to publish inventory, availability, and rich content into the marketplace.
- **Extension APIs** for developers to build modular *chapters* or *cards* inside Studio (see 16.5).
- **Webhook and streaming APIs** for disruption, booking status, and itinerary changes.
- **Versioning discipline**: semantic versioning, six-month deprecation minimum, first-party migration tools.

### 16.4 Partner integrations (tiers)
- **Tier 1 — Strategic**: deeply co-designed integrations (airline groups, hotel groups, tourism boards).
- **Tier 2 — Certified**: contract-based partners with a reviewed integration (insurance, visa, transport).
- **Tier 3 — Open**: self-serve API partners subject to policy, quality bar, and neutrality contract.

### 16.5 Plugin & extension architecture (philosophy)
- Plugins are **guests in the workspace**, not owners of it.
- Plugins render inside Studio's editorial fabric (voice, type, palette) — they do not bring their own visual identity.
- Plugins declare permissions explicitly and are audited on install and on update.
- Plugins cannot influence ranking, cannot access memory beyond declared scope, and cannot bypass the neutrality contract.
- Plugins that violate policy are removed without appeal; users are notified with a preserved-work fallback.

### 16.6 Marketplace governance
- Curation before openness.
- Reputation systems that resist gaming (weighted by outcomes, not vote counts).
- Fair economics visible to operators.
- Sustainability and ethics as tier-1 admission criteria.

### 16.7 What we will *not* do
- No open ad marketplace.
- No third-party trackers inside Studio.
- No plugin that requests access to a user's memory without an explicit, per-scope grant.
- No white-labelling of the consumer brand.

### 16.8 The platform sequencing
1. **Years 1–2:** consumer product excellence; deep supply integrations (§16.4 Tier 1).
2. **Years 2–3:** curated marketplace; creator economy; Premium & Business tiers mature.
3. **Years 3–5:** open developer APIs (read → write → extend), Certified partners.
4. **Years 5+:** engine licensing; a Studio ecosystem in which Easy Trip is the operating system.

---

## Section 17 — Product Governance

Governance is how a great product stays great when the team is 200, 2,000, and 20,000 people. This section is the *operating manual*.

### 17.1 Decision principles (how we choose)
1. **Vision over feature.** Every decision is tested against the Master Vision and this PRD.
2. **Trust over throughput.** A slower path that protects trust beats a faster one that doesn't.
3. **Reversible over irreversible.** Prefer choices we can undo cheaply.
4. **One-way doors demand a written argument.** Big, irreversible decisions require a memo, reviewed by two of {CEO, CPO, AI Product Lead, Platform Architect}.
5. **Boring beats clever.** When two solutions solve the problem, the more boring one wins.
6. **Kill it if it fails the excitement test.** (PRD v1.0 §P13.)

### 17.2 Feature acceptance criteria (definition of "ready to build")
A feature is ready when *all* the following are true:
- It maps to a named JTBD (v1.0 §5) and a stage in the emotional curve (v1.1 §12).
- It has a written product principle it strengthens (v1.0 §3, v1.1 §11).
- It has a named metric it moves (v1.0 §7).
- It has a plain-language "why now."
- It has an empty state, error state, offline behaviour, and reduced-motion behaviour designed *before* the happy path.
- Its AI behaviour is mapped to §10 (act / wait / ask / explain).
- Its monetisation implications are reviewed against §8.10.
- Its accessibility posture is defined (§17.7).
- It has a rollback plan.

### 17.3 Quality gates (definition of "done")
A feature ships only when:
- All 17.2 criteria remain satisfied.
- Passes design review, architecture review, accessibility review, performance review, and (if AI-touching) AI review — see below.
- Instrumentation is live and dashboards are wired.
- Copy is edited by a writer, not just a PM.
- The excitement test is confirmed by two people not on the team that built it.

### 17.4 Design review
- **Cadence:** weekly, one hour, all in-flight surfaces reviewed against the Master Vision and §11 principles.
- **Deliverable:** a green/amber/red for each surface, with named owners for red.
- **Veto power:** the Principal Designer can block a ship on brand grounds; only the CPO can override, in writing.

### 17.5 Architecture review
- **Cadence:** biweekly and on any change touching AI Core, TIOS, TIE, APIs, SDKs, routing, database.
- **Rule:** the architectural boundaries listed in the Master Vision are **frozen** and require an explicit, written unfreeze decision by the CTO/Platform Architect.
- **Deliverable:** ADRs (architecture decision records) for anything crossing a boundary.

### 17.6 AI review
- **Cadence:** every model change, prompt change, tool change, memory-schema change, or safety-policy change.
- **Gates:** hallucination bench, refusal bench, override-safety bench, personalisation-recall bench, and latency/cost budgets.
- **Rule:** no AI change ships without passing evals *and* a written human review.

### 17.7 Accessibility review
- **Baseline:** WCAG 2.2 AA on every surface; AAA on typography and colour contrast where feasible.
- **Includes:** keyboard-first flows, screen-reader flows, reduced motion, reduced transparency, high-contrast, colour-blindness safety, and cognitive-load review.
- **Rule:** an inaccessible feature is not "done." No exceptions.

### 17.8 Performance review
- **Budgets** (indicative, refined per surface):
  - LCP ≤ 2.0s on median desktop, ≤ 2.5s on median mobile.
  - INP ≤ 200ms.
  - CLS ≤ 0.05.
  - AI first-token ≤ 800ms on chat surfaces where feasible.
  - Cold app JS budget capped per route.
- **Rule:** exceeding a budget requires a written waiver and a scheduled fix.

### 17.9 Release readiness (per feature)
Checklist:
- Feature flag, staged rollout plan, kill switch.
- Runbook for on-call.
- Support macros and knowledge-base article ready.
- Legal / privacy sign-off if applicable.
- Marketing brief only if the feature is user-visible enough to warrant it — most features ship quietly.

### 17.10 Deprecation policy
- Six-month minimum deprecation window for any user-facing surface, one year for developer APIs.
- Migration path is provided, not asked for.
- Deprecations are announced editorially, not buried in a changelog.
- Data survives deprecation; features do not orphan trips.

### 17.11 Long-term maintainability
- **Boring architecture.** Prefer widely-adopted tech; avoid clever internal frameworks.
- **Small, well-named units.** Optimise for reading, not writing.
- **Documented invariants.** Every architectural boundary is a written invariant with an owner.
- **A living PRD.** This document, and its successors, is the source of truth. Code follows PRD; PRD follows Vision; Vision follows the traveller.
- **Post-mortems as culture.** Blameless, published internally, patterned insights folded back into governance.

### 17.12 Governance guardrails (permanent)
1. The neutrality contract (§8.4/§8.10) cannot be weakened by any team.
2. The AI trust framework (§10) cannot be relaxed for a growth target.
3. The architectural freeze (Master Vision) requires written CTO approval to lift.
4. The brand principles (§11) are stewarded by design; only the CPO can override, in writing.
5. Any policy change that affects users must be announced in plain language ahead of time.

### 17.13 Governance cadence (annual)
- **Quarterly:** metric review against v1.0 §7 targets; trust KPIs are board-level.
- **Semi-annually:** PRD review; add sections only when needed; retire sections when superseded.
- **Annually:** Master Vision review; transparency report published; deprecation calendar for the next 12 months.

---

**End of v1.1.**

The following sections are intentionally *not* included and will follow only after explicit approval:
- Information Architecture
- UX Architecture
- Component System
- Motion System
- Technical Design
- Instrumentation Plan
- Rollout & Risk

STOP.

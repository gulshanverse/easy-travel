# EDS-001 — Memory Engine Engineering Specification

**Status:** Engineering Design Phase (Approved for Implementation Planning)
**Architecture Baseline:** Journey Intelligence Platform v1.3 (FROZEN)
**Compatibility:** AI Core · TIOS · TIE · Intelligence Mesh · JIP v1.0 → v1.3
**Document Type:** Engineering Design Specification (EDS)
**Scope:** How the Memory Engine will be engineered. Not architecture. Not implementation. Not UI.

> This document translates the frozen Memory Engine architecture into an engineering-grade specification detailed enough that multiple independent teams could implement it and remain interoperable. No architectural decisions are altered; only the *how* is defined.

---

## 0. Reading Guide

| Audience | Read |
|---|---|
| Backend engineers | §2, §3, §5, §6, §7, §8, §9, §13 |
| Platform / SRE | §3, §10, §12, §13, §15 |
| Security / Privacy | §6, §11, §13 |
| AI / Retrieval engineers | §4, §5, §8 |
| QA | §14 |
| Product / PM | §1, §10, §15 |

Normative language: MUST, SHOULD, MAY per RFC 2119.

---

## 1. Memory Goals

### 1.1 Purpose
The Memory Engine (ME) is the *persistence and recall substrate* of the Journey Intelligence Platform. It stores, ranks, promotes, decays and serves every unit of knowledge the platform uses to reason about a traveler, a journey, a group, and the world — with deterministic contracts, bounded latency, and full explainability.

### 1.2 Design Philosophy
1. **Memory is a first-class product surface**, not a cache.
2. **Layered by lifetime, not by feature.** Types differ in TTL and promotion, not in schema families.
3. **Every recall is explainable.** Every returned item carries provenance, confidence, and the ranking components that produced it.
4. **Forgetting is a feature.** Decay and deletion are equal citizens with write and read.
5. **No cross-user leakage, ever.** Isolation is a build-time and runtime invariant.
6. **Deterministic contracts, probabilistic content.** APIs are strict; ranked payloads may be uncertain, but uncertainty is quantified.
7. **Additive only.** Schemas and events evolve via versioning; nothing is silently mutated.

### 1.3 Non-Goals
- ME does not host business logic (Journey planning, booking, pricing).
- ME does not perform LLM inference — it *feeds* AI Core via POE slots.
- ME does not own UI state (that belongs to Journey Studio).
- ME does not replace TIE's world state; it references it.
- ME does not implement multi-agent arbitration (that is UDE/MAG).

### 1.4 Constraints
- All persistence rides existing Lovable Cloud primitives (Postgres, pgvector, object storage).
- Server-side code executes in the TanStack Start Worker runtime — no Node-native binaries, no long-lived processes.
- Every public.* table MUST have RLS and GRANTs (per platform standards).
- Bearer-authenticated server functions only; `service_role` only in verified server-only modules.
- p95 recall latency budget: **< 120 ms** for hot paths (see §10).

### 1.5 Engineering Assumptions
- Vector dimension is fixed per embedding model version; changing dimension = new index.
- Embedding provider is Lovable AI Gateway; model IDs pinned per env.
- Write volume ceiling per user: **≤ 500 writes/min sustained, 2 000 burst**.
- Storage ceiling per user (year 1): **≤ 250 MB structured + 1 GB blob**.
- Time is UTC; all TTLs stored as absolute `expires_at` timestamps.
- The Intelligence Mesh delivers events at-least-once with per-partition ordering.

---

## 2. Memory Types

All types share the base envelope:

```
MemoryItem {
  id: uuid                       // globally unique
  user_id: uuid                  // owner (nullable ONLY for Global Anonymous)
  scope: enum                    // working|session|journey|cross|dna|global|temp|cache|archive
  namespace: text                // logical bucket, e.g. "preferences", "moment"
  key: text                      // domain key (nullable)
  content: jsonb                 // structured payload
  embedding_id: uuid?            // FK to memory_embeddings
  confidence: numeric(4,3)       // [0.000, 1.000]
  importance: numeric(4,3)       // [0.000, 1.000], decays over time
  provenance: jsonb              // {source, agent, evidence_ids[], created_by}
  version: int                   // monotonically increasing per (user_id,scope,key)
  parent_version_id: uuid?       // supersession chain
  created_at, updated_at, expires_at, promoted_at, forgotten_at: timestamptz
  tombstone: bool                // soft-delete flag
}
```

### 2.1 Type Matrix

| Type | Purpose | Storage | Lifetime | TTL | Promotion | Eviction | Priority | Visibility | Mutability | Recovery | Versioning |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Working** | In-flight reasoning slots for a single request/turn | In-process LRU + Redis-compatible KV | Turn / request | 5 min hard cap | → Session on turn commit | LRU + TTL | Highest | Request-scoped | Freely mutable | None (ephemeral) | None |
| **Session** | Conversation / studio session state | KV + Postgres shadow | Session | 24 h idle, 7 d absolute | → Journey when journey_id bound | Idle timeout | High | User + session id | Mutable | Last-write snapshot | Linear |
| **Journey** | Facts scoped to one journey | Postgres + pgvector | Journey lifecycle (Dream → Remembering) | None while active; 365 d after Remembering | → Cross-Journey / DNA per §5 | Post-archive prune | Medium-High | User + journey members | Immutable after `promoted_at` | PITR | Full |
| **Cross-Journey** | Multi-journey patterns for a user | Postgres + pgvector | Lifetime of account | None | → DNA when stable | Consent-triggered | Medium | User | Append-only + supersession | PITR | Full |
| **Journey DNA** | Stable identity signals | Postgres | Lifetime of account | None | → Portfolio metrics | Never (only via RTBF) | Highest for personalization | User (opaque to agents) | Supersession only | Snapshot chain | Full + signed |
| **Global Anonymous Learning** | Aggregate learning across users | Postgres (aggregated) + object store | Indefinite | None | Not applicable | k-anonymity purge | Low per-item, high aggregate | Platform (no user_id) | Append-only | Rebuild from source aggregates | Bucketed by epoch |
| **Temporary** | Scratchpad for agents & tools | KV | Task | 15 min hard cap | Never | TTL | Low | Task-scoped | Mutable | None | None |
| **Cached** | Memoized derived results | KV + edge cache | Derivation TTL | 60 s – 24 h per key class | Never (recompute) | LRU + TTL + invalidation event | Low | Depends on key scope | Immutable per key | Recompute | Keyed |
| **Archived** | Cold Journey/DNA history | Object storage (parquet) | Indefinite | None | Read-only restore | Retention policy | Lowest online | User | Immutable | From cold snapshot | Bucketed |

### 2.2 Per-Type Engineering Notes
- **Working / Temporary / Cached** are the only types that MAY skip Postgres. Everything else is durable-first.
- **Journey → DNA promotion** REQUIRES ≥ N=3 supporting journeys and confidence ≥ 0.75 (see §5.3).
- **Global Anonymous** MUST pass k-anonymity (k ≥ 50) and differential privacy noise (ε ≤ 1.0) before write.
- **DNA** is the only type signed with an HMAC of its provenance vector; tampering fails signature check on read.

---

## 3. Storage Architecture

### 3.1 Logical vs Physical Layout

```
Logical            Physical (default)                      Notes
-----------------  --------------------------------------  ----------------------------------
Working            Worker in-proc LRU + KV                 Never fsynced
Session            KV (primary) + Postgres shadow          Shadow every 30 s or commit
Journey            Postgres: memory_items, memory_edges    Row-level partitioned by user_id
Cross-Journey      Postgres: same tables, scope='cross'    Same partition scheme
DNA                Postgres: memory_dna                    Signed rows, append-only
Vectors            Postgres pgvector: memory_embeddings    HNSW index per model_version
Blobs / Archive    Object storage (parquet + JSONL)        Written by archival worker
Metadata           Postgres: memory_meta                   FK-lite; JSONB indexed
```

### 3.2 Table Set (logical — DDL not in scope)
- `memory_items` — envelope + content
- `memory_embeddings` — `(id, item_id, model_version, dim, vector)`
- `memory_edges` — graph edges `(src_id, dst_id, relation, weight, evidence_id)`
- `memory_meta` — extended metadata / labels
- `memory_dna` — DNA rows (signed)
- `memory_audit` — append-only audit trail
- `memory_events_outbox` — transactional outbox for the Mesh
- `memory_snapshots` — snapshot manifests
- `memory_tombstones` — RTBF markers

All above tables live in `public`, RLS-enabled, with `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role`. `anon` gets no grants.

### 3.3 Vector Storage
- **Engine:** pgvector, `HNSW` index, `m=16`, `ef_construction=200`, `ef_search` tuned per query class (default 64).
- **Distance:** cosine.
- **Dimension:** pinned per `model_version` (e.g., 1536 or 3072). New model version = new index, dual-write during migration window.
- **Sharding:** logical shard = `user_id % N`; physical shard = Postgres partition per shard bucket.

### 3.4 Indexes
| Index | Table | Type | Purpose |
|---|---|---|---|
| `pk_items` | memory_items | btree | PK |
| `ix_items_user_scope_updated` | memory_items | btree | Recency scan |
| `ix_items_user_ns_key` | memory_items | btree | Direct key lookup |
| `ix_items_expires` | memory_items | partial btree WHERE expires_at IS NOT NULL | Eviction sweeper |
| `ix_items_tombstone` | memory_items | partial btree WHERE tombstone | Purge sweeper |
| `ix_emb_hnsw` | memory_embeddings | HNSW | Similarity |
| `ix_edges_src_rel` | memory_edges | btree | Graph traversal |
| `gin_content` | memory_items | GIN(jsonb_path_ops) | Structured filter |
| `ix_audit_user_time` | memory_audit | btree | Audit query |

### 3.5 Cache Tier
- **L1:** in-Worker LRU (size cap 8 MB, item cap 1 000).
- **L2:** KV / edge cache, keyed as `mem:{user_id}:{scope}:{sig}` with 60 s default TTL.
- Cache invalidation events (§9) purge affected keys on write/promote/forget.

### 3.6 Snapshots
- **Journey snapshot** taken on state transitions (Dream→Plan→Book→Live→Remember).
- **DNA snapshot** taken monthly + on every supersession.
- Snapshot = parquet blob + manifest row in `memory_snapshots`.

### 3.7 Cold Storage
- Journeys entering `archived` status move blobs to object storage after 90 d online.
- Restore SLA: **≤ 30 s** for last-year, **≤ 5 min** older.

### 3.8 Encryption
- At rest: managed by platform (AES-256).
- In transit: TLS 1.2+ only.
- Field-level: PII columns wrapped with envelope encryption; DEKs per-user, KEK platform-managed.
- DNA rows additionally HMAC-signed for tamper-evidence.

### 3.9 Compression
- JSONB payloads > 4 KB compressed via TOAST (Postgres default).
- Archived parquet uses ZSTD level 3.

### 3.10 Sharding & Partitioning
- Row partition key: `user_id` (hash, 64 partitions initial).
- Time sub-partitioning on `memory_audit` and `memory_events_outbox` (monthly).
- Repartition plan documented in §15 (Phase 5).

---

## 4. Memory Retrieval

### 4.1 Composite Ranking Function
For a query `q` against candidate item `i`:

```
score(i) = w_sim · sim(q,i)
        + w_rec · recency(i)
        + w_imp · importance(i)
        + w_id  · identityFit(i, user)
        + w_goal· goalFit(i, activeGoals)
        + w_jny · journeyFit(i, activeJourney)
        + w_conf· confidence(i)
        - w_pen · conflictPenalty(i)
```

Default weights (tunable per query class, MUST sum to 1 for `w_*` positive terms except `w_pen`):

| w_sim | w_rec | w_imp | w_id | w_goal | w_jny | w_conf | w_pen |
|---|---|---|---|---|---|---|---|
| 0.35 | 0.10 | 0.10 | 0.15 | 0.10 | 0.10 | 0.10 | 0.25 |

### 4.2 Similarity
- Cosine over pgvector; `ef_search` between 40 (fast) and 128 (accurate).
- Candidate cap per stage: 200 → 50 → 20 → K (default K=8).

### 4.3 Hybrid Search
Two-stage retrieval:
1. **Recall stage** — union of (a) vector ANN top-200, (b) BM25/GIN keyword top-100, (c) graph 1-hop neighbors of active anchors.
2. **Rank stage** — composite scoring per §4.1, then diversity filter (MMR λ=0.5) to prevent near-duplicates.

### 4.4 Semantic Search
Cross-encoder rerank (optional, per query class) invoked via AI Core only when candidate count > 20 AND latency budget allows. Rerank is bypassed when p95 SLO is at risk (see §10).

### 4.5 Graph Traversal
- Max depth 3, max fanout 25, max nodes 200 per query.
- Weighted edges; traversal biased by `relation × weight`.
- Cycles broken via visited set.

### 4.6 Recency Weighting
`recency(i) = exp(-Δt / τ_scope)` where τ is per scope:

| Scope | τ |
|---|---|
| Working | 5 min |
| Session | 1 h |
| Journey | 14 d |
| Cross | 180 d |
| DNA | 730 d |

### 4.7 Importance Weighting
Importance is written at creation and *decays* on the same τ curve as recency but with a floor of 0.05.

### 4.8 Identity / Goal / Journey Fit
Each returns [0,1] from IIE / GIE / JTE respectively. Ranker MUST degrade gracefully to 0 if the upstream engine is unavailable (never blocks).

### 4.9 Confidence Weighting
Confidence enters as a linear factor and also gates: items below `min_confidence` (default 0.30) are dropped pre-rank.

### 4.10 Conflict Resolution
When two candidates disagree on the same `(namespace,key)`:
1. Higher `confidence` wins.
2. Tie → newer `updated_at`.
3. Tie → higher `provenance.trust_tier`.
4. Tie → deterministic id sort.
Losing candidate is annotated `conflict_with=id`, penalized by `w_pen`, and surfaced to XAI as "suppressed alternative".

---

## 5. Memory Promotion

### 5.1 Working → Session
- **Trigger:** turn commit event.
- **Condition:** item referenced by ≥ 1 completed reasoning step AND confidence ≥ 0.40.
- **Action:** shallow copy into Session KV with new `scope='session'`, `version=1`.

### 5.2 Session → Journey
- **Trigger:** session commit while a `journey_id` is bound OR explicit `PromoteMemory` call.
- **Condition:** importance ≥ 0.30 OR item is referenced by a Journey artifact.
- **Action:** durable insert into `memory_items` with `scope='journey'`, provenance carried, embedding computed if missing.

### 5.3 Journey → DNA
- **Trigger:** nightly promotion job + on JTE `remembering` transition.
- **Condition (ALL):**
  - Signal observed in ≥ **3 distinct journeys** (configurable per DNA facet).
  - Aggregate confidence ≥ **0.75**.
  - No contradicting DNA fact with confidence ≥ 0.80.
  - User consent state = `granted` for the DNA facet class.
- **Action:** supersede prior DNA row (version+1, `parent_version_id` set), sign HMAC.

### 5.4 DNA → Portfolio
- **Trigger:** PIE roll-up job.
- **Action:** derived metrics only; DNA rows themselves never move.

### 5.5 Thresholds Summary

| Transition | Min Confidence | Min Importance | Extra Gate |
|---|---|---|---|
| Working→Session | 0.40 | — | referenced by step |
| Session→Journey | 0.50 | 0.30 | journey bound |
| Journey→Cross | 0.60 | 0.40 | seen in ≥ 2 journeys |
| Cross→DNA | 0.75 | 0.50 | ≥ 3 journeys + consent |

### 5.6 Decay Rules
Every item runs `importance ← importance · exp(-Δt / τ_scope)` on the recency clock; items falling below `min_retention` (default 0.05) become eviction candidates unless pinned.

### 5.7 Retention Policies
- Journey items: online 365 d after Remembering, then archive.
- Cross-Journey: retained while account active.
- DNA: retained until deletion request.
- Audit: 400 d online, then cold.

---

## 6. Memory Forgetting

### 6.1 Decay
Continuous per §5.6; recomputed lazily on read and by nightly sweeper.

### 6.2 Eviction
- Sweeper batches (10 000 rows) run every 5 min for KV, hourly for Postgres.
- Order: `tombstone → expired → below_min_retention → LRU`.
- Evicted items with `importance ≥ 0.20` are summarized (§6.4) before deletion.

### 6.3 Retention
Explicit `pinned=true` flag disables eviction and decay; pinning requires DNA-facet or user action.

### 6.4 Summarisation
Summariser compacts N related items into 1 summary item with:
- `provenance.evidence_ids = [sources...]`
- `confidence = min(sources.confidence)`
- `content.summary = <text>` (bounded 1 KB)

Summaries are marked `derived=true` and never promoted directly to DNA.

### 6.5 Compression
Cold-tier items rewritten as parquet columnar; JSONB payloads > 16 KB summarized before archive.

### 6.6 Privacy Deletion
`ForgetMemory(scope, selector)` marks tombstone, purges KV/cache immediately, enqueues async purge from indexes.

### 6.7 Right-to-be-Forgotten
Full-user RTBF procedure:
1. Freeze writes for user (feature flag).
2. Emit `memory.rtbf.requested`.
3. Cascade tombstone all `memory_*` rows for `user_id`.
4. Purge object storage archives (async, ≤ 30 d SLA).
5. Emit `memory.rtbf.completed` with cryptographic proof (root hash of deleted ids).

### 6.8 Version Cleanup
Superseded versions retained N=5 by default; older collapsed into a single "history summary" row.

---

## 7. Memory Transactions

### 7.1 Atomicity
All durable writes use single Postgres transactions. Multi-item writes use `WITH` CTE inserts; the outbox row is inserted in the SAME transaction (Transactional Outbox pattern).

### 7.2 Consistency
- Read-after-write consistency guaranteed for the same user session (routed to primary).
- Eventual consistency (≤ 5 s) for cross-user aggregates and Global Anonymous.

### 7.3 Isolation
- Default: `READ COMMITTED`.
- Promotion jobs: `REPEATABLE READ` with advisory lock per `(user_id, scope)`.
- DNA supersession: `SERIALIZABLE`.

### 7.4 Durability
- Postgres synchronous commit ON for DNA and Journey writes.
- Working/Temporary/Cached: fire-and-forget, no durability guarantee.

### 7.5 Rollback
- Business rollback via supersession, not physical delete.
- Job-level rollback: outbox row NOT emitted unless transaction commits (guarantees no ghost events).

### 7.6 Conflict Handling
Optimistic concurrency using `version` column: `UPDATE ... WHERE version = :expected`. Mismatch → return `409 CONFLICT` with server version; caller retries with merge policy.

### 7.7 Concurrent Updates
Merge policy pluggable per namespace:
- `last-write-wins` (default for Working/Session)
- `higher-confidence-wins` (Journey/Cross/DNA)
- `custom-merger(a,b)` (namespaces registering a merger)

### 7.8 Event Sourcing
Not a full event-sourced store, but every mutation emits an audit event (`memory_audit`) and an outbox event (§9). Reconstruction from audit is supported for last 400 d.

---

## 8. APIs (Engineering Contracts)

All APIs are transport-agnostic contracts. On this platform they are exposed as `createServerFn` calls (auth: `requireSupabaseAuth`) and internal Mesh RPCs. No implementation shown.

Common request context: `{ user_id, session_id?, journey_id?, request_id, trace_id }`.
Common error model: `{ code, message, retryable, details? }` with codes:
`OK · NOT_FOUND · CONFLICT · PERMISSION_DENIED · VALIDATION · QUOTA · UNAVAILABLE · INTERNAL`.

### 8.1 `ReadMemory`
```
input:  { scope, selector: { id? | (namespace,key)? }, include_provenance?: bool }
output: { item: MemoryItem, provenance?: Provenance }
errors: NOT_FOUND, PERMISSION_DENIED
```

### 8.2 `WriteMemory`
```
input:  { scope, namespace, key?, content, importance?, confidence?, provenance, ttl?, expected_version? }
output: { id, version, promoted_from? }
errors: CONFLICT (version mismatch), VALIDATION, QUOTA
```

### 8.3 `SearchMemory`
```
input:  { query_text?, query_vector?, scopes[], filters?, k?, weights?, min_confidence?, budget_ms? }
output: { results: [{ item, score, components, explanation }], truncated: bool, latency_ms }
errors: VALIDATION, UNAVAILABLE
```
Weights and min_confidence follow §4 defaults if omitted.

### 8.4 `PromoteMemory`
```
input:  { item_id, target_scope, force?: bool }
output: { promoted: bool, new_id?, reason? }
errors: VALIDATION (thresholds not met unless force), PERMISSION_DENIED
```

### 8.5 `ForgetMemory`
```
input:  { selector: { id? | (scope,namespace,key)? | user_id (RTBF) }, reason }
output: { tombstoned_count, purge_job_id }
errors: PERMISSION_DENIED, VALIDATION
```

### 8.6 `MergeMemory`
```
input:  { ids: uuid[], strategy: "summary"|"supersede"|"custom", custom_ref? }
output: { merged_id }
errors: CONFLICT, VALIDATION
```

### 8.7 `ResolveConflict`
```
input:  { a_id, b_id, policy?: "confidence"|"recency"|"trust"|"manual", manual_winner? }
output: { winner_id, loser_id, annotation }
```

### 8.8 `SummariseMemory`
```
input:  { selector, max_tokens?: int, preserve_evidence?: bool }
output: { summary_id, source_ids[] }
```

### 8.9 `SnapshotMemory`
```
input:  { scope, subject_id (journey_id|user_id), label? }
output: { snapshot_id, manifest_uri }
```

### 8.10 `RestoreMemory`
```
input:  { snapshot_id, target_mode: "shadow"|"replace", dry_run?: bool }
output: { restored_count, diff_report_uri }
errors: PERMISSION_DENIED, VALIDATION
```

---

## 9. Event Contracts

Transport: Intelligence Mesh (at-least-once, per-partition ordering by `user_id`). Envelope:

```
Event {
  event_id: uuid                // idempotency key
  type: string                  // dotted name below
  version: semver               // contract version
  user_id?: uuid
  subject: { kind, id }
  occurred_at: timestamptz
  producer: string              // service name
  payload: object               // per type
  trace_id: string
}
```

### 9.1 Event Catalog

| Type | Producer | Consumers | Payload (summary) | Retry | Ordering | Idempotency |
|---|---|---|---|---|---|---|
| `memory.item.written.v1` | ME | CLF, XAI, POF | `{id, scope, namespace, importance, confidence}` | exp backoff, 24 h | per user_id | by `event_id` |
| `memory.item.promoted.v1` | ME | CLF, DIL, PIE | `{from_scope, to_scope, id, new_id, reason}` | exp backoff, 24 h | per user_id | by `event_id` |
| `memory.item.forgotten.v1` | ME | XAI, CLF, POF | `{id, reason}` | exp backoff, 7 d | per user_id | by `event_id` |
| `memory.conflict.detected.v1` | ME | UDE, XAI | `{a_id, b_id, namespace}` | 3× immediate | per user_id | by `event_id` |
| `memory.snapshot.created.v1` | ME | PIE, TEE | `{snapshot_id, scope, subject}` | 1× | none | by `snapshot_id` |
| `memory.rtbf.requested.v1` | ME | ALL | `{user_id}` | until ack | strict | by `user_id`+`day` |
| `memory.rtbf.completed.v1` | ME | ALL | `{user_id, root_hash}` | until ack | strict | by `user_id`+`day` |
| `memory.cache.invalidated.v1` | ME | ME (workers), POF | `{keys[]}` | best-effort | none | by `keys` hash |
| `memory.decay.applied.v1` | ME | POF | `{sweep_id, count}` | none | none | by `sweep_id` |

### 9.2 Failure Behaviour
Consumer failure MUST NOT block the transaction. Outbox worker retries with exponential backoff (1s, 5s, 30s, 5m, 30m, 3h, 24h). After max retries, event is parked in DLQ and paged.

### 9.3 Versioning
Additive fields only within a `vN`. Breaking change ⇒ `vN+1` published in parallel; consumers migrated; old contract retired ≥ 90 d after last emission.

---

## 10. Performance Targets

| Metric | Target (p50) | Target (p95) | Target (p99) |
|---|---|---|---|
| `ReadMemory` by id | 8 ms | 25 ms | 60 ms |
| `SearchMemory` hybrid, K=8 | 45 ms | **120 ms** | 220 ms |
| `SearchMemory` vector-only | 20 ms | 60 ms | 120 ms |
| `WriteMemory` durable | 15 ms | 40 ms | 90 ms |
| Promotion latency (Session→Journey) | 60 ms | 200 ms | 500 ms |
| Promotion latency (Journey→DNA, batch) | 5 min | 15 min | 30 min |
| Cache hit ratio (L2) | ≥ 70 % steady | — | — |
| Sustained write throughput per user | 500 wps | — | 2 000 wps burst |
| Sustained read throughput per user | 2 000 rps | — | 10 000 rps burst |
| Event delivery lag (Mesh) | 500 ms | 3 s | 15 s |

Scalability targets year 1: 1 M users · 1 B rows · 50 GB vectors. Horizontal via user_id hash partitioning; no single-node bottleneck by design.

---

## 11. Security

### 11.1 Encryption
- At rest: AES-256 (platform-managed).
- In transit: TLS 1.2+.
- Field-level envelope encryption for `content.pii.*` paths; DEK per user.

### 11.2 Access Scopes
| Scope | Read | Write |
|---|---|---|
| Working/Session | request principal only | request principal only |
| Journey | journey members | authoring principal |
| Cross/DNA | owner user only | ME internals via authorized fn |
| Global Anonymous | platform | ingest workers only |

### 11.3 User Isolation
Enforced at THREE layers:
1. RLS policies on every `memory_*` table (`user_id = auth.uid()` or member check).
2. Server function guard (`requireSupabaseAuth` + explicit `user_id` check).
3. Query builder helper that MUST inject `user_id` — bare queries rejected in code review + lint rule.

### 11.4 Permission Model
Role table (per platform standard `has_role`): `user`, `service`, `dpo`. Only `dpo` and `service` may invoke `ForgetMemory(user_id)` (RTBF).

### 11.5 Audit
Every mutation ⇒ `memory_audit` row `{who, when, what, before_hash, after_hash, reason}`. Audit is append-only and RLS-restricted to owner + dpo.

### 11.6 Consent
Consent state per DNA facet class stored in `consent_ledger`. Promotion to DNA MUST verify current consent within the same transaction; consent revocation triggers `ForgetMemory` on affected DNA facets.

### 11.7 GDPR Compatibility
- Article 15 (access): `ExportMyMemory` (out of scope of this doc, provided by platform).
- Article 17 (erasure): §6.7 RTBF.
- Article 20 (portability): parquet export via snapshot.
- Article 30 (records): audit table.

### 11.8 Deletion Guarantees
RTBF root hash MUST be reproducible from `memory_tombstones` for ≥ 400 d.

---

## 12. Observability

### 12.1 Metrics (Prometheus-style names)
- `memory_read_latency_seconds{scope,quantile}`
- `memory_search_latency_seconds{stage,quantile}`
- `memory_write_latency_seconds{scope,quantile}`
- `memory_cache_hit_ratio{tier}`
- `memory_items_total{scope}`
- `memory_promotion_total{from,to,result}`
- `memory_eviction_total{reason}`
- `memory_conflict_total{policy}`
- `memory_event_lag_seconds{type}`
- `memory_outbox_backlog`
- `memory_rtbf_open`

### 12.2 Tracing
OpenTelemetry spans on every API and every event handler. Span attributes: `user_id_hash` (never raw), `scope`, `namespace`, `k`, `weights_hash`.

### 12.3 Logging
Structured JSON. **Never log content, embeddings, PII, or raw ids in plaintext beyond debug-only sampled traces.** Log levels: `debug|info|warn|error`. Sampling: 100 % of errors, 1 % of info.

### 12.4 Diagnostics
`memory.health` endpoint returns: partition lag, outbox backlog, HNSW recall estimate, cache stats.

### 12.5 Alerts
| Alert | Threshold | Severity |
|---|---|---|
| Search p95 > 200 ms 5 min | breach | SEV2 |
| Write error rate > 1 % 5 min | breach | SEV2 |
| Outbox backlog > 10 k for 10 min | breach | SEV1 |
| RTBF SLA at 80 % | breach | SEV1 |
| Cache hit ratio < 40 % 30 min | breach | SEV3 |
| DNA signature failure detected | any | SEV1 |

### 12.6 KPIs
- Recall precision @10 (offline eval, weekly)
- Explanation completeness (100 % of ranked items carry `components`)
- Promotion precision (samples reviewed by CLF)
- Forgetting compliance (RTBF closed ≤ 30 d = 100 %)

### 12.7 Health Checks
- `/live` — process up
- `/ready` — DB + KV + Mesh reachable
- `/deep` — sample write+read roundtrip < 100 ms

---

## 13. Failure Recovery

### 13.1 Partial Writes
Prevented by Transactional Outbox; a partial write is impossible because either the transaction commits (row + outbox row both present) or nothing is persisted.

### 13.2 Corruption
- Row-level checksum via HMAC on DNA and Journey items > importance 0.60.
- Nightly integrity scan (10 % sample) compares stored hash vs recomputed.
- Corruption detected ⇒ quarantine row, emit `memory.corruption.detected` (SEV1), restore from snapshot.

### 13.3 Network Loss
- Client retries follow error `retryable` flag with jittered exp backoff (100 ms base, cap 5 s, max 5 attempts).
- Server functions are idempotent by `request_id` for 24 h.

### 13.4 Duplicate Writes
Idempotency via `(user_id, scope, namespace, key, request_id)` unique index on a small `memory_idempotency` table (24 h TTL).

### 13.5 Recovery Procedures
Runbook stored in ops repo. Categories: KV outage, Postgres primary failover, HNSW rebuild, outbox stall, DLQ drain.

### 13.6 Backup
- Postgres PITR retention 30 d.
- Object storage versioning enabled, 90 d.
- Snapshot manifests replicated cross-region.

### 13.7 Restore
- Per-user restore via `RestoreMemory(snapshot_id)` (dry-run mandatory).
- Full-tenant restore rehearsed quarterly.

### 13.8 Disaster Recovery
- RPO ≤ 15 min, RTO ≤ 4 h.
- Cross-region replica lag alarmed > 60 s.

---

## 14. Testing Strategy

### 14.1 Unit
- Ranker function property tests (weights sum, monotonicity, deterministic tiebreak).
- Merger strategies (idempotence, commutativity where applicable).
- TTL / decay math (boundary at floors).

### 14.2 Integration
- End-to-end `Write → Search → Read` per scope.
- Promotion pipeline with synthetic journeys.
- Outbox event delivery to Mesh test consumer.

### 14.3 Load
- Sustained 10 k rps read, 2 k wps write across 10 k synthetic users; assert p95 SLOs.

### 14.4 Stress
- 10× target load until degradation; capture failure mode; verify graceful (429/QUOTA, no data loss).

### 14.5 Chaos
- Kill Postgres primary, KV node, Mesh broker mid-write; assert §13 recovery.
- Clock skew ±5 min; assert TTL and ordering safety.

### 14.6 Migration
- Dual-write and shadow-read harness for schema/model migrations.
- Vector model upgrade drill: build new index, dual-read, cutover, retire.

### 14.7 Regression
- Golden retrieval set with 500 queries; precision@10 must not regress > 1 % without waiver.

### 14.8 Security
- RLS bypass fuzz (query with `user_id` swapped).
- IDOR tests on every API.
- Static + dependency scan in CI.

### 14.9 Privacy
- RTBF completeness test: seed user across all scopes, run RTBF, verify zero residuals across DB, cache, blobs, indexes, outbox, audit lookups.
- k-anonymity assertion on Global Anonymous batches.

---

## 15. Implementation Roadmap

Phases are additive; each ends with a demonstrable capability and passing acceptance tests.

### Phase 1 — Core Storage (Weeks 1–3)
- `memory_items`, `memory_meta`, `memory_audit`, `memory_events_outbox` (schemas, RLS, GRANTs).
- `ReadMemory`, `WriteMemory`, `ForgetMemory` server fns.
- Working/Session/Temporary types.
- Outbox worker + `memory.item.written.v1`.
- Metrics + tracing baseline.
**Exit:** durable writes at p95 < 40 ms, RLS proof, RTBF stub.

### Phase 2 — Vector Retrieval (Weeks 4–6)
- `memory_embeddings` + HNSW.
- Embedding pipeline via Lovable AI Gateway.
- `SearchMemory` vector-only + hybrid.
- L1/L2 cache.
**Exit:** hybrid search p95 < 120 ms at 100 k items/user.

### Phase 3 — Promotion Engine (Weeks 7–9)
- Journey/Cross-Journey scopes.
- Promotion jobs Working→Session→Journey→Cross with thresholds §5.
- `PromoteMemory`, `MergeMemory`, `ResolveConflict`.
- Conflict + decay sweepers.
**Exit:** promotion precision ≥ 85 % on eval set.

### Phase 4 — DNA (Weeks 10–12)
- `memory_dna`, HMAC signing, supersession chain.
- DNA promotion criteria + consent ledger integration.
- `SnapshotMemory`, `RestoreMemory`.
- Global Anonymous ingest with k-anonymity + DP noise.
**Exit:** DNA facets stable across 3 synthetic user cohorts; snapshot/restore drill green.

### Phase 5 — Optimisation & Scale (Weeks 13–16)
- Repartitioning to 128 shards.
- Cross-encoder rerank behind budget guard.
- Cold-tier archival + restore path.
- Chaos + DR drill; SLO burn-rate alerts.
- Vector model upgrade drill (dual-index, cutover).
**Exit:** all §10 SLOs met at 10× load; DR RTO/RPO met.

---

## 16. Appendix — Compatibility Matrix

| Peer System | Interface | Direction | Notes |
|---|---|---|---|
| AI Core | POE slots + Mesh events | ME → AI Core | ME never calls model providers directly |
| TIOS | Mesh events (`state.*`) | TIOS → ME (context), ME → TIOS (memory hints) | No shared tables |
| TIE | Reference by `world_ref` | ME reads TIE snapshots | ME never mutates TIE |
| Intelligence Mesh | Event envelope §9 | Bi-directional | Ordering per user_id |
| UDE | `memory.conflict.detected` + `SearchMemory` | ME → UDE, UDE → ME | UDE arbitration only |
| XAI | `provenance` on every response | ME → XAI | Every ranked item carries components |
| CLF | Learning events | ME → CLF | Aggregate signal, never PII |
| PIE | Snapshots + aggregates | ME → PIE | Read-only |

---

## 17. Change Control

- This EDS is versioned; changes require review by ME lead + Platform lead + Security lead.
- Breaking changes to §8 APIs or §9 events require dual-version publish and 90 d deprecation.
- All ADRs (Architecture Decision Records) supporting deviations from JIP v1.3 MUST be linked.

---

**End of EDS-001 — Memory Engine Engineering Specification.**

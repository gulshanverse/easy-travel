# Easy Trip — AI Core Platform

Central intelligence layer powering every AI feature. Provider-independent,
observable, safety-guarded, and DB-backed.

## Architecture

```text
 UI ─► useAI() ─► invokeAgentFn (RPC)  ─┐
                                        │
 UI ─► useAI().streamAgent ─► /api/ai/invoke ─┐
                                              ▼
                        ┌──────────────────────────────────────┐
                        │             AI Core                  │
                        │  Safety → Context → Memory →         │
                        │  Prompt → Provider Router → Tools →  │
                        │  Structured Output → Usage           │
                        └──────────────────────────────────────┘
                                              │
                                     Lovable AI Gateway
                                              │
                    Gemini · OpenAI · Anthropic · (future providers)
```

The frontend never talks to an LLM directly. All requests flow through the
Gateway and Provider Router.

## Modules

| Module | File | Purpose |
| --- | --- | --- |
| Config | `src/lib/ai/config.ts` | Central model catalog + tuning defaults. |
| Types | `src/lib/ai/types.ts` | Shared contracts. |
| Errors | `src/lib/ai/errors.ts` | Typed error hierarchy, sanitized public shape. |
| Safety | `src/lib/ai/safety.ts` | Input validation, PII scrub, injection heuristics. |
| Gateway | `src/lib/ai/gateway.server.ts` | Lovable AI Gateway provider helper + run-id capture. |
| Provider Router | `src/lib/ai/providers.server.ts` | Resolves `ModelId → LanguageModelHandle`. |
| Prompt Manager | `src/lib/ai/prompts.server.ts` | DB-backed versioned prompt templates + cache. |
| Context Engine | `src/lib/ai/context.server.ts` | Builds a minimal per-user context bundle. |
| Memory Engine | `src/lib/ai/memory.server.ts` | Short/long-term/trip/pref memory via `conversation_memory`. |
| Tool Registry | `src/lib/ai/tools.server.ts` | Declared tools; validated + isolated execution. |
| Usage Tracker | `src/lib/ai/usage.server.ts` | Writes to `ai_usage`; in-memory burst rate limiter. |
| Core Orchestrator | `src/lib/ai/core.server.ts` | `invokeAI` (unary) + `streamAI` (streaming). |
| Agent Framework | `src/lib/ai/agents.server.ts` | `AgentDefinition` + registry with 12 registered agents. |
| Public API | `src/lib/ai/ai.functions.ts` | `invokeAgentFn`, `listAgentsFn` server functions. |
| Streaming Route | `src/routes/api/ai/invoke.ts` | Authenticated HTTP endpoint returning `text/event-stream`. |
| Client Hook | `src/hooks/use-ai.ts` | `useAI()` with `.run()` and `.streamAgent()`. |

## Provider Flow

`resolveModel(id) → routeModel(id) → LanguageModelHandle`. Today all models
route through the Lovable AI Gateway; adding Anthropic direct or local models
means implementing a new `case` in `routeModel` — no changes above that line.

## Prompt Flow

1. Caller supplies `promptKey` or an inline `system`.
2. `renderPrompt(key, vars)` loads the highest active version from
   `prompt_templates`, validates required variables, renders `{{var}}` tokens.
3. Compiled prompts cached in-worker for `AI_CONFIG.cachePromptsTtlMs`.

## Memory Flow

- `writeMemory({ userId, kind, content, importance, expiresAt })`
- `retrieveMemories({ userId, kinds, limit })` — top-K by importance then recency.
- Memories filtered out when expired (`expires_at ≤ now`).

## Tool Flow

1. Agent declares `tools: string[]` (allowlist).
2. Core builds AI-SDK tools from the registry entries.
3. Model proposes a tool call → registry validates input with Zod → executes
   with isolated `ToolExecContext`.
4. Tools flagged `requiresApproval` return `{ pendingApproval: true }` instead
   of executing (booking, payments will use this).

## Structured Output

`invokeAI({ schema })` uses AI SDK `Output.object`. On OpenAI models the
provider is built with `structuredOutputs: true` so the gateway enforces
strict `json_schema`. Failures degrade to a typed `AIStructuredOutputError`
carrying the raw text.

## Observability

Every call writes to `ai_usage`:
`user_id, feature, agent, model, provider, tokens, latency, success,
 error_code, request_id, run_id, metadata`.

Gateway run ids are captured via the fetch wrapper and forwarded to the
browser through `X-Lovable-AIG-Run-ID`.

## Security

- `LOVABLE_API_KEY` never leaves the server (read inside handlers).
- All server functions and the HTTP route require a Supabase bearer token.
- Errors are wrapped by `toPublicError` before crossing the boundary.
- Tool execution respects an explicit allowlist per request.

## Registered Agents (v0.1.0 interfaces)

`planner`, `budget`, `recommendation`, `weather`, `safety`, `translator`,
`memory`, `booking`, `expense`, `local_guide`, `packing`, `emergency`.

Implement a real agent by expanding its `buildRequest` and optionally
attaching `parse` + a schema. The public API surface does not change.

## Next Milestone

**Milestone 5 — Planner Agent v1**: wire the `planner` agent to a
structured itinerary schema, persist output to `trips`/`trip_days`/
`trip_activities`, and connect the `/ai-planner` UI end-to-end.

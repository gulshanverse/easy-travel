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

---

## Milestone 4.1 — Hardening Pass

### AI Event Bus (`src/lib/ai/events.ts`)
Isomorphic pub/sub. Emitted events:
`AI_STARTED · AI_CONTEXT_READY · MEMORY_RETRIEVED · PROMPT_RENDERED ·
 TOOLS_SELECTED · TOOLS_EXECUTED · STREAM_STARTED · STREAM_COMPLETED ·
 USAGE_RECORDED · AI_COMPLETED · AI_FAILED · WORKFLOW_STEP_STARTED ·
 WORKFLOW_STEP_COMPLETED · WORKFLOW_STEP_FAILED · WORKFLOW_COMPLETED ·
 WORKFLOW_FAILED`

```ts
import { onAIEvent } from "@/lib/ai/events";
onAIEvent("AI_FAILED", (e) => reportToSentry(e));
onAIEvent("*", (e) => tracer.log(e));
```

Listeners run in-process; failures are swallowed so instrumentation cannot
break an AI call.

### Agent Manifest (`src/lib/ai/manifest.ts`)
Every registered agent now ships a manifest:
`name · description · version · category · priority · defaultModel ·
 fallbackModel · systemPromptKey · allowedTools · memoryScope · temperature ·
 maxOutputTokens · streaming · timeoutMs · retries · permissions
 (requiresAuth/role, allowsTools, allowsMemoryWrite) · costLimits
 (maxTokensPerCall, maxCallsPerHour, maxCreditsPerCall) · providerCompatibility`

`listAgents()` returns the manifest array. `getAgentManifest(name)` returns
one. The manifest is applied as defaults inside `runAgent`, so a caller who
overrides `temperature` or `model` still wins.

### Workflow Engine (`src/lib/ai/workflow.server.ts`)
Groups of steps: **groups run sequentially, steps within a group in parallel**.
Each step supports: `when` (conditional), `retries`, `timeoutMs`,
`required` (soft-fail). Cancellation propagates via a single AbortController.

```ts
import { runWorkflow, agentStep, taskStep } from "@/lib/ai/workflow.server";

const plan = {
  id: "plan_trip",
  groups: [
    [ agentStep("outline", "planner", (s) => ({ prompt: s.outputs.userPrompt })) ],
    [
      agentStep("budget",  "budget",  (s) => ({ prompt: JSON.stringify(s.outputs.outline) })),
      agentStep("weather", "weather", (s) => ({ prompt: `weather for ${s.outputs.userPrompt}` })),
    ],
    [ agentStep("safety",  "safety",  (s) => ({ prompt: `risks for ${s.outputs.userPrompt}` }), { required: false }) ],
  ],
};
const result = await runWorkflow(plan, { ctx, input: { userPrompt: "Kyoto 5 days" } });
```

### Easy Trip AI SDK (`src/lib/ai/sdk.ts`)
The single client entrypoint. Frontend code no longer touches AI Core internals.

```ts
import { aiClient } from "@/lib/ai/sdk";

await aiClient.runAgent({ agent: "planner", prompt: "..." });
const { requestId } = await aiClient.streamAgent({ agent: "chat", prompt, onChunk });
aiClient.cancelRequest(requestId);
await aiClient.invokeTool({ name: "search_destinations", input: { query: "kyoto" } });
await aiClient.searchMemory({ kinds: ["preference"] });
await aiClient.saveMemory({ kind: "preference", key: "seat", content: "aisle" });
await aiClient.listAgents();
aiClient.cancelAll();
```

`runWorkflow` is intentionally exposed per-feature: each domain (Trip Engine,
Booking Engine) will register a dedicated workflow server function. The SDK
throws with guidance if called generically today.

### Backward Compatibility
- `invokeAgentFn`, `listAgentsFn`, `POST /api/ai/invoke`, `useAI()` — signatures unchanged.
- `listAgentsFn` now returns richer objects (adds fields, does not remove any).
- All Milestone 4 imports (`invokeAI`, `streamAI`, `registerAgent`, `runAgent`, memory/tool APIs) unchanged.

### Architecture (updated)

```text
                             AI Event Bus  ◄──── observers, tracing, sinks
                                   ▲
 UI ─► aiClient (SDK) ─► RPC/HTTP  │
                          │        ▼
                        AI Core  ─► Safety→Context→Memory→Prompt→
                          │        Router→Tools→Structured→Usage
                          │
                        Workflow Engine (sequential | parallel | conditional)
                          │
                     Agent Registry (+ Manifest per agent)
                          │
                    Lovable AI Gateway
                          │
              Gemini · OpenAI · Anthropic · future
```

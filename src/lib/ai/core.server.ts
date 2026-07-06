/**
 * AI Core — Central orchestrator.
 * The single entrypoint used by every server function, server route, and agent.
 * Wires: safety → context → memory → prompt → provider → tools → structured → usage.
 */
import { generateText, streamText, Output, NoObjectGeneratedError, tool as aiTool } from "ai";
import { z } from "zod";

import { AI_CONFIG, resolveModel } from "./config";
import {
  AICreditsError,
  AIError,
  AIProviderError,
  AIRateLimitError,
  AIStructuredOutputError,
  AIUnauthorizedError,
} from "./errors";
import { routeModel } from "./providers.server";
import { renderPrompt } from "./prompts.server";
import { buildUserContext, renderContext } from "./context.server";
import { retrieveMemories, renderMemories } from "./memory.server";
import { listTools } from "./tools.server";
import { checkRateLimit, recordUsage } from "./usage.server";
import { sanitizeMessages } from "./safety";
import type { AIInvokeParams, AIMessage, AIResult } from "./types";

function newRequestId() {
  return `air_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function classifyProviderError(err: unknown): AIError {
  const message = err instanceof Error ? err.message : String(err);
  if (/rate.?limit|429/i.test(message)) return new AIRateLimitError();
  if (/402|credit|billing/i.test(message)) return new AICreditsError();
  if (/401|unauthor/i.test(message)) return new AIUnauthorizedError();
  return new AIProviderError(message, err);
}

async function buildSystemPrompt(params: AIInvokeParams): Promise<string> {
  const parts: string[] = [];
  if (params.promptKey) {
    const rendered = await renderPrompt(params.promptKey, params.promptVariables ?? {});
    parts.push(rendered.text);
  } else if (params.system) {
    parts.push(params.system);
  }
  const ctxBundle = await buildUserContext(params.ctx);
  parts.push("--- Context ---", renderContext(ctxBundle));

  if (params.ctx.userId) {
    const memories = await retrieveMemories({
      userId: params.ctx.userId,
      conversationId: params.ctx.conversationId ?? null,
    });
    const rendered = renderMemories(memories);
    if (rendered) parts.push("--- Memory ---", rendered);
  }
  return parts.filter(Boolean).join("\n\n");
}

function buildAiSdkTools(allowed: string[] | undefined) {
  if (!allowed?.length) return undefined;
  const tools = listTools(allowed);
  const out: Record<string, unknown> = {};
  for (const t of tools) {
    out[t.name] = aiTool({
      description: t.description,
      inputSchema: t.inputSchema as unknown as z.ZodTypeAny,
      execute: async (input, opts) => {
        if (t.requiresApproval) {
          return { pendingApproval: true, tool: t.name, input };
        }
        return await t.execute(input, {
          userId: null,
          requestId: (opts?.toolCallId as string) ?? "",
        });
      },
    });
  }
  return out;
}

/**
 * Non-streaming invocation. Returns a fully-formed result.
 */
export async function invokeAI<T = string>(
  params: AIInvokeParams<T>,
): Promise<AIResult<T>> {
  const requestId = newRequestId();
  const started = Date.now();
  const modelProfile = resolveModel(params.model);

  if (!checkRateLimit(params.ctx.userId, AI_CONFIG.rateLimit.perUserPerMinute, AI_CONFIG.rateLimit.perUserPerDay)) {
    throw new AIRateLimitError();
  }

  const system = await buildSystemPrompt(params);
  const messages: AIMessage[] = sanitizeMessages(params.messages);

  const handle = routeModel(modelProfile.id, {
    structuredOutputs: Boolean(params.schema),
  });

  try {
    const common = {
      model: handle.model as any,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })) as any,
      temperature: params.temperature ?? AI_CONFIG.temperature,
      maxOutputTokens: params.maxOutputTokens ?? AI_CONFIG.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_CONFIG.timeoutMs),
      tools: buildAiSdkTools(params.tools),
    };

    if (params.schema) {
      try {
        const res = await generateText({
          ...common,
          output: Output.object({
            schema: z.any().describe(params.schema.name),
          }) as any,
        });
        const usage = res.usage as any;
        const runId = await handle.waitForRunId();
        const result: AIResult<T> = {
          requestId,
          model: modelProfile.id,
          output: (res as any).output as T,
          toolCalls: [],
          usage: {
            promptTokens: usage?.inputTokens ?? 0,
            completionTokens: usage?.outputTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0,
            costCredits: 0,
          },
          latencyMs: Date.now() - started,
          finishReason: "stop",
        };
        void recordUsage({
          ctx: params.ctx, model: modelProfile.id, usage: result.usage,
          latencyMs: result.latencyMs, success: true, requestId, runId,
        });
        return result;
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) {
          throw new AIStructuredOutputError("Model output did not match schema", (err as any).text);
        }
        throw err;
      }
    }

    const res = await generateText(common as any);
    const usage = (res as any).usage;
    const runId = await handle.waitForRunId();
    const result: AIResult<T> = {
      requestId,
      model: modelProfile.id,
      output: (res.text as unknown) as T,
      toolCalls: ((res as any).toolCalls ?? []).map((c: any) => ({
        name: c.toolName,
        input: c.input,
        output: c.output,
      })),
      usage: {
        promptTokens: usage?.inputTokens ?? 0,
        completionTokens: usage?.outputTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
        costCredits: 0,
      },
      latencyMs: Date.now() - started,
      finishReason: (res as any).finishReason ?? "stop",
    };
    void recordUsage({
      ctx: params.ctx, model: modelProfile.id, usage: result.usage,
      latencyMs: result.latencyMs, success: true, requestId, runId,
    });
    return result;
  } catch (err) {
    const wrapped = err instanceof AIError ? err : classifyProviderError(err);
    void recordUsage({
      ctx: params.ctx,
      model: modelProfile.id,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costCredits: 0 },
      latencyMs: Date.now() - started,
      success: false,
      errorCode: wrapped.code,
      requestId,
    });
    throw wrapped;
  }
}

/**
 * Streaming invocation. Returns the AI SDK stream result plus the model handle
 * so route handlers can attach gateway response headers.
 */
export async function streamAI(params: AIInvokeParams) {
  const modelProfile = resolveModel(params.model);
  if (!modelProfile.supportsStreaming) {
    throw new AIProviderError(`Model ${modelProfile.id} does not support streaming`);
  }
  if (!checkRateLimit(params.ctx.userId, AI_CONFIG.rateLimit.perUserPerMinute, AI_CONFIG.rateLimit.perUserPerDay)) {
    throw new AIRateLimitError();
  }
  const system = await buildSystemPrompt(params);
  const messages = sanitizeMessages(params.messages);
  const handle = routeModel(modelProfile.id);

  const result = streamText({
    model: handle.model as any,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })) as any,
    temperature: params.temperature ?? AI_CONFIG.temperature,
    maxOutputTokens: params.maxOutputTokens ?? AI_CONFIG.maxOutputTokens,
    tools: buildAiSdkTools(params.tools) as any,
  });

  return { result, handle, model: modelProfile.id };
}

/**
 * AI Core — Shared type contracts.
 * These types travel from the Gateway → Router → Provider → back.
 */
import type { ModelId } from "./config";

export type AIRole = "system" | "user" | "assistant" | "tool";

export interface AIMessage {
  role: AIRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AIToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON-Schema-compatible or Zod-derived shape. */
  parameters: Record<string, unknown>;
  /** Optional server-only executor. Not sent to the model. */
  execute?: (input: TInput, ctx: ToolExecContext) => Promise<TOutput>;
  /** Requires human approval before executing (bookings, payments). */
  requiresApproval?: boolean;
}

export interface ToolExecContext {
  userId: string | null;
  requestId: string;
  locale?: string;
  currency?: string;
}

export interface AIRequestContext {
  userId: string | null;
  conversationId?: string | null;
  feature: string; // "planner" | "recommendation" | "chat" | etc.
  agent?: string;
  locale?: string;
  currency?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface AIInvokeParams<TStructured = unknown> {
  ctx: AIRequestContext;
  model?: ModelId;
  system?: string;
  messages: AIMessage[];
  /** Prompt registry key; when set, the prompt manager renders `system`. */
  promptKey?: string;
  promptVariables?: Record<string, unknown>;
  /** Tools available to the model this turn. */
  tools?: string[];
  /** Enforce structured output. */
  schema?: {
    name: string;
    schema: Record<string, unknown>;
    example?: TStructured;
  };
  temperature?: number;
  maxOutputTokens?: number;
  stream?: boolean;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCredits: number;
}

export interface AIResult<T = string> {
  requestId: string;
  model: ModelId;
  output: T;
  toolCalls: Array<{ name: string; input: unknown; output?: unknown }>;
  usage: AIUsage;
  latencyMs: number;
  finishReason: "stop" | "length" | "tool_calls" | "error";
}

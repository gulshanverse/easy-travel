/**
 * PromptValidator — validates PromptIR, CompiledPrompt, and structured output.
 * JSON validation uses a small, permissive JSON-Schema subset (type, required,
 * properties, items, enum). Full JSON-Schema is not required at runtime and
 * a heavyweight validator would violate the "no external deps" constraint.
 */
import { ValidationError } from "./errors";
import type {
  AssembledContext,
  CompiledPrompt,
  OutputSchema,
  PromptFragment,
  PromptIR,
  PromptRegistryEntry,
} from "./types";

export class PromptValidator {
  validateFragments(fragments: PromptFragment[]): void {
    const issues: string[] = [];
    if (!fragments.length) issues.push("No fragments provided");
    const ids = new Set<string>();
    for (const f of fragments) {
      if (!f.id) issues.push("Fragment missing id");
      if (ids.has(f.id)) issues.push(`Duplicate fragment id: ${f.id}`);
      ids.add(f.id);
      if (!f.content?.trim()) issues.push(`Empty content: ${f.id}`);
      if (!Number.isFinite(f.order)) issues.push(`Non-finite order: ${f.id}`);
    }
    if (issues.length) throw new ValidationError(issues);
  }

  validateIR(ir: PromptIR): void {
    const issues: string[] = [];
    if (!ir.promptId) issues.push("Missing promptId");
    if (!ir.version) issues.push("Missing version");
    if (!ir.fragments.length) issues.push("Empty fragments");
    if (!ir.metadata?.correlationId) issues.push("Missing correlationId");
    if (issues.length) throw new ValidationError(issues);
    this.validateFragments(ir.fragments);
  }

  validateCompiled(compiled: CompiledPrompt): void {
    const issues: string[] = [];
    if (!compiled.messages.length) issues.push("Empty messages");
    for (const m of compiled.messages) {
      if (!m.role) issues.push("Message missing role");
      if (m.content == null) issues.push("Message missing content");
    }
    if (!compiled.fingerprint) issues.push("Missing fingerprint");
    if (issues.length) throw new ValidationError(issues);
  }

  validateContext(ctx: AssembledContext): void {
    const issues: string[] = [];
    if (ctx.conversation && !Array.isArray(ctx.conversation.turns)) {
      issues.push("conversation.turns must be array");
    }
    if (ctx.trust && (ctx.trust.score < 0 || ctx.trust.score > 1)) {
      issues.push("trust.score must be 0..1");
    }
    if (ctx.memory && !Array.isArray(ctx.memory.items)) {
      issues.push("memory.items must be array");
    }
    if (issues.length) throw new ValidationError(issues, "context_assembly");
  }

  validateRegistryEntry(entry: PromptRegistryEntry): void {
    this.validateFragments(entry.fragments);
  }

  /** Structured output validation against a minimal JSON-Schema subset. */
  validateStructured(raw: string, schema: OutputSchema): unknown {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new ValidationError([`Invalid JSON: ${(err as Error).message}`], "structured_parsing");
    }
    const issues: string[] = [];
    validateAgainst(parsed, schema.schema, "$", issues);
    if (issues.length) {
      throw new ValidationError(issues, "output_validation", { schema: schema.name });
    }
    return parsed;
  }
}

function validateAgainst(
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  const type = schema.type as string | string[] | undefined;
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    const actual = jsonType(value);
    if (!types.includes(actual)) {
      issues.push(`${path}: expected ${types.join("|")} got ${actual}`);
      return;
    }
  }
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!(schema.enum as unknown[]).includes(value)) {
      issues.push(`${path}: value not in enum`);
    }
  }
  if (jsonType(value) === "object" && schema.properties) {
    const obj = value as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    for (const req of (schema.required as string[] | undefined) ?? []) {
      if (!(req in obj)) issues.push(`${path}.${req}: required`);
    }
    for (const [k, sub] of Object.entries(props)) {
      if (k in obj) validateAgainst(obj[k], sub, `${path}.${k}`, issues);
    }
  }
  if (jsonType(value) === "array" && schema.items) {
    const arr = value as unknown[];
    const itemSchema = schema.items as Record<string, unknown>;
    arr.forEach((el, i) => validateAgainst(el, itemSchema, `${path}[${i}]`, issues));
  }
}

function jsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

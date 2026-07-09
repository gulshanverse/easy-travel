/**
 * Memory Engine — Validators (envelope + per-class payload gates).
 *
 * We deliberately avoid Zod at this layer to keep the Memory Engine free of
 * bundle-critical deps; callers may wrap payloads in Zod at their boundary.
 * Validation errors throw MemoryValidationError with a stable code.
 */
import { MEMORY_CLASSES, type MemoryClass, type MemoryDraft, type MemoryEnvelope } from "./types";
import { MemoryValidationError } from "./errors";

const KEBAB_RE = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

/** Payload validators may be registered per (class, kind) pair. */
type PayloadValidator = (payload: unknown) => void;
const payloadValidators = new Map<string, PayloadValidator>();

export function registerPayloadValidator(
  class_: MemoryClass,
  kind: string,
  fn: PayloadValidator,
): void {
  payloadValidators.set(`${class_}::${kind}`, fn);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new MemoryValidationError(msg);
}

function isBoundedNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

export class MemoryValidators {
  static validateDraft<T>(draft: MemoryDraft<T>): void {
    assert(draft && typeof draft === "object", "draft must be an object");
    assert(MEMORY_CLASSES.includes(draft.class), `unknown class: ${String(draft.class)}`);
    assert(
      typeof draft.kind === "string" && KEBAB_RE.test(draft.kind),
      `kind must be kebab-case, got: ${String(draft.kind)}`,
    );
    assert(typeof draft.ownerId === "string" && draft.ownerId.length > 0, "ownerId is required");
    assert(typeof draft.scope === "string", "scope is required");
    assert(draft.source && typeof draft.source === "object", "source is required");
    assert(
      typeof draft.source.kind === "string" && typeof draft.source.actorId === "string",
      "source.kind and source.actorId are required",
    );
    if (draft.confidence !== undefined)
      assert(isBoundedNumber(draft.confidence), "confidence must be in [0,1]");
    if (draft.importance !== undefined)
      assert(isBoundedNumber(draft.importance), "importance must be in [0,1]");
    if (draft.evidence) {
      assert(Array.isArray(draft.evidence), "evidence must be an array");
      for (const e of draft.evidence) {
        assert(typeof e?.evidenceId === "string", "evidence[].evidenceId required");
        assert(isBoundedNumber(e.weight), "evidence[].weight must be in [0,1]");
      }
    }
    if (draft.tags) {
      assert(Array.isArray(draft.tags), "tags must be an array");
      for (const t of draft.tags)
        assert(typeof t === "string" && KEBAB_RE.test(t), `tag must be kebab-case: ${String(t)}`);
    }
    if (draft.relationships) {
      assert(Array.isArray(draft.relationships), "relationships must be an array");
      for (const r of draft.relationships) {
        assert(
          typeof r?.type === "string" && typeof r.targetId === "string",
          "relationships[].type and .targetId required",
        );
        assert(isBoundedNumber(r.weight), "relationships[].weight must be in [0,1]");
      }
    }
    const key = `${draft.class}::${draft.kind}`;
    payloadValidators.get(key)?.(draft.payload);
  }

  static validateEnvelope(env: MemoryEnvelope): void {
    assert(env.memoryId, "envelope.memoryId required");
    assert(env.contentHash, "envelope.contentHash required");
    assert(isBoundedNumber(env.confidence), "envelope.confidence out of range");
    assert(isBoundedNumber(env.importance), "envelope.importance out of range");
    assert(env.decayState && env.decayState.halfLifeSeconds >= 0, "envelope.decayState invalid");
  }

  static assertOwnership(env: MemoryEnvelope, expectedOwnerId: string): void {
    if (env.ownerId !== expectedOwnerId) {
      throw new MemoryValidationError("owner mismatch");
    }
  }
}

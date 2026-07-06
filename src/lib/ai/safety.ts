/**
 * AI Core — Safety layer.
 * Input validation, prompt-injection heuristics, PII scrubbing, output validation.
 * Intentionally conservative — flags don't necessarily block; the caller decides.
 */
import { AISafetyError, AIValidationError } from "./errors";
import type { AIMessage } from "./types";

const INJECTION_PATTERNS = [
  /ignore (all |the )?previous instructions/i,
  /disregard (the )?system prompt/i,
  /you are now [a-z ]+ mode/i,
  /reveal your (system )?prompt/i,
  /print (your )?instructions/i,
];

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{16}\b/g, "[REDACTED_CARD]"], // naive card numbers
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
];

export interface SafetyReport {
  ok: boolean;
  flags: string[];
  sanitized: string;
}

export function inspectUserInput(input: string): SafetyReport {
  if (typeof input !== "string") throw new AIValidationError("Input must be a string");
  const trimmed = input.trim();
  if (!trimmed) throw new AIValidationError("Input cannot be empty");
  if (trimmed.length > 8_000) throw new AIValidationError("Input exceeds 8000 characters");

  const flags: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) flags.push("prompt_injection_suspected");
  }

  let sanitized = trimmed;
  for (const [pattern, replacement] of PII_PATTERNS) {
    if (pattern.test(sanitized)) flags.push("pii_redacted");
    sanitized = sanitized.replace(pattern, replacement);
  }

  return { ok: flags.length === 0, flags, sanitized };
}

export function sanitizeMessages(messages: AIMessage[]): AIMessage[] {
  return messages.map((m) => {
    if (m.role !== "user") return m;
    const report = inspectUserInput(m.content);
    return { ...m, content: report.sanitized };
  });
}

export function assertToolAllowed(toolName: string, allowed: string[]) {
  if (!allowed.includes(toolName)) {
    throw new AISafetyError(`Tool "${toolName}" is not permitted in this context`);
  }
}

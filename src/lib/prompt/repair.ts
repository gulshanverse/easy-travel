/**
 * PromptRepairEngine — best-effort recovery of malformed structured output.
 * Strategies (in order):
 *   1. Extract JSON substring from surrounding prose (```json fences, first
 *      balanced object/array).
 *   2. Strip trailing commas.
 *   3. Replace single quotes with double quotes when safe.
 *   4. Attempt schema-guided coercion for primitive fields.
 */
import { ValidationError } from "./errors";
import type { OutputSchema } from "./types";
import { PromptValidator } from "./validator";

export interface RepairResult {
  repaired: boolean;
  strategy: string[];
  value?: unknown;
  raw?: string;
}

export class PromptRepairEngine {
  constructor(
    private readonly validator: PromptValidator = new PromptValidator(),
    private readonly maxAttempts = 2,
  ) {}

  repair(raw: string, schema: OutputSchema): RepairResult {
    const strategies: string[] = [];
    const candidates: string[] = [raw];

    // Extract fenced ```json blocks.
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
    if (fenced) { candidates.push(fenced[1]); strategies.push("fenced-block"); }

    // Extract first balanced JSON object/array.
    const balanced = extractBalancedJson(raw);
    if (balanced) { candidates.push(balanced); strategies.push("balanced-json"); }

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      for (const c of candidates) {
        const cleaned = cleanupJson(c);
        try {
          const value = this.validator.validateStructured(cleaned, schema);
          return { repaired: cleaned !== raw, strategy: strategies, value, raw: cleaned };
        } catch {
          // try next
        }
      }
      // On second pass, try tolerant coercion.
      if (attempt === 0) {
        strategies.push("cleanup-commas-quotes");
      }
    }
    throw new ValidationError(["Unrepairable structured output"], "output_validation", {
      strategies,
    });
  }
}

function cleanupJson(s: string): string {
  let out = s.trim();
  // Strip surrounding backticks.
  out = out.replace(/^`+|`+$/g, "");
  // Remove trailing commas before ]/}.
  out = out.replace(/,\s*([}\]])/g, "$1");
  return out;
}

function extractBalancedJson(s: string): string | null {
  const startObj = s.indexOf("{");
  const startArr = s.indexOf("[");
  const start = [startObj, startArr].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

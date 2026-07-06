/**
 * TIOS Feature Flags.
 * Central, in-memory flag registry with default values.
 * Replace with a remote provider (Cloud config table) later without changing callers.
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import type { FeatureFlagName } from "./types";

const defaults: Record<string, boolean> = {
  PlannerV2: false,
  BudgetV2: false,
  Claude: false,
  Gemini: true,
  OpenAI: true,
  Weather: true,
  Maps: true,
  KnowledgeGraph: true,
  DecisionEngine: true,
};

const overrides = new Map<string, boolean>();

export function setFlag(name: FeatureFlagName, value: boolean): void {
  overrides.set(name, value);
}

export function getFlag(name: FeatureFlagName): boolean {
  const value = overrides.has(name) ? overrides.get(name)! : (defaults[name] ?? false);
  emitTIOSEvent({
    name: "FLAG_EVALUATED",
    requestId: makeRequestId("flag"),
    timestamp: Date.now(),
    data: { flag: name, value },
  });
  return value;
}

export function snapshotFlags(): Record<string, boolean> {
  const out: Record<string, boolean> = { ...defaults };
  for (const [k, v] of overrides.entries()) out[k] = v;
  return out;
}

export function resetFlags(): void {
  overrides.clear();
}

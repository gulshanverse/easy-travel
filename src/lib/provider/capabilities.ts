/**
 * Provider Runtime — Capability inspection helpers.
 */
import { ProviderCapabilityError } from "./errors";
import type { ModelDescriptor, ProviderCapabilityFlags } from "./types";

export function matchesCapabilities(
  model: ModelDescriptor,
  required: Partial<ProviderCapabilityFlags>,
): boolean {
  for (const key of Object.keys(required) as (keyof ProviderCapabilityFlags)[]) {
    if (required[key] && !model.capabilities[key]) return false;
  }
  return true;
}

export function assertCapabilities(
  model: ModelDescriptor,
  required: Partial<ProviderCapabilityFlags>,
): void {
  const missing: string[] = [];
  for (const key of Object.keys(required) as (keyof ProviderCapabilityFlags)[]) {
    if (required[key] && !model.capabilities[key]) missing.push(String(key));
  }
  if (missing.length > 0) {
    throw new ProviderCapabilityError(
      `Model '${model.id}' missing capabilities: ${missing.join(", ")}`,
      { metadata: { modelId: model.id, missing } },
    );
  }
}

export function assertContextWindow(model: ModelDescriptor, minContextWindow?: number): void {
  if (!minContextWindow) return;
  if (model.contextWindow < minContextWindow) {
    throw new ProviderCapabilityError(
      `Model '${model.id}' context window ${model.contextWindow} < required ${minContextWindow}`,
      { metadata: { modelId: model.id, contextWindow: model.contextWindow, minContextWindow } },
    );
  }
}

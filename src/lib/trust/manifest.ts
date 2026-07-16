/**
 * Trust & Evidence Engine — capability manifest.
 * Declares what the engine can do and where it can be extended.
 */
export interface TrustCapabilityManifest {
  readonly id: "trust";
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly futureHooks: readonly string[];
}

export const TRUST_CAPABILITY_MANIFEST: TrustCapabilityManifest = Object.freeze({
  id: "trust",
  version: "1.0.0",
  capabilities: Object.freeze([
    "evidence.intake",
    "evidence.scoring",
    "evidence.freshness",
    "evidence.conflict.detection",
    "trust.compute",
    "trust.decide",
    "trust.history",
    "source.registry",
    "source.invalidation",
    "provenance.tracking",
    "trust.snapshot",
  ]),
  dependencies: Object.freeze([
    "runtime.kernel", "memory.port", "graph.port",
    "journey.port", "decision.port", "prompt.port", "provider.port",
  ]),
  extensionPoints: Object.freeze([
    "trust.policy.custom",
    "trust.telemetry.sink",
    "trust.event.listener",
    "trust.confidence.model",
    "trust.freshness.decay",
  ]),
  futureHooks: Object.freeze([
    "trust.persistence.adapter",
    "trust.model.reasoning",
    "trust.cross.subject.propagation",
    "trust.federated.sources",
  ]),
});

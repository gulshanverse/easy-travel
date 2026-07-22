/** ARP — deterministic planning engine. */
import { PlanningError } from "./errors";
import { makePlan, makeTask } from "./factories";
import type { AgentPlan, AgentTask, Intent } from "./types";

export interface PlanBlueprint {
  readonly forClassification: string;
  readonly requiredCapabilities: readonly string[];
  readonly optionalCapabilities?: readonly string[];
  readonly parallel?: boolean;
}

/** Deterministic mapping from intent classification to required capabilities. */
export const DEFAULT_BLUEPRINTS: readonly PlanBlueprint[] = Object.freeze([
  { forClassification: "plan.trip", requiredCapabilities: ["journey.assemble-context", "goal.plan", "decision.rank"], parallel: false },
  { forClassification: "book.flight", requiredCapabilities: ["decision.rank"], parallel: false },
  { forClassification: "book.hotel", requiredCapabilities: ["decision.rank"], parallel: false },
  { forClassification: "book.cab", requiredCapabilities: ["decision.rank"], parallel: false },
  { forClassification: "discover.destination", requiredCapabilities: ["spatial.query", "decision.rank"], parallel: true },
  { forClassification: "budget.estimate", requiredCapabilities: ["decision.rank"], parallel: false },
  { forClassification: "safety.check", requiredCapabilities: ["trust.evaluate"], parallel: false },
  { forClassification: "visa.check", requiredCapabilities: ["trust.evaluate"], parallel: false },
  { forClassification: "support.help", requiredCapabilities: [], parallel: false },
  { forClassification: "generic.request", requiredCapabilities: [], parallel: false },
]);

export interface PlanningOptions {
  readonly agentId: string;
  readonly intent: Intent;
  readonly blueprints?: readonly PlanBlueprint[];
  readonly maxCapabilities?: number;
  readonly now?: number;
}

function computeLayers(tasks: readonly AgentTask[]): readonly (readonly string[])[] {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const done = new Set<string>();
  const layers: string[][] = [];
  while (done.size < tasks.length) {
    const layer: string[] = [];
    for (const t of tasks) {
      if (done.has(t.id)) continue;
      if (t.dependsOn.every(d => done.has(d))) layer.push(t.id);
    }
    if (!layer.length) throw new PlanningError(`Cyclic plan dependency: ${[...byId.keys()].filter(k => !done.has(k)).join(", ")}`);
    layers.push(layer);
    for (const id of layer) done.add(id);
  }
  return Object.freeze(layers.map(l => Object.freeze([...l])));
}

export class PlanningEngine {
  private readonly blueprints: readonly PlanBlueprint[];
  constructor(blueprints: readonly PlanBlueprint[] = DEFAULT_BLUEPRINTS) {
    this.blueprints = blueprints;
  }

  buildPlan(opts: PlanningOptions): AgentPlan {
    const bp = (opts.blueprints ?? this.blueprints).find(b => b.forClassification === opts.intent.classification)
      ?? this.blueprints.find(b => b.forClassification === "generic.request")!;
    const caps = bp.requiredCapabilities.slice(0, opts.maxCapabilities ?? 16);
    if (!caps.length) {
      const synth = makeTask({ kind: "synthesize", dependsOn: [] });
      return makePlan({
        agentId: opts.agentId,
        intentId: opts.intent.id,
        strategy: "sequential",
        tasks: [synth],
        layers: [[synth.id]],
        now: opts.now,
      });
    }
    const tasks: AgentTask[] = [];
    let previous: string | undefined;
    for (const capId of caps) {
      const deps = bp.parallel ? [] : (previous ? [previous] : []);
      const t = makeTask({ kind: "capability-request", capabilityId: capId, dependsOn: deps });
      tasks.push(t);
      previous = t.id;
    }
    const synth = makeTask({
      kind: "synthesize",
      dependsOn: bp.parallel ? tasks.map(t => t.id) : (previous ? [previous] : []),
    });
    tasks.push(synth);
    const layers = computeLayers(tasks);
    return makePlan({
      agentId: opts.agentId,
      intentId: opts.intent.id,
      strategy: bp.parallel ? "parallel" : "sequential",
      tasks,
      layers,
      now: opts.now,
    });
  }
}

export function planLayers(plan: AgentPlan): readonly (readonly string[])[] { return plan.layers; }

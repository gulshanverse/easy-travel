/** WAR — definition validation + DAG analysis. */
import { WorkflowCycleError, WorkflowValidationError } from "./errors";
import type { WorkflowDefinition, WorkflowStep } from "./types";

const SEMVER = /^\d+\.\d+\.\d+$/;

export function validateWorkflowDefinition(def: WorkflowDefinition): void {
  if (!def.id) throw new WorkflowValidationError("Workflow id is required");
  if (!def.name.trim()) throw new WorkflowValidationError("Workflow name is required");
  if (!SEMVER.test(def.version))
    throw new WorkflowValidationError(`Invalid workflow version: ${def.version}`);
  if (def.steps.length === 0)
    throw new WorkflowValidationError("Workflow requires at least one step");
  const ids = new Set<string>();
  for (const s of def.steps) {
    if (ids.has(s.id)) throw new WorkflowValidationError(`Duplicate step id: ${s.id}`);
    ids.add(s.id);
    if (s.kind === "capability" && !s.capabilityId) {
      throw new WorkflowValidationError(`Step ${s.id} of kind capability requires capabilityId`);
    }
    if (s.kind === "connector" && (!s.connectorId || !s.capabilityId)) {
      throw new WorkflowValidationError(
        `Step ${s.id} of kind connector requires connectorId and capabilityId`,
      );
    }
    if (s.kind === "signal" && !s.signalName) {
      throw new WorkflowValidationError(`Step ${s.id} of kind signal requires signalName`);
    }
    if (s.kind === "timer" && (s.delayMs === undefined || s.delayMs < 0)) {
      throw new WorkflowValidationError(
        `Step ${s.id} of kind timer requires a non-negative delayMs`,
      );
    }
  }
  for (const s of def.steps) {
    for (const d of s.dependsOn) {
      if (!ids.has(d))
        throw new WorkflowValidationError(`Step ${s.id} depends on unknown step ${d}`);
    }
  }
  if (def.policy.maxStepConcurrency < 1)
    throw new WorkflowValidationError("maxStepConcurrency must be >= 1");
  topologicalSort(def.steps);
}

export function topologicalSort(steps: readonly WorkflowStep[]): readonly WorkflowStep[] {
  const indegree = new Map<string, number>();
  const byId = new Map(steps.map((s) => [s.id, s]));
  const dependents = new Map<string, string[]>();
  for (const s of steps) indegree.set(s.id, 0);
  for (const s of steps) {
    for (const d of s.dependsOn) {
      indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
      dependents.set(d, [...(dependents.get(d) ?? []), s.id]);
    }
  }
  const queue = steps
    .filter((s) => (indegree.get(s.id) ?? 0) === 0)
    .map((s) => s.id)
    .sort();
  const out: WorkflowStep[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(byId.get(id)!);
    for (const dep of (dependents.get(id) ?? []).slice().sort()) {
      const n = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, n);
      if (n === 0) queue.push(dep);
    }
  }
  if (out.length !== steps.length) {
    const remaining = steps.filter((s) => !out.includes(s)).map((s) => s.id);
    throw new WorkflowCycleError(remaining);
  }
  return out;
}

/** Parallel execution layers — steps in a layer may run concurrently (branches/join). */
export function computeLayers(
  steps: readonly WorkflowStep[],
): readonly (readonly WorkflowStep[])[] {
  const sorted = topologicalSort(steps);
  const depth = new Map<string, number>();
  const byId = new Map(steps.map((s) => [s.id, s]));
  for (const s of sorted) {
    const d = s.dependsOn.length ? Math.max(...s.dependsOn.map((x) => (depth.get(x) ?? 0) + 1)) : 0;
    depth.set(s.id, d);
  }
  const layers: WorkflowStep[][] = [];
  for (const [id, d] of [...depth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    (layers[d] ??= []).push(byId.get(id)!);
  }
  return layers.map((l) => Object.freeze(l));
}

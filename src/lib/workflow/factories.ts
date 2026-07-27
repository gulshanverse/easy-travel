/** WAR — immutable factories. */
import { newWorkflowDefinitionId, newWorkflowInstanceId, newWorkflowCorrelationId, newCheckpointId } from "./ids";
import { mergeWorkflowPolicy } from "./policies";
import { validateWorkflowDefinition } from "./validation";
import type {
  WorkflowCheckpoint, WorkflowDefinition, WorkflowInstance, WorkflowPolicy, WorkflowState,
  WorkflowStep, WorkflowTrigger, WorkflowVariables, WorkflowSnapshot, WorkflowHistoryRecord,
} from "./types";

export function makeWorkflowStep(input: Partial<WorkflowStep> & { id: string; name: string }): WorkflowStep {
  return Object.freeze({
    kind: "capability",
    dependsOn: Object.freeze([...(input.dependsOn ?? [])]),
    required: input.required ?? true,
    ...input,
    input: Object.freeze({ ...(input.input ?? {}) }),
  }) as WorkflowStep;
}

export function makeWorkflowDefinition(input: {
  id?: string; name: string; version: string; description?: string;
  steps: readonly WorkflowStep[]; triggers?: readonly WorkflowTrigger[];
  policy?: Partial<WorkflowPolicy>; metadata?: Record<string, string>; createdAt?: number;
}): WorkflowDefinition {
  const def: WorkflowDefinition = Object.freeze({
    id: input.id ?? newWorkflowDefinitionId(),
    name: input.name,
    version: input.version,
    description: input.description,
    steps: Object.freeze(input.steps.map(s => makeWorkflowStep(s as WorkflowStep))),
    triggers: Object.freeze([...(input.triggers ?? [{ kind: "manual" as const }])].map(t => Object.freeze({ ...t }))),
    policy: mergeWorkflowPolicy(input.policy),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    createdAt: input.createdAt ?? Date.now(),
  });
  validateWorkflowDefinition(def);
  return def;
}

export function makeWorkflowState(
  def: WorkflowDefinition,
  status: WorkflowState["status"] = "registered",
): WorkflowState {
  const steps: Record<string, WorkflowState["steps"][string]> = {};
  for (const s of def.steps) steps[s.id] = "pending";
  return Object.freeze({ status, steps: Object.freeze(steps), outputs: Object.freeze({}) });
}

export function makeWorkflowInstance(input: {
  definition: WorkflowDefinition;
  id?: string;
  variables?: WorkflowVariables;
  now?: number;
  correlationId?: string;
  priority?: number;
}): WorkflowInstance {
  const now = input.now ?? Date.now();
  return Object.freeze({
    id: input.id ?? newWorkflowInstanceId(),
    definitionId: input.definition.id,
    correlationId: input.correlationId ?? newWorkflowCorrelationId(),
    state: makeWorkflowState(input.definition, "registered"),
    variables: Object.freeze({ ...(input.variables ?? {}) }),
    transitions: Object.freeze([]),
    history: Object.freeze([Object.freeze({ seq: 0, at: now, kind: "created" as const })]),
    checkpoints: Object.freeze([]),
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    priority: input.priority ?? input.definition.policy.priority,
  });
}

export function makeCheckpoint(instance: WorkflowInstance, at: number): WorkflowCheckpoint {
  return Object.freeze({
    id: newCheckpointId(),
    instanceId: instance.id,
    seq: instance.history.length,
    at,
    state: instance.state,
    variables: instance.variables,
  });
}

export function makeSnapshot(instance: WorkflowInstance, at: number): WorkflowSnapshot {
  return Object.freeze({
    instanceId: instance.id,
    definitionId: instance.definitionId,
    at,
    state: instance.state,
    variables: instance.variables,
    history: Object.freeze([...instance.history]) as readonly WorkflowHistoryRecord[],
  });
}

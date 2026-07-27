/** WAR — WorkflowFactory: builder + manager composition root. */
import { makeWorkflowDefinition, makeWorkflowStep } from "./factories";
import { WorkflowManager, type WorkflowManagerDeps } from "./manager";
import type { WorkflowDefinition, WorkflowPolicy, WorkflowStep, WorkflowTrigger } from "./types";

export class WorkflowBuilder {
  private steps: WorkflowStep[] = [];
  private triggers: WorkflowTrigger[] = [];
  private policy: Partial<WorkflowPolicy> = {};
  private metadata: Record<string, string> = {};
  constructor(private readonly opts: { id?: string; name: string; version: string; description?: string }) {}
  step(s: Partial<WorkflowStep> & { id: string; name: string }): this { this.steps.push(makeWorkflowStep(s)); return this; }
  trigger(t: WorkflowTrigger): this { this.triggers.push(t); return this; }
  withPolicy(p: Partial<WorkflowPolicy>): this { this.policy = { ...this.policy, ...p }; return this; }
  withMetadata(m: Record<string, string>): this { this.metadata = { ...this.metadata, ...m }; return this; }
  build(): WorkflowDefinition {
    return makeWorkflowDefinition({
      ...this.opts, steps: this.steps,
      triggers: this.triggers.length ? this.triggers : undefined,
      policy: this.policy, metadata: this.metadata,
    });
  }
}

export const WorkflowFactory = Object.freeze({
  builder(opts: { id?: string; name: string; version: string; description?: string }): WorkflowBuilder {
    return new WorkflowBuilder(opts);
  },
  definition: makeWorkflowDefinition,
  step: makeWorkflowStep,
});

export function createWorkflowManager(deps: WorkflowManagerDeps): WorkflowManager {
  return new WorkflowManager(deps);
}

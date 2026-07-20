/** CTOR — CapabilityManager (aggregates capability + tool + workflow state). */
import type { CTOREventBus } from "./events";
import type { CTORMetrics } from "./metrics";
import type { CTORTelemetrySink } from "./telemetry";
import type { CTORPolicies } from "./policies";
import { CapabilityRegistry, ToolRegistry } from "./registry";
import { ToolInvoker } from "./tools";
import { executeWorkflow, WorkflowScheduler } from "./workflow";
import type {
  Capability, ExecutionContext, Tool, WorkflowDefinition, WorkflowHistoryEntry, WorkflowRunResult,
} from "./types";
import { transitionWorkflow } from "./lifecycle";

export interface CapabilityManagerDeps {
  readonly capabilities: CapabilityRegistry;
  readonly tools: ToolRegistry;
  readonly events: CTOREventBus;
  readonly metrics: CTORMetrics;
  readonly telemetry: CTORTelemetrySink;
  readonly policies: CTORPolicies;
  readonly scheduler: WorkflowScheduler;
  readonly now?: () => number;
}

export class CapabilityManager {
  readonly capabilities: CapabilityRegistry;
  readonly tools: ToolRegistry;
  readonly invoker: ToolInvoker;
  readonly scheduler: WorkflowScheduler;
  private readonly workflows = new Map<string, WorkflowDefinition>();
  private readonly workflowHistory = new Map<string, WorkflowHistoryEntry[]>();
  private readonly runs: WorkflowRunResult[] = [];
  private readonly deps: CapabilityManagerDeps;

  constructor(deps: CapabilityManagerDeps) {
    this.deps = deps;
    this.capabilities = deps.capabilities;
    this.tools = deps.tools;
    this.invoker = new ToolInvoker({ registry: deps.tools, events: deps.events, metrics: deps.metrics, telemetry: deps.telemetry, now: deps.now });
    this.scheduler = deps.scheduler;
  }

  registerCapability(c: Capability): Capability {
    const created = this.capabilities.register(c);
    this.deps.metrics.capabilityRegistered();
    this.deps.events.emit({ name: "CapabilityRegistered", data: { id: c.id, name: c.name, version: c.version } });
    return created;
  }
  removeCapability(id: string): void {
    this.capabilities.remove(id);
    this.deps.metrics.capabilityRemoved();
    this.deps.events.emit({ name: "CapabilityRemoved", data: { id } });
  }
  registerTool(t: Tool, impl?: (input: Readonly<Record<string, unknown>>) => Promise<unknown> | unknown): Tool {
    const created = this.tools.register(t, impl);
    this.deps.metrics.toolRegistered();
    this.deps.events.emit({ name: "ToolRegistered", data: { id: t.id, name: t.name } });
    return created;
  }
  registerWorkflow(w: WorkflowDefinition): WorkflowDefinition {
    this.workflows.set(w.id, w);
    this.workflowHistory.set(w.id, [{ at: Date.now(), status: "validated" }]);
    this.deps.events.emit({ name: "WorkflowRegistered", data: { id: w.id, name: w.name } });
    return w;
  }
  getWorkflow(id: string): WorkflowDefinition | undefined { return this.workflows.get(id); }
  listWorkflows(): readonly WorkflowDefinition[] { return [...this.workflows.values()]; }

  async runWorkflow(id: string, context: ExecutionContext): Promise<WorkflowRunResult> {
    const wf = this.workflows.get(id);
    if (!wf) throw new Error(`Workflow not registered: ${id}`);
    this.workflowHistory.get(id)?.push({ at: Date.now(), status: transitionWorkflow("validated", "running") });
    const result = await this.scheduler.schedule(wf, () => executeWorkflow(wf, {
      context, policies: this.deps.policies, events: this.deps.events,
      metrics: this.deps.metrics, telemetry: this.deps.telemetry, now: this.deps.now,
    }));
    this.workflowHistory.get(id)?.push({ at: Date.now(), status: result.status as "completed" | "failed" | "cancelled" });
    this.runs.push(result);
    if (this.runs.length > 512) this.runs.shift();
    return result;
  }
  history(): readonly WorkflowRunResult[] { return [...this.runs]; }
  workflowHistoryOf(id: string): readonly WorkflowHistoryEntry[] { return this.workflowHistory.get(id) ?? []; }
  clear(): void {
    this.capabilities.clear(); this.tools.clear();
    this.workflows.clear(); this.workflowHistory.clear(); this.runs.length = 0;
  }
}

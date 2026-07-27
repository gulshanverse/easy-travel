/** WAR — workflow definition registry. */
import { WorkflowAlreadyRegisteredError, WorkflowNotFoundError, WorkflowValidationError } from "./errors";
import { validateWorkflowDefinition } from "./validation";
import type { WorkflowDefinition } from "./types";

export class WorkflowRegistry {
  private readonly defs = new Map<string, WorkflowDefinition>();
  private readonly byName = new Map<string, Set<string>>();

  constructor(private readonly maxDefinitions = 10_000) {}

  register(def: WorkflowDefinition): WorkflowDefinition {
    validateWorkflowDefinition(def);
    if (this.defs.has(def.id)) throw new WorkflowAlreadyRegisteredError(def.id);
    if (this.defs.size >= this.maxDefinitions) throw new WorkflowValidationError("Workflow registry is full");
    this.defs.set(def.id, def);
    const set = this.byName.get(def.name) ?? new Set<string>();
    set.add(def.id);
    this.byName.set(def.name, set);
    return def;
  }
  upsert(def: WorkflowDefinition): WorkflowDefinition {
    if (this.defs.has(def.id)) this.remove(def.id);
    return this.register(def);
  }
  has(id: string): boolean { return this.defs.has(id); }
  get(id: string): WorkflowDefinition {
    const d = this.defs.get(id);
    if (!d) throw new WorkflowNotFoundError(id);
    return d;
  }
  find(id: string): WorkflowDefinition | undefined { return this.defs.get(id); }
  byWorkflowName(name: string): readonly WorkflowDefinition[] {
    return [...(this.byName.get(name) ?? [])].map(id => this.defs.get(id)!).filter(Boolean);
  }
  list(): readonly WorkflowDefinition[] { return [...this.defs.values()].sort((a, b) => a.id < b.id ? -1 : 1); }
  remove(id: string): boolean {
    const d = this.defs.get(id);
    if (!d) return false;
    this.defs.delete(id);
    this.byName.get(d.name)?.delete(id);
    return true;
  }
  size(): number { return this.defs.size; }
  clear(): void { this.defs.clear(); this.byName.clear(); }
}

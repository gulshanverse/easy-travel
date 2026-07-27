/** WAR — checkpointing, snapshots and execution recovery (in-memory only). */
import { makeCheckpoint, makeSnapshot } from "./factories";
import { WorkflowInstanceNotFoundError } from "./errors";
import type { WorkflowCheckpoint, WorkflowInstance, WorkflowSnapshot } from "./types";
import type { WorkflowStatePersistencePort } from "./ports";
import { InMemoryStatePersistence } from "./ports";

export class CheckpointManager {
  private readonly byInstance = new Map<string, WorkflowCheckpoint[]>();
  constructor(private readonly maxPerInstance = 200) {}

  create(instance: WorkflowInstance, at: number): WorkflowCheckpoint {
    const cp = makeCheckpoint(instance, at);
    const list = this.byInstance.get(instance.id) ?? [];
    list.push(cp);
    while (list.length > this.maxPerInstance) list.shift();
    this.byInstance.set(instance.id, list);
    return cp;
  }
  list(instanceId: string): readonly WorkflowCheckpoint[] {
    return [...(this.byInstance.get(instanceId) ?? [])];
  }
  latest(instanceId: string): WorkflowCheckpoint | undefined {
    const list = this.byInstance.get(instanceId);
    return list?.[list.length - 1];
  }
  count(): number {
    let n = 0;
    for (const l of this.byInstance.values()) n += l.length;
    return n;
  }
  clear(): void {
    this.byInstance.clear();
  }
}

export class SnapshotManager {
  private readonly snapshots = new Map<string, WorkflowSnapshot[]>();
  constructor(
    private readonly persistence: WorkflowStatePersistencePort = new InMemoryStatePersistence(),
  ) {}

  async capture(instance: WorkflowInstance, at: number): Promise<WorkflowSnapshot> {
    const snap = makeSnapshot(instance, at);
    const list = this.snapshots.get(instance.id) ?? [];
    list.push(snap);
    this.snapshots.set(instance.id, list);
    await this.persistence.save(`snapshot:${instance.id}:${list.length - 1}`, snap);
    return snap;
  }
  list(instanceId: string): readonly WorkflowSnapshot[] {
    return [...(this.snapshots.get(instanceId) ?? [])];
  }
  latest(instanceId: string): WorkflowSnapshot | undefined {
    const list = this.snapshots.get(instanceId);
    return list?.[list.length - 1];
  }
  clear(): void {
    this.snapshots.clear();
  }
}

/** Restores a running instance to its last durable checkpoint. */
export class ExecutionRecovery {
  constructor(private readonly checkpoints: CheckpointManager) {}

  recover(instance: WorkflowInstance | undefined, at: number): WorkflowInstance {
    if (!instance) throw new WorkflowInstanceNotFoundError("<unknown>");
    const cp = this.checkpoints.latest(instance.id);
    if (!cp) return instance;
    return Object.freeze({
      ...instance,
      state: Object.freeze({ ...cp.state, status: instance.state.status }),
      variables: cp.variables,
      updatedAt: at,
      history: Object.freeze([
        ...instance.history,
        Object.freeze({
          seq: instance.history.length,
          at,
          kind: "checkpoint" as const,
          data: { recoveredFrom: cp.id },
        }),
      ]),
    });
  }
}

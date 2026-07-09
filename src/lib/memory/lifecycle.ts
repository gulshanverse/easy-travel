/**
 * Memory Engine — Lifecycle Manager (EDS-001 v2.0 §3).
 *
 * Owns state transitions: soft/hard delete, restore, supersede, archive,
 * status changes. Every transition emits a domain event via the publisher.
 */
import type { MemoryConfiguration } from "./config";
import type { MemoryEnvelope, MemoryStatus } from "./types";
import type { MemoryStore } from "./store/types";
import type { MemoryEventPublisher } from "./events";
import { MemoryNotFoundError, MemoryConflictError } from "./errors";

export interface LifecycleActor {
  actorId: string;
  reason?: string;
}

export class MemoryLifecycleManager {
  constructor(
    private config: MemoryConfiguration,
    private store: MemoryStore,
    private publisher: MemoryEventPublisher,
  ) {}

  async archive(memoryId: string, ownerId: string, actor: LifecycleActor): Promise<MemoryEnvelope> {
    const env = await this.mustGet(memoryId, ownerId);
    this.assertNotTerminal(env.status);
    const now = new Date().toISOString();
    const updated = await this.store.patch(memoryId, { status: "archived" as MemoryStatus, version: env.version + 1 });
    this.publisher.publish("MemoryArchived", {
      memoryId, reason: actor.reason ?? "policy", archivedAt: now,
    }, { ownerId, tenantId: env.tenantId });
    return updated;
  }

  async softDelete(memoryId: string, ownerId: string, actor: LifecycleActor): Promise<MemoryEnvelope> {
    if (!this.config.flags.softDeleteEnabled) {
      return this.hardDelete(memoryId, ownerId, actor);
    }
    const env = await this.mustGet(memoryId, ownerId);
    this.assertNotTerminal(env.status);
    const policy = this.config.classPolicies[env.class];
    const recoverableUntil = new Date(Date.now() + policy.softDeleteGraceSeconds * 1000).toISOString();
    const updated = await this.store.patch(memoryId, { status: "deleted", version: env.version + 1 });
    this.publisher.publish("MemoryDeleted", {
      memoryId, reason: actor.reason ?? "user", actorId: actor.actorId, recoverableUntil,
    }, { ownerId, tenantId: env.tenantId });
    return updated;
  }

  async restore(memoryId: string, ownerId: string): Promise<MemoryEnvelope> {
    const env = await this.mustGet(memoryId, ownerId);
    if (env.status !== "deleted") throw new MemoryConflictError("only soft-deleted memories can be restored");
    const updated = await this.store.patch(memoryId, { status: "active", version: env.version + 1 });
    this.publisher.publish("MemoryUpdated", {
      memoryId, changedFields: ["status"], priorVersion: env.version, newVersion: env.version + 1,
    }, { ownerId, tenantId: env.tenantId });
    return updated;
  }

  async hardDelete(memoryId: string, ownerId: string, actor: LifecycleActor): Promise<MemoryEnvelope> {
    const env = await this.mustGet(memoryId, ownerId);
    // Purge derivatives (embeddings, blobs) would happen here in production
    await this.store.patch(memoryId, { status: "hard_deleted", version: env.version + 1 });
    await this.store.hardDelete(memoryId, ownerId);
    const tombstoneHash = env.contentHash;
    this.publisher.publish("MemoryForgotten", {
      memoryId,
      tombstoneHash,
      reason: actor.reason ?? "rtbf",
      completedAt: new Date().toISOString(),
    }, { ownerId, tenantId: env.tenantId });
    return { ...env, status: "hard_deleted" };
  }

  async supersede(oldId: string, newId: string, ownerId: string): Promise<void> {
    const old = await this.mustGet(oldId, ownerId);
    await this.store.patch(oldId, { status: "superseded", supersededBy: newId, version: old.version + 1 });
    this.publisher.publish("MemoryUpdated", {
      memoryId: oldId, changedFields: ["status", "supersededBy"], priorVersion: old.version, newVersion: old.version + 1,
    }, { ownerId, tenantId: old.tenantId });
  }

  async setStatus(memoryId: string, ownerId: string, status: MemoryStatus): Promise<MemoryEnvelope> {
    const env = await this.mustGet(memoryId, ownerId);
    this.assertNotTerminal(env.status);
    const updated = await this.store.patch(memoryId, { status, version: env.version + 1 });
    this.publisher.publish("MemoryUpdated", {
      memoryId, changedFields: ["status"], priorVersion: env.version, newVersion: env.version + 1,
    }, { ownerId, tenantId: env.tenantId });
    return updated;
  }

  private async mustGet(memoryId: string, ownerId: string): Promise<MemoryEnvelope> {
    const env = await this.store.get(memoryId, ownerId);
    if (!env) throw new MemoryNotFoundError(memoryId);
    return env;
  }

  private assertNotTerminal(status: MemoryStatus): void {
    if (status === "hard_deleted" || status === "superseded") {
      throw new MemoryConflictError(`memory in terminal state: ${status}`);
    }
  }
}

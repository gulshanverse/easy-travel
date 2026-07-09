/**
 * Memory Engine — Archiver (TTL sweeps + expiry policy).
 *
 * Scheduled by the caller (cron / worker heartbeat). Idempotent per row.
 */
import type { MemoryConfiguration } from "./config";
import type { MemoryStore } from "./store/types";
import type { MemoryLifecycleManager } from "./lifecycle";

export interface ArchiveSweepStats {
  scanned: number;
  archived: number;
  hardDeleted: number;
  softDeleteGraceExpired: number;
}

export class MemoryArchiver {
  constructor(
    private config: MemoryConfiguration,
    private store: MemoryStore,
    private lifecycle: MemoryLifecycleManager,
  ) {}

  async sweep(ownerId: string, now = Date.now()): Promise<ArchiveSweepStats> {
    const rows = await this.store.list({
      ownerId,
      includeExpired: true,
      statuses: ["active", "deleted"],
      now,
    });
    const stats: ArchiveSweepStats = {
      scanned: rows.length,
      archived: 0,
      hardDeleted: 0,
      softDeleteGraceExpired: 0,
    };
    for (const r of rows) {
      if (r.ttlExpiresAt && Date.parse(r.ttlExpiresAt) <= now && r.status === "active") {
        const policy = this.config.classPolicies[r.class];
        if (policy.archiveOnExpire) {
          await this.lifecycle.archive(r.memoryId, ownerId, {
            actorId: "system",
            reason: "ttl_expired",
          });
          stats.archived += 1;
        } else {
          await this.lifecycle.hardDelete(r.memoryId, ownerId, {
            actorId: "system",
            reason: "ttl_expired",
          });
          stats.hardDeleted += 1;
        }
        continue;
      }
      if (r.status === "deleted") {
        const policy = this.config.classPolicies[r.class];
        const expiredAt = Date.parse(r.updatedAt) + policy.softDeleteGraceSeconds * 1000;
        if (expiredAt <= now) {
          await this.lifecycle.hardDelete(r.memoryId, ownerId, {
            actorId: "system",
            reason: "soft_delete_grace_expired",
          });
          stats.softDeleteGraceExpired += 1;
        }
      }
    }
    return stats;
  }
}

/**
 * ObjectStorageManager — namespaced buckets, metrics and health, provider
 * independent.
 */

import type { ObjectStorageConfig } from "../config";
import { aggregateHealth, PersistenceMetrics, type AggregatedHealth } from "../telemetry";
import type { ObjectMetadata, ObjectStorageDriver, SignedUrl } from "./types";

export class ObjectStorageManager {
  constructor(
    readonly driver: ObjectStorageDriver,
    private readonly config: ObjectStorageConfig,
    readonly metrics: PersistenceMetrics = new PersistenceMetrics(),
  ) {}

  private key(namespace: string, key: string): string {
    const prefix = this.config.pathPrefix ? `${this.config.pathPrefix}/` : "";
    return `${prefix}${namespace}/${key}`;
  }

  async put(
    namespace: string,
    key: string,
    body: Uint8Array | string,
    contentType?: string,
  ): Promise<ObjectMetadata> {
    return this.metrics.time("storage.put", () =>
      this.driver.put({ key: this.key(namespace, key), body, contentType }),
    );
  }
  async get(namespace: string, key: string): Promise<Uint8Array | null> {
    return this.metrics.time("storage.get", () => this.driver.get(this.key(namespace, key)));
  }
  async head(namespace: string, key: string): Promise<ObjectMetadata | null> {
    return this.driver.head(this.key(namespace, key));
  }
  async list(namespace: string, prefix = ""): Promise<readonly ObjectMetadata[]> {
    return this.driver.list(this.key(namespace, prefix));
  }
  async delete(namespace: string, key: string): Promise<boolean> {
    return this.metrics.time("storage.delete", () =>
      this.driver.delete(this.key(namespace, key)),
    );
  }
  async signedUrl(namespace: string, key: string, mode: "read" | "write"): Promise<SignedUrl> {
    return this.driver.signedUrl(
      this.key(namespace, key),
      mode,
      this.config.signedUrlTtlSeconds,
    );
  }
  async health(): Promise<AggregatedHealth> {
    const ok = await this.driver.healthy().catch(() => false);
    return aggregateHealth([
      {
        name: "storage.driver",
        status: ok ? "healthy" : "unhealthy",
        details: { kind: this.driver.kind, bucket: this.config.bucket },
      },
    ]);
  }
}

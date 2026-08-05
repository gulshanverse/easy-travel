/**
 * Object storage drivers.
 *
 * - `InMemoryObjectStorageDriver` — tests/dev only.
 * - `RemoteObjectStorageDriver`   — one implementation for S3, Azure Blob and
 *   GCS; the provider supplies only a `UrlSigner` and an `ObjectTransport`.
 */

import { ObjectStorageError } from "../errors";
import {
  etagOf,
  toBytes,
  type ObjectMetadata,
  type ObjectStorageDriver,
  type ObjectTransport,
  type PutObjectInput,
  type SignedUrl,
  type UrlSigner,
} from "./types";

export class InMemoryObjectStorageDriver implements ObjectStorageDriver {
  readonly kind = "memory" as const;
  private readonly objects = new Map<string, { bytes: Uint8Array; meta: ObjectMetadata }>();

  async put(input: PutObjectInput): Promise<ObjectMetadata> {
    const bytes = toBytes(input.body);
    const meta: ObjectMetadata = {
      key: input.key,
      size: bytes.byteLength,
      contentType: input.contentType ?? "application/octet-stream",
      etag: etagOf(bytes),
      updatedAt: new Date().toISOString(),
    };
    this.objects.set(input.key, { bytes, meta });
    return meta;
  }
  async get(key: string): Promise<Uint8Array | null> {
    return this.objects.get(key)?.bytes ?? null;
  }
  async head(key: string): Promise<ObjectMetadata | null> {
    return this.objects.get(key)?.meta ?? null;
  }
  async list(prefix = ""): Promise<readonly ObjectMetadata[]> {
    return [...this.objects.values()]
      .map((o) => o.meta)
      .filter((m) => m.key.startsWith(prefix))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
  }
  async delete(key: string): Promise<boolean> {
    return this.objects.delete(key);
  }
  async signedUrl(key: string, mode: "read" | "write", ttlSeconds: number): Promise<SignedUrl> {
    return {
      url: `memory://${key}?mode=${mode}`,
      method: mode === "read" ? "GET" : "PUT",
      expiresInSeconds: ttlSeconds,
    };
  }
  async healthy(): Promise<boolean> {
    return true;
  }
  clear(): void {
    this.objects.clear();
  }
}

export interface RemoteStorageOptions {
  readonly kind: "local" | "s3" | "azure" | "gcs";
  readonly bucket: string;
  readonly pathPrefix?: string;
  readonly signer: UrlSigner;
  readonly transport: ObjectTransport;
  readonly maxObjectBytes?: number;
}

export class RemoteObjectStorageDriver implements ObjectStorageDriver {
  readonly kind: "local" | "s3" | "azure" | "gcs";

  constructor(private readonly opts: RemoteStorageOptions) {
    this.kind = opts.kind;
  }

  private path(key: string): string {
    const prefix = this.opts.pathPrefix ?? "";
    return prefix ? `${prefix.replace(/\/$/, "")}/${key}` : key;
  }

  async put(input: PutObjectInput): Promise<ObjectMetadata> {
    const bytes = toBytes(input.body);
    const max = this.opts.maxObjectBytes ?? Number.MAX_SAFE_INTEGER;
    if (bytes.byteLength > max)
      throw new ObjectStorageError("object exceeds max size", {
        key: input.key,
        size: bytes.byteLength,
        max,
      });
    const url = await this.opts.signer.sign({
      bucket: this.opts.bucket,
      key: this.path(input.key),
      mode: "write",
      ttlSeconds: 900,
    });
    const contentType = input.contentType ?? "application/octet-stream";
    await this.opts.transport.put(url, bytes, contentType);
    return {
      key: input.key,
      size: bytes.byteLength,
      contentType,
      etag: etagOf(bytes),
      updatedAt: new Date().toISOString(),
    };
  }

  async get(key: string): Promise<Uint8Array | null> {
    const url = await this.opts.signer.sign({
      bucket: this.opts.bucket,
      key: this.path(key),
      mode: "read",
      ttlSeconds: 900,
    });
    return this.opts.transport.get(url);
  }

  async head(key: string): Promise<ObjectMetadata | null> {
    const url = await this.opts.signer.sign({
      bucket: this.opts.bucket,
      key: this.path(key),
      mode: "read",
      ttlSeconds: 900,
    });
    return this.opts.transport.head(url);
  }

  async list(prefix = ""): Promise<readonly ObjectMetadata[]> {
    return this.opts.transport.list(this.opts.bucket, this.path(prefix));
  }

  async delete(key: string): Promise<boolean> {
    const url = await this.opts.signer.sign({
      bucket: this.opts.bucket,
      key: this.path(key),
      mode: "write",
      ttlSeconds: 900,
    });
    return this.opts.transport.delete(url);
  }

  async signedUrl(key: string, mode: "read" | "write", ttlSeconds: number): Promise<SignedUrl> {
    return {
      url: await this.opts.signer.sign({
        bucket: this.opts.bucket,
        key: this.path(key),
        mode,
        ttlSeconds,
      }),
      method: mode === "read" ? "GET" : "PUT",
      expiresInSeconds: ttlSeconds,
    };
  }

  async healthy(): Promise<boolean> {
    try {
      await this.opts.transport.list(this.opts.bucket, this.path(""));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Object storage contracts — one interface, four providers.
 * No provider-specific branch ever escapes a driver module.
 */

export interface ObjectMetadata {
  readonly key: string;
  readonly size: number;
  readonly contentType: string;
  readonly etag: string;
  readonly updatedAt: string;
}

export interface PutObjectInput {
  readonly key: string;
  readonly body: Uint8Array | string;
  readonly contentType?: string;
}

export interface SignedUrl {
  readonly url: string;
  readonly method: "GET" | "PUT";
  readonly expiresInSeconds: number;
}

export interface ObjectStorageDriver {
  readonly kind: "memory" | "local" | "s3" | "azure" | "gcs";
  put(input: PutObjectInput): Promise<ObjectMetadata>;
  get(key: string): Promise<Uint8Array | null>;
  head(key: string): Promise<ObjectMetadata | null>;
  list(prefix?: string): Promise<readonly ObjectMetadata[]>;
  delete(key: string): Promise<boolean>;
  signedUrl(key: string, mode: "read" | "write", ttlSeconds: number): Promise<SignedUrl>;
  healthy(): Promise<boolean>;
}

/**
 * Provider-neutral signing hook. S3, Azure Blob and GCS differ only in how a
 * URL is signed, so each provider supplies this one function.
 */
export interface UrlSigner {
  sign(input: {
    readonly bucket: string;
    readonly key: string;
    readonly mode: "read" | "write";
    readonly ttlSeconds: number;
  }): Promise<string>;
}

/** Byte-level transport shared by every remote provider. */
export interface ObjectTransport {
  put(url: string, body: Uint8Array | string, contentType: string): Promise<void>;
  get(url: string): Promise<Uint8Array | null>;
  head(url: string): Promise<ObjectMetadata | null>;
  delete(url: string): Promise<boolean>;
  list(bucket: string, prefix: string): Promise<readonly ObjectMetadata[]>;
}

export function etagOf(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function toBytes(body: Uint8Array | string): Uint8Array {
  return typeof body === "string" ? new TextEncoder().encode(body) : body;
}

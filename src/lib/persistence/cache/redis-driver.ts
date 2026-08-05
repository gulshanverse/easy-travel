/**
 * Redis CacheDriver (production).
 *
 * Uses the Redis HTTP protocol (Upstash-compatible) because the serverless
 * worker runtime has no raw TCP sockets. The transport is injected, so this
 * module imports no vendor SDK and stays testable.
 */

import { CacheError } from "../errors";
import type { CacheDriver } from "./types";

export interface RedisTransport {
  /** Executes a Redis command as an argv array, returning the raw reply. */
  command(argv: readonly (string | number)[]): Promise<unknown>;
}

export interface RedisHttpTransportOptions {
  readonly url: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
}

/** REST transport: POST ["SET","k","v"] to the Redis HTTP endpoint. */
export function createRedisHttpTransport(opts: RedisHttpTransportOptions): RedisTransport {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async command(argv) {
      const res = await doFetch(opts.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(argv.map(String)),
      });
      if (!res.ok) {
        throw new CacheError(`redis command failed [${res.status}]`, {
          body: await res.text(),
          command: argv[0],
        });
      }
      const json = (await res.json()) as { result?: unknown; error?: string };
      if (json.error) throw new CacheError(`redis error: ${json.error}`, { command: argv[0] });
      return json.result ?? null;
    },
  };
}

export class RedisCacheDriver implements CacheDriver {
  readonly kind = "redis" as const;
  constructor(private readonly transport: RedisTransport) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.transport.command(["GET", key]);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(String(raw)) as T;
    } catch {
      return raw as T;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await this.transport.command(["SET", key, payload, "PX", Math.ceil(ttlMs)]);
      return;
    }
    await this.transport.command(["SET", key, payload]);
  }

  async delete(key: string): Promise<boolean> {
    return Number(await this.transport.command(["DEL", key])) > 0;
  }

  async has(key: string): Promise<boolean> {
    return Number(await this.transport.command(["EXISTS", key])) > 0;
  }

  async increment(key: string, by: number, ttlMs?: number): Promise<number> {
    const next = Number(await this.transport.command(["INCRBY", key, by]));
    if (ttlMs && ttlMs > 0 && next === by) {
      await this.transport.command(["PEXPIRE", key, Math.ceil(ttlMs)]);
    }
    return next;
  }

  async keys(prefix: string): Promise<readonly string[]> {
    const raw = await this.transport.command(["KEYS", `${prefix}*`]);
    return Array.isArray(raw) ? (raw as string[]).map(String).sort() : [];
  }

  async clear(prefix?: string): Promise<number> {
    const keys = await this.keys(prefix ?? "");
    let n = 0;
    for (const key of keys) if (await this.delete(key)) n += 1;
    return n;
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await this.transport.command(["PING"]);
      return String(reply).toUpperCase() === "PONG";
    } catch {
      return false;
    }
  }

  async size(): Promise<number> {
    return Number(await this.transport.command(["DBSIZE"]));
  }
}

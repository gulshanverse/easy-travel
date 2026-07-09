/**
 * Runtime Core — Service Registry.
 *
 * A discoverable registry of long-lived runtime services (Memory Runtime,
 * Prompt Runtime, Context Builder, Event Bus, future engines). Provides
 * metadata, health, and semver-aware version lookup on top of the
 * dependency-injection container.
 */

import { ContainerError, ValidationError } from "./errors";

export interface ServiceDescriptor<T = unknown> {
  readonly id: string;
  readonly version: string;
  readonly kind: string;
  readonly instance: T;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly healthCheck?: () => Promise<ServiceHealth> | ServiceHealth;
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  detail?: string;
  checkedAt: number;
}

export interface RegisterOptions {
  version?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  healthCheck?: () => Promise<ServiceHealth> | ServiceHealth;
  /** Replace an existing registration; default false. */
  replace?: boolean;
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;

export class ServiceRegistry {
  private services = new Map<string, ServiceDescriptor>();

  register<T>(id: string, instance: T, opts: RegisterOptions = {}): ServiceDescriptor<T> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Service id must be a non-empty string");
    }
    const version = opts.version ?? "0.0.0";
    if (!SEMVER.test(version)) {
      throw new ValidationError(`Invalid semver for service '${id}': ${version}`);
    }
    if (this.services.has(id) && !opts.replace) {
      throw new ContainerError(`Service '${id}' already registered`);
    }
    const descriptor: ServiceDescriptor<T> = Object.freeze({
      id,
      version,
      kind: opts.kind ?? "runtime",
      instance,
      metadata: Object.freeze({ ...(opts.metadata ?? {}) }),
      healthCheck: opts.healthCheck,
    });
    this.services.set(id, descriptor as ServiceDescriptor);
    return descriptor;
  }

  unregister(id: string): boolean {
    return this.services.delete(id);
  }

  get<T>(id: string): ServiceDescriptor<T> | undefined {
    return this.services.get(id) as ServiceDescriptor<T> | undefined;
  }

  require<T>(id: string): ServiceDescriptor<T> {
    const svc = this.get<T>(id);
    if (!svc) throw new ContainerError(`Service '${id}' not registered`);
    return svc;
  }

  list(kind?: string): readonly ServiceDescriptor[] {
    const out: ServiceDescriptor[] = [];
    for (const svc of this.services.values()) {
      if (!kind || svc.kind === kind) out.push(svc);
    }
    return out;
  }

  async health(): Promise<Record<string, ServiceHealth>> {
    const out: Record<string, ServiceHealth> = {};
    for (const svc of this.services.values()) {
      if (!svc.healthCheck) {
        out[svc.id] = { status: "healthy", checkedAt: Date.now(), detail: "no-check" };
        continue;
      }
      try {
        out[svc.id] = await svc.healthCheck();
      } catch (err) {
        out[svc.id] = {
          status: "unhealthy",
          detail: (err as Error).message,
          checkedAt: Date.now(),
        };
      }
    }
    return out;
  }

  size(): number { return this.services.size; }
}

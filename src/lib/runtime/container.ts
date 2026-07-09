/**
 * Runtime Core — Dependency Injection container.
 *
 * A small, deterministic DI container with support for singleton, scoped,
 * and transient lifetimes; factory registrations; interface (token-based)
 * resolution; lazy initialization; and circular dependency detection.
 *
 * The container is NOT a service locator — capabilities receive resolved
 * dependencies via their constructor / factory closure, they never reach
 * into the container at runtime.
 */

import { ContainerError, DependencyResolutionError } from "./errors";

export type Lifetime = "singleton" | "scoped" | "transient";

export interface Token<T> {
  readonly key: symbol;
  readonly description: string;
  readonly _type?: T; // phantom
}

export function createToken<T>(description: string): Token<T> {
  return { key: Symbol(description), description };
}

export type Factory<T> = (resolver: Resolver) => T | Promise<T>;

export interface Resolver {
  resolve<T>(token: Token<T>): T | Promise<T>;
  resolveSync<T>(token: Token<T>): T;
  has<T>(token: Token<T>): boolean;
}

interface Registration<T> {
  factory: Factory<T>;
  lifetime: Lifetime;
  instance?: T | Promise<T>;
}

export class Container implements Resolver {
  private registrations = new Map<symbol, Registration<unknown>>();
  private tokens = new Map<symbol, Token<unknown>>();

  register<T>(token: Token<T>, factory: Factory<T>, lifetime: Lifetime = "singleton"): void {
    if (this.registrations.has(token.key)) {
      throw new ContainerError(`Token '${token.description}' already registered`);
    }
    this.registrations.set(token.key, { factory: factory as Factory<unknown>, lifetime });
    this.tokens.set(token.key, token as Token<unknown>);
  }

  registerInstance<T>(token: Token<T>, instance: T): void {
    if (this.registrations.has(token.key)) {
      throw new ContainerError(`Token '${token.description}' already registered`);
    }
    this.registrations.set(token.key, {
      factory: () => instance,
      lifetime: "singleton",
      instance,
    });
    this.tokens.set(token.key, token as Token<unknown>);
  }

  has<T>(token: Token<T>): boolean {
    return this.registrations.has(token.key);
  }

  resolveSync<T>(token: Token<T>): T {
    const reg = this.get(token);
    const value = this.resolveInternal(token, reg, new Set());
    if (value instanceof Promise) {
      throw new DependencyResolutionError(
        `Token '${token.description}' resolves asynchronously; use resolve() instead`,
      );
    }
    return value as T;
  }

  async resolve<T>(token: Token<T>): Promise<T> {
    const reg = this.get(token);
    const value = this.resolveInternal(token, reg, new Set());
    return (await value) as T;
  }

  /** Create a scoped resolver (scoped lifetimes get fresh instances per scope). */
  createScope(): Container {
    const scope = new Container();
    for (const [key, reg] of this.registrations) {
      const token = this.tokens.get(key)!;
      if (reg.lifetime === "singleton") {
        // Reuse parent singleton instance lazily.
        scope.registrations.set(key, {
          factory: () => this.resolve(token),
          lifetime: "singleton",
        });
      } else {
        scope.registrations.set(key, { factory: reg.factory, lifetime: reg.lifetime });
      }
      scope.tokens.set(key, token);
    }
    return scope;
  }

  registered(): readonly Token<unknown>[] {
    return [...this.tokens.values()];
  }

  private get<T>(token: Token<T>): Registration<T> {
    const reg = this.registrations.get(token.key);
    if (!reg) {
      throw new DependencyResolutionError(`Token '${token.description}' not registered`);
    }
    return reg as Registration<T>;
  }

  private resolveInternal<T>(
    token: Token<T>,
    reg: Registration<T>,
    stack: Set<symbol>,
  ): T | Promise<T> {
    if (stack.has(token.key)) {
      throw new DependencyResolutionError(
        `Circular dependency detected while resolving '${token.description}'`,
        { context: { chain: [...stack].map((s) => s.description) } },
      );
    }
    stack.add(token.key);
    try {
      if (reg.lifetime === "singleton" || reg.lifetime === "scoped") {
        if (reg.instance !== undefined) return reg.instance;
        const built = reg.factory(this.trackingResolver(stack));
        reg.instance = built;
        return built;
      }
      return reg.factory(this.trackingResolver(stack));
    } finally {
      stack.delete(token.key);
    }
  }

  private trackingResolver(stack: Set<symbol>): Resolver {
    return {
      resolve: <T>(token: Token<T>) => this.resolveInternal(token, this.get(token), stack),
      resolveSync: <T>(token: Token<T>) => {
        const v = this.resolveInternal(token, this.get(token), stack);
        if (v instanceof Promise) {
          throw new DependencyResolutionError(
            `Token '${token.description}' resolves asynchronously; use resolve() instead`,
          );
        }
        return v as T;
      },
      has: <T>(token: Token<T>) => this.has(token),
    };
  }
}

/**
 * IAM Platform — runtime registry (multi-tenant hosting of IAM runtimes).
 */
import type { IamRuntime } from "./runtime";

export class IamRegistry {
  private readonly runtimes = new Map<string, IamRuntime>();

  register(name: string, runtime: IamRuntime): IamRuntime {
    this.runtimes.set(name, runtime);
    return runtime;
  }
  get(name: string): IamRuntime | undefined {
    return this.runtimes.get(name);
  }
  names(): readonly string[] {
    return Object.freeze([...this.runtimes.keys()]);
  }
}

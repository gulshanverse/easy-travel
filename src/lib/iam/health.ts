/**
 * IAM Platform — health reporting.
 */
import type { AuthenticationManager } from "./manager";

export interface IamHealthCheck {
  readonly name: string;
  readonly healthy: boolean;
  readonly detail?: string;
}

export interface IamHealthReport {
  readonly healthy: boolean;
  readonly checks: readonly IamHealthCheck[];
  readonly at: number;
}

export async function collectIamHealth(manager: AuthenticationManager): Promise<IamHealthReport> {
  const checks: IamHealthCheck[] = [];
  try {
    const snapshot = await manager.snapshot();
    checks.push({ name: "persistence", healthy: true, detail: `${snapshot.credentials} credential(s)` });
    checks.push({ name: "authorization", healthy: snapshot.roles >= 0 });
    checks.push({ name: "sessions", healthy: snapshot.sessions >= 0 });
  } catch (error) {
    checks.push({ name: "persistence", healthy: false, detail: String(error) });
  }
  checks.push({ name: "password.hasher", healthy: Boolean(manager.hasher.algorithm) });
  return Object.freeze({
    healthy: checks.every((c) => c.healthy),
    checks: Object.freeze(checks),
    at: Date.now(),
  });
}

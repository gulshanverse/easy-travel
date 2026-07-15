/**
 * Constraint Evaluation Engine.
 * Deterministic. Detects violations and hard-vs-hard conflicts.
 */

import { DecisionConstraintConflictError } from "./errors";
import type { DecisionConstraint, DecisionOption } from "./types";

export interface ConstraintEvaluation {
  readonly optionId: string;
  readonly violated: readonly DecisionConstraint[];
  readonly softViolations: readonly DecisionConstraint[];
  readonly satisfiesHardConstraints: boolean;
}

export class ConstraintEngine {
  evaluate(
    option: DecisionOption,
    constraints: readonly DecisionConstraint[],
  ): ConstraintEvaluation {
    const violated: DecisionConstraint[] = [];
    const soft: DecisionConstraint[] = [];
    for (const c of constraints) {
      const ok = c.predicate ? this.safePredicate(c, option) : true;
      if (!ok) {
        if (c.severity === "hard") violated.push(c);
        else if (c.severity === "soft") soft.push(c);
      }
    }
    return Object.freeze({
      optionId: option.id,
      violated: Object.freeze(violated),
      softViolations: Object.freeze(soft),
      satisfiesHardConstraints: violated.length === 0,
    });
  }

  evaluateMany(
    options: readonly DecisionOption[],
    constraints: readonly DecisionConstraint[],
  ): readonly ConstraintEvaluation[] {
    return options.map((o) => this.evaluate(o, constraints));
  }

  /** Detect structural hard-vs-hard conflicts (same kind, opposite params). */
  detectConflicts(constraints: readonly DecisionConstraint[]): void {
    const hardsByKind = new Map<string, DecisionConstraint[]>();
    for (const c of constraints) {
      if (c.severity !== "hard") continue;
      const arr = hardsByKind.get(c.kind) ?? [];
      arr.push(c);
      hardsByKind.set(c.kind, arr);
    }
    for (const [kind, arr] of hardsByKind) {
      if (arr.length < 2) continue;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (this.paramsConflict(arr[i], arr[j])) {
            throw new DecisionConstraintConflictError(
              `hard constraints conflict for kind=${kind}`,
              { a: arr[i].id, b: arr[j].id },
            );
          }
        }
      }
    }
  }

  private paramsConflict(a: DecisionConstraint, b: DecisionConstraint): boolean {
    // Simple structural check: overlapping keys with different scalar values.
    for (const [k, va] of Object.entries(a.params)) {
      if (!(k in b.params)) continue;
      const vb = b.params[k];
      if (typeof va !== typeof vb) return true;
      if (typeof va !== "object" && va !== vb) return true;
    }
    return false;
  }

  private safePredicate(c: DecisionConstraint, o: DecisionOption): boolean {
    try { return c.predicate!(o); } catch { return false; }
  }
}

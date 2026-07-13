/**
 * Journey Constraint Engine.
 * Ranking, validation, and conflict detection over the constraint set.
 * Pure — no side effects.
 */

import { JourneyConstraintConflictError } from "./errors";
import type { TravelConstraint } from "./types";

export interface ConstraintConflict {
  readonly kind: "budget" | "date" | "policy" | "hard-vs-hard" | "capacity";
  readonly ids: readonly string[];
  readonly message: string;
}

const SEVERITY_WEIGHT: Record<TravelConstraint["severity"], number> = {
  hard: 3,
  soft: 2,
  advisory: 1,
};

export class ConstraintEngine {
  /** Deterministic ordering: hard > soft > advisory, higher rank first, then createdAt. */
  rank(constraints: readonly TravelConstraint[]): readonly TravelConstraint[] {
    return [...constraints].sort((a, b) => {
      const w = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      if (w !== 0) return w;
      if (b.rank !== a.rank) return b.rank - a.rank;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  /** Only hard constraints define the effective decision boundary. */
  active(constraints: readonly TravelConstraint[]): readonly TravelConstraint[] {
    return constraints.filter((c) => c.severity === "hard" || c.severity === "soft");
  }

  /** Detect structural conflicts between constraints. */
  conflicts(constraints: readonly TravelConstraint[]): readonly ConstraintConflict[] {
    const conflicts: ConstraintConflict[] = [];
    const hardByKind = new Map<string, TravelConstraint[]>();
    for (const c of constraints) {
      if (c.severity !== "hard") continue;
      const arr = hardByKind.get(c.kind) ?? [];
      arr.push(c);
      hardByKind.set(c.kind, arr);
    }
    // multiple hard budget constraints ⇒ conflict
    const hardBudget = hardByKind.get("budget") ?? [];
    if (hardBudget.length > 1) {
      conflicts.push({
        kind: "hard-vs-hard",
        ids: hardBudget.map((c) => c.id),
        message: "multiple hard budget constraints",
      });
    }
    // conflicting date windows
    const dates = hardByKind.get("date") ?? [];
    if (dates.length > 1) {
      conflicts.push({
        kind: "date",
        ids: dates.map((c) => c.id),
        message: "multiple hard date constraints",
      });
    }
    // group / capacity: if group requires >N seats but transport constraint caps <M
    const group = constraints.find((c) => c.kind === "group" && c.severity === "hard");
    const transport = constraints.find((c) => c.kind === "transport" && c.severity === "hard");
    if (group && transport) {
      const needed = Number(group.params.size ?? 0);
      const capacity = Number(transport.params.capacity ?? Infinity);
      if (needed > 0 && capacity < needed) {
        conflicts.push({
          kind: "capacity",
          ids: [group.id, transport.id],
          message: `group of ${needed} exceeds transport capacity ${capacity}`,
        });
      }
    }
    return conflicts;
  }

  assertNoConflicts(constraints: readonly TravelConstraint[]): void {
    const c = this.conflicts(constraints);
    if (c.length > 0) {
      throw new JourneyConstraintConflictError(
        c.map((x) => `${x.kind}: ${x.message}`).join("; "),
        { conflicts: c },
      );
    }
  }
}

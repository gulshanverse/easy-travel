/**
 * Specification pattern — composable, driver-independent query predicates.
 * Specifications compile to `RowFilter[]`, so the same specification runs on
 * the in-memory driver and on Postgres.
 */

import type { RowFilter, RowSort, SortDirection } from "../database/types";

export interface Specification {
  readonly filters: readonly RowFilter[];
  and(other: Specification): Specification;
}

class Spec implements Specification {
  constructor(readonly filters: readonly RowFilter[]) {}
  and(other: Specification): Specification {
    return new Spec([...this.filters, ...other.filters]);
  }
}

export const spec = {
  none(): Specification {
    return new Spec([]);
  },
  where(field: string, op: RowFilter["op"], value?: unknown): Specification {
    return new Spec([{ field, op, value }]);
  },
  eq(field: string, value: unknown): Specification {
    return new Spec([{ field, op: "eq", value }]);
  },
  neq(field: string, value: unknown): Specification {
    return new Spec([{ field, op: "neq", value }]);
  },
  in(field: string, values: readonly unknown[]): Specification {
    return new Spec([{ field, op: "in", value: [...values] }]);
  },
  contains(field: string, value: unknown): Specification {
    return new Spec([{ field, op: "contains", value }]);
  },
  exists(field: string, present = true): Specification {
    return new Spec([{ field, op: "exists", value: present }]);
  },
  between(field: string, min: unknown, max: unknown): Specification {
    return new Spec([
      { field, op: "gte", value: min },
      { field, op: "lte", value: max },
    ]);
  },
  all(...specs: readonly Specification[]): Specification {
    return new Spec(specs.flatMap((s) => [...s.filters]));
  },
};

export function sortBy(field: string, direction: SortDirection = "asc"): RowSort {
  return { field, direction };
}

/**
 * BudgetService — estimated vs actual spend, per-category rollup,
 * daily limits, warnings, and currency conversion (pluggable).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  ActivityType,
  BudgetCategoryTotal,
  BudgetSummary,
  BudgetWarning,
  TIEResult,
} from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;

/** Plug in a real FX provider later; identity converter for now. */
export interface CurrencyConverter {
  convert(amount: number, from: string, to: string): Promise<number>;
}
export const identityConverter: CurrencyConverter = {
  async convert(amount) {
    return amount;
  },
};

/** Rolls up activities and booking items into a budget summary. */
export class BudgetService {
  constructor(private readonly supabase: SB, private readonly fx: CurrencyConverter = identityConverter) {}

  async summarize(tripId: string): Promise<TIEResult<BudgetSummary>> {
    const [tripRes, actsRes, itemsRes] = await Promise.all([
      this.supabase.from("trips").select("currency, budget_total_cents, traveler_count, start_date, end_date").eq("id", tripId).maybeSingle(),
      this.supabase.from("trip_activities").select("activity_type, cost_cents, currency").eq("trip_id", tripId),
      this.supabase
        .from("booking_items")
        .select("item_type, price_cents, currency, booking_id, bookings!inner(trip_id, status)")
        .eq("bookings.trip_id", tripId),
    ]);
    if (tripRes.error || !tripRes.data) return fail("budget.trip_not_found", tripRes.error?.message ?? "Trip missing");
    if (actsRes.error) return fail("budget.activities_failed", actsRes.error.message);

    const currency = tripRes.data.currency ?? "USD";
    const budgetCents = tripRes.data.budget_total_cents ?? null;
    const travelers = Math.max(1, tripRes.data.traveler_count ?? 1);
    const days = computeDayCount(tripRes.data.start_date, tripRes.data.end_date);

    const catMap = new Map<string, { est: number; act: number }>();
    let estimatedCents = 0;
    let actualCents = 0;

    for (const a of actsRes.data ?? []) {
      if (a.cost_cents == null) continue;
      const cents = await this.fx.convert(a.cost_cents, a.currency ?? currency, currency);
      estimatedCents += cents;
      addCat(catMap, categoryFor(a.activity_type), cents, 0);
    }
    for (const bi of itemsRes.data ?? []) {
      if (bi.price_cents == null) continue;
      const cents = await this.fx.convert(bi.price_cents, bi.currency ?? currency, currency);
      actualCents += cents;
      addCat(catMap, bi.item_type ?? "other", 0, cents);
    }

    const categories: BudgetCategoryTotal[] = Array.from(catMap.entries())
      .map(([category, v]) => ({
        category,
        estimatedCents: v.est,
        actualCents: v.act,
        percentOfBudget: budgetCents && budgetCents > 0 ? (v.est + v.act) / budgetCents : 0,
      }))
      .sort((a, b) => b.estimatedCents + b.actualCents - (a.estimatedCents + a.actualCents));

    const total = estimatedCents + actualCents;
    const warnings: BudgetWarning[] = [];
    let utilization: number | null = null;
    let remaining: number | null = null;
    if (budgetCents == null) {
      warnings.push({ code: "no-budget-set", severity: "info", message: "No trip budget set. Set one for warnings and daily limits." });
    } else {
      utilization = budgetCents > 0 ? total / budgetCents : null;
      remaining = budgetCents - total;
      if (total > budgetCents) {
        warnings.push({
          code: "over-budget",
          severity: "critical",
          message: `Trip is ${((total / budgetCents - 1) * 100).toFixed(1)}% over budget`,
        });
      } else if (utilization !== null && utilization >= 0.85) {
        warnings.push({
          code: "near-limit",
          severity: "warning",
          message: `Trip has used ${(utilization * 100).toFixed(0)}% of its budget`,
        });
      }
    }

    const perDayCents = days > 0 ? Math.round(total / days) : 0;
    const perTravelerCents = Math.round(total / travelers);

    const summary: BudgetSummary = {
      tripId,
      currency,
      budgetCents,
      estimatedCents,
      actualCents,
      remainingCents: remaining,
      utilizationPct: utilization,
      perDayCents,
      perTravelerCents,
      categories,
      warnings,
    };

    for (const w of warnings.filter((x) => x.severity !== "info")) {
      emitTIEEvent({ name: "BUDGET_WARNING", tripId, userId: null, data: w });
    }
    emitTIEEvent({ name: "BUDGET_CHANGED", tripId, userId: null, data: { total, budgetCents } });
    return ok(summary);
  }

  async setBudget(tripId: string, budgetCents: number | null, currency?: string): Promise<TIEResult<{ id: string }>> {
    const patch: Database["public"]["Tables"]["trips"]["Update"] = { budget_total_cents: budgetCents };
    if (currency) patch.currency = currency;
    const { error } = await this.supabase.from("trips").update(patch).eq("id", tripId);
    if (error) return fail("budget.set_failed", error.message, error);
    emitTIEEvent({ name: "BUDGET_CHANGED", tripId, userId: null, data: { budgetCents, currency } });
    return ok({ id: tripId });
  }
}

function categoryFor(t: ActivityType): string {
  switch (t) {
    case "flight":
    case "train":
    case "bus":
    case "cab":
    case "transfer":
      return "transport";
    case "hotel":
    case "checkin":
    case "checkout":
      return "lodging";
    case "restaurant":
      return "food";
    case "experience":
    case "sightseeing":
      return "activities";
    default:
      return "other";
  }
}

function addCat(m: Map<string, { est: number; act: number }>, key: string, est: number, act: number) {
  const cur = m.get(key) ?? { est: 0, act: 0 };
  cur.est += est;
  cur.act += act;
  m.set(key, cur);
}

function computeDayCount(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
}

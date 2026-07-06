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

export interface CurrencyConverter {
  convert(amount: number, from: string, to: string): Promise<number>;
}
export const identityConverter: CurrencyConverter = {
  async convert(amount) {
    return amount;
  },
};

export class BudgetService {
  constructor(private readonly supabase: SB, private readonly fx: CurrencyConverter = identityConverter) {}

  async summarize(tripId: string): Promise<TIEResult<BudgetSummary>> {
    const [tripRes, actsRes, bookingsRes] = await Promise.all([
      this.supabase
        .from("trips")
        .select("currency, budget_total_cents, traveler_count, start_date, end_date")
        .eq("id", tripId)
        .maybeSingle(),
      this.supabase
        .from("trip_activities")
        .select("activity_type, cost_cents, currency")
        .eq("trip_id", tripId),
      this.supabase
        .from("bookings")
        .select("id, currency, booking_type, booking_items(item_type, total_cents)")
        .eq("trip_id", tripId),
    ]);
    if (tripRes.error || !tripRes.data)
      return fail("budget.trip_not_found", tripRes.error?.message ?? "Trip missing");
    if (actsRes.error) return fail("budget.activities_failed", actsRes.error.message);
    if (bookingsRes.error) return fail("budget.bookings_failed", bookingsRes.error.message);

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
      addCat(catMap, categoryForActivity(a.activity_type), cents, 0);
    }
    for (const b of bookingsRes.data ?? []) {
      const items = (b.booking_items ?? []) as Array<{ item_type: string; total_cents: number | null }>;
      for (const it of items) {
        if (it.total_cents == null) continue;
        const cents = await this.fx.convert(it.total_cents, b.currency ?? currency, currency);
        actualCents += cents;
        addCat(catMap, categoryForBooking(it.item_type), 0, cents);
      }
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
      warnings.push({
        code: "no-budget-set",
        severity: "info",
        message: "No trip budget set. Set one for warnings and daily limits.",
      });
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

  async setBudget(
    tripId: string,
    budgetCents: number | null,
    currency?: string,
  ): Promise<TIEResult<{ id: string }>> {
    const patch: Database["public"]["Tables"]["trips"]["Update"] = { budget_total_cents: budgetCents };
    if (currency) patch.currency = currency;
    const { error } = await this.supabase.from("trips").update(patch).eq("id", tripId);
    if (error) return fail("budget.set_failed", error.message, error);
    emitTIEEvent({ name: "BUDGET_CHANGED", tripId, userId: null, data: { budgetCents, currency } });
    return ok({ id: tripId });
  }
}

function categoryForActivity(t: ActivityType): string {
  switch (t) {
    case "flight":
    case "transit":
      return "transport";
    case "lodging":
      return "lodging";
    case "meal":
      return "food";
    case "attraction":
    case "experience":
      return "activities";
    case "free_time":
    case "note":
    case "other":
    default:
      return "other";
  }
}

function categoryForBooking(t: string): string {
  switch (t) {
    case "flight":
      return "transport";
    case "hotel":
    case "lodging":
      return "lodging";
    case "restaurant":
      return "food";
    case "experience":
    case "activity":
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

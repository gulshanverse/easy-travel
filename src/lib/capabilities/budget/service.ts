/**
 * BUDGET SERVICE — deterministic estimation, tracking, forecast, alerts.
 */
import type { DecisionContext } from "@/lib/tios/types";
import { capabilityRequestId, emitCapabilityEvent } from "../events";
import type { BudgetInput, BudgetOutput, BudgetCategory } from "./types";
import type { Money } from "../types";

const STYLE_PER_DAY_CENTS: Record<BudgetInput["style"], number> = {
  budget: 6000, comfort: 15000, luxury: 40000,
};
const CATEGORY_WEIGHTS: Record<string, number> = {
  accommodation: 0.4, food: 0.25, transport: 0.15,
  activities: 0.15, misc: 0.05,
};

function moneyOf(cents: number, currency: string): Money {
  return { amountCents: Math.round(cents), currency };
}

export async function runBudget(input: BudgetInput, ctx: DecisionContext): Promise<BudgetOutput> {
  const t0 = Date.now();
  const requestId = capabilityRequestId("budget");
  const currency = input.currency;
  const perDay = STYLE_PER_DAY_CENTS[input.style] * input.travelers;
  const estimatedTotalCents = perDay * input.durationDays;

  // Actuals by category
  const actualByCat = new Map<string, number>();
  let realTotalCents = 0;
  for (const e of input.expenses) {
    const conv = e.amount.currency === currency ? e.amount.amountCents
      : Math.round(e.amount.amountCents * (input.fxRates?.[e.amount.currency] ?? 1));
    actualByCat.set(e.category, (actualByCat.get(e.category) ?? 0) + conv);
    realTotalCents += conv;
  }

  const categories: BudgetCategory[] = Object.entries(CATEGORY_WEIGHTS).map(([category, weight]) => {
    const estimated = estimatedTotalCents * weight;
    const actual = actualByCat.get(category) ?? 0;
    const variance = estimated > 0 ? ((actual - estimated) / estimated) * 100 : 0;
    return {
      category,
      estimated: moneyOf(estimated, currency),
      actual: moneyOf(actual, currency),
      variancePct: Math.round(variance * 10) / 10,
    };
  });

  const daysElapsed = Math.min(
    input.durationDays,
    Math.max(1, input.expenses.length ? Math.ceil(input.durationDays / 2) : 0),
  );
  const daysRemaining = Math.max(0, input.durationDays - daysElapsed);
  const burnRate = daysElapsed > 0 ? realTotalCents / daysElapsed : 0;
  const projectedTotalCents = realTotalCents + burnRate * daysRemaining;
  const target = input.targetBudget?.amountCents ?? estimatedTotalCents;
  const overspendPct = target > 0 ? ((projectedTotalCents - target) / target) * 100 : 0;

  const alerts: BudgetOutput["alerts"] = [];
  if (overspendPct > 20) alerts.push({ id: "over_20", severity: "critical", message: `Projected overspend of ${overspendPct.toFixed(0)}%.` });
  else if (overspendPct > 5) alerts.push({ id: "over_5", severity: "warn", message: `Projected overspend of ${overspendPct.toFixed(0)}%.` });
  else if (overspendPct < -15) alerts.push({ id: "under", severity: "info", message: "Trending significantly under budget." });

  const savings: BudgetOutput["savings"] = [
    { id: "sv_accom", suggestion: "Switch one accommodation night to a mid-tier option.", estimatedSaving: moneyOf(estimatedTotalCents * 0.05, currency) },
    { id: "sv_food", suggestion: "Replace one dinner with a local street-food session.", estimatedSaving: moneyOf(estimatedTotalCents * 0.02, currency) },
  ];

  const output: BudgetOutput = {
    meta: { requestId, capabilityId: "budget", latencyMs: Date.now() - t0, generatedAt: Date.now() },
    estimatedTotal: moneyOf(estimatedTotalCents, currency),
    realTotal: moneyOf(realTotalCents, currency),
    dailyBudget: moneyOf(perDay, currency),
    categories,
    forecast: {
      projectedTotal: moneyOf(projectedTotalCents, currency),
      projectedOverspendPct: Math.round(overspendPct * 10) / 10,
      daysRemaining,
    },
    currencyConversion: {
      base: currency,
      rates: input.fxRates ?? { [currency]: 1 },
    },
    alerts,
    savings,
    optimization: {
      score: Math.max(0, Math.min(1, 1 - Math.abs(overspendPct) / 100)),
      recommendations: [
        "Book accommodation early to lock lower rates.",
        "Bundle intra-city transport with a day pass.",
        "Track expenses daily for accurate forecasting.",
      ],
    },
  };

  emitCapabilityEvent({
    name: "BudgetCalculated",
    capability: "budget",
    requestId,
    timestamp: Date.now(),
    userId: ctx.userId,
    data: { estimated: estimatedTotalCents, real: realTotalCents, currency },
  });

  return output;
}

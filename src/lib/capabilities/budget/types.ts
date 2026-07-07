/**
 * BUDGET CAPABILITY — types + schemas.
 */
import { z } from "zod";
import { CapabilityMetaSchema, MoneySchema } from "../types";

export const BudgetInputSchema = z.object({
  journeyId: z.string().optional(),
  destination: z.string().optional(),
  durationDays: z.number().int().positive(),
  travelers: z.number().int().positive().default(1),
  currency: z.string().default("USD"),
  style: z.enum(["budget", "comfort", "luxury"]).default("comfort"),
  expenses: z.array(z.object({
    id: z.string(),
    category: z.string(),
    amount: MoneySchema,
    date: z.string().optional(),
  })).default([]),
  targetBudget: MoneySchema.optional(),
  fxRates: z.record(z.string(), z.number().positive()).optional(),
});
export type BudgetInput = z.infer<typeof BudgetInputSchema>;

export const BudgetCategorySchema = z.object({
  category: z.string(),
  estimated: MoneySchema,
  actual: MoneySchema,
  variancePct: z.number(),
});
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const BudgetOutputSchema = z.object({
  meta: CapabilityMetaSchema,
  estimatedTotal: MoneySchema,
  realTotal: MoneySchema,
  dailyBudget: MoneySchema,
  categories: z.array(BudgetCategorySchema),
  forecast: z.object({
    projectedTotal: MoneySchema,
    projectedOverspendPct: z.number(),
    daysRemaining: z.number().int().nonnegative(),
  }),
  currencyConversion: z.object({
    base: z.string(),
    rates: z.record(z.string(), z.number().positive()),
  }),
  alerts: z.array(z.object({
    id: z.string(),
    severity: z.enum(["info", "warn", "critical"]),
    message: z.string(),
  })),
  savings: z.array(z.object({
    id: z.string(),
    suggestion: z.string(),
    estimatedSaving: MoneySchema,
  })),
  optimization: z.object({
    score: z.number().min(0).max(1),
    recommendations: z.array(z.string()),
  }),
});
export type BudgetOutput = z.infer<typeof BudgetOutputSchema>;

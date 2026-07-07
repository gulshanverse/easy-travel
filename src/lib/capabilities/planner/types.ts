/**
 * PLANNER CAPABILITY — types + Zod schemas.
 * Structured planner output. Never plain text.
 */
import { z } from "zod";
import {
  CapabilityMetaSchema, CompanionKindSchema, MoneySchema, SeasonSchema, TravelStyleSchema,
} from "../types";

// ---------- Input ----------
export const PlannerInputSchema = z.object({
  prompt: z.string(),
  userId: z.string().optional().nullable(),
  journeyId: z.string().optional(),
  locale: z.string().optional(),
  currency: z.string().optional(),
  now: z.number().optional(),
  overrides: z.object({
    destination: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    budgetCents: z.number().int().optional(),
    travelStyle: TravelStyleSchema.optional(),
    companions: CompanionKindSchema.optional(),
  }).partial().optional(),
});
export type PlannerInput = z.infer<typeof PlannerInputSchema>;

// ---------- Intent (extracted from natural language) ----------
export const PlannerIntentSchema = z.object({
  destination: z.string().nullable(),
  origin: z.string().nullable(),
  durationDays: z.number().int().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  budget: MoneySchema.nullable(),
  travelStyle: TravelStyleSchema.nullable(),
  companions: CompanionKindSchema.nullable(),
  transportation: z.array(z.string()),
  accommodation: z.array(z.string()),
  activities: z.array(z.string()),
  season: SeasonSchema,
  constraints: z.array(z.string()),
  missingFields: z.array(z.string()),
});
export type PlannerIntent = z.infer<typeof PlannerIntentSchema>;

// ---------- Structured output ----------
export const TimelineActivitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startTime: z.string().optional(),
  durationMinutes: z.number().int().nonnegative(),
  location: z.string().optional(),
  estimatedCost: MoneySchema.optional(),
  category: z.string(),
  editable: z.literal(true),
});
export type TimelineActivity = z.infer<typeof TimelineActivitySchema>;

export const TimelineDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  date: z.string().nullable(),
  title: z.string(),
  activities: z.array(TimelineActivitySchema),
  notes: z.array(z.string()),
});
export type TimelineDay = z.infer<typeof TimelineDaySchema>;

export const RiskSchema = z.object({
  id: z.string(),
  kind: z.enum(["weather", "safety", "budget", "logistics", "health", "documents", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string(),
});
export type Risk = z.infer<typeof RiskSchema>;

export const PlannerRecommendationRefSchema = z.object({
  subject: z.enum(["hotel", "flight", "restaurant", "experience", "transport", "destination"]),
  title: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});
export type PlannerRecommendationRef = z.infer<typeof PlannerRecommendationRefSchema>;

export const PlannerOutputSchema = z.object({
  meta: CapabilityMetaSchema,
  intent: PlannerIntentSchema,
  journey: z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    destination: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    durationDays: z.number().int().nullable(),
    travelStyle: TravelStyleSchema.nullable(),
    companions: CompanionKindSchema.nullable(),
  }),
  timeline: z.array(TimelineDaySchema),
  budgetEstimate: z.object({
    total: MoneySchema,
    perDay: MoneySchema,
    breakdown: z.array(z.object({
      category: z.string(),
      amount: MoneySchema,
    })),
  }),
  recommendations: z.array(PlannerRecommendationRefSchema),
  risks: z.array(RiskSchema),
  packingSuggestions: z.array(z.string()),
  questions: z.array(z.string()),
  alternatives: z.array(z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
  })),
  editable: z.literal(true),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

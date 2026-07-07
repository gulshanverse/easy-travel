/**
 * WEATHER CAPABILITY — provider-independent interface + types.
 * No provider integration; downstream milestones bind adapters via the
 * TIOS Provider Matrix.
 */
import { z } from "zod";
import { CapabilityMetaSchema } from "../types";

export const WeatherInputSchema = z.object({
  destination: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  units: z.enum(["metric", "imperial"]).default("metric"),
});
export type WeatherInput = z.infer<typeof WeatherInputSchema>;

export const ForecastDaySchema = z.object({
  date: z.string(),
  tempMin: z.number(),
  tempMax: z.number(),
  condition: z.enum(["clear", "clouds", "rain", "snow", "storm", "fog", "unknown"]),
  precipitationPct: z.number().min(0).max(100),
  windKph: z.number().nonnegative(),
});
export type ForecastDay = z.infer<typeof ForecastDaySchema>;

export const WeatherOutputSchema = z.object({
  meta: CapabilityMetaSchema,
  destination: z.string(),
  units: z.enum(["metric", "imperial"]),
  climateSummary: z.string(),
  forecast: z.array(ForecastDaySchema),
  warnings: z.array(z.object({
    id: z.string(),
    severity: z.enum(["info", "warn", "critical"]),
    message: z.string(),
  })),
  packingSuggestions: z.array(z.string()),
  activitySuitability: z.array(z.object({
    activity: z.string(),
    score: z.number().min(0).max(1),
    reason: z.string(),
  })),
  risk: z.object({
    overall: z.enum(["low", "medium", "high"]),
    factors: z.array(z.string()),
  }),
});
export type WeatherOutput = z.infer<typeof WeatherOutputSchema>;

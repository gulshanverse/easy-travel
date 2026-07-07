/**
 * Shared types for Travel Intelligence Capabilities (Phase 2).
 * All capability I/O uses these primitives so the SDK stays uniform.
 */
import { z } from "zod";

// ---------- Common ----------
export const MoneySchema = z.object({
  amountCents: z.number().int(),
  currency: z.string(),
});
export type Money = z.infer<typeof MoneySchema>;

export const ConfidenceSchema = z.number().min(0).max(1);

export const CapabilityMetaSchema = z.object({
  requestId: z.string(),
  capabilityId: z.string(),
  latencyMs: z.number().nonnegative(),
  generatedAt: z.number(),
  provider: z.string().optional(),
});
export type CapabilityMeta = z.infer<typeof CapabilityMetaSchema>;

// ---------- Companions & preferences (used by Planner + Recommendation) ----------
export const TravelStyleSchema = z.enum([
  "budget", "comfort", "luxury", "backpacker", "family", "romantic",
  "adventure", "business", "wellness",
]);
export type TravelStyle = z.infer<typeof TravelStyleSchema>;

export const CompanionKindSchema = z.enum([
  "solo", "couple", "family", "friends", "group", "colleagues",
]);
export type CompanionKind = z.infer<typeof CompanionKindSchema>;

export const SeasonSchema = z.enum(["spring", "summer", "autumn", "winter", "unknown"]);
export type Season = z.infer<typeof SeasonSchema>;

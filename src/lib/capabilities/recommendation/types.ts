/**
 * RECOMMENDATION CAPABILITY — types + schemas.
 * Runs a Context → Knowledge → Rules → Ranking → AI Enhancement → Explainability pipeline.
 */
import { z } from "zod";
import { CapabilityMetaSchema } from "../types";

export const RecommendationSubjectSchema = z.enum([
  "hotels", "flights", "restaurants", "experiences",
  "transport", "destinations", "local-tips", "hidden-gems",
]);
export type RecommendationSubject = z.infer<typeof RecommendationSubjectSchema>;

export const RecommendationInputSchema = z.object({
  subject: RecommendationSubjectSchema,
  destination: z.string().optional(),
  journeyId: z.string().optional(),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  enhanceWithAI: z.boolean().default(false),
});
export type RecommendationInput = z.infer<typeof RecommendationInputSchema>;

export const RecommendationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  antiReasons: z.array(z.string()),
  tags: z.array(z.string()),
  payload: z.record(z.string(), z.unknown()),
});
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

export const RecommendationOutputSchema = z.object({
  meta: CapabilityMetaSchema,
  subject: RecommendationSubjectSchema,
  items: z.array(RecommendationItemSchema),
  explanation: z.object({
    summary: z.string(),
    stages: z.array(z.enum(["context", "knowledge", "rules", "ranking", "ai", "explainability"])),
    aiEnhanced: z.boolean(),
  }),
});
export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;

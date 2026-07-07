/**
 * SEARCH CAPABILITY — semantic search architecture (types + schemas).
 */
import { z } from "zod";
import { CapabilityMetaSchema } from "../types";

export const SearchScopeSchema = z.enum([
  "destinations", "experiences", "hotels", "restaurants", "all",
]);
export type SearchScope = z.infer<typeof SearchScopeSchema>;

export const SearchIntentSchema = z.enum([
  "browse", "compare", "book", "learn", "plan", "unknown",
]);
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const SearchInputSchema = z.object({
  query: z.string(),
  scope: SearchScopeSchema.default("all"),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().positive().max(50).default(10),
  history: z.array(z.string()).optional(),
});
export type SearchInput = z.infer<typeof SearchInputSchema>;

export const SearchHitSchema = z.object({
  id: z.string(),
  scope: SearchScopeSchema,
  title: z.string(),
  snippet: z.string(),
  score: z.number().min(0).max(1),
  tags: z.array(z.string()),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchOutputSchema = z.object({
  meta: CapabilityMetaSchema,
  query: z.string(),
  scope: SearchScopeSchema,
  intent: SearchIntentSchema,
  hits: z.array(SearchHitSchema),
  suggestions: z.array(z.string()),
  totalHits: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
});
export type SearchOutput = z.infer<typeof SearchOutputSchema>;

/**
 * Travel Intelligence Capabilities — public entry point.
 * Import from "@/lib/capabilities" to access the SDK, types, and event bus.
 */
export * from "./types";
export * from "./events";
export * from "./sdk";
export { CAPABILITY_IDS, bootstrapCapabilities } from "./bootstrap";

// Per-capability type re-exports
export type {
  PlannerInput, PlannerIntent, PlannerOutput, TimelineDay, TimelineActivity,
  Risk, PlannerRecommendationRef,
} from "./planner/types";
export type { BudgetInput, BudgetOutput, BudgetCategory } from "./budget/types";
export type {
  RecommendationInput, RecommendationOutput, RecommendationItem, RecommendationSubject,
} from "./recommendation/types";
export type { WeatherInput, WeatherOutput, ForecastDay } from "./weather/types";
export type { MapInput, MapOutput, MapPin, LatLng, MapOperation } from "./map/types";
export type { SearchInput, SearchOutput, SearchHit, SearchScope, SearchIntent } from "./search/types";

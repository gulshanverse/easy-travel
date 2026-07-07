/**
 * CAPABILITIES SDK — the ONLY entry point UI code should use for Travel
 * Intelligence Capabilities. Wraps each capability's contract behind a
 * typed client. Uses ExecutionContext + invokeContract so every call goes
 * through the TIOS validation pipeline.
 */
import { invokeContract } from "@/lib/tios/contracts";
import { createExecutionContext, type ExecutionContextInit } from "@/lib/tios/execution-context";
import "./bootstrap"; // side-effect: registers all capability contracts

import type { PlannerInput, PlannerOutput } from "./planner/types";
import type { BudgetInput, BudgetOutput } from "./budget/types";
import type { RecommendationInput, RecommendationOutput } from "./recommendation/types";
import type { WeatherInput, WeatherOutput } from "./weather/types";
import type { MapInput, MapOutput } from "./map/types";
import type { SearchInput, SearchOutput } from "./search/types";

export interface CapabilityCallOptions extends ExecutionContextInit {}

function ctxFor(options?: CapabilityCallOptions) {
  return createExecutionContext(options ?? {});
}

export const plannerClient = {
  run: (input: PlannerInput, options?: CapabilityCallOptions) =>
    invokeContract<PlannerInput, PlannerOutput>("planner", input, ctxFor(options)),
};

export const budgetClient = {
  run: (input: BudgetInput, options?: CapabilityCallOptions) =>
    invokeContract<BudgetInput, BudgetOutput>("budget", input, ctxFor(options)),
};

export const recommendationClient = {
  run: (input: RecommendationInput, options?: CapabilityCallOptions) =>
    invokeContract<RecommendationInput, RecommendationOutput>("recommendation-engine", input, ctxFor(options)),
};

export const weatherClient = {
  run: (input: WeatherInput, options?: CapabilityCallOptions) =>
    invokeContract<WeatherInput, WeatherOutput>("weather", input, ctxFor(options)),
};

export const mapClient = {
  run: (input: MapInput, options?: CapabilityCallOptions) =>
    invokeContract<MapInput, MapOutput>("maps", input, ctxFor(options)),
};

export const searchClient = {
  run: (input: SearchInput, options?: CapabilityCallOptions) =>
    invokeContract<SearchInput, SearchOutput>("search-engine", input, ctxFor(options)),
};

export const capabilitiesClient = {
  planner: plannerClient,
  budget: budgetClient,
  recommendation: recommendationClient,
  weather: weatherClient,
  map: mapClient,
  search: searchClient,
} as const;

export type CapabilitiesClient = typeof capabilitiesClient;

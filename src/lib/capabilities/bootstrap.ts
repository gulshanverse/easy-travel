/**
 * Capabilities bootstrap — registers every capability contract with TIOS.
 * Import once (the SDK does this) to enable all capabilities.
 */
import "@/lib/tios/default-contracts"; // ensure defaults are seeded first
import { registerPlannerContract } from "./planner/contract";
import { registerBudgetContract } from "./budget/contract";
import { registerRecommendationContract } from "./recommendation/contract";
import { registerWeatherContract } from "./weather/contract";
import { registerMapContract } from "./map/contract";
import { registerSearchContract } from "./search/contract";

let bootstrapped = false;

export function bootstrapCapabilities(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  registerPlannerContract();
  registerBudgetContract();
  registerRecommendationContract();
  registerWeatherContract();
  registerMapContract();
  registerSearchContract();
}

bootstrapCapabilities();

export const CAPABILITY_IDS = [
  "planner", "budget", "recommendation-engine",
  "weather", "maps", "search-engine",
] as const;
export type BootstrappedCapabilityId = (typeof CAPABILITY_IDS)[number];

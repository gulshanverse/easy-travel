/**
 * WEATHER CAPABILITY CONTRACT.
 */
import { registerContract } from "@/lib/tios/contracts";
import { WeatherInputSchema, WeatherOutputSchema, type WeatherInput, type WeatherOutput } from "./types";
import { runWeather } from "./service";

export function registerWeatherContract(): void {
  registerContract<WeatherInput, WeatherOutput>({
    id: "weather",
    displayName: "Weather Intelligence",
    version: "1.1.0",
    description:
      "Provider-agnostic weather intelligence: forecast, climate summary, travel warnings, packing hints, activity suitability, and risk assessment.",
    category: "insights",
    lifecycle: "beta",
    inputSchema: WeatherInputSchema,
    outputSchema: WeatherOutputSchema,
    dependencies: [],
    requiredPermissions: [],
    supportedAgents: [],
    supportedProviders: ["open-meteo", "openweather", "tomorrow", "weatherapi"],
    priority: 70,
    featureFlags: ["Weather"],
    tags: ["environment", "provider-independent"],
    failureModes: ["provider_unavailable", "unknown_location"],
    fallbackStrategy: "cached",
    retryStrategy: { maxAttempts: 3, backoffMs: 400, jitter: true },
    sla: { availability: 0.995, p95LatencyMs: 1200 },
    latencyTargetMs: 600,
    costCategory: "low",
    securityClassification: "public",
    ownerModule: "capabilities/weather",
    docsUrl: "/docs/CAPABILITIES.md#weather",
    handler: async (input, ctx) => runWeather(input, ctx),
  });
}

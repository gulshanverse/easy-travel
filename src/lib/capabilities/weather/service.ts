/**
 * WEATHER SERVICE — provider-independent stub that emits a valid structured
 * forecast so upstream capabilities (Planner, Packing) can integrate today.
 * Real provider adapters attach through the TIOS Provider Matrix later.
 */
import type { DecisionContext } from "@/lib/tios/types";
import { capabilityRequestId, emitCapabilityEvent } from "../events";
import type { ForecastDay, WeatherInput, WeatherOutput } from "./types";

function deterministic(destination: string): number {
  let h = 0;
  for (let i = 0; i < destination.length; i++) h = (h * 31 + destination.charCodeAt(i)) >>> 0;
  return h;
}

function buildForecast(destination: string, days: number, units: WeatherInput["units"]): ForecastDay[] {
  const base = deterministic(destination);
  const isImperial = units === "imperial";
  const out: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const seed = (base + i * 7) % 100;
    const baseC = 12 + (seed % 20);
    const tempMin = isImperial ? Math.round((baseC * 9) / 5 + 32 - 8) : baseC - 4;
    const tempMax = isImperial ? Math.round((baseC * 9) / 5 + 32 + 6) : baseC + 6;
    const cond = (["clear", "clouds", "rain", "clear", "clouds"] as const)[seed % 5];
    out.push({
      date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
      tempMin, tempMax,
      condition: cond,
      precipitationPct: cond === "rain" ? 60 + (seed % 30) : (seed % 20),
      windKph: 5 + (seed % 25),
    });
  }
  return out;
}

export async function runWeather(input: WeatherInput, ctx: DecisionContext): Promise<WeatherOutput> {
  const t0 = Date.now();
  const requestId = capabilityRequestId("weather");
  const days =
    input.startDate && input.endDate
      ? Math.max(1, Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 86400000) + 1)
      : 7;

  const forecast = buildForecast(input.destination, days, input.units);
  const rainy = forecast.filter((f) => f.condition === "rain").length;
  const hot = forecast.some((f) => f.tempMax >= (input.units === "imperial" ? 90 : 32));
  const cold = forecast.some((f) => f.tempMin <= (input.units === "imperial" ? 32 : 0));

  const warnings: WeatherOutput["warnings"] = [];
  if (rainy > days / 2) warnings.push({ id: "w_rain", severity: "warn", message: "Frequent rain expected — pack waterproofs." });
  if (hot) warnings.push({ id: "w_heat", severity: "warn", message: "Peak heat expected — hydrate and seek shade midday." });
  if (cold) warnings.push({ id: "w_cold", severity: "warn", message: "Sub-freezing temperatures possible — pack thermal layers." });

  const packing = [
    ...(rainy > 0 ? ["Waterproof jacket", "Compact umbrella"] : []),
    ...(hot ? ["Sunscreen SPF 30+", "Refillable water bottle", "Sunglasses"] : []),
    ...(cold ? ["Thermal base layer", "Warm gloves and hat"] : []),
    "Comfortable walking shoes",
  ];

  const output: WeatherOutput = {
    meta: { requestId, capabilityId: "weather", latencyMs: Date.now() - t0, generatedAt: Date.now() },
    destination: input.destination,
    units: input.units,
    climateSummary: `Mixed conditions expected across ${days} day(s) in ${input.destination}.`,
    forecast,
    warnings,
    packingSuggestions: packing,
    activitySuitability: [
      { activity: "outdoor sightseeing", score: rainy > days / 2 ? 0.4 : 0.85, reason: rainy > days / 2 ? "Rain risk" : "Favorable weather" },
      { activity: "beach", score: hot && rainy === 0 ? 0.9 : 0.5, reason: hot ? "Warm weather" : "Cooler than ideal" },
      { activity: "museum", score: 0.9, reason: "Indoor — weather-independent" },
    ],
    risk: {
      overall: warnings.length >= 2 ? "high" : warnings.length === 1 ? "medium" : "low",
      factors: warnings.map((w) => w.id),
    },
  };

  emitCapabilityEvent({
    name: "WeatherAnalyzed",
    capability: "weather",
    requestId,
    timestamp: Date.now(),
    userId: ctx.userId,
    data: { destination: input.destination, days, warnings: warnings.length },
  });

  return output;
}

/**
 * DestinationIntelligence — insight aggregation for a destination.
 * Reads from the reference tables (destinations/cities/countries).
 * External sources (weather, safety) are behind pluggable providers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DestinationInsight, TIEResult } from "./types";
import { ok, fail } from "./types";

type SB = SupabaseClient<Database>;

export interface WeatherSnapshot {
  tempC: number;
  condition: string;
  forecastDays: Array<{ date: string; highC: number; lowC: number; condition: string }>;
}

export interface WeatherProvider {
  current(latLng: { lat: number; lng: number }): Promise<WeatherSnapshot>;
}

export interface SafetyProvider {
  score(countryCode: string): Promise<{ score: number; advisory?: string }>;
}

export class DestinationIntelligence {
  constructor(
    private readonly supabase: SB,
    private readonly weather?: WeatherProvider,
    private readonly safety?: SafetyProvider,
  ) {}

  async getInsight(destinationId: string): Promise<TIEResult<DestinationInsight>> {
    const { data, error } = await this.supabase
      .from("destinations")
      .select("id, name, summary, best_season, safety_score, city_id, country_code, cities(timezone, country_code), countries!destinations_country_code_fkey(currency_code, language_code, timezone)")
      .eq("id", destinationId)
      .maybeSingle();
    if (error) return fail("destination.read_failed", error.message, error);
    if (!data) return fail("destination.not_found", "Destination not found");

    const country = Array.isArray(data.countries) ? data.countries[0] : data.countries;
    const city = Array.isArray(data.cities) ? data.cities[0] : data.cities;

    const insight: DestinationInsight = {
      id: data.id,
      name: data.name,
      countryCode: (data.country_code ?? city?.country_code) ?? null,
      cityId: data.city_id,
      timezone: city?.timezone ?? country?.timezone ?? null,
      currency: country?.currency_code ?? null,
      language: country?.language_code ?? null,
      bestSeason: data.best_season,
      safetyScore: data.safety_score,
      summary: data.summary,
      tips: [],
    };
    return ok(insight);
  }

  async nearby(destinationId: string, limit = 8): Promise<TIEResult<Array<{ id: string; name: string; kind: string }>>> {
    const { data, error } = await this.supabase
      .from("places")
      .select("id, name, kind")
      .eq("destination_id", destinationId)
      .limit(limit);
    if (error) return fail("destination.nearby_failed", error.message);
    return ok(data ?? []);
  }
}

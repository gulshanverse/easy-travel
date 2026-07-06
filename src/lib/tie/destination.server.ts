/**
 * DestinationIntelligence — insight aggregation for a destination.
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
  score(countryIso2: string): Promise<{ score: number; advisory?: string }>;
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
      .select("id, name, description, tagline, best_months, avg_budget_usd, city_id, country_id")
      .eq("id", destinationId)
      .maybeSingle();
    if (error) return fail("destination.read_failed", error.message, error);
    if (!data) return fail("destination.not_found", "Destination not found");

    let timezone: string | null = null;
    if (data.city_id) {
      const { data: city } = await this.supabase
        .from("cities")
        .select("timezone")
        .eq("id", data.city_id)
        .maybeSingle();
      timezone = city?.timezone ?? null;
    }

    let countryCode: string | null = null;
    let currency: string | null = null;
    if (data.country_id) {
      const { data: country } = await this.supabase
        .from("countries")
        .select("iso2, currency")
        .eq("id", data.country_id)
        .maybeSingle();
      countryCode = country?.iso2 ?? null;
      currency = country?.currency ?? null;
    }

    return ok({
      id: data.id,
      name: data.name,
      countryCode,
      cityId: data.city_id,
      timezone,
      currency,
      language: null,
      bestMonths: data.best_months,
      avgBudgetUsd: data.avg_budget_usd,
      summary: data.description,
      tagline: data.tagline,
      tips: [],
    });
  }

  async nearby(destinationId: string, limit = 8): Promise<TIEResult<Array<{ id: string; name: string; kind: string }>>> {
    const { data: dest } = await this.supabase
      .from("destinations")
      .select("city_id")
      .eq("id", destinationId)
      .maybeSingle();
    if (!dest?.city_id) return ok([]);
    const { data, error } = await this.supabase
      .from("places")
      .select("id, name, kind")
      .eq("city_id", dest.city_id)
      .limit(limit);
    if (error) return fail("destination.nearby_failed", error.message);
    return ok((data ?? []).map((p) => ({ id: p.id, name: p.name, kind: p.kind as string })));
  }
}

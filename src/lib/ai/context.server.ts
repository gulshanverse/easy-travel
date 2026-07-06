/**
 * AI Core — Context Engine.
 * Builds a minimal, relevant context bundle for a request.
 */
import type { AIRequestContext } from "./types";

export interface UserContextBundle {
  now: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  profile?: {
    displayName: string | null;
    homeCity: string | null;
    homeCountry: string | null;
    locale: string | null;
    currency: string | null;
    timezone: string | null;
  };
  activeTrip?: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    currency: string | null;
    budgetCents: number | null;
    travelers: number | null;
  } | null;
  preferences?: Record<string, unknown>;
}

export async function buildUserContext(ctx: AIRequestContext): Promise<UserContextBundle> {
  const bundle: UserContextBundle = {
    now: new Date().toISOString(),
    locale: ctx.locale,
    timezone: ctx.timezone,
    currency: ctx.currency,
  };
  if (!ctx.userId) return bundle;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [profileRes, prefsRes, tripRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("display_name, home_city, home_country, locale, currency, timezone")
      .eq("id", ctx.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_preferences")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("trips")
      .select("id, title, start_date, end_date, currency, budget_total_cents, traveler_count")
      .eq("user_id", ctx.userId)
      .in("status", ["planning", "confirmed", "in_progress"])
      .order("start_date", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.data) {
    const p = profileRes.data;
    bundle.profile = {
      displayName: p.display_name ?? null,
      homeCity: p.home_city ?? null,
      homeCountry: p.home_country ?? null,
      locale: p.locale ?? null,
      currency: p.currency ?? null,
      timezone: p.timezone ?? null,
    };
  }
  if (prefsRes.data) bundle.preferences = prefsRes.data as unknown as Record<string, unknown>;
  if (tripRes.data) {
    const t = tripRes.data;
    bundle.activeTrip = {
      id: t.id,
      title: t.title,
      startDate: t.start_date ?? null,
      endDate: t.end_date ?? null,
      currency: t.currency ?? null,
      budgetCents: t.budget_total_cents ?? null,
      travelers: t.traveler_count ?? null,
    };
  }
  return bundle;
}

export function renderContext(bundle: UserContextBundle): string {
  const lines: string[] = [`Current time: ${bundle.now}`];
  const locale = bundle.locale ?? bundle.profile?.locale;
  const tz = bundle.timezone ?? bundle.profile?.timezone;
  const cur = bundle.currency ?? bundle.profile?.currency;
  if (locale) lines.push(`Locale: ${locale}`);
  if (tz) lines.push(`Timezone: ${tz}`);
  if (cur) lines.push(`Currency: ${cur}`);
  if (bundle.profile?.displayName) lines.push(`User: ${bundle.profile.displayName}`);
  if (bundle.profile?.homeCity || bundle.profile?.homeCountry) {
    lines.push(`Home: ${[bundle.profile.homeCity, bundle.profile.homeCountry].filter(Boolean).join(", ")}`);
  }
  if (bundle.activeTrip) {
    const t = bundle.activeTrip;
    const dates = t.startDate ? `${t.startDate}${t.endDate ? ` → ${t.endDate}` : ""}` : "";
    const budget = t.budgetCents ? ` budget ${(t.budgetCents / 100).toFixed(0)} ${t.currency ?? ""}` : "";
    lines.push(`Active trip: "${t.title}"${dates ? ` (${dates})` : ""}${budget}`);
  }
  return lines.join("\n");
}

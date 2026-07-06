/**
 * AI Core — Context Engine.
 * Builds a minimal, relevant context bundle for a request.
 * Never dumps whole tables — each source is bounded by budget.
 */
import type { AIRequestContext } from "./types";

export interface UserContextBundle {
  now: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  profile?: {
    displayName: string | null;
    country: string | null;
    preferredLanguage: string | null;
  };
  activeTrip?: {
    id: string;
    title: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
    budget: number | null;
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
      .select("display_name, country_code, preferred_language")
      .eq("id", ctx.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_preferences")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("trips")
      .select("id, title, destination, start_date, end_date, budget")
      .eq("user_id", ctx.userId)
      .in("status", ["planning", "active"])
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.data) {
    bundle.profile = {
      displayName: (profileRes.data as any).display_name ?? null,
      country: (profileRes.data as any).country_code ?? null,
      preferredLanguage: (profileRes.data as any).preferred_language ?? null,
    };
  }
  if (prefsRes.data) bundle.preferences = prefsRes.data as Record<string, unknown>;
  if (tripRes.data) {
    const t = tripRes.data as any;
    bundle.activeTrip = {
      id: t.id,
      title: t.title,
      destination: t.destination ?? null,
      startDate: t.start_date ?? null,
      endDate: t.end_date ?? null,
      budget: t.budget ?? null,
    };
  }
  return bundle;
}

/** Render the context bundle to a compact system-prompt-friendly string. */
export function renderContext(bundle: UserContextBundle): string {
  const lines: string[] = [`Current time: ${bundle.now}`];
  if (bundle.locale) lines.push(`Locale: ${bundle.locale}`);
  if (bundle.timezone) lines.push(`Timezone: ${bundle.timezone}`);
  if (bundle.currency) lines.push(`Currency: ${bundle.currency}`);
  if (bundle.profile?.displayName) lines.push(`User: ${bundle.profile.displayName}`);
  if (bundle.profile?.country) lines.push(`Country: ${bundle.profile.country}`);
  if (bundle.activeTrip) {
    const t = bundle.activeTrip;
    lines.push(
      `Active trip: "${t.title}"${t.destination ? ` → ${t.destination}` : ""}${
        t.startDate ? ` (${t.startDate}${t.endDate ? ` to ${t.endDate}` : ""})` : ""
      }${t.budget ? ` budget ${t.budget}` : ""}`,
    );
  }
  return lines.join("\n");
}

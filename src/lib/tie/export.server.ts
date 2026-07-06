/**
 * ExportService — PDF (JSON payload for server-side rendering later),
 * ICS calendar, share links, offline JSON package.
 * Binary formats are returned as base64 to survive the RPC boundary.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ExportFormat, ExportResult, TIEResult } from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;

export class ExportService {
  constructor(private readonly supabase: SB) {}

  async export(tripId: string, format: ExportFormat, baseUrl?: string): Promise<TIEResult<ExportResult>> {
    const pack = await this.buildOfflinePackage(tripId);
    if (!pack.ok) return pack;
    let result: ExportResult;
    switch (format) {
      case "json":
      case "offline":
        result = {
          format,
          contentType: "application/json",
          filename: `trip-${tripId}.json`,
          body: JSON.stringify(pack.data, null, 2),
          encoding: "utf8",
        };
        break;
      case "ics":
        result = {
          format,
          contentType: "text/calendar",
          filename: `trip-${tripId}.ics`,
          body: renderICS(pack.data),
          encoding: "utf8",
        };
        break;
      case "share-link":
        result = {
          format,
          contentType: "text/uri-list",
          filename: `trip-${tripId}.url`,
          body: `${baseUrl ?? ""}/trips/${tripId}`,
          encoding: "utf8",
          url: `${baseUrl ?? ""}/trips/${tripId}`,
        };
        break;
      case "pdf":
        // Placeholder: PDF renderer isn't wired up in the sandboxed worker.
        // Return the structured payload so a downstream rendering worker
        // (e.g. a Playwright/print job) can materialize a PDF.
        result = {
          format,
          contentType: "application/json",
          filename: `trip-${tripId}.pdf.json`,
          body: JSON.stringify(pack.data),
          encoding: "utf8",
        };
        break;
      default:
        return fail("export.unsupported", `Unsupported format: ${format}`);
    }
    emitTIEEvent({ name: "EXPORT_CREATED", tripId, userId: null, data: { format } });
    return ok(result);
  }

  private async buildOfflinePackage(tripId: string): Promise<TIEResult<OfflinePackage>> {
    const [trip, days, acts] = await Promise.all([
      this.supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
      this.supabase.from("trip_days").select("*").eq("trip_id", tripId).order("day_index"),
      this.supabase.from("trip_activities").select("*").eq("trip_id", tripId).order("position"),
    ]);
    if (trip.error || !trip.data) return fail("export.trip_missing", trip.error?.message ?? "Trip not found");
    return ok({
      generatedAt: new Date().toISOString(),
      trip: trip.data,
      days: days.data ?? [],
      activities: acts.data ?? [],
    });
  }
}

interface OfflinePackage {
  generatedAt: string;
  trip: Database["public"]["Tables"]["trips"]["Row"];
  days: Database["public"]["Tables"]["trip_days"]["Row"][];
  activities: Database["public"]["Tables"]["trip_activities"]["Row"][];
}

function renderICS(pkg: OfflinePackage): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EasyTrip//TIE//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICS(pkg.trip.title)}`,
  ];
  for (const a of pkg.activities) {
    if (!a.starts_at) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${a.id}@easytrip.app`);
    lines.push(`DTSTAMP:${formatICSDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${formatICSDate(a.starts_at)}`);
    if (a.ends_at) lines.push(`DTEND:${formatICSDate(a.ends_at)}`);
    lines.push(`SUMMARY:${escapeICS(a.title)}`);
    if (a.description) lines.push(`DESCRIPTION:${escapeICS(a.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function formatICSDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Provider Gateway (P-1.4) — response normalization (ADR-034).
 *
 *  Raw provider payloads MUST NOT escape this module. Every response is
 *  sanitized and mapped into a canonical, provider-independent envelope
 *  before any domain runtime (Journey, Decision, Goal, Agent, Studio,
 *  Workflow, UI) can observe it.
 */
import { ProviderSchemaMismatchError } from "./errors";
import { sanitizeResponse } from "./security";
import type { ProviderCategory } from "./types";

export interface NormalizedEnvelope<T = unknown> {
  readonly kind: ProviderCategory;
  readonly schema: string;
  readonly items: readonly T[];
  readonly attributes: Readonly<Record<string, unknown>>;
}

export type Normalizer<TRaw = unknown, TOut = unknown> = (
  raw: TRaw,
) => NormalizedEnvelope<TOut>;

function asArray(value: unknown, field: string, schema: string): readonly unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value))
    throw new ProviderSchemaMismatchError(`${schema}: field '${field}' must be an array`);
  return value;
}

function obj(raw: unknown, schema: string): Record<string, unknown> {
  if (raw === null || typeof raw !== "object")
    throw new ProviderSchemaMismatchError(`${schema}: response must be an object`);
  return raw as Record<string, unknown>;
}

function envelope<T>(
  kind: ProviderCategory,
  schema: string,
  items: readonly unknown[],
  attributes: Record<string, unknown> = {},
): NormalizedEnvelope<T> {
  return Object.freeze({
    kind,
    schema,
    items: Object.freeze(sanitizeResponse(items) as readonly T[]),
    attributes: Object.freeze(sanitizeResponse(attributes) as Record<string, unknown>),
  });
}

/* Canonical normalizers — one per supported travel category. -------- */

export const normalizeRailway: Normalizer = (raw) => {
  const r = obj(raw, "railway.v1");
  return envelope("RAILWAY", "railway.v1", asArray(r["results"], "results", "railway.v1"), {
    query: r["query"] ?? null,
  });
};

export const normalizeFlight: Normalizer = (raw) => {
  const r = obj(raw, "flight.v1");
  return envelope("FLIGHT", "flight.v1", asArray(r["results"], "results", "flight.v1"), {
    query: r["query"] ?? null,
  });
};

export const normalizeHotel: Normalizer = (raw) => {
  const r = obj(raw, "hotel.v1");
  return envelope("HOTEL", "hotel.v1", asArray(r["results"], "results", "hotel.v1"), {
    query: r["query"] ?? null,
  });
};

export const normalizeMaps: Normalizer = (raw) => {
  const r = obj(raw, "maps.v1");
  return envelope("MAPS", "maps.v1", asArray(r["results"], "results", "maps.v1"), {
    query: r["query"] ?? null,
  });
};

export const normalizeWeather: Normalizer = (raw) => {
  const r = obj(raw, "weather.v1");
  return envelope("WEATHER", "weather.v1", asArray(r["results"], "results", "weather.v1"), {
    location: r["location"] ?? null,
  });
};

export const normalizeCurrency: Normalizer = (raw) => {
  const r = obj(raw, "currency.v1");
  return envelope("CURRENCY", "currency.v1", asArray(r["results"], "results", "currency.v1"), {
    base: r["base"] ?? null,
  });
};

export const normalizeTimezone: Normalizer = (raw) => {
  const r = obj(raw, "timezone.v1");
  return envelope("TIMEZONE", "timezone.v1", asArray(r["results"], "results", "timezone.v1"), {
    reference: r["reference"] ?? null,
  });
};

export const normalizeTransit: Normalizer = (raw) => {
  const r = obj(raw, "transit.v1");
  return envelope("TRANSIT", "transit.v1", asArray(r["results"], "results", "transit.v1"), {
    query: r["query"] ?? null,
  });
};

export const normalizeGeneral: Normalizer = (raw) => {
  const r = obj(raw, "general.v1");
  return envelope("GENERAL", "general.v1", asArray(r["results"], "results", "general.v1"), {});
};

export const CATEGORY_NORMALIZERS: Readonly<Record<ProviderCategory, Normalizer>> = Object.freeze({
  RAILWAY: normalizeRailway,
  FLIGHT: normalizeFlight,
  HOTEL: normalizeHotel,
  MAPS: normalizeMaps,
  WEATHER: normalizeWeather,
  CURRENCY: normalizeCurrency,
  TIMEZONE: normalizeTimezone,
  TRANSIT: normalizeTransit,
  PAYMENT: normalizeGeneral, // contract only in P-1.4 — no processing
  NOTIFICATION: normalizeGeneral,
  GENERAL: normalizeGeneral,
});

export class NormalizationRegistry {
  private overrides = new Map<string, Normalizer>();

  register(capabilityId: string, normalizer: Normalizer): void {
    this.overrides.set(capabilityId, normalizer);
  }

  resolve(category: ProviderCategory, capabilityId: string): Normalizer {
    return this.overrides.get(capabilityId) ?? CATEGORY_NORMALIZERS[category] ?? normalizeGeneral;
  }

  normalize(category: ProviderCategory, capabilityId: string, raw: unknown): NormalizedEnvelope {
    return this.resolve(category, capabilityId)(raw);
  }

  clear(): void {
    this.overrides.clear();
  }
}

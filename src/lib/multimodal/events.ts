/** MTIP — typed, deterministic domain events. */
import { newTravelEventId } from "./ids";
import type { TravelMode } from "./contracts";

export type MultiModalEventName =
  | "FlightUpdated" | "WeatherChanged" | "HotelPriceChanged" | "TransitUpdated"
  | "CurrencyUpdated" | "TimezoneResolved" | "TravelSegmentUpdated";

export interface MultiModalEvent {
  readonly id: string;
  readonly name: MultiModalEventName;
  readonly mode: TravelMode;
  readonly at: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export type MultiModalEventListener = (event: MultiModalEvent) => void;

export class MultiModalEventBus {
  private readonly listeners = new Set<MultiModalEventListener>();
  private readonly history: MultiModalEvent[] = [];
  private limit: number;
  constructor(limit = 1000) { this.limit = limit; }

  on(listener: MultiModalEventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  publish(input: {
    name: MultiModalEventName; mode: TravelMode;
    data?: Record<string, unknown>; correlationId?: string; causationId?: string;
  }): MultiModalEvent {
    const event: MultiModalEvent = Object.freeze({
      id: newTravelEventId(),
      name: input.name,
      mode: input.mode,
      at: Date.now(),
      correlationId: input.correlationId,
      causationId: input.causationId,
      data: Object.freeze({ ...(input.data ?? {}) }),
    });
    this.history.push(event);
    if (this.history.length > this.limit) this.history.shift();
    for (const l of this.listeners) l(event);
    return event;
  }

  recent(name?: MultiModalEventName): readonly MultiModalEvent[] {
    return name ? this.history.filter((e) => e.name === name) : [...this.history];
  }
  clear(): void { this.history.length = 0; this.listeners.clear(); }
}

const EVENT_BY_MODE: Readonly<Record<TravelMode, MultiModalEventName>> = Object.freeze({
  flight: "FlightUpdated",
  weather: "WeatherChanged",
  hotel: "HotelPriceChanged",
  transit: "TransitUpdated",
  currency: "CurrencyUpdated",
  timezone: "TimezoneResolved",
  maps: "TravelSegmentUpdated",
});

export function eventNameForMode(mode: TravelMode): MultiModalEventName { return EVENT_BY_MODE[mode]; }

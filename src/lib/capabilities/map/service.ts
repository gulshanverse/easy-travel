/**
 * MAP SERVICE — provider-independent stubs. Deterministic haversine + fake
 * polylines so downstream code can build against a stable contract.
 */
import type { DecisionContext } from "@/lib/tios/types";
import { capabilityRequestId, emitCapabilityEvent } from "../events";
import type { LatLng, MapInput, MapOutput, MapPin } from "./types";

const R = 6_371_000;
function haversine(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const MODE_KPH: Record<NonNullable<MapInput["mode"]>, number> = {
  walking: 5, driving: 40, transit: 25, cycling: 15,
};

export async function runMap(input: MapInput, ctx: DecisionContext): Promise<MapOutput> {
  const t0 = Date.now();
  const requestId = capabilityRequestId("maps");
  const meta = { requestId, capabilityId: "maps", latencyMs: 0, generatedAt: Date.now() };

  const output: MapOutput = { meta, operation: input.operation };

  switch (input.operation) {
    case "distance":
    case "travel-time":
    case "route": {
      if (!input.origin || !input.destination) break;
      const dist = haversine(input.origin, input.destination);
      const secs = (dist / 1000 / MODE_KPH[input.mode]) * 3600;
      output.distanceMeters = Math.round(dist);
      output.travelTimeSeconds = Math.round(secs);
      if (input.operation === "route") {
        const steps = 8;
        const polyline: LatLng[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          polyline.push({
            lat: input.origin.lat + (input.destination.lat - input.origin.lat) * t,
            lng: input.origin.lng + (input.destination.lng - input.origin.lng) * t,
          });
        }
        output.route = { polyline, distanceMeters: Math.round(dist), durationSeconds: Math.round(secs), mode: input.mode };
      }
      break;
    }
    case "nearby": {
      const origin = input.origin ?? { lat: 0, lng: 0 };
      const pins: MapPin[] = Array.from({ length: 5 }).map((_, i) => ({
        id: `pin_${i}`,
        label: `${input.query ?? "Place"} #${i + 1}`,
        coord: { lat: origin.lat + i * 0.001, lng: origin.lng + i * 0.001 },
        category: input.query ?? "poi",
      }));
      output.pins = pins;
      break;
    }
    case "pins":
    case "saved-places": {
      output.pins = [];
      break;
    }
    case "heatmap": {
      const origin = input.origin ?? { lat: 0, lng: 0 };
      output.heatmap = Array.from({ length: 12 }).map((_, i) => ({
        coord: { lat: origin.lat + (i % 4) * 0.002, lng: origin.lng + Math.floor(i / 4) * 0.002 },
        intensity: 0.3 + ((i * 7) % 60) / 100,
      }));
      break;
    }
  }

  output.meta.latencyMs = Date.now() - t0;

  emitCapabilityEvent({
    name: "MapResolved",
    capability: "maps",
    requestId,
    timestamp: Date.now(),
    userId: ctx.userId,
    data: { operation: input.operation },
  });

  return output;
}

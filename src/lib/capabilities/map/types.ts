/**
 * MAP CAPABILITY — provider-independent interfaces + types.
 */
import { z } from "zod";
import { CapabilityMetaSchema } from "../types";

export const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });
export type LatLng = z.infer<typeof LatLngSchema>;

export const MapOperationSchema = z.enum([
  "route", "nearby", "distance", "travel-time", "pins", "saved-places", "heatmap",
]);
export type MapOperation = z.infer<typeof MapOperationSchema>;

export const MapInputSchema = z.object({
  operation: MapOperationSchema,
  origin: LatLngSchema.optional(),
  destination: LatLngSchema.optional(),
  query: z.string().optional(),
  radiusMeters: z.number().positive().optional(),
  mode: z.enum(["walking", "driving", "transit", "cycling"]).default("walking"),
  waypoints: z.array(LatLngSchema).optional(),
});
export type MapInput = z.infer<typeof MapInputSchema>;

export const MapPinSchema = z.object({
  id: z.string(),
  label: z.string(),
  coord: LatLngSchema,
  category: z.string().optional(),
});
export type MapPin = z.infer<typeof MapPinSchema>;

export const MapOutputSchema = z.object({
  meta: CapabilityMetaSchema,
  operation: MapOperationSchema,
  route: z.object({
    polyline: z.array(LatLngSchema),
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
    mode: z.enum(["walking", "driving", "transit", "cycling"]),
  }).optional(),
  pins: z.array(MapPinSchema).optional(),
  distanceMeters: z.number().nonnegative().optional(),
  travelTimeSeconds: z.number().nonnegative().optional(),
  heatmap: z.array(z.object({ coord: LatLngSchema, intensity: z.number().min(0).max(1) })).optional(),
});
export type MapOutput = z.infer<typeof MapOutputSchema>;

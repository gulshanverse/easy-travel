/** Multi-Modal Travel Intelligence Platform (MTIP) — public API surface.
 *  Consumers MUST import only from "@/lib/multimodal".
 */
export * from "./ids";
export * from "./errors";
export * from "./contracts";
export * from "./models";
export * from "./normalization";
export * from "./events";
export * from "./metrics";
export * from "./telemetry";
export * from "./runtime";
export * from "./ctor";
export * from "./workflows";
export * from "./presentation";
export * from "./manifest";

export * from "./providers/types";
export * from "./providers/mock-providers";
export {
  mockTravelDataset,
  haversineKm,
  seededUnit,
  seededCondition,
  MOCK_AIRPORT_COUNT,
  MOCK_FLIGHT_COUNT,
  MOCK_HOTEL_COUNT,
  MOCK_PLACE_COUNT,
} from "./providers/mock-data";

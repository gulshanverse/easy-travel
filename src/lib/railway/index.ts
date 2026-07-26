/** Railway Intelligence Connector Suite (RICS) — public API surface.
 *  Consumers MUST import only from "@/lib/railway".
 */
export * from "./ids";
export * from "./errors";
export * from "./models";
export * from "./contracts";
export * from "./normalization";
export * from "./metrics";
export * from "./telemetry";
export * from "./runtime";
export * from "./manifest";
export * from "./providers/types";
export * from "./providers/mock-provider";
export * from "./providers/stubs";
export { mockDataset, MOCK_STATION_COUNT, MOCK_TRAIN_COUNT } from "./providers/mock-data";

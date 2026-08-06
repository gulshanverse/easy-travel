/**
 * Persistence Platform (Phase P-1.1) — public surface.
 * The only sanctioned entry point for persistence. Engines depend on ports
 * and repositories exported here, never on drivers.
 */
export * from "./errors";
export * from "./config";
export * from "./telemetry";
export * from "./collections";
export * from "./database";
export * from "./repository";
export * from "./cache";
export * from "./storage";
export * from "./migrations";
export * from "./adapters";
export * from "./stores";
export * from "./runtime";

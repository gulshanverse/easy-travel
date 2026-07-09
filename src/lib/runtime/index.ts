/**
 * Runtime Core — Public surface (Sprint I-003).
 *
 * This module is the ONLY sanctioned entry point for the runtime kernel,
 * dependency injection container, event bus, capability runtime, service
 * registry, context builder, and observability primitives. Runtime
 * internals must not be imported directly.
 */
export * from "./errors";
export * from "./ids";
export * from "./config";
export * from "./telemetry";
export * from "./metrics";
export * from "./context";
export * from "./ports";
export * from "./event-bus";
export * from "./container";
export * from "./service-registry";
export * from "./context-builder";
export * from "./capability-runtime";
export * from "./health";
export * from "./kernel";

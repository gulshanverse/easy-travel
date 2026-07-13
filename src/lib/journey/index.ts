/**
 * Journey Intelligence Engine — Public API surface (Sprint I-006).
 *
 * This module is the ONLY sanctioned entry point for the Journey Runtime.
 * Downstream capabilities (Recommendation, Trust, Goal Intelligence,
 * Spatial Intelligence, AI Agents) MUST consume this facade — never the
 * internal modules.
 *
 * Provider-independent. Persistence-independent. Deterministic behaviour.
 * Interacts with Memory, Prompt, Graph, Provider, and Runtime Kernel
 * exclusively through the ports declared in `./ports`.
 */

export * from "./types";
export * from "./errors";
export * from "./config";
export * from "./ids";
export * from "./events";
export * from "./telemetry";
export * from "./factories";
export * from "./state-machine";
export * from "./validation";
export * from "./intent";
export * from "./constraint";
export * from "./timeline";
export * from "./context";
export * from "./manager";
export * from "./registry";
export * from "./factory";
export * from "./health";
export * from "./runtime";
export * from "./ports";

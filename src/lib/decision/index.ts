/**
 * Travel Decision Intelligence Engine — Public API surface (Sprint I-007).
 *
 * This module is the ONLY sanctioned entry point for the Decision Runtime.
 * Downstream capabilities MUST consume this facade — never internal modules.
 *
 * Provider-independent. Persistence-independent. Deterministic behaviour.
 * Consumes Memory, Graph, Journey, Prompt and Provider runtimes ONLY through
 * the ports declared in `./ports`.
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
export * from "./generator";
export * from "./scoring";
export * from "./constraints";
export * from "./ranking";
export * from "./tradeoff";
export * from "./explanation";
export * from "./context-assembler";
export * from "./manager";
export * from "./registry";
export * from "./factory";
export * from "./health";
export * from "./manifest";
export * from "./runtime";
export * from "./ports";

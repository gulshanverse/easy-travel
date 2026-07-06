/**
 * TIOS — Travel Intelligence Operating System (Milestone 5.1)
 * ------------------------------------------------------------
 * Central coordination layer between UI/TIE and AI Core / providers.
 *
 * Public surface (all isomorphic-safe):
 *   • Capability Registry     — registerCapability, listCapabilities
 *   • Policy Engine           — registerPolicy, evaluatePolicies
 *   • Context Graph           — ContextGraph, buildGraph
 *   • Knowledge Interfaces    — registerKnowledgeProvider, queryKnowledge
 *   • Recommendation Pipeline — runRecommendationPipeline
 *   • Decision Engine         — decide
 *   • Orchestration           — runWorkflow, step
 *   • Provider Abstraction    — registerProvider, callCapabilityProvider
 *   • Feature Flags           — getFlag, setFlag
 *   • Explainability          — explainRecommendation, explanationToMarkdown
 *   • Observability           — readMetricsSnapshot
 *   • Event Bus               — onTIOSEvent, emitTIOSEvent
 *
 * Backward compatibility: TIOS is additive. It does not modify existing
 * TIE, AI Core, or route APIs.
 */
export * from "./types";
export * from "./events";
export * from "./flags";
export * from "./registry";
export * from "./policy";
export * from "./context-graph";
export * from "./knowledge";
export * from "./recommendation";
export * from "./decision-engine";
export * from "./orchestrator";
export * from "./providers";
export * from "./explainability";
export * from "./observability";

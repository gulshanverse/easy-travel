/** JSR — engine contract & capability manifest. */
export const JOURNEY_STUDIO_ENGINE_CONTRACT = Object.freeze({
  id: "studio.runtime",
  name: "Journey Studio Runtime",
  version: "1.0.0",
  ownership: {
    owns: [
      "planning-sessions", "workspace-state", "cards", "timeline",
      "plan-versions", "drafts", "collaboration-model", "user-actions",
      "timeline-editing", "session-history", "presentation-models",
    ],
    doesNotOwn: [
      "business-logic", "memory", "decision-logic", "journey-logic", "trust",
      "goal", "spatial", "capability-execution", "provider-apis",
      "llm-reasoning", "ui-rendering", "networking", "persistence",
      "authentication", "booking", "payments", "streaming", "voice",
    ],
  },
  dependencies: {
    frozenEngines: ["agent.runtime"],
    ports: ["StudioAgentPort"],
  },
  consumedEvents: ["ResponseAssembled"],
  publishedEvents: [
    "SessionCreated", "SessionUpdated", "SessionArchived", "SessionEnded", "SessionExpired",
    "WorkspaceCreated", "WorkspaceUpdated",
    "CardAdded", "CardRemoved", "CardUpdated", "CardsMerged", "CardSplit",
    "TimelineUpdated", "TimelineCheckpointCreated", "TimelineCheckpointRestored",
    "RevisionCreated", "RevisionRestored", "VersionPromoted",
    "DraftCreated", "DraftPromoted", "DraftDiscarded",
    "ParticipantJoined", "ParticipantLeft",
    "SessionLocked", "SessionUnlocked",
    "ConflictDetected", "PresentationApplied",
  ],
  publicApis: [
    "createJourneyStudioRuntime", "JourneyStudioRuntime", "JourneyStudioFacade",
    "JourneyStudioManager", "JourneyStudioRegistry",
    "PresentationEngine", "TimelineEngine", "WorkspaceEngine",
    "SessionEngine", "EditingEngine", "CollaborationEngine",
    "makeCard", "makeWorkspace", "makePlanningSession", "makeParticipant",
  ],
  ports: ["StudioAgentPort"],
  extensionPoints: ["StudioAgentPort", "StudioTelemetrySink", "StudioPolicies"],
  adr: ["ADR-006", "ADR-007"],
});

export const JOURNEY_STUDIO_CAPABILITY_MANIFEST = Object.freeze({
  id: "studio.runtime.capability.manifest",
  version: "1.0.0",
  supportedCardKinds: [
    "destination", "journey", "decision", "trust", "goal",
    "budget", "timeline", "warning", "recommendation", "insight",
  ],
  workspaceLayouts: ["columns", "board", "timeline", "map"],
  editingOperations: [
    "insert-card", "delete-card", "move-card", "merge-cards", "split-cards",
    "insert-timeline-item", "reorder-timeline", "checkpoint-timeline",
    "restore-timeline-checkpoint", "rollback-revision", "promote-draft",
    "promote-version",
  ],
  collaboration: [
    "multi-participant", "owner-editor-observer-roles", "session-locks",
    "revision-numbers", "conflict-detection",
  ],
  versioning: [
    "revisions", "versions", "checkpoints", "drafts", "snapshots", "history",
  ],
  presentation: [
    "agent-response-transformation", "card-extraction", "timeline-derivation",
  ],
  extensionHooks: ["StudioAgentPort", "StudioTelemetrySink", "StudioPolicies"],
  futureIntegrations: [
    "collaborative-crdt", "session-persistence", "shareable-links",
    "presenter-view", "multi-workspace-sessions",
  ],
});

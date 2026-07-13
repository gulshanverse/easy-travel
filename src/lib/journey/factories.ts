/**
 * Journey domain factories — pure, deterministic, immutable output.
 * The manager is the only sanctioned mutator; these factories are the only
 * sanctioned constructors.
 */

import {
  newConstraintId,
  newIntentId,
  newJourneyId,
  newSnapshotId,
  newStageId,
  newTimelineId,
} from "./ids";
import type {
  BudgetProfile,
  Destination,
  Journey,
  JourneyIntent,
  JourneyMetadata,
  JourneySnapshot,
  JourneyStage,
  JourneyState,
  IntentKind,
  RiskProfile,
  Timeline,
  TimelineMilestone,
  TravelConstraint,
  TravelGroup,
  TravelPreference,
  TravelWindow,
  Waypoint,
  ConstraintKind,
  ConstraintSeverity,
  TimelinePhase,
} from "./types";

const iso = (): string => new Date().toISOString();

export function createJourney(input: {
  ownerId: string;
  namespace: string;
  title: string;
  summary?: string;
  window?: TravelWindow;
  destinations?: readonly Destination[];
  group?: TravelGroup;
  budget?: BudgetProfile;
  risk?: RiskProfile;
  metadata?: Partial<JourneyMetadata>;
}): Journey {
  const now = iso();
  const stage: JourneyStage = {
    id: newStageId(),
    name: "created",
    state: "created",
    enteredAt: now,
  };
  const meta: JourneyMetadata = {
    tags: input.metadata?.tags ? [...input.metadata.tags] : [],
    attributes: Object.freeze({ ...(input.metadata?.attributes ?? {}) }),
  };
  return Object.freeze({
    id: newJourneyId(),
    ownerId: input.ownerId,
    namespace: input.namespace,
    title: input.title,
    summary: input.summary,
    state: "created" as JourneyState,
    version: 1,
    createdAt: now,
    updatedAt: now,
    window: input.window,
    group: input.group,
    destinations: Object.freeze([...(input.destinations ?? [])]),
    waypoints: Object.freeze([] as Waypoint[]),
    constraints: Object.freeze([] as TravelConstraint[]),
    preferences: Object.freeze([] as TravelPreference[]),
    budget: input.budget,
    risk: input.risk,
    stages: Object.freeze([stage]),
    intents: Object.freeze([] as JourneyIntent[]),
    timeline: undefined,
    metadata: meta,
  }) as Journey;
}

export function createStage(name: string, state: JourneyState, notes?: readonly string[]): JourneyStage {
  return Object.freeze({
    id: newStageId(),
    name,
    state,
    enteredAt: iso(),
    notes: notes ? Object.freeze([...notes]) : undefined,
  });
}

export function createConstraint(input: {
  kind: ConstraintKind;
  severity: ConstraintSeverity;
  description: string;
  rank?: number;
  params?: Record<string, unknown>;
}): TravelConstraint {
  return Object.freeze({
    id: newConstraintId(),
    kind: input.kind,
    severity: input.severity,
    description: input.description,
    rank: input.rank ?? 0,
    params: Object.freeze({ ...(input.params ?? {}) }),
    createdAt: iso(),
  });
}

export function createIntent(input: {
  kind: IntentKind;
  text: string;
  confidence: number;
  rank?: number;
  signals?: Record<string, unknown>;
}): JourneyIntent {
  return Object.freeze({
    id: newIntentId(),
    kind: input.kind,
    text: input.text,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    rank: input.rank ?? 0,
    detectedAt: iso(),
    signals: Object.freeze({ ...(input.signals ?? {}) }),
  });
}

export function createMilestone(input: {
  at: string;
  label: string;
  phase: TimelinePhase;
  required?: boolean;
  dependsOn?: readonly string[];
  bufferMin?: number;
}): TimelineMilestone {
  return Object.freeze({
    id: newStageId(),
    at: input.at,
    label: input.label,
    phase: input.phase,
    required: input.required ?? false,
    dependsOn: input.dependsOn ? Object.freeze([...input.dependsOn]) : undefined,
    bufferMin: input.bufferMin,
  });
}

export function createTimeline(input: {
  window: TravelWindow;
  milestones?: readonly TimelineMilestone[];
  deadlines?: readonly TimelineMilestone[];
}): Timeline {
  return Object.freeze({
    id: newTimelineId(),
    window: input.window,
    milestones: Object.freeze([...(input.milestones ?? [])]),
    deadlines: Object.freeze([...(input.deadlines ?? [])]),
    createdAt: iso(),
  });
}

export function captureSnapshot(journey: Journey, reason: string): JourneySnapshot {
  return Object.freeze({
    id: newSnapshotId(),
    journeyId: journey.id,
    version: journey.version,
    capturedAt: iso(),
    reason,
    journey,
  });
}

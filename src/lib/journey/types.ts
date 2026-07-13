/**
 * Journey Intelligence Engine — Domain model.
 * All entities are immutable value types. Mutations produce a new value with
 * a bumped version + a snapshot; the manager owns the transitions.
 *
 * These types are intentionally provider-agnostic and persistence-agnostic.
 */

// ---------- State machine ----------
export const JOURNEY_STATES = [
  "created",
  "exploring",
  "planning",
  "draft",
  "review",
  "confirmed",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type JourneyState = (typeof JOURNEY_STATES)[number];

// ---------- Sub-entities ----------
export interface Traveller {
  readonly id: string;
  readonly displayName: string;
  readonly age?: number;
  readonly accessibility?: readonly string[];
  readonly preferences?: Readonly<Record<string, unknown>>;
}

export interface TravelGroup {
  readonly id: string;
  readonly primaryTravellerId: string;
  readonly members: readonly Traveller[];
  readonly relationships?: Readonly<Record<string, string>>;
}

export interface Destination {
  readonly id: string;
  readonly name: string;
  readonly countryCode?: string;
  readonly region?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly tags?: readonly string[];
}

export interface Waypoint {
  readonly id: string;
  readonly destination: Destination;
  readonly arrival?: string;   // ISO
  readonly departure?: string; // ISO
  readonly durationMin?: number;
  readonly order: number;
}

export interface TravelWindow {
  readonly earliestStart: string; // ISO
  readonly latestEnd: string;     // ISO
  readonly flexibilityDays?: number;
}

export type ConstraintKind =
  | "budget"
  | "date"
  | "group"
  | "visa"
  | "weather"
  | "transport"
  | "accessibility"
  | "personal"
  | "policy";

export type ConstraintSeverity = "hard" | "soft" | "advisory";

export interface TravelConstraint {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly severity: ConstraintSeverity;
  readonly description: string;
  readonly rank: number; // higher = more important
  readonly params: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface TravelPreference {
  readonly key: string;
  readonly value: unknown;
  readonly weight: number; // 0..1
}

export interface BudgetProfile {
  readonly currency: string;
  readonly totalMinor: number;
  readonly perDayMinor?: number;
  readonly allocations?: Readonly<Record<string, number>>; // category → minor
  readonly hardCap: boolean;
}

export interface RiskProfile {
  readonly appetite: "low" | "medium" | "high";
  readonly notes?: readonly string[];
}

// ---------- Timeline ----------
export type TimelinePhase =
  | "inspiration"
  | "research"
  | "planning"
  | "booking"
  | "pre-trip"
  | "in-trip"
  | "post-trip";

export interface TimelineMilestone {
  readonly id: string;
  readonly at: string; // ISO
  readonly label: string;
  readonly phase: TimelinePhase;
  readonly required: boolean;
  readonly dependsOn?: readonly string[];
  readonly bufferMin?: number;
}

export interface Timeline {
  readonly id: string;
  readonly window: TravelWindow;
  readonly milestones: readonly TimelineMilestone[];
  readonly deadlines: readonly TimelineMilestone[];
  readonly createdAt: string;
}

// ---------- Intent ----------
export type IntentKind =
  | "explore"
  | "plan"
  | "book"
  | "modify"
  | "cancel"
  | "compare"
  | "confirm"
  | "recall"
  | "advise";

export interface JourneyIntent {
  readonly id: string;
  readonly kind: IntentKind;
  readonly text: string;
  readonly confidence: number; // 0..1
  readonly rank: number;
  readonly detectedAt: string;
  readonly signals: Readonly<Record<string, unknown>>;
}

// ---------- Stages ----------
export interface JourneyStage {
  readonly id: string;
  readonly name: string;
  readonly state: JourneyState;
  readonly enteredAt: string;
  readonly exitedAt?: string;
  readonly notes?: readonly string[];
}

// ---------- Journey aggregate ----------
export interface JourneyMetadata {
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface Journey {
  readonly id: string;
  readonly ownerId: string;
  readonly namespace: string;
  readonly title: string;
  readonly summary?: string;
  readonly state: JourneyState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly window?: TravelWindow;
  readonly group?: TravelGroup;
  readonly destinations: readonly Destination[];
  readonly waypoints: readonly Waypoint[];
  readonly constraints: readonly TravelConstraint[];
  readonly preferences: readonly TravelPreference[];
  readonly budget?: BudgetProfile;
  readonly risk?: RiskProfile;
  readonly stages: readonly JourneyStage[];
  readonly intents: readonly JourneyIntent[];
  readonly timeline?: Timeline;
  readonly metadata: JourneyMetadata;
}

export interface JourneySnapshot {
  readonly id: string;
  readonly journeyId: string;
  readonly version: number;
  readonly capturedAt: string;
  readonly reason: string;
  readonly journey: Journey;
}

// ---------- Execution context (I/O of the Context Engine) ----------
export interface JourneyExecutionContext {
  readonly id: string;
  readonly journeyId: string;
  readonly ownerId: string;
  readonly namespace: string;
  readonly correlationId: string;
  readonly builtAt: string;
  readonly journey: Journey;
  readonly memory: readonly JourneyMemoryItem[];
  readonly graph: JourneyGraphView;
  readonly intent: JourneyIntent | null;
  readonly activeConstraints: readonly TravelConstraint[];
  readonly stats: JourneyContextStats;
}

export interface JourneyMemoryItem {
  readonly id: string;
  readonly kind: string;
  readonly content: string;
  readonly score?: number;
}

export interface JourneyGraphView {
  readonly rootNodeIds: readonly string[];
  readonly neighborsById: Readonly<Record<string, readonly string[]>>;
  readonly expandedCount: number;
}

export interface JourneyContextStats {
  readonly memoryItems: number;
  readonly graphExpansions: number;
  readonly assemblyMs: number;
  readonly truncated: boolean;
}

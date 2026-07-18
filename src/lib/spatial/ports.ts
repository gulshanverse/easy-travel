/**
 * Spatial Intelligence Engine — external subsystem ports.
 * The Spatial Engine orchestrates through these shapes ONLY.
 * Composition roots wire concrete adapters. No implementation imports.
 */
import type { Place } from "./types";

export interface SpatialMemoryPort {
  fetchPlaceHints(input: { readonly ownerId: string; readonly query?: string; readonly limit?: number }): Promise<readonly Place[]>;
  healthy(): Promise<boolean>;
}

export interface SpatialJourneyPort {
  placesForJourney(journeyId: string): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface SpatialDecisionPort {
  placesForDecision(decisionId: string): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface SpatialGoalPort {
  placesForGoal(goalId: string): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface SpatialTrustPort {
  trustFor(subject: string): Promise<{ readonly value: number; readonly level: string }>;
  healthy(): Promise<boolean>;
}

export interface SpatialGraphPort {
  linkPlace(placeId: string, nodeId: string): Promise<void>;
  healthy(): Promise<boolean>;
}

export interface SpatialPromptPort {
  registeredPromptCount(): number;
  healthy(): Promise<boolean>;
}

export interface SpatialProviderPort {
  registeredProviderCount(): number;
  healthy(): Promise<boolean>;
}

export interface SpatialKernelPort {
  now(): number;
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
}

/** Persistence hook contract (future adapters — PostGIS, tiles, etc.). */
export interface SpatialPersistencePort {
  savePlace(p: Place): Promise<void>;
  loadPlace(id: string): Promise<Place | null>;
  healthy(): Promise<boolean>;
}

/* --- Test doubles --- */
export const noopSpatialMemoryPort: SpatialMemoryPort = {
  async fetchPlaceHints() { return []; }, async healthy() { return true; },
};
export const noopSpatialJourneyPort: SpatialJourneyPort = {
  async placesForJourney() { return []; }, async healthy() { return true; },
};
export const noopSpatialDecisionPort: SpatialDecisionPort = {
  async placesForDecision() { return []; }, async healthy() { return true; },
};
export const noopSpatialGoalPort: SpatialGoalPort = {
  async placesForGoal() { return []; }, async healthy() { return true; },
};
export const noopSpatialTrustPort: SpatialTrustPort = {
  async trustFor() { return { value: 0.5, level: "medium" }; }, async healthy() { return true; },
};
export const noopSpatialGraphPort: SpatialGraphPort = {
  async linkPlace() { /* noop */ }, async healthy() { return true; },
};
export const noopSpatialPromptPort: SpatialPromptPort = {
  registeredPromptCount() { return 0; }, async healthy() { return true; },
};
export const noopSpatialProviderPort: SpatialProviderPort = {
  registeredProviderCount() { return 0; }, async healthy() { return true; },
};
export const noopSpatialKernelPort: SpatialKernelPort = {
  now() { return Date.now(); }, currentUserId() { return undefined; }, currentSessionId() { return undefined; },
};

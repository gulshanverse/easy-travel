/**
 * Journey Runtime — External subsystem ports.
 *
 * The Journey Engine is an orchestrator. It never imports Memory, Prompt,
 * Graph, Provider or Runtime internals — only the port shapes below. The
 * composition root wires concrete adapters at startup.
 */

import type { JourneyMemoryItem } from "./types";

// ---------- Memory ----------
export interface JourneyMemoryPort {
  retrieve(input: {
    userId: string;
    namespace: string;
    query?: string;
    limit?: number;
    kinds?: readonly string[];
  }): Promise<readonly JourneyMemoryItem[]>;
  healthy(): Promise<boolean>;
}

// ---------- Graph ----------
export interface JourneyGraphPort {
  seedForJourney(journeyId: string): Promise<readonly string[]>;
  neighbors(nodeId: string, limit?: number): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

// ---------- Prompt ----------
export interface JourneyPromptPort {
  registeredPromptCount(): number;
  healthy(): Promise<boolean>;
}

// ---------- Provider ----------
export interface JourneyProviderPort {
  healthy(): Promise<boolean>;
  registeredProviderCount(): number;
}

// ---------- Runtime Kernel ----------
export interface JourneyKernelPort {
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
  currentTimezone(): string | undefined;
}

// ---------- No-op / test doubles ----------
export const noopMemoryPort: JourneyMemoryPort = {
  async retrieve() { return []; },
  async healthy() { return true; },
};
export const noopGraphPort: JourneyGraphPort = {
  async seedForJourney() { return []; },
  async neighbors() { return []; },
  async healthy() { return true; },
};
export const noopPromptPort: JourneyPromptPort = {
  registeredPromptCount() { return 0; },
  async healthy() { return true; },
};
export const noopProviderPort: JourneyProviderPort = {
  async healthy() { return true; },
  registeredProviderCount() { return 0; },
};
export const noopKernelPort: JourneyKernelPort = {
  currentUserId() { return undefined; },
  currentSessionId() { return undefined; },
  currentTimezone() { return undefined; },
};

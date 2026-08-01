/**
 * Identity Platform — typed event bus.
 */
import { newEventId } from "./ids";

export type IdentityEventName =
  | "UserCreated" | "UserUpdated" | "UserStatusChanged" | "UserDeleted"
  | "ProfileUpdated" | "PreferencesUpdated" | "SettingsUpdated"
  | "FavoriteAdded" | "FavoriteRemoved"
  | "JourneySaved" | "JourneyUpdated" | "JourneyArchived" | "JourneyDuplicated"
  | "JourneyNoteAdded" | "JourneyVersionCreated"
  | "NotificationSettingsUpdated" | "NotificationRuleEvaluated"
  | "PrivacySettingsUpdated" | "ConsentRecorded"
  | "DataExportRequested" | "DataDeletionRequested"
  | "DeviceSessionStarted" | "DeviceSessionRevoked" | "DeviceSessionTouched"
  | "CompanionAdded" | "EmergencyContactAdded"
  | "TravelProfileCreated" | "TravelProfileUpdated" | "TravelProfileActivated"
  | "PreferencesResolved" | "PreferenceConflictDetected"
  | "StatisticsComputed" | "PersonalizationContextPublished"
  | "PersonalizationBuilt";

export interface IdentityEvent {
  readonly id: string;
  readonly name: IdentityEventName;
  readonly at: number;
  readonly version: number;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export type IdentityEventListener = (event: IdentityEvent) => void;

export interface EmitIdentityEventInput {
  name: IdentityEventName;
  at: number;
  userId?: string;
  correlationId?: string;
  causationId?: string;
  data?: Record<string, unknown>;
}

export class IdentityEventBus {
  private readonly listeners = new Set<IdentityEventListener>();
  emit(input: EmitIdentityEventInput): IdentityEvent {
    const ev: IdentityEvent = Object.freeze({
      id: newEventId(),
      name: input.name,
      at: input.at,
      version: 1,
      userId: input.userId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      data: Object.freeze({ ...(input.data ?? {}) }),
    });
    for (const l of this.listeners) { try { l(ev); } catch { /* isolate */ } }
    return ev;
  }
  on(listener: IdentityEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  clear(): void { this.listeners.clear(); }
  get size(): number { return this.listeners.size; }
}

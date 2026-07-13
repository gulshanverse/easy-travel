/**
 * JourneyManager — owns a single journey aggregate's mutations.
 *
 * All mutations produce a NEW immutable Journey with an incremented version,
 * a snapshot in history, and a corresponding event on the shared bus.
 */

import type { JourneyConfiguration } from "./config";
import { JourneyStateError, JourneyValidationError } from "./errors";
import {
  JourneyEventBus,
  makeEvent,
  type JourneyEventEnvelope,
} from "./events";
import {
  captureSnapshot,
  createStage,
} from "./factories";
import { assertTransition, canRollback, rollbackTarget } from "./state-machine";
import type {
  Journey,
  JourneyIntent,
  JourneySnapshot,
  JourneyState,
  Timeline,
  TravelConstraint,
  TravelPreference,
} from "./types";
import { throwIfFailed, validateConstraints, validateIntent, validateJourney, validateTimeline } from "./validation";
import type { JourneyMetrics, JourneyTelemetry } from "./telemetry";
import { ConstraintEngine } from "./constraint";

export interface JourneyManagerOptions {
  readonly config: JourneyConfiguration;
  readonly initial: Journey;
  readonly bus: JourneyEventBus;
  readonly metrics: JourneyMetrics;
  readonly telemetry: JourneyTelemetry;
}

export class JourneyManager {
  private current: Journey;
  private history: JourneySnapshot[] = [];
  private readonly constraints = new ConstraintEngine();

  constructor(private readonly opts: JourneyManagerOptions) {
    throwIfFailed(validateJourney(opts.initial), "invalid initial journey");
    this.current = opts.initial;
    this.snapshot("create");
  }

  get id(): string { return this.current.id; }
  get journey(): Journey { return this.current; }
  get state(): JourneyState { return this.current.state; }
  get versions(): readonly JourneySnapshot[] { return this.history; }

  // ---------- Mutations ----------
  update(patch: Partial<Pick<Journey, "title" | "summary" | "window" | "metadata" | "preferences" | "budget" | "risk" | "group" | "destinations" | "waypoints">>): Journey {
    const next = this.bump({ ...this.current, ...patch });
    throwIfFailed(validateJourney(next), "invalid journey after update");
    this.current = next;
    this.snapshot("update");
    this.emit("JourneyUpdated", {});
    return next;
  }

  transition(to: JourneyState, reason?: string): Journey {
    assertTransition(this.current.state, to);
    const from = this.current.state;
    const stage = createStage(to, to, reason ? [reason] : undefined);
    const stages = [...this.current.stages];
    const last = stages[stages.length - 1];
    if (last && !last.exitedAt) {
      stages[stages.length - 1] = { ...last, exitedAt: new Date().toISOString() };
    }
    stages.push(stage);
    const next = this.bump({ ...this.current, state: to, stages: Object.freeze(stages) });
    this.current = next;
    this.snapshot(`state:${to}`);
    this.emit("JourneyStateChanged", { from, to });
    this.emit("JourneyStageChanged", { stageId: stage.id, state: to });
    if (to === "active") this.emit("JourneyStarted", {});
    if (to === "paused") this.emit("JourneyPaused", {});
    if (to === "completed") this.emit("JourneyCompleted", {});
    if (to === "archived") this.emit("JourneyArchived", {});
    return next;
  }

  rollback(): Journey {
    if (!canRollback(this.current.state))
      throw new JourneyStateError(`cannot rollback from '${this.current.state}'`);
    return this.transition(rollbackTarget(this.current.state), "rollback");
  }

  addConstraint(c: TravelConstraint): Journey {
    if (this.current.constraints.length >= this.opts.config.policies.maxConstraintsPerJourney)
      throw new JourneyStateError("constraint limit exceeded");
    const constraints = Object.freeze([...this.current.constraints, c]);
    throwIfFailed(validateConstraints(constraints), "invalid constraints");
    this.constraints.assertNoConflicts(constraints);
    const next = this.bump({ ...this.current, constraints });
    this.current = next;
    this.snapshot("constraint:add");
    this.emit("JourneyConstraintAdded", { constraintId: c.id, kind: c.kind });
    return next;
  }

  removeConstraint(id: string): Journey {
    const constraints = Object.freeze(this.current.constraints.filter((c) => c.id !== id));
    if (constraints.length === this.current.constraints.length)
      throw new JourneyStateError(`constraint not found: ${id}`);
    const next = this.bump({ ...this.current, constraints });
    this.current = next;
    this.snapshot("constraint:remove");
    this.emit("JourneyConstraintRemoved", { constraintId: id });
    return next;
  }

  addPreference(p: TravelPreference): Journey {
    const preferences = Object.freeze([...this.current.preferences, p]);
    const next = this.bump({ ...this.current, preferences });
    this.current = next;
    this.snapshot("preference:add");
    this.emit("JourneyUpdated", { preference: p.key });
    return next;
  }

  recordIntent(intent: JourneyIntent): Journey {
    throwIfFailed(validateIntent(intent), "invalid intent");
    const limit = this.opts.config.policies.maxIntentHistory;
    const combined = [...this.current.intents, intent];
    const intents = Object.freeze(combined.slice(-limit));
    const next = this.bump({ ...this.current, intents });
    this.current = next;
    this.snapshot("intent");
    this.emit("JourneyIntentChanged", { intentId: intent.id, kind: intent.kind });
    return next;
  }

  setTimeline(timeline: Timeline): Journey {
    throwIfFailed(validateTimeline(timeline), "invalid timeline");
    const next = this.bump({ ...this.current, timeline });
    this.current = next;
    this.snapshot("timeline");
    this.emit("JourneyTimelineUpdated", { timelineId: timeline.id });
    return next;
  }

  markContextUpdated(contextId: string): void {
    this.emit("JourneyContextUpdated", { contextId });
  }

  delete(): void {
    this.emit("JourneyDeleted", {});
  }

  // ---------- Helpers ----------
  private bump(next: Journey): Journey {
    return Object.freeze({
      ...next,
      version: next.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  private snapshot(reason: string): void {
    if (this.history.length >= this.opts.config.policies.maxSnapshotsPerJourney) {
      this.history.shift();
    }
    this.history.push(captureSnapshot(this.current, reason));
    this.opts.metrics.counter("journey.snapshot", 1, { namespace: this.opts.config.namespace });
    this.opts.bus.publish(this.makeEnvelope("JourneySnapshotCaptured", { reason }));
  }

  private emit(name: Parameters<typeof makeEvent>[0]["name"], payload: Record<string, unknown>): void {
    this.opts.metrics.counter(`journey.event.${name}`, 1);
    this.opts.bus.publish(this.makeEnvelope(name, payload));
  }

  private makeEnvelope(name: Parameters<typeof makeEvent>[0]["name"], payload: Record<string, unknown>): JourneyEventEnvelope {
    return makeEvent({
      name,
      journeyId: this.current.id,
      ownerId: this.current.ownerId,
      namespace: this.current.namespace,
      version: this.current.version,
      payload,
    });
  }

  ensureOwner(userId: string): void {
    if (this.opts.config.policies.requireOwnership && this.current.ownerId !== userId)
      throw new JourneyValidationError("caller is not the journey owner", {
        ownerId: this.current.ownerId,
        callerId: userId,
      });
  }
}

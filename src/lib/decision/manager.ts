/**
 * DecisionManager — owns a single Decision aggregate.
 * Applies state transitions, versioning, snapshots, and event emission.
 */

import type { DecisionConfiguration } from "./config";
import { DecisionStateError } from "./errors";
import { makeEvent, type DecisionEventBus } from "./events";
import {
  createOutcome, createSnapshot,
} from "./factories";
import { newCorrelationId } from "./ids";
import { assertTransition, canRollback, rollbackTarget } from "./state-machine";
import { validateDecision } from "./validation";
import type {
  Decision, DecisionExplanation, DecisionOption, DecisionOutcome, DecisionScore,
  DecisionSnapshot, DecisionState, DecisionTradeoff, RankedOption,
} from "./types";

export interface DecisionManagerOptions {
  readonly config: DecisionConfiguration;
  readonly bus: DecisionEventBus;
}

export class DecisionManager {
  private _decision: Decision;
  private _snapshots: DecisionSnapshot[] = [];
  private readonly correlationId: string;
  private readonly opts: DecisionManagerOptions;

  constructor(initial: Decision, opts: DecisionManagerOptions) {
    validateDecision(initial);
    this._decision = initial;
    this.opts = opts;
    this.correlationId = initial.context.correlationId || newCorrelationId();
    this.snapshot("created");
    this.emit("DecisionCreated", { title: initial.title });
  }

  get decision(): Decision { return this._decision; }
  get id(): string { return this._decision.id; }
  get version(): number { return this._decision.version; }
  get state(): DecisionState { return this._decision.state; }
  get snapshots(): readonly DecisionSnapshot[] { return this._snapshots; }

  // ---------- mutation helpers ----------
  private update(patch: Partial<Decision>, reason: string): Decision {
    const next: Decision = Object.freeze({
      ...this._decision,
      ...patch,
      version: this._decision.version + 1,
      updatedAt: new Date().toISOString(),
    });
    validateDecision(next);
    this._decision = next;
    this.snapshot(reason);
    return next;
  }

  private snapshot(reason: string): void {
    const max = this.opts.config.policies.maxSnapshotsPerDecision;
    this._snapshots.push(createSnapshot({ decision: this._decision, reason }));
    if (this._snapshots.length > max) this._snapshots.splice(0, this._snapshots.length - max);
  }

  private emit(name: Parameters<typeof makeEvent>[0]["name"], payload: Record<string, unknown>): void {
    this.opts.bus.publish(makeEvent({
      name,
      decisionId: this._decision.id,
      ownerId: this._decision.ownerId,
      namespace: this._decision.namespace,
      version: this._decision.version,
      payload,
      correlationId: this.correlationId,
    }));
  }

  // ---------- transitions ----------
  transition(to: DecisionState, reason = to): Decision {
    const from = this._decision.state;
    assertTransition(from, to);
    const next = this.update({ state: to }, `transition:${to}`);
    this.emit("DecisionStateChanged", { from, to, reason });
    return next;
  }

  rollback(): Decision {
    if (!canRollback(this._decision.state)) {
      throw new DecisionStateError(`cannot rollback from ${this._decision.state}`);
    }
    const target = rollbackTarget(this._decision.state);
    const from = this._decision.state;
    const next = this.update({ state: target }, `rollback:${target}`);
    this.emit("DecisionStateChanged", { from, to: target, reason: "rollback" });
    return next;
  }

  // ---------- data-carrying transitions ----------
  attachOptions(options: readonly DecisionOption[]): Decision {
    const max = this.opts.config.policies.maxOptionsPerDecision;
    if (options.length > max) {
      throw new DecisionStateError(`too many options (${options.length}>${max})`);
    }
    const next = this.update({ options: Object.freeze([...options]) }, "options");
    this.emit("DecisionOptionsGenerated", { count: options.length });
    return next;
  }

  attachScores(scores: readonly DecisionScore[]): Decision {
    const next = this.update({ scores: Object.freeze([...scores]) }, "scores");
    this.emit("DecisionScored", { count: scores.length });
    return next;
  }

  attachRanking(ranked: readonly RankedOption[]): Decision {
    const next = this.update({ ranked: Object.freeze([...ranked]) }, "ranking");
    this.emit("DecisionRanked", { count: ranked.length, topOptionId: ranked[0]?.optionId });
    return next;
  }

  attachTradeoffs(tradeoffs: readonly DecisionTradeoff[]): Decision {
    const max = this.opts.config.policies.maxTradeoffsPerDecision;
    if (tradeoffs.length > max) {
      throw new DecisionStateError(`too many tradeoffs (${tradeoffs.length}>${max})`);
    }
    const next = this.update({ tradeoffs: Object.freeze([...tradeoffs]) }, "tradeoffs");
    this.emit("DecisionTradeoffsComputed", { count: tradeoffs.length });
    return next;
  }

  attachExplanation(explanation: DecisionExplanation): Decision {
    const next = this.update({ explanation }, "explanation");
    this.emit("DecisionExplained", { explanationId: explanation.id });
    return next;
  }

  approve(selectedOptionId: string, note?: string): { decision: Decision; outcome: DecisionOutcome } {
    if (!this._decision.options.some((o) => o.id === selectedOptionId)) {
      throw new DecisionStateError("selected option not in decision", { selectedOptionId });
    }
    const outcome = createOutcome({
      decisionId: this._decision.id,
      selectedOptionId,
      approved: true,
      note,
    });
    const next = this.update({ outcome }, "approved");
    this.emit("DecisionApproved", { selectedOptionId });
    return { decision: next, outcome };
  }

  archive(): Decision {
    return this.transition("archived", "archived");
  }

  fail(reason: string): Decision {
    const from = this._decision.state;
    assertTransition(from, "failed");
    const next = this.update({ state: "failed" }, `failed:${reason}`);
    this.emit("DecisionFailed", { from, reason });
    return next;
  }

  delete(): void {
    this._snapshots = [];
    this.emit("DecisionDeleted", {});
  }
}

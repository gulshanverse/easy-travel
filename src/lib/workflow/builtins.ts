/** WAR — built-in deterministic travel workflows.
 *  Capability ids are strings resolved by CTOR/IPCF at runtime — no connector imports.
 */
import { makeWorkflowDefinition } from "./factories";
import type { WorkflowDefinition } from "./types";

const RAIL = "railway";

function monitorPnr(): WorkflowDefinition {
  return makeWorkflowDefinition({
    id: "builtin.monitor-pnr", name: "Monitor PNR", version: "1.0.0",
    description: "Polls PNR status through IPCF until confirmation or cancellation.",
    triggers: [{ kind: "schedule", intervalMs: 15 * 60_000 }],
    steps: [
      { id: "fetch", name: "Fetch PNR status", kind: "connector", connectorId: RAIL, capabilityId: "railway.pnr.status", dependsOn: [] },
      { id: "evaluate", name: "Evaluate PNR change", kind: "capability", capabilityId: "workflow.evaluate.pnr", dependsOn: ["fetch"] },
      { id: "notify", name: "Record PNR change", kind: "capability", capabilityId: "workflow.record.change", dependsOn: ["evaluate"] },
    ],
  });
}
function monitorSeatAvailability(): WorkflowDefinition {
  return makeWorkflowDefinition({
    id: "builtin.monitor-seat-availability", name: "Monitor Seat Availability", version: "1.0.0",
    triggers: [{ kind: "schedule", intervalMs: 30 * 60_000 }],
    steps: [
      { id: "availability", name: "Fetch seat availability", kind: "connector", connectorId: RAIL, capabilityId: "railway.seat.availability", dependsOn: [] },
      { id: "compare", name: "Compare with target class", kind: "capability", capabilityId: "workflow.compare.availability", dependsOn: ["availability"] },
      { id: "record", name: "Record availability delta", kind: "capability", capabilityId: "workflow.record.change", dependsOn: ["compare"] },
    ],
  });
}
function trackLiveTrain(): WorkflowDefinition {
  return makeWorkflowDefinition({
    id: "builtin.track-live-train", name: "Track Live Train", version: "1.0.0",
    triggers: [{ kind: "schedule", intervalMs: 5 * 60_000 }],
    steps: [
      { id: "live", name: "Fetch live status", kind: "connector", connectorId: RAIL, capabilityId: "railway.live.status", dependsOn: [] },
      { id: "project", name: "Project arrival", kind: "capability", capabilityId: "workflow.project.arrival", dependsOn: ["live"] },
    ],
  });
}
function journeyReminder(): WorkflowDefinition {
  return makeWorkflowDefinition({
    id: "builtin.journey-reminder", name: "Journey Reminder", version: "1.0.0",
    triggers: [{ kind: "schedule", delayMs: 60_000 }],
    steps: [
      { id: "wait", name: "Wait until reminder window", kind: "timer", delayMs: 60_000, dependsOn: [] },
      { id: "compose", name: "Compose reminder", kind: "agent", capabilityId: "travel-orchestrator", dependsOn: ["wait"] },
      { id: "record", name: "Record reminder", kind: "capability", capabilityId: "workflow.record.reminder", dependsOn: ["compose"] },
    ],
  });
}
function trainDelayWatch(): WorkflowDefinition {
  return makeWorkflowDefinition({
    id: "builtin.train-delay-watch", name: "Train Delay Watch", version: "1.0.0",
    triggers: [{ kind: "signal", name: "train.delay" }],
    steps: [
      { id: "await", name: "Await delay signal", kind: "signal", signalName: "train.delay", dependsOn: [] },
      { id: "delay", name: "Fetch delay detail", kind: "connector", connectorId: RAIL, capabilityId: "railway.delay", dependsOn: ["await"] },
      { id: "assess", name: "Assess journey impact", kind: "capability", capabilityId: "workflow.assess.delay", dependsOn: ["delay"] },
    ],
  });
}
function platformChangeWatch(): WorkflowDefinition {
  return makeWorkflowDefinition({
    id: "builtin.platform-change-watch", name: "Platform Change Watch", version: "1.0.0",
    triggers: [{ kind: "signal", name: "platform.change" }],
    steps: [
      { id: "await", name: "Await platform signal", kind: "signal", signalName: "platform.change", dependsOn: [] },
      { id: "platform", name: "Fetch platform info", kind: "connector", connectorId: RAIL, capabilityId: "railway.platform", dependsOn: ["await"] },
      { id: "record", name: "Record platform change", kind: "capability", capabilityId: "workflow.record.change", dependsOn: ["platform"],
        compensation: { capabilityId: "workflow.rollback.change" } },
    ],
  });
}

export const BUILTIN_WORKFLOW_IDS: readonly string[] = Object.freeze([
  "builtin.monitor-pnr", "builtin.monitor-seat-availability", "builtin.track-live-train",
  "builtin.journey-reminder", "builtin.train-delay-watch", "builtin.platform-change-watch",
]);

export function builtinWorkflows(): readonly WorkflowDefinition[] {
  return Object.freeze([
    monitorPnr(), monitorSeatAvailability(), trackLiveTrain(),
    journeyReminder(), trainDelayWatch(), platformChangeWatch(),
  ]);
}

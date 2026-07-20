/** CTOR — validation helpers. */
import { ValidationError, WorkflowValidationError, ToolValidationError } from "./errors";
import type { Capability, Tool, ToolInput, WorkflowDefinition } from "./types";

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function validateSemver(v: string): void {
  if (!SEMVER.test(v)) throw new ValidationError(`Invalid semver: ${v}`);
}

export function validateCapability(c: Capability): void {
  if (!c.id) throw new ValidationError("Capability id required");
  if (!c.name) throw new ValidationError("Capability name required");
  validateSemver(c.version);
  if (!c.owner?.engine) throw new ValidationError("Capability owner.engine required");
  if (!c.contract || c.contract.id !== c.id) throw new ValidationError("Capability contract mismatch");
}

export function validateTool(t: Tool): void {
  if (!t.id) throw new ToolValidationError("Tool id required");
  if (!t.name) throw new ToolValidationError("Tool name required");
  validateSemver(t.version);
  if (!t.schema) throw new ToolValidationError("Tool schema required");
  const names = new Set<string>();
  for (const p of t.schema.input) {
    if (names.has(p.name)) throw new ToolValidationError(`Duplicate parameter: ${p.name}`);
    names.add(p.name);
  }
}

export function validateToolInput(t: Tool, input: ToolInput): void {
  for (const p of t.schema.input) {
    const v = (input as Record<string, unknown>)[p.name];
    if (p.required && (v === undefined || v === null)) {
      throw new ToolValidationError(`Missing required parameter: ${p.name}`);
    }
    if (v === undefined || v === null) continue;
    const t2 = Array.isArray(v) ? "array" : typeof v;
    const expected = p.type;
    if (expected === "array" && !Array.isArray(v)) throw new ToolValidationError(`Param ${p.name} must be array`);
    if (expected !== "array" && t2 !== expected) throw new ToolValidationError(`Param ${p.name} must be ${expected}`);
  }
}

export function validateWorkflow(w: WorkflowDefinition): void {
  if (!w.id) throw new WorkflowValidationError("Workflow id required");
  if (!w.name) throw new WorkflowValidationError("Workflow name required");
  validateSemver(w.version);
  if (!w.steps.length) throw new WorkflowValidationError("Workflow needs at least one step");
  const ids = new Set<string>();
  for (const s of w.steps) {
    if (!s.id) throw new WorkflowValidationError("Step id required");
    if (ids.has(s.id)) throw new WorkflowValidationError(`Duplicate step id: ${s.id}`);
    ids.add(s.id);
  }
  for (const s of w.steps) {
    for (const d of s.dependsOn) {
      if (!ids.has(d)) throw new WorkflowValidationError(`Step ${s.id} depends on unknown ${d}`);
    }
  }
}

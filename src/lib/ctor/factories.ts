/** CTOR — immutable factories. */
import { newCapabilityId, newToolId, newWorkflowId } from "./ids";
import type {
  Capability, CapabilityContract, CapabilityDependency, CapabilityMetadata,
  CapabilityOwner, CapabilityPermission, CapabilityPolicy, Tool, ToolContract,
  ToolMetadata, ToolParameter, ToolPermission, ToolSchema, WorkflowDefinition,
  WorkflowStep,
} from "./types";
import { validateCapability, validateTool, validateWorkflow } from "./validation";

function freezeArr<T>(a: readonly T[] = []): readonly T[] { return Object.freeze([...a]); }
function freezeObj<T extends object>(o: T = {} as T): Readonly<T> { return Object.freeze({ ...o }); }

export interface MakeCapabilityInput {
  id?: string;
  name: string;
  version: string;
  owner: CapabilityOwner;
  dependencies?: readonly CapabilityDependency[];
  permissions?: readonly CapabilityPermission[];
  contract?: Partial<CapabilityContract>;
  policy?: CapabilityPolicy;
  tags?: readonly string[];
  labels?: Record<string, string>;
  description?: string;
  now?: number;
}
export function makeCapability(i: MakeCapabilityInput): Capability {
  const id = i.id ?? newCapabilityId();
  const now = i.now ?? Date.now();
  const contract: CapabilityContract = Object.freeze({
    id,
    version: i.version,
    consumes: freezeArr(i.contract?.consumes),
    produces: freezeArr(i.contract?.produces),
    ports: freezeArr(i.contract?.ports),
  });
  const metadata: CapabilityMetadata = Object.freeze({
    tags: freezeArr(i.tags),
    labels: freezeObj(i.labels),
    description: i.description,
    createdAt: now,
    updatedAt: now,
  });
  const cap: Capability = Object.freeze({
    id, name: i.name, version: i.version,
    owner: freezeObj(i.owner),
    dependencies: freezeArr(i.dependencies),
    permissions: freezeArr(i.permissions),
    contract,
    policy: freezeObj(i.policy ?? {}),
    metadata,
    status: "registered",
  });
  validateCapability(cap);
  return cap;
}

export interface MakeToolInput {
  id?: string;
  name: string;
  version: string;
  schema: { input?: readonly ToolParameter[]; output?: ToolSchema["output"] };
  contract?: Partial<ToolContract>;
  permissions?: readonly ToolPermission[];
  tags?: readonly string[];
  labels?: Record<string, string>;
  description?: string;
  policy?: CapabilityPolicy;
  now?: number;
}
export function makeTool(i: MakeToolInput): Tool {
  const id = i.id ?? newToolId();
  const now = i.now ?? Date.now();
  const schema: ToolSchema = Object.freeze({
    input: freezeArr(i.schema.input).map(p => Object.freeze({ ...p })) as unknown as readonly ToolParameter[],
    output: Object.freeze({ type: i.schema.output?.type ?? "object", description: i.schema.output?.description }),
  });
  const contract: ToolContract = Object.freeze({
    capabilityId: i.contract?.capabilityId,
    idempotent: i.contract?.idempotent ?? true,
    sideEffects: i.contract?.sideEffects ?? false,
  });
  const metadata: ToolMetadata = Object.freeze({
    tags: freezeArr(i.tags),
    labels: freezeObj(i.labels),
    description: i.description,
    createdAt: now,
  });
  const tool: Tool = Object.freeze({
    id, name: i.name, version: i.version, schema, contract,
    permissions: freezeArr(i.permissions),
    metadata,
    status: "registered",
    policy: i.policy ? Object.freeze({ ...i.policy }) : undefined,
  });
  validateTool(tool);
  return tool;
}

export interface MakeWorkflowInput {
  id?: string;
  name: string;
  version: string;
  steps: readonly WorkflowStep[];
  metadata?: Record<string, string>;
}
export function makeWorkflow(i: MakeWorkflowInput): WorkflowDefinition {
  const id = i.id ?? newWorkflowId();
  const steps = freezeArr(i.steps.map(s => Object.freeze({
    ...s,
    dependsOn: freezeArr(s.dependsOn),
    policy: s.policy ? Object.freeze({ ...s.policy }) : undefined,
  }))) as readonly WorkflowStep[];
  const wf: WorkflowDefinition = Object.freeze({
    id, name: i.name, version: i.version, steps,
    metadata: i.metadata ? freezeObj(i.metadata) : undefined,
  });
  validateWorkflow(wf);
  return wf;
}

export function step(s: WorkflowStep): WorkflowStep { return Object.freeze({ ...s, dependsOn: freezeArr(s.dependsOn) }); }

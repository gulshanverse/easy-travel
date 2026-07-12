/**
 * Graph Runtime — Error hierarchy.
 * Every failure path routes through a typed error so callers can distinguish
 * validation, integrity, traversal, index, and serialization concerns without
 * string-matching messages.
 */
export type GraphErrorSeverity = "info" | "warn" | "error" | "fatal";

export class GraphError extends Error {
  code: string;
  severity: GraphErrorSeverity;
  retryable: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
  constructor(
    code: string,
    message: string,
    opts: {
      severity?: GraphErrorSeverity;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "GraphError";
    this.code = code;
    this.severity = opts.severity ?? "error";
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
    this.cause = opts.cause;
  }
}

export class GraphValidationError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_validation_error", message, { severity: "error", details });
    this.name = "GraphValidationError";
  }
}

export class GraphNotFoundError extends GraphError {
  constructor(kind: "node" | "edge" | "subgraph" | "snapshot", id: string) {
    super("graph_not_found", `${kind} not found: ${id}`, { severity: "warn", details: { kind, id } });
    this.name = "GraphNotFoundError";
  }
}

export class GraphIntegrityError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_integrity_error", message, { severity: "error", details });
    this.name = "GraphIntegrityError";
  }
}

export class GraphCycleError extends GraphError {
  constructor(path: string[]) {
    super("graph_cycle_detected", `cycle detected: ${path.join(" -> ")}`, { details: { path } });
    this.name = "GraphCycleError";
  }
}

export class GraphIndexError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_index_error", message, { details });
    this.name = "GraphIndexError";
  }
}

export class GraphTraversalError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_traversal_error", message, { details });
    this.name = "GraphTraversalError";
  }
}

export class GraphSerializationError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_serialization_error", message, { details });
    this.name = "GraphSerializationError";
  }
}

export class GraphPolicyError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_policy_error", message, { details });
    this.name = "GraphPolicyError";
  }
}

export class GraphConfigurationError extends GraphError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("graph_configuration_error", message, { severity: "fatal", details });
    this.name = "GraphConfigurationError";
  }
}

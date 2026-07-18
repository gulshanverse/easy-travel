/** Spatial Intelligence Engine — typed error hierarchy. */
export class SpatialError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SpatialError";
    this.code = code;
  }
}
export class SpatialValidationError extends SpatialError {
  constructor(message: string) { super("spatial/validation", message); this.name = "SpatialValidationError"; }
}
export class SpatialNotFoundError extends SpatialError {
  constructor(kind: string, id: string) { super("spatial/not-found", `${kind} not found: ${id}`); this.name = "SpatialNotFoundError"; }
}
export class SpatialConflictError extends SpatialError {
  constructor(message: string) { super("spatial/conflict", message); this.name = "SpatialConflictError"; }
}
export class SpatialConfigurationError extends SpatialError {
  constructor(message: string) { super("spatial/config", message); this.name = "SpatialConfigurationError"; }
}
export class SpatialConstraintViolation extends SpatialError {
  constructor(message: string) { super("spatial/constraint", message); this.name = "SpatialConstraintViolation"; }
}
export class SpatialLifecycleError extends SpatialError {
  constructor(message: string) { super("spatial/lifecycle", message); this.name = "SpatialLifecycleError"; }
}

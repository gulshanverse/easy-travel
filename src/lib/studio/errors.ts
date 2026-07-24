/** JSR — error hierarchy. */
export class StudioError extends Error {
  constructor(message: string, readonly code: string = "studio_error") {
    super(message);
    this.name = "StudioError";
  }
}
export class StudioValidationError extends StudioError {
  constructor(m: string) { super(m, "studio_validation_error"); this.name = "StudioValidationError"; }
}
export class StudioNotFoundError extends StudioError {
  constructor(kind: string, id: string) { super(`${kind} not found: ${id}`, "studio_not_found"); this.name = "StudioNotFoundError"; }
}
export class StudioLifecycleError extends StudioError {
  constructor(m: string) { super(m, "studio_lifecycle_error"); this.name = "StudioLifecycleError"; }
}
export class StudioConflictError extends StudioError {
  constructor(m: string) { super(m, "studio_conflict_error"); this.name = "StudioConflictError"; }
}
export class StudioPermissionError extends StudioError {
  constructor(m: string) { super(m, "studio_permission_error"); this.name = "StudioPermissionError"; }
}
export class StudioEditingError extends StudioError {
  constructor(m: string) { super(m, "studio_editing_error"); this.name = "StudioEditingError"; }
}
export class StudioVersioningError extends StudioError {
  constructor(m: string) { super(m, "studio_versioning_error"); this.name = "StudioVersioningError"; }
}
export class StudioPresentationError extends StudioError {
  constructor(m: string) { super(m, "studio_presentation_error"); this.name = "StudioPresentationError"; }
}

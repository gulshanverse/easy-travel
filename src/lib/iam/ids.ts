/**
 * IAM Platform — deterministic, monotonic ID helpers.
 * IDs never encode secrets; secret material is generated in `crypto.ts`.
 */
let counter = 0;
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const newCredentialId = () => next("cred");
export const newPasswordHistoryId = () => next("pwh");
export const newResetTokenId = () => next("prt");
export const newTokenId = () => next("tok");
export const newSessionId = () => next("ses");
export const newSessionEventId = () => next("sev");
export const newDeviceId = () => next("dvc");
export const newRoleId = () => next("rol");
export const newPermissionId = () => next("prm");
export const newPermissionGroupId = () => next("pmg");
export const newRoleAssignmentId = () => next("rasg");
export const newApiKeyId = () => next("akey");
export const newServiceAccountId = () => next("svc");
export const newLoginAttemptId = () => next("lat");
export const newMfaEnrollmentId = () => next("mfa");
export const newFederatedIdentityId = () => next("fed");
export const newAuditId = () => next("aud");
export const newIamEventId = () => next("iam");

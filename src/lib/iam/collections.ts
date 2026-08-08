/**
 * IAM persisted collections. Every IAM aggregate maps to exactly one
 * collection in the Persistence Platform — never two.
 */
export const IAM_COLLECTIONS = Object.freeze({
  credentials: "iam_credentials",
  passwordHistory: "iam_password_history",
  passwordResetTokens: "iam_password_reset_tokens",
  tokens: "iam_tokens",
  sessions: "iam_sessions",
  sessionHistory: "iam_session_history",
  devices: "iam_devices",
  roles: "iam_roles",
  permissions: "iam_permissions",
  permissionGroups: "iam_permission_groups",
  roleAssignments: "iam_role_assignments",
  apiKeys: "iam_api_keys",
  serviceAccounts: "iam_service_accounts",
  loginAttempts: "iam_login_attempts",
  mfaEnrollments: "iam_mfa_enrollments",
  federatedIdentities: "iam_federated_identities",
  accountLifecycle: "iam_account_lifecycle",
  accountLifecycleHistory: "iam_account_lifecycle_history",
  credentialStore: "iam_credential_store",
  credentialHistory: "iam_credential_history",
  riskEvaluations: "iam_risk_evaluations",

} as const);

export type IamCollection = (typeof IAM_COLLECTIONS)[keyof typeof IAM_COLLECTIONS];

export const ALL_IAM_COLLECTIONS: readonly IamCollection[] = Object.freeze(
  Object.values(IAM_COLLECTIONS),
);

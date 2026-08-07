/**
 * IAM Platform — MFA interfaces (contracts only, ADR-027).
 * No provider, no OTP delivery, no WebAuthn implementation. Enrollment
 * bookkeeping is persisted; verification is always delegated to an adapter.
 */
import { MfaError } from "./errors";
import { newMfaEnrollmentId } from "./ids";
import type { CollectionStore } from "./stores";
import type { MfaEnrollment, MfaFactorKind } from "./types";

export interface MfaChallenge {
  readonly id: string;
  readonly userId: string;
  readonly factor: MfaFactorKind;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface MfaVerification {
  readonly verified: boolean;
  readonly factor: MfaFactorKind;
  readonly reason: string;
}

/** Every real factor is supplied by an adapter implementing this contract. */
export interface MfaFactorProvider {
  readonly factor: MfaFactorKind;
  enroll(userId: string, options?: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
  challenge(userId: string): Promise<MfaChallenge>;
  verify(challengeId: string, response: string): Promise<MfaVerification>;
}

/** Recovery/backup codes are also provider supplied; IAM stores nothing raw. */
export interface RecoveryCodeProvider {
  generate(userId: string, count: number): Promise<readonly string[]>;
  consume(userId: string, code: string): Promise<boolean>;
}

export const SUPPORTED_MFA_FACTORS: readonly MfaFactorKind[] = Object.freeze([
  "totp",
  "email_otp",
  "sms_otp",
  "authenticator_app",
  "webauthn",
  "passkey",
  "recovery_code",
  "backup_code",
]);

export class MfaRegistry {
  private readonly providers = new Map<MfaFactorKind, MfaFactorProvider>();

  register(provider: MfaFactorProvider): void {
    this.providers.set(provider.factor, provider);
  }
  get(factor: MfaFactorKind): MfaFactorProvider | undefined {
    return this.providers.get(factor);
  }
  require(factor: MfaFactorKind): MfaFactorProvider {
    const provider = this.providers.get(factor);
    if (!provider) throw new MfaError(`no provider registered for MFA factor '${factor}'`);
    return provider;
  }
  registered(): readonly MfaFactorKind[] {
    return Object.freeze([...this.providers.keys()]);
  }
}

export class MfaManager {
  readonly registry = new MfaRegistry();

  constructor(
    private readonly enrollments: CollectionStore<MfaEnrollment>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async enroll(userId: string, factor: MfaFactorKind, label = factor): Promise<MfaEnrollment> {
    if (!SUPPORTED_MFA_FACTORS.includes(factor))
      throw new MfaError(`unsupported MFA factor '${factor}'`);
    const provider = this.registry.get(factor);
    const metadata = provider ? await provider.enroll(userId) : {};
    const enrollment: MfaEnrollment = Object.freeze({
      id: newMfaEnrollmentId(),
      userId,
      factor,
      status: provider ? "pending" : "pending",
      label,
      createdAt: this.now(),
      verifiedAt: null,
      metadata: Object.freeze({ ...metadata, providerRegistered: Boolean(provider) }),
    });
    await this.enrollments.put(enrollment);
    return enrollment;
  }

  async challenge(userId: string, factor: MfaFactorKind): Promise<MfaChallenge> {
    return this.registry.require(factor).challenge(userId);
  }

  async verify(enrollmentId: string, challengeId: string, response: string): Promise<MfaEnrollment> {
    const enrollment = await this.enrollments.get(enrollmentId);
    if (!enrollment) throw new MfaError(`unknown MFA enrollment '${enrollmentId}'`);
    const result = await this.registry.require(enrollment.factor).verify(challengeId, response);
    if (!result.verified) throw new MfaError(`MFA verification failed: ${result.reason}`);
    const next: MfaEnrollment = Object.freeze({
      ...enrollment,
      status: "active",
      verifiedAt: this.now(),
    });
    await this.enrollments.put(next);
    return next;
  }

  async revoke(enrollmentId: string): Promise<MfaEnrollment> {
    const enrollment = await this.enrollments.get(enrollmentId);
    if (!enrollment) throw new MfaError(`unknown MFA enrollment '${enrollmentId}'`);
    const next: MfaEnrollment = Object.freeze({ ...enrollment, status: "revoked" });
    await this.enrollments.put(next);
    return next;
  }

  listFor(userId: string): Promise<readonly MfaEnrollment[]> {
    return this.enrollments.where((e) => e.userId === userId);
  }

  async hasActiveFactor(userId: string): Promise<boolean> {
    return (await this.enrollments.where((e) => e.userId === userId && e.status === "active")).length > 0;
  }
}

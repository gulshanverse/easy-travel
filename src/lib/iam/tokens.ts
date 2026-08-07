/**
 * IAM Platform — Token Platform.
 * Signing and verification are behind ports; JWT and opaque formats are both
 * first-class. No identity provider is hardcoded.
 */
import type { TokenConfig } from "./config";
import { hmacSha256, randomToken, sha256, timingSafeEqual, toBase64Url, encodeUtf8 } from "./crypto";
import { TokenError, TokenExpiredError, TokenRevokedError, TokenSignatureError } from "./errors";
import { newTokenId } from "./ids";
import type { CollectionStore } from "./stores";
import type { IssuedToken, TokenClaims, TokenRecord, TokenType } from "./types";

/* ---------------------------------------------------------------- ports */

export interface TokenSigner {
  readonly algorithm: string;
  sign(payload: string): Promise<string>;
}
export interface TokenVerifier {
  verify(payload: string, signature: string): Promise<boolean>;
}

export class HmacTokenSigner implements TokenSigner, TokenVerifier {
  readonly algorithm = "HS256";
  constructor(private readonly secret: string) {
    if (!secret) throw new TokenError("HMAC signer requires a secret");
  }
  sign(payload: string): Promise<string> {
    return hmacSha256(this.secret, payload);
  }
  async verify(payload: string, signature: string): Promise<boolean> {
    return timingSafeEqual(await this.sign(payload), signature);
  }
}

/* ------------------------------------------------------------- helpers */

function b64urlJson(value: unknown): string {
  return toBase64Url(encodeUtf8(JSON.stringify(value)));
}

export interface IssueTokenInput {
  readonly userId: string;
  readonly sessionId: string | null;
  readonly type: TokenType;
  readonly scope?: readonly string[];
  readonly roles?: readonly string[];
  readonly amr?: readonly string[];
  readonly rotatedFrom?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Issues, validates, rotates and revokes tokens. Only fingerprints (SHA-256)
 * of token values are persisted — raw tokens exist in memory for one call.
 */
export class TokenService {
  constructor(
    private readonly config: TokenConfig,
    private readonly store: CollectionStore<TokenRecord>,
    private readonly signer: TokenSigner & TokenVerifier,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private ttl(type: TokenType): number {
    return type === "access" ? this.config.accessTtlMs : this.config.refreshTtlMs;
  }

  async issue(input: IssueTokenInput): Promise<IssuedToken> {
    const at = this.now();
    const jti = newTokenId();
    const claims: TokenClaims = Object.freeze({
      sub: input.userId,
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: Math.floor(at / 1000),
      exp: Math.floor((at + this.ttl(input.type)) / 1000),
      jti,
      typ: input.type,
      sid: input.sessionId,
      scope: Object.freeze([...(input.scope ?? [])]),
      roles: Object.freeze([...(input.roles ?? [])]),
      amr: Object.freeze([...(input.amr ?? [])]),
    });

    const value =
      this.config.format === "jwt"
        ? await this.encodeJwt(claims)
        : `${jti}.${randomToken(32)}`;

    const record: TokenRecord = Object.freeze({
      id: jti,
      userId: input.userId,
      sessionId: input.sessionId,
      type: input.type,
      format: this.config.format,
      fingerprint: await sha256(value),
      issuedAt: at,
      expiresAt: at + this.ttl(input.type),
      revokedAt: null,
      rotatedFrom: input.rotatedFrom ?? null,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    });
    await this.store.put(record);
    return Object.freeze({ value, record, claims });
  }

  private async encodeJwt(claims: TokenClaims): Promise<string> {
    const header = b64urlJson({ alg: this.signer.algorithm, typ: "JWT" });
    const body = b64urlJson(claims);
    const payload = `${header}.${body}`;
    return `${payload}.${await this.signer.sign(payload)}`;
  }

  decodeJwt(value: string): TokenClaims {
    const parts = value.split(".");
    if (parts.length !== 3) throw new TokenSignatureError("malformed JWT");
    try {
      const json = new TextDecoder().decode(
        Uint8Array.from(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        ),
      );
      return JSON.parse(json) as TokenClaims;
    } catch {
      throw new TokenSignatureError("unreadable JWT payload");
    }
  }

  /** Full validation: signature (JWT), persistence, revocation and expiry. */
  async validate(value: string, expected?: TokenType): Promise<{ record: TokenRecord; claims: TokenClaims | null }> {
    const at = this.now();
    let claims: TokenClaims | null = null;

    if (this.config.format === "jwt") {
      const parts = value.split(".");
      if (parts.length !== 3) throw new TokenSignatureError("malformed token");
      const ok = await this.signer.verify(`${parts[0]}.${parts[1]}`, parts[2]!);
      if (!ok) throw new TokenSignatureError("token signature mismatch");
      claims = this.decodeJwt(value);
      if (claims.iss !== this.config.issuer || claims.aud !== this.config.audience)
        throw new TokenSignatureError("token issuer/audience mismatch");
    }

    const fingerprint = await sha256(value);
    const record = await this.store.first((r) => r.fingerprint === fingerprint);
    if (!record) throw new TokenError("unknown token");
    if (record.revokedAt !== null) throw new TokenRevokedError("token has been revoked");
    if (at > record.expiresAt + this.config.clockSkewMs)
      throw new TokenExpiredError("token has expired");
    if (expected && record.type !== expected)
      throw new TokenError(`expected a ${expected} token, received ${record.type}`);
    return { record, claims };
  }

  /** Refresh rotation: the presented token is revoked and replaced atomically. */
  async rotate(refreshValue: string, input: Omit<IssueTokenInput, "type" | "rotatedFrom">): Promise<{
    readonly access: IssuedToken;
    readonly refresh: IssuedToken;
    readonly revoked: TokenRecord;
  }> {
    const { record } = await this.validate(refreshValue, "refresh");
    const revoked = await this.revokeRecord(record, "rotated");
    const access = await this.issue({ ...input, type: "access" });
    const refresh = this.config.rotateRefreshOnUse
      ? await this.issue({ ...input, type: "refresh", rotatedFrom: record.id })
      : await this.issue({ ...input, type: "refresh" });
    return Object.freeze({ access, refresh, revoked });
  }

  async revoke(tokenId: string, reason = "revoked"): Promise<TokenRecord | undefined> {
    const record = await this.store.get(tokenId);
    return record ? this.revokeRecord(record, reason) : undefined;
  }

  async revokeForSession(sessionId: string, reason = "session_revoked"): Promise<number> {
    const records = await this.store.where((r) => r.sessionId === sessionId && r.revokedAt === null);
    for (const r of records) await this.revokeRecord(r, reason);
    return records.length;
  }

  async revokeForUser(userId: string, reason = "user_revoked"): Promise<number> {
    const records = await this.store.where((r) => r.userId === userId && r.revokedAt === null);
    for (const r of records) await this.revokeRecord(r, reason);
    return records.length;
  }

  private async revokeRecord(record: TokenRecord, reason: string): Promise<TokenRecord> {
    const next: TokenRecord = Object.freeze({
      ...record,
      revokedAt: this.now(),
      metadata: Object.freeze({ ...record.metadata, revokedReason: reason }),
    });
    await this.store.put(next);
    return next;
  }

  listForUser(userId: string): Promise<readonly TokenRecord[]> {
    return this.store.where((r) => r.userId === userId) as Promise<readonly TokenRecord[]>;
  }
}

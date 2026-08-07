/**
 * IAM Platform — Device Platform.
 * Fingerprinting, trust levels, verification and revocation. Deterministic.
 */
import { sha256 } from "./crypto";
import { DeviceError } from "./errors";
import { newDeviceId } from "./ids";
import type { CollectionStore } from "./stores";
import type { Device, DevicePlatform, DeviceTrustLevel } from "./types";

export interface DeviceProfileInput {
  readonly platform: DevicePlatform;
  readonly userAgent?: string | null;
  readonly screen?: string | null;
  readonly timezone?: string | null;
  readonly locale?: string | null;
  readonly label?: string;
}

/** Stable fingerprint over the declared device profile (no PII beyond UA). */
export async function computeDeviceFingerprint(profile: DeviceProfileInput): Promise<string> {
  const canonical = [
    profile.platform,
    profile.userAgent ?? "",
    profile.screen ?? "",
    profile.timezone ?? "",
    profile.locale ?? "",
  ].join("|");
  return sha256(canonical);
}

export function defaultDeviceLabel(profile: DeviceProfileInput): string {
  return profile.label ?? `${profile.platform} device`;
}

export class DeviceManager {
  constructor(
    private readonly devices: CollectionStore<Device>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Registers or refreshes a device; known devices keep their trust level. */
  async register(userId: string, profile: DeviceProfileInput): Promise<Device> {
    const fingerprint = await computeDeviceFingerprint(profile);
    const at = this.now();
    const existing = await this.devices.first(
      (d) => d.userId === userId && d.fingerprint === fingerprint,
    );
    if (existing) {
      const refreshed: Device = Object.freeze({
        ...existing,
        lastSeenAt: at,
        trust: existing.trust === "unknown" ? "known" : existing.trust,
      });
      await this.devices.put(refreshed);
      return refreshed;
    }
    const device: Device = Object.freeze({
      id: newDeviceId(),
      userId,
      fingerprint,
      platform: profile.platform,
      label: defaultDeviceLabel(profile),
      trust: "unknown" as DeviceTrustLevel,
      verifiedAt: null,
      firstSeenAt: at,
      lastSeenAt: at,
      revokedAt: null,
      metadata: Object.freeze({
        userAgent: profile.userAgent ?? null,
        timezone: profile.timezone ?? null,
        locale: profile.locale ?? null,
      }),
    });
    await this.devices.put(device);
    return device;
  }

  async verify(deviceId: string): Promise<Device> {
    const device = await this.require(deviceId);
    const next: Device = Object.freeze({
      ...device,
      trust: "known",
      verifiedAt: this.now(),
    });
    await this.devices.put(next);
    return next;
  }

  /** "Remember this device" — promotes a verified device to trusted. */
  async trust(deviceId: string): Promise<Device> {
    const device = await this.require(deviceId);
    if (device.revokedAt !== null) throw new DeviceError("cannot trust a revoked device");
    const at = this.now();
    const next: Device = Object.freeze({
      ...device,
      trust: "trusted",
      verifiedAt: device.verifiedAt ?? at,
      lastSeenAt: at,
    });
    await this.devices.put(next);
    return next;
  }

  async revoke(deviceId: string): Promise<Device> {
    const device = await this.require(deviceId);
    const next: Device = Object.freeze({ ...device, trust: "revoked", revokedAt: this.now() });
    await this.devices.put(next);
    return next;
  }

  async isTrusted(deviceId: string): Promise<boolean> {
    const device = await this.devices.get(deviceId);
    return device?.trust === "trusted" && device.revokedAt === null;
  }

  async listFor(userId: string): Promise<readonly Device[]> {
    return this.devices.where((d) => d.userId === userId);
  }

  async findByFingerprint(userId: string, fingerprint: string): Promise<Device | undefined> {
    return this.devices.first((d) => d.userId === userId && d.fingerprint === fingerprint);
  }

  async count(): Promise<number> {
    return this.devices.count();
  }

  private async require(deviceId: string): Promise<Device> {
    const device = await this.devices.get(deviceId);
    if (!device) throw new DeviceError(`unknown device '${deviceId}'`);
    return device;
  }
}

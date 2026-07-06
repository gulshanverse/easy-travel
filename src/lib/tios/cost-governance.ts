/**
 * TIOS Cost Governance (Milestone 5.3).
 * Centralized AI/provider cost accounting with emergency stop, per-user,
 * per-capability, and provider quotas. Future billing integration replaces
 * the in-memory store without changing call sites.
 */
export interface CostLimit {
  dailyBudget?: number;         // in cost units (e.g. USD)
  monthlyBudget?: number;
  perUserDaily?: number;
  perCapabilityDaily?: number;
}

export interface ProviderQuota {
  providerId: string;
  dailyLimit: number;
}

interface UsageBucket {
  spendToday: number;
  spendThisMonth: number;
  perUserDaily: Record<string, number>;
  perCapabilityDaily: Record<string, number>;
  providerToday: Record<string, number>;
  dayKey: string;
  monthKey: string;
  emergencyStop: boolean;
}

function keyOf(d: Date): { day: string; month: string } {
  return {
    day: d.toISOString().slice(0, 10),
    month: d.toISOString().slice(0, 7),
  };
}

const state: UsageBucket = {
  spendToday: 0,
  spendThisMonth: 0,
  perUserDaily: {},
  perCapabilityDaily: {},
  providerToday: {},
  ...(() => { const k = keyOf(new Date()); return { dayKey: k.day, monthKey: k.month }; })(),
  emergencyStop: false,
};

let limits: CostLimit = {};
const providerQuotas = new Map<string, number>();

export function configureCostLimits(next: CostLimit): void { limits = { ...next }; }
export function setProviderQuota(q: ProviderQuota): void {
  providerQuotas.set(q.providerId, q.dailyLimit);
}
export function triggerEmergencyStop(on = true): void { state.emergencyStop = on; }
export function isEmergencyStopped(): boolean { return state.emergencyStop; }

function rollover(): void {
  const k = keyOf(new Date());
  if (k.day !== state.dayKey) {
    state.dayKey = k.day;
    state.spendToday = 0;
    state.perUserDaily = {};
    state.perCapabilityDaily = {};
    state.providerToday = {};
  }
  if (k.month !== state.monthKey) {
    state.monthKey = k.month;
    state.spendThisMonth = 0;
  }
}

export interface CostGuardInput {
  cost: number;
  userId?: string | null;
  capabilityId?: string;
  providerId?: string;
}

export interface CostGuardDecision {
  allowed: boolean;
  reason?: string;
}

/** Check whether a proposed spend fits within limits. Does NOT record. */
export function guardCost(input: CostGuardInput): CostGuardDecision {
  rollover();
  if (state.emergencyStop) return { allowed: false, reason: "emergency stop active" };
  if (limits.dailyBudget != null && state.spendToday + input.cost > limits.dailyBudget) {
    return { allowed: false, reason: "daily AI budget exceeded" };
  }
  if (limits.monthlyBudget != null && state.spendThisMonth + input.cost > limits.monthlyBudget) {
    return { allowed: false, reason: "monthly AI budget exceeded" };
  }
  if (input.userId && limits.perUserDaily != null) {
    const cur = state.perUserDaily[input.userId] ?? 0;
    if (cur + input.cost > limits.perUserDaily) {
      return { allowed: false, reason: "per-user daily limit exceeded" };
    }
  }
  if (input.capabilityId && limits.perCapabilityDaily != null) {
    const cur = state.perCapabilityDaily[input.capabilityId] ?? 0;
    if (cur + input.cost > limits.perCapabilityDaily) {
      return { allowed: false, reason: "per-capability daily limit exceeded" };
    }
  }
  if (input.providerId) {
    const q = providerQuotas.get(input.providerId);
    if (q != null) {
      const cur = state.providerToday[input.providerId] ?? 0;
      if (cur + input.cost > q) {
        return { allowed: false, reason: `provider quota exceeded (${input.providerId})` };
      }
    }
  }
  return { allowed: true };
}

/** Record spend after a successful call. Silently no-op if guardCost would deny. */
export function recordSpend(input: CostGuardInput): void {
  rollover();
  state.spendToday += input.cost;
  state.spendThisMonth += input.cost;
  if (input.userId) {
    state.perUserDaily[input.userId] = (state.perUserDaily[input.userId] ?? 0) + input.cost;
  }
  if (input.capabilityId) {
    state.perCapabilityDaily[input.capabilityId] =
      (state.perCapabilityDaily[input.capabilityId] ?? 0) + input.cost;
  }
  if (input.providerId) {
    state.providerToday[input.providerId] =
      (state.providerToday[input.providerId] ?? 0) + input.cost;
  }
}

export function readCostSnapshot(): UsageBucket & { limits: CostLimit; providerQuotas: Record<string, number> } {
  rollover();
  return {
    ...state,
    perUserDaily: { ...state.perUserDaily },
    perCapabilityDaily: { ...state.perCapabilityDaily },
    providerToday: { ...state.providerToday },
    limits: { ...limits },
    providerQuotas: Object.fromEntries(providerQuotas.entries()),
  };
}

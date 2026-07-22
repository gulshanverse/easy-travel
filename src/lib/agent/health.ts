/** ARP — health checks. */
import type { AgentRegistry } from "./registry";
import type { ConversationRuntime } from "./conversation";
import type { SessionRegistry } from "./session";
import type { AgentCTORPort, AgentKernelPort } from "./ports";

export interface AgentHealthDeps {
  readonly ctor?: AgentCTORPort;
  readonly kernel?: AgentKernelPort;
}

export interface AgentHealthReport {
  readonly healthy: boolean;
  readonly agents: number;
  readonly sessions: number;
  readonly conversations: number;
  readonly ports: Readonly<Record<string, boolean>>;
  readonly checkedAt: number;
}

export async function collectAgentHealth(
  agents: AgentRegistry,
  sessions: SessionRegistry,
  conversations: ConversationRuntime,
  deps: AgentHealthDeps,
): Promise<AgentHealthReport> {
  const ports: Record<string, boolean> = {};
  if (deps.ctor) { try { ports.ctor = await deps.ctor.healthy(); } catch { ports.ctor = false; } }
  if (deps.kernel) { ports.kernel = true; }
  const allHealthy = Object.values(ports).every(Boolean);
  return Object.freeze({
    healthy: allHealthy,
    agents: agents.size(),
    sessions: sessions.size(),
    conversations: conversations.size(),
    ports: Object.freeze(ports),
    checkedAt: Date.now(),
  });
}

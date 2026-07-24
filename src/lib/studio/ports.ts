/** JSR — port to the Agent Runtime. Interface-only.
 * Journey Studio Runtime consumes ONLY the Agent Runtime. Any other
 * subsystem is reached transitively via Agent → CTOR → Engines.
 */
export interface StudioAgentResponse {
  readonly id: string;
  readonly agentId: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly summary?: string;
  readonly outputs?: Readonly<Record<string, unknown>>;
  readonly reasoning?: readonly {
    readonly id: string;
    readonly kind: string;
    readonly summary?: string;
  }[];
  readonly evidence?: readonly {
    readonly id: string;
    readonly kind: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  }[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudioAgentRequest {
  readonly agentId: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly input: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudioAgentPort {
  healthy(): Promise<boolean>;
  handleRequest(req: StudioAgentRequest): Promise<StudioAgentResponse>;
}

export const noopStudioAgentPort: StudioAgentPort = {
  async healthy() { return true; },
  async handleRequest(req) {
    return Object.freeze({
      id: "resp_noop",
      agentId: req.agentId,
      sessionId: req.sessionId,
      conversationId: req.conversationId,
      summary: "",
      outputs: {},
      reasoning: [],
      evidence: [],
      metadata: {},
    });
  },
};

/** JSR — Card factories (immutable presentation models). */
import { newCardId } from "./ids";
import { validateCard } from "./validation";
import type { Card, CardKind } from "./types";

export interface MakeCardInput {
  readonly kind: CardKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
  readonly sourceAgentResponseId?: string;
  readonly id?: string;
  readonly createdAt?: number;
}

export function makeCard(input: MakeCardInput): Card {
  const card: Card = Object.freeze({
    id: input.id ?? newCardId(),
    kind: input.kind,
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    data: Object.freeze({ ...(input.data ?? {}) }),
    tags: Object.freeze([...(input.tags ?? [])]),
    createdAt: input.createdAt ?? Date.now(),
    sourceAgentResponseId: input.sourceAgentResponseId,
  });
  validateCard(card);
  return card;
}

export const CARD_KINDS: readonly CardKind[] = Object.freeze([
  "destination", "journey", "decision", "trust", "goal",
  "budget", "timeline", "warning", "recommendation", "insight",
]);

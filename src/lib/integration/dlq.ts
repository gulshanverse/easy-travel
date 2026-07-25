/** IPCF — dead-letter queue (in-memory). */
import { newDlqEntryId } from "./ids";
import type { DeadLetterEntry } from "./types";

export class DeadLetterQueue {
  private readonly entries: DeadLetterEntry[] = [];
  constructor(private readonly maxEntries = 1024) {}
  enqueue(input: Omit<DeadLetterEntry, "id" | "at"> & { at?: number }): DeadLetterEntry {
    const entry: DeadLetterEntry = Object.freeze({
      id: newDlqEntryId(),
      at: input.at ?? Date.now(),
      connectorId: input.connectorId,
      kind: input.kind,
      attempts: input.attempts,
      reason: input.reason,
      payload: input.payload,
    });
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return entry;
  }
  list(): readonly DeadLetterEntry[] { return [...this.entries]; }
  size(): number { return this.entries.length; }
  drain(): readonly DeadLetterEntry[] {
    const copy = [...this.entries];
    this.entries.length = 0;
    return copy;
  }
  clear(): void { this.entries.length = 0; }
}

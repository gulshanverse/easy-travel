/**
 * Graph Runtime — Identifier helpers.
 */
let counter = 0;
export function randomId(prefix = "id"): string {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    counter = (counter + 1) >>> 0;
    return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}
export const newNodeId = () => randomId("node");
export const newEdgeId = () => randomId("edge");
export const newSubgraphId = () => randomId("sub");
export const newTraversalId = () => randomId("trv");
export const newSnapshotId = () => randomId("snap");
export const newEventId = () => randomId("gevt");
export const newCorrelationId = () => randomId("gcorr");
export const newCausationId = () => randomId("gcause");

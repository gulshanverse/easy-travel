/** IPCF — supported connector categories.
 *  Categories are labels for discovery/governance only. IPCF ships NO
 *  provider integrations for any category listed here.
 */
import type { ConnectorCategory } from "./types";

export const CONNECTOR_CATEGORIES: readonly ConnectorCategory[] = Object.freeze([
  "railway", "flight", "hotel", "maps", "weather", "payments",
  "notifications", "calendar", "identity", "documents",
  "analytics", "storage", "search", "messaging", "custom",
]);

export function isKnownCategory(x: string): x is ConnectorCategory {
  return (CONNECTOR_CATEGORIES as readonly string[]).includes(x);
}

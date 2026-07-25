/** IPCF — connector registry with capability + category indexes. */
import { IntegrationDependencyError, IntegrationDuplicateError, IntegrationNotFoundError } from "./errors";
import type { Connector, ConnectorCategory, ConnectorStatus } from "./types";

export interface ConnectorQuery {
  readonly category?: ConnectorCategory;
  readonly status?: ConnectorStatus;
  readonly capabilityId?: string;
  readonly tag?: string;
}

export class ConnectorRegistry {
  private readonly items = new Map<string, Connector>();
  private readonly byCategory = new Map<ConnectorCategory, Set<string>>();
  private readonly byCapability = new Map<string, Set<string>>();
  private readonly byTag = new Map<string, Set<string>>();

  register(c: Connector): void {
    if (this.items.has(c.id)) throw new IntegrationDuplicateError(`connector already registered: ${c.id}`);
    this.items.set(c.id, c);
    this.indexAdd(c);
  }
  update(c: Connector): void {
    const prev = this.items.get(c.id);
    if (!prev) throw new IntegrationNotFoundError("connector", c.id);
    this.indexRemove(prev);
    this.items.set(c.id, c);
    this.indexAdd(c);
  }
  get(id: string): Connector | undefined { return this.items.get(id); }
  require(id: string): Connector {
    const c = this.items.get(id);
    if (!c) throw new IntegrationNotFoundError("connector", id);
    return c;
  }
  remove(id: string): boolean {
    const c = this.items.get(id);
    if (!c) return false;
    this.items.delete(id);
    this.indexRemove(c);
    return true;
  }
  list(): readonly Connector[] { return [...this.items.values()]; }
  size(): number { return this.items.size; }
  clear(): void {
    this.items.clear();
    this.byCategory.clear();
    this.byCapability.clear();
    this.byTag.clear();
  }
  discover(q: ConnectorQuery = {}): readonly Connector[] {
    let ids: Set<string> | null = null;
    const intersect = (next: Set<string>) => {
      if (ids === null) { ids = new Set(next); return; }
      for (const id of ids) if (!next.has(id)) ids.delete(id);
    };
    if (q.category) intersect(this.byCategory.get(q.category) ?? new Set());
    if (q.capabilityId) intersect(this.byCapability.get(q.capabilityId) ?? new Set());
    if (q.tag) intersect(this.byTag.get(q.tag) ?? new Set());
    const source = ids ?? new Set(this.items.keys());
    const out: Connector[] = [];
    for (const id of source) {
      const c = this.items.get(id)!;
      if (q.status && c.status !== q.status) continue;
      out.push(c);
    }
    return out;
  }
  validateDependencies(c: Connector): void {
    for (const d of c.definition.manifest.dependencies) {
      const dep = this.items.get(d.connectorId);
      if (!dep) {
        if (d.optional) continue;
        throw new IntegrationDependencyError(`missing dependency: ${d.connectorId}`);
      }
    }
  }

  private indexAdd(c: Connector): void {
    this.bucket(this.byCategory, c.definition.manifest.category, c.id);
    for (const cap of c.definition.manifest.capabilities) this.bucket(this.byCapability, cap.id, c.id);
    for (const t of c.definition.manifest.metadata.tags) this.bucket(this.byTag, t, c.id);
  }
  private indexRemove(c: Connector): void {
    this.byCategory.get(c.definition.manifest.category)?.delete(c.id);
    for (const cap of c.definition.manifest.capabilities) this.byCapability.get(cap.id)?.delete(c.id);
    for (const t of c.definition.manifest.metadata.tags) this.byTag.get(t)?.delete(c.id);
  }
  private bucket<K>(map: Map<K, Set<string>>, key: K, id: string) {
    let s = map.get(key); if (!s) { s = new Set(); map.set(key, s); } s.add(id);
  }
}

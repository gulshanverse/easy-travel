/**
 * NCP — template version store.
 *
 * Every template registration is recorded as an immutable version row in the
 * Persistence Platform so renders remain auditable and rollback is possible.
 */
import { fingerprint } from "./ids";
import type { NotificationStore } from "./stores";
import type { NotificationTemplate } from "./templates";

export interface TemplateVersionRecord {
  readonly id: string;
  readonly templateId: string;
  readonly locale: string;
  readonly version: number;
  readonly fingerprint: string;
  readonly template: NotificationTemplate;
  readonly publishedAt: number;
}

export function templateFingerprint(template: NotificationTemplate): string {
  const channels = Object.entries(template.channels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([channel, tpl]) => `${channel}:${tpl?.subject ?? ""}:${tpl?.body ?? ""}`)
    .join("|");
  return fingerprint(`${template.id}:${template.locale}:${channels}`);
}

export function templateVersionId(id: string, locale: string, version: number): string {
  return `tvr_${fingerprint(`${id}|${locale}|${version}`)}`;
}

export class TemplateVersionStore {
  constructor(private readonly store: NotificationStore<TemplateVersionRecord>) {}

  async publish(template: NotificationTemplate, at: number): Promise<TemplateVersionRecord> {
    const record: TemplateVersionRecord = Object.freeze({
      id: templateVersionId(template.id, template.locale, template.version),
      templateId: template.id,
      locale: template.locale,
      version: template.version,
      fingerprint: templateFingerprint(template),
      template,
      publishedAt: at,
    });
    return this.store.put(record);
  }

  async history(templateId: string, locale?: string): Promise<readonly TemplateVersionRecord[]> {
    const rows = await this.store.where(
      (r) => r.templateId === templateId && (locale === undefined || r.locale === locale),
    );
    return Object.freeze([...rows].sort((a, b) => a.version - b.version));
  }

  async latest(templateId: string, locale: string): Promise<TemplateVersionRecord | undefined> {
    const rows = await this.history(templateId, locale);
    return rows[rows.length - 1];
  }

  async at(
    templateId: string,
    locale: string,
    version: number,
  ): Promise<TemplateVersionRecord | undefined> {
    return this.store.get(templateVersionId(templateId, locale, version));
  }

  async count(): Promise<number> {
    return this.store.count();
  }
}

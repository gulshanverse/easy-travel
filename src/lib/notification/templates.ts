/**
 * NCP — template registry, versioning and deterministic renderer.
 *
 * Templates are pure data. Rendering is a pure function of
 * (template, variables, locale) — identical inputs always produce an
 * identical fingerprint.
 */
import { MissingVariableError, UnknownTemplateError, NotificationValidationError } from "./errors";
import { fingerprint } from "./ids";
import { escapeHtml, sanitizeSms, sanitizeText, truncate } from "./security";
import type {
  NotificationAction,
  NotificationCategory,
  NotificationChannel,
  RenderedMessage,
  TemplateVariables,
} from "./types";

export interface ChannelTemplate {
  readonly subject?: string;
  readonly body: string;
  readonly summary?: string;
}

export interface NotificationTemplate {
  readonly id: string;
  readonly version: number;
  readonly category: NotificationCategory;
  readonly locale: string;
  readonly requiredVariables: readonly string[];
  readonly channels: Readonly<Partial<Record<NotificationChannel, ChannelTemplate>>>;
  readonly createdAt: number;
}

export interface MakeTemplateInput {
  readonly id: string;
  readonly category: NotificationCategory;
  readonly locale?: string;
  readonly version?: number;
  readonly requiredVariables?: readonly string[];
  readonly channels: Readonly<Partial<Record<NotificationChannel, ChannelTemplate>>>;
  readonly createdAt?: number;
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function makeTemplate(input: MakeTemplateInput): NotificationTemplate {
  if (!input.id.trim()) throw new NotificationValidationError("template id is required");
  if (Object.keys(input.channels).length === 0) {
    throw new NotificationValidationError(`template ${input.id} defines no channels`);
  }
  return Object.freeze({
    id: input.id,
    version: input.version ?? 1,
    category: input.category,
    locale: input.locale ?? "en",
    requiredVariables: Object.freeze([...(input.requiredVariables ?? [])].sort()),
    channels: Object.freeze({ ...input.channels }),
    createdAt: input.createdAt ?? 0,
  });
}

/** Extracts every placeholder referenced by a template, sorted and deduped. */
export function templateVariables(template: NotificationTemplate): readonly string[] {
  const found = new Set<string>();
  for (const channel of Object.values(template.channels)) {
    if (!channel) continue;
    for (const text of [channel.subject ?? "", channel.body, channel.summary ?? ""]) {
      for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
    }
  }
  return Object.freeze([...found].sort());
}

export function validateTemplate(template: NotificationTemplate): NotificationTemplate {
  for (const required of template.requiredVariables) {
    if (!templateVariables(template).includes(required)) {
      throw new NotificationValidationError(
        `template ${template.id} declares unused required variable "${required}"`,
        { templateId: template.id, variable: required },
      );
    }
  }
  return template;
}

function interpolate(
  text: string,
  variables: TemplateVariables,
  templateId: string,
  strict: boolean,
): string {
  return text.replace(PLACEHOLDER, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) {
      if (strict) throw new MissingVariableError(templateId, name);
      return "";
    }
    return String(value);
  });
}

export interface RenderInput {
  readonly template: NotificationTemplate;
  readonly channel: NotificationChannel;
  readonly variables: TemplateVariables;
  readonly actions?: readonly NotificationAction[];
  readonly maxBodyLength?: number;
  readonly strict?: boolean;
}

export function renderTemplate(input: RenderInput): RenderedMessage {
  const channelTemplate = input.template.channels[input.channel];
  if (!channelTemplate) {
    throw new UnknownTemplateError(`${input.template.id}#${input.channel}`, input.template.locale);
  }
  const strict = input.strict ?? true;
  for (const required of input.template.requiredVariables) {
    if (input.variables[required] === undefined) {
      throw new MissingVariableError(input.template.id, required);
    }
  }
  const max = input.maxBodyLength ?? 4_000;
  const rawSubject = channelTemplate.subject
    ? interpolate(channelTemplate.subject, input.variables, input.template.id, strict)
    : null;
  const rawBody = interpolate(channelTemplate.body, input.variables, input.template.id, strict);
  const rawSummary = channelTemplate.summary
    ? interpolate(channelTemplate.summary, input.variables, input.template.id, strict)
    : rawBody;

  const body =
    input.channel === "sms"
      ? sanitizeSms(rawBody, Math.min(max, 480))
      : truncate(sanitizeText(input.channel === "email" ? escapeHtml(rawBody) : rawBody), max);
  const subject = rawSubject ? truncate(sanitizeText(rawSubject), 200) : null;
  const summary = truncate(sanitizeText(rawSummary), 200);

  return Object.freeze({
    channel: input.channel,
    locale: input.template.locale,
    subject,
    body,
    summary,
    actions: Object.freeze([...(input.actions ?? [])]),
    fingerprint: fingerprint(
      `${input.template.id}:${input.template.version}:${input.template.locale}:${input.channel}:${subject ?? ""}:${body}`,
    ),
  });
}

/** Registry of templates keyed by id + locale, with locale fallback. */
export class TemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  constructor(
    private readonly fallbackLocale = "en",
    seed: readonly NotificationTemplate[] = [],
  ) {
    for (const template of seed) this.register(template);
  }

  private key(id: string, locale: string): string {
    return `${id}::${locale}`;
  }

  register(template: NotificationTemplate): NotificationTemplate {
    const validated = validateTemplate(template);
    const key = this.key(validated.id, validated.locale);
    const existing = this.templates.get(key);
    const next =
      existing && existing.version >= validated.version
        ? Object.freeze({ ...validated, version: existing.version + 1 })
        : validated;
    this.templates.set(key, next);
    return next;
  }

  has(id: string, locale?: string): boolean {
    return this.templates.has(this.key(id, locale ?? this.fallbackLocale));
  }

  resolve(id: string, locale?: string): NotificationTemplate {
    const requested = locale ?? this.fallbackLocale;
    return (
      this.templates.get(this.key(id, requested)) ??
      this.templates.get(this.key(id, requested.split("-")[0])) ??
      this.templates.get(this.key(id, this.fallbackLocale)) ??
      (() => {
        throw new UnknownTemplateError(id, requested);
      })()
    );
  }

  list(): readonly NotificationTemplate[] {
    return Object.freeze(
      [...this.templates.values()].sort(
        (a, b) => a.id.localeCompare(b.id) || a.locale.localeCompare(b.locale),
      ),
    );
  }

  get size(): number {
    return this.templates.size;
  }
}

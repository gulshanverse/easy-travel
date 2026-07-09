/**
 * PromptTemplateRegistry — reusable, provider-neutral prompt templates.
 * Placeholder syntax: {{variableName}}. Missing required variables throw.
 */
import { TemplateError } from "./errors";
import type { PromptFragment, PromptTemplate, TemplateCategory } from "./types";
import { estimateTokens, stableHash } from "./ids";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

export class PromptTemplateRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  register(t: PromptTemplate): PromptTemplate {
    if (!t.id) throw new TemplateError("template id required");
    if (this.templates.has(t.id)) {
      throw new TemplateError(`Duplicate template: ${t.id}`);
    }
    this.templates.set(t.id, t);
    return t;
  }

  upsert(t: PromptTemplate): PromptTemplate {
    this.templates.set(t.id, t);
    return t;
  }

  get(id: string): PromptTemplate | undefined { return this.templates.get(id); }

  list(category?: TemplateCategory): PromptTemplate[] {
    const all = [...this.templates.values()];
    return category ? all.filter((t) => t.category === category) : all;
  }

  size(): number { return this.templates.size; }

  render(id: string, variables: Record<string, unknown>): string {
    const t = this.templates.get(id);
    if (!t) throw new TemplateError(`Template not found: ${id}`);
    return renderTemplate(t, variables);
  }

  toFragment(id: string, variables: Record<string, unknown>): PromptFragment {
    const t = this.templates.get(id);
    if (!t) throw new TemplateError(`Template not found: ${id}`);
    const content = renderTemplate(t, variables);
    return {
      id: `tpl:${t.id}`,
      kind: t.category === "output" ? "output" : (t.category as PromptFragment["kind"]),
      role: t.role,
      order: t.order,
      priority: t.priority,
      content,
      estimatedTokens: estimateTokens(content),
      dedupeKey: `tpl:${t.id}:${stableHash(content)}`,
    };
  }
}

export function renderTemplate(t: PromptTemplate, variables: Record<string, unknown>): string {
  const required = new Set(t.requiredVariables ?? []);
  const missing: string[] = [];
  const out = t.body.replace(PLACEHOLDER_RE, (_m, name: string) => {
    const value = resolvePath(variables, name);
    if (value === undefined || value === null) {
      if (required.has(name)) missing.push(name);
      return "";
    }
    return typeof value === "string" ? value : JSON.stringify(value);
  });
  if (missing.length) {
    throw new TemplateError(`Missing required variables: ${missing.join(", ")}`, {
      templateId: t.id, missing,
    });
  }
  return out.trim();
}

function resolvePath(root: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[seg];
    return undefined;
  }, root);
}

/**
 * AI Core — Prompt Manager.
 * Loads versioned prompts from public.prompt_templates (keyed by `slug`),
 * renders variables, validates required inputs, caches in memory per worker.
 */
import { AI_CONFIG } from "./config";
import { AIValidationError } from "./errors";

interface CachedPrompt {
  slug: string;
  version: number;
  systemPrompt: string;
  userTemplate: string | null;
  variables: string[];
  cachedAt: number;
}

const cache = new Map<string, CachedPrompt>();

async function loadPromptFromDb(slug: string): Promise<CachedPrompt | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("prompt_templates")
    .select("slug, version, system_prompt, user_prompt_template, input_schema")
    .eq("slug", slug)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AIValidationError(`Prompt load failed: ${error.message}`);
  if (!data) return null;

  const schema = (data.input_schema ?? null) as { required?: unknown } | null;
  const required = Array.isArray(schema?.required)
    ? (schema!.required as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  return {
    slug: data.slug,
    version: data.version,
    systemPrompt: data.system_prompt,
    userTemplate: data.user_prompt_template ?? null,
    variables: required,
    cachedAt: Date.now(),
  };
}

export async function getPrompt(slug: string): Promise<CachedPrompt | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.cachedAt < AI_CONFIG.cachePromptsTtlMs) return hit;
  const row = await loadPromptFromDb(slug);
  if (row) cache.set(slug, row);
  return row;
}

export function renderTemplate(template: string, variables: Record<string, unknown> = {}): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, name: string) => {
    const value = name
      .split(".")
      .reduce<unknown>((acc: unknown, key: string) => {
        if (acc == null || typeof acc !== "object") return undefined;
        return (acc as Record<string, unknown>)[key];
      }, variables);
    return value == null ? "" : String(value);
  });
}

export async function renderPrompt(
  slug: string,
  variables: Record<string, unknown> = {},
): Promise<{ text: string; version: number }> {
  const prompt = await getPrompt(slug);
  if (!prompt) throw new AIValidationError(`Prompt not found: ${slug}`);
  for (const required of prompt.variables) {
    if (variables[required] === undefined) {
      throw new AIValidationError(`Missing prompt variable: ${required}`);
    }
  }
  return { text: renderTemplate(prompt.systemPrompt, variables), version: prompt.version };
}

export function _clearPromptCache() {
  cache.clear();
}

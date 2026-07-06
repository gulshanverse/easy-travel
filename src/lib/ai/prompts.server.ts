/**
 * AI Core — Prompt Manager.
 * Loads versioned prompts from public.prompt_templates, renders variables,
 * validates required inputs, and caches compiled prompts in memory per worker.
 */
import { AI_CONFIG } from "./config";
import { AIValidationError } from "./errors";

interface CachedPrompt {
  key: string;
  version: number;
  template: string;
  variables: string[];
  cachedAt: number;
}

const cache = new Map<string, CachedPrompt>();

interface PromptRow {
  key: string;
  version: number;
  template: string;
  variables: string[] | null;
}

async function loadPromptFromDb(key: string): Promise<CachedPrompt | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("prompt_templates")
    .select("key, version, template, variables")
    .eq("key", key)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<PromptRow>();

  if (error) throw new AIValidationError(`Prompt load failed: ${error.message}`);
  if (!data) return null;
  return {
    key: data.key,
    version: data.version,
    template: data.template,
    variables: data.variables ?? [],
    cachedAt: Date.now(),
  };
}

/** Get a prompt by key. Returns null if not registered. */
export async function getPrompt(key: string): Promise<CachedPrompt | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.cachedAt < AI_CONFIG.cachePromptsTtlMs) return hit;
  const row = await loadPromptFromDb(key);
  if (row) cache.set(key, row);
  return row;
}

/** Render `{{var}}` placeholders. Missing required variables throw. */
export function renderTemplate(template: string, variables: Record<string, unknown> = {}): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, name) => {
    const value = name.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), variables);
    if (value == null) return "";
    return String(value);
  });
}

export async function renderPrompt(
  key: string,
  variables: Record<string, unknown> = {},
): Promise<{ text: string; version: number }> {
  const prompt = await getPrompt(key);
  if (!prompt) throw new AIValidationError(`Prompt not found: ${key}`);
  for (const required of prompt.variables) {
    if (variables[required] === undefined) {
      throw new AIValidationError(`Missing prompt variable: ${required}`);
    }
  }
  return { text: renderTemplate(prompt.template, variables), version: prompt.version };
}

/** Test-only cache reset. */
export function _clearPromptCache() {
  cache.clear();
}

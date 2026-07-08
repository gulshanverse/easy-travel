import { useState } from "react";
import { Send, Sparkles, Loader2, Command } from "lucide-react";
import { plannerClient } from "@/lib/capabilities/sdk";
import { plannerOutputToJourney, useStudio } from "./state/StudioContext";
import { cn } from "@/lib/utils";

export function AIComposer({ className }: { className?: string }) {
  const { actions } = useStudio();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const submit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    actions.setThinking("Companion is drafting your journey…");
    try {
      const out = await plannerClient.run({ prompt: text });
      actions.replaceJourney(plannerOutputToJourney(out), "AI plan");
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planner failed");
    } finally {
      actions.setThinking(null);
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-[26px] p-[1.5px] transition-all duration-500",
        focused || busy
          ? "bg-[conic-gradient(from_180deg,var(--brand-coral),var(--brand-sunrise),var(--brand-coral))] shadow-[var(--shadow-coral)]"
          : "bg-gradient-to-br from-border via-border/60 to-border/40 shadow-[var(--shadow-2)]",
        className,
      )}
    >
      <div className="rounded-[calc(26px-1.5px)] glass border border-border/40">
        <div className="flex items-start gap-2 p-2.5">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-coral to-brand-sunrise text-white shadow-[var(--shadow-1)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <label className="sr-only" htmlFor="studio-composer">Ask the travel companion</label>
          <textarea
            id="studio-composer"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
            rows={1}
            placeholder="Design your next journey — 'Five slow days in Lisbon in October, food and design.'"
            className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-snug outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !prompt.trim()}
            aria-label="Send to companion"
            className={cn(
              "press mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white transition-all duration-300",
              "bg-brand-ink shadow-[var(--shadow-2)]",
              "hover:-translate-y-0.5 hover:shadow-[var(--shadow-coral)]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-brand-mint" />
            Grounded in real data — never a hallucinated hotel.
          </span>
          <span className="inline-flex items-center gap-1"><Command className="h-3 w-3" />⏎</span>
        </div>
      </div>
    </div>
  );
}

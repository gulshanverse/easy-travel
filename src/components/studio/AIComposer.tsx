import { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { plannerClient } from "@/lib/capabilities/sdk";
import { plannerOutputToJourney, useStudio } from "./state/StudioContext";
import { cn } from "@/lib/utils";

export function AIComposer({ className }: { className?: string }) {
  const { actions } = useStudio();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    actions.setThinking("Planner is drafting your journey…");
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
    <div className={cn("rounded-2xl border border-border bg-background/95 shadow-lg backdrop-blur", className)}>
      <div className="flex items-start gap-2 p-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <label className="sr-only" htmlFor="studio-composer">Ask the planner</label>
        <textarea
          id="studio-composer"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
          rows={1}
          placeholder="Plan a 5-day trip to Lisbon in October for two, focus on food and design…"
          className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !prompt.trim()}
          aria-label="Send to planner"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {error && <p role="alert" className="px-3 pb-2 text-xs text-destructive">{error}</p>}
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">⌘⏎ to send · plans become structured cards</p>
    </div>
  );
}

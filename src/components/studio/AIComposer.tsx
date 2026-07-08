import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Loader2, Command, MapPin, CalendarDays, Wallet, Users, CloudSun, Thermometer, Clock } from "lucide-react";
import { plannerClient } from "@/lib/capabilities/sdk";
import { plannerOutputToJourney, useStudio } from "./state/StudioContext";
import { cn } from "@/lib/utils";

const rotatingPlaceholders = [
  "Design your next journey — 'Five slow days in Lisbon in October.'",
  "Try 'A weekend of onsen and soba near Tokyo.'",
  "Try 'Family week in Crete — beaches, ruins, no rental car.'",
  "Try 'Two weeks across Patagonia in shoulder season.'",
];

const contextChips = [
  { icon: MapPin, label: "Anywhere" },
  { icon: CalendarDays, label: "Flexible dates" },
  { icon: Users, label: "Just me" },
  { icon: Wallet, label: "Comfortable" },
];

/** Tiny inline "world model" — surfaces live suggestions as the user types.
 *  Purely presentational; grounded planning still happens on submit. */
const knownPlaces: Array<{ match: RegExp; name: string; region: string; season: string; temp: string }> = [
  { match: /\b(lisbon|portugal|porto|sintra)\b/i, name: "Lisbon", region: "Portugal", season: "Apr–Oct", temp: "18–26°C" },
  { match: /\b(tokyo|japan|kyoto|osaka|kamakura|ryokan)\b/i, name: "Japan", region: "Honshū", season: "Mar–May · Oct–Nov", temp: "14–22°C" },
  { match: /\b(bali|indonesia|ubud|canggu)\b/i, name: "Bali", region: "Indonesia", season: "Apr–Oct", temp: "26–30°C" },
  { match: /\b(iceland|reykjavik|aurora|northern lights)\b/i, name: "Iceland", region: "Nordic", season: "Sep–Mar", temp: "−2–4°C" },
  { match: /\b(marrakech|morocco|sahara|fez)\b/i, name: "Marrakech", region: "Morocco", season: "Oct–Apr", temp: "18–24°C" },
  { match: /\b(dolomites|alps|hut-to-hut)\b/i, name: "Dolomites", region: "Italy", season: "Jun–Sep", temp: "10–20°C" },
  { match: /\b(patagonia|argentina|chile|torres del paine)\b/i, name: "Patagonia", region: "South America", season: "Nov–Mar", temp: "6–18°C" },
  { match: /\b(crete|greece|santorini|athens|kefalonia)\b/i, name: "Greece", region: "Mediterranean", season: "May–Oct", temp: "20–30°C" },
  { match: /\b(norway|tromsø|fjord|lofoten)\b/i, name: "Norway", region: "Nordic", season: "Feb–Sep", temp: "0–15°C" },
];

function detectDuration(text: string): string | null {
  const m = text.match(/(\d+)\s*(day|days|night|nights|week|weeks|month|months)/i);
  if (!m) {
    if (/weekend/i.test(text)) return "2–3 nights";
    if (/honeymoon/i.test(text)) return "10–14 nights";
    return null;
  }
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u.startsWith("week")) return `${n * 7} nights`;
  if (u.startsWith("month")) return `~${n * 30} nights`;
  return `${n} ${n === 1 ? "night" : "nights"}`;
}

function detectBudget(text: string): string | null {
  const m = text.match(/([₹$€£¥])\s?([\d,]+)\s*(k)?/i);
  if (m) {
    const raw = parseInt(m[2].replace(/,/g, ""), 10);
    const val = m[3] ? raw * 1000 : raw;
    return `${m[1]}${val.toLocaleString()} budget`;
  }
  if (/\b(luxury|boutique|ryokan|aman|five[- ]star)\b/i.test(text)) return "Luxury tier";
  if (/\b(budget|cheap|backpack|hostel)\b/i.test(text)) return "Budget tier";
  return null;
}

export function AIComposer({ className }: { className?: string }) {
  const { actions } = useStudio();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Gently rotate the placeholder so the composer always feels alive.
  useEffect(() => {
    if (focused || prompt) return;
    const id = window.setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % rotatingPlaceholders.length),
      4200,
    );
    return () => window.clearInterval(id);
  }, [focused, prompt]);

  // Autosize the textarea for a natural conversational feel.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [prompt]);

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

  const active = focused || busy || prompt.length > 0;

  // Live intelligence — cheap, local, updates as you type
  const intel = useMemo(() => {
    if (!prompt.trim()) return null;
    const place = knownPlaces.find((p) => p.match.test(prompt));
    const duration = detectDuration(prompt);
    const budget = detectBudget(prompt);
    if (!place && !duration && !budget) return null;
    return { place, duration, budget };
  }, [prompt]);

  return (
    <div
      className={cn(
        "relative rounded-[28px] p-[1.5px] transition-all duration-500",
        active
          ? "bg-[conic-gradient(from_180deg,var(--brand-coral),var(--brand-sunrise),var(--brand-teal),var(--brand-coral))] shadow-[var(--shadow-coral)]"
          : "bg-gradient-to-br from-border via-border/60 to-border/40 shadow-[var(--shadow-2)]",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[calc(28px-1.5px)] glass border transition-colors duration-500",
          active ? "border-transparent" : "border-border/40",
        )}
      >
        <div className="flex items-start gap-2.5 p-2.5">
          <span
            className={cn(
              "relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-[var(--shadow-1)]",
              "bg-gradient-to-br from-brand-coral to-brand-sunrise",
              busy && "ring-pulse",
            )}
            aria-hidden
          >
            <Sparkles className={cn("h-4 w-4", busy && "animate-pulse")} />
          </span>

          <label className="sr-only" htmlFor="studio-composer">Ask the travel companion</label>
          <div className="relative flex-1">
            <textarea
              id="studio-composer"
              ref={taRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
              rows={1}
              placeholder={rotatingPlaceholders[placeholderIdx]}
              className="min-h-11 w-full resize-none bg-transparent px-2 py-2.5 text-[15px] leading-snug outline-none placeholder:text-muted-foreground placeholder:transition-opacity"
            />
            {/* Editorial caret cue — appears when empty & unfocused */}
            {!prompt && !focused && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-2 top-2.5 h-6 w-[2px] rounded-full bg-brand-coral/80 caret-blink"
              />
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy || !prompt.trim()}
            aria-label="Send to companion"
            className={cn(
              "press mt-0.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-sm font-medium text-white transition-all duration-300",
              "bg-brand-ink shadow-[var(--shadow-2)]",
              "hover:-translate-y-0.5 hover:shadow-[var(--shadow-coral)]",
              "disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-2)]",
              prompt.trim() && !busy && "sheen",
            )}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Drafting…</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Begin</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <p role="alert" className="px-4 pb-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {/* Live intel — companion previews what it's understanding as you type */}
        {intel && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 bg-brand-coral/[0.04] px-3 pt-2 pb-1.5 rise-in">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.22em] text-brand-coral/80">
              Reading
            </span>
            {intel.place && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-coral/30 bg-background px-2.5 py-1 text-[11px] text-foreground/85">
                  <MapPin className="h-3 w-3 text-brand-coral" /> {intel.place.name}
                  <span className="text-muted-foreground">· {intel.place.region}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground/75">
                  <CloudSun className="h-3 w-3 text-brand-sunrise" /> Best: {intel.place.season}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground/75">
                  <Thermometer className="h-3 w-3 text-brand-teal" /> {intel.place.temp}
                </span>
              </>
            )}
            {intel.duration && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground/75">
                <Clock className="h-3 w-3 text-brand-mint" /> {intel.duration}
              </span>
            )}
            {intel.budget && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground/75">
                <Wallet className="h-3 w-3 text-brand-coral" /> {intel.budget}
              </span>
            )}
          </div>
        )}

        {/* Context chips — the companion's default assumptions, editable feel */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 px-3 pt-2 pb-1.5">
          {contextChips.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="press inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-[11px] text-foreground/70 transition hover:-translate-y-0.5 hover:border-brand-coral/40 hover:text-foreground"
            >
              <Icon className="h-3 w-3 text-brand-coral" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-1 w-1 rounded-full", busy ? "bg-brand-coral animate-pulse" : "bg-brand-mint")} />
            {busy ? "Thinking · grounding · composing" : "Grounded in real data — never a hallucinated hotel"}
          </span>
          <span className="inline-flex items-center gap-1"><Command className="h-3 w-3" />⏎</span>
        </div>
      </div>
    </div>
  );
}

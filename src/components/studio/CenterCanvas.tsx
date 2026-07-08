import { useEffect, useMemo, useState } from "react";
import { useStudio, type StudioActivity } from "./state/StudioContext";
import { ActivityCard, AIThinkingCard } from "./cards";
import {
  Plus, Pencil, MapPin, Calendar, Wallet, Sparkles, ArrowRight,
  ChevronLeft, ChevronRight, Clock, CloudSun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import destTokyo from "@/assets/dest-tokyo.jpg";
import destBali from "@/assets/dest-bali.jpg";
import destIceland from "@/assets/dest-iceland.jpg";
import destMarrakech from "@/assets/dest-marrakech.jpg";
import destDolomites from "@/assets/dest-dolomites.jpg";
import destLisbon from "@/assets/dest-lisbon.jpg";
import heroOcean from "@/assets/hero-ocean.jpg";

const inspirations = [
  { img: destIceland, name: "Iceland", tag: "Aurora season", prompt: "A week chasing the northern lights in Iceland — geothermal, coastal, calm." },
  { img: destTokyo, name: "Tokyo", tag: "Neon rhythm", prompt: "Five days in Tokyo, food-first, one day in Kamakura." },
  { img: destBali, name: "Bali", tag: "Slow island", prompt: "Ten days in Bali: yoga, surfing, one temple pilgrimage." },
  { img: destMarrakech, name: "Marrakech", tag: "Colour & spice", prompt: "Four days in Marrakech, riads and souks, one desert night." },
  { img: destDolomites, name: "Dolomites", tag: "Alpine air", prompt: "Six-day hut-to-hut hike through the Dolomites, moderate difficulty." },
  { img: destLisbon, name: "Lisbon", tag: "Golden hour", prompt: "Long weekend in Lisbon: pastel de nata, viewpoints, Sintra day trip." },
];

function setComposerPrompt(prompt: string) {
  const el = document.getElementById("studio-composer") as HTMLTextAreaElement | null;
  if (!el) return;
  el.value = prompt;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

/* ─── EMPTY STATE — cinematic invitation ───────────────────────────────── */
function EmptyCanvas() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-40 pt-10 sm:px-10 sm:pt-14">
      {/* Hero — full-width cinematic photograph */}
      <section className="relative isolate overflow-hidden rounded-[2rem] shadow-[var(--shadow-3)] ring-1 ring-black/5">
        <img
          src={heroOcean}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover ken-burns"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-brand-ink/85 via-brand-ink/50 to-brand-ink/10" />
        <div className="absolute inset-0 -z-10 grain" aria-hidden />

        <div className="flex min-h-[520px] flex-col justify-end p-8 text-white sm:min-h-[600px] sm:p-14">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] text-white/85 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-coral animate-pulse" />
            Studio · A blank canvas
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[0.95] tracking-[-0.03em] sm:text-6xl md:text-7xl">
            Where would you like
            <span className="block font-editorial text-brand-sunrise">to wander next?</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80">
            Describe the trip you're dreaming of in the composer below.
            I'll draft it day by day, with real activities, budgets and weather.
          </p>
        </div>
      </section>

      {/* Editorial inspiration — magazine-style tiles */}
      <section className="mt-14">
        <div className="flex items-end justify-between gap-4 pb-6">
          <div>
            <p className="eyebrow">Inspiration</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em] sm:text-4xl">
              Six ways to begin.
            </h2>
          </div>
          <p className="hidden max-w-xs text-xs text-muted-foreground sm:block">
            Every tile is a prompt. Tap one and the Studio drafts it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inspirations.map((d, i) => (
            <button
              key={d.name}
              onClick={() => setComposerPrompt(d.prompt)}
              className="group relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-muted text-left ring-1 ring-border/50 transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-3)] hover:ring-brand-coral/30"
            >
              <img
                src={d.img}
                alt={d.name}
                loading={i < 3 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/25 to-transparent" />
              <div className="absolute inset-x-0 top-0 p-5">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 backdrop-blur">
                  {d.tag}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <h3 className="font-display text-4xl leading-none tracking-[-0.02em]">{d.name}</h3>
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-white/80 opacity-0 transition group-hover:opacity-100">
                  Draft this journey <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Prompt starters */}
      <section className="mt-14 rounded-[1.5rem] border border-border/60 bg-card/60 p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-coral to-brand-sunrise text-white shadow-[var(--shadow-2)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Companion</p>
            <p className="mt-1 font-display text-2xl tracking-[-0.02em]">Not sure where to start?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try one of these prompts. Every one becomes a full itinerary — with real activities, budget, and travel-day flow.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                "Plan a slow 7-day trip through Portugal for two — coastal, culinary, calm.",
                "I have 4 days and $800. Pick a place I've never been and design it.",
                "Family of four, spring break, warm weather, under 6-hour flight from NYC.",
                "Cinematic 10-day road trip through northern Italy — lakes and mountains.",
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => setComposerPrompt(p)}
                  className="group rounded-2xl border border-border/60 bg-background p-3 text-left text-sm text-foreground/85 transition hover:-translate-y-0.5 hover:border-brand-coral/40 hover:text-foreground hover:shadow-[var(--shadow-1)]"
                >
                  <span className="font-editorial text-base leading-snug text-foreground/90 group-hover:text-brand-coral">"</span>
                  {p}
                  <span className="font-editorial text-base leading-snug text-foreground/90 group-hover:text-brand-coral">"</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── DAY SPINE — horizontal, editorial, keyboard-navigable ────────────── */
function DaySpine({
  activeIndex, onSelect, days,
}: {
  activeIndex: number;
  onSelect: (i: number) => void;
  days: Array<{ id: string; dayNumber: number; title: string; activities: unknown[] }>;
}) {
  return (
    <nav aria-label="Day timeline" className="relative">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="eyebrow">Itinerary</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {days.length} {days.length === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={d.id}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group relative shrink-0 rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                  active
                    ? "border-brand-coral/50 bg-brand-coral/[0.06] shadow-[var(--shadow-1)]"
                    : "border-border/60 bg-card/50 hover:-translate-y-0.5 hover:border-brand-coral/30",
                )}
                style={{ minWidth: 148 }}
              >
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.22em]",
                    active ? "text-brand-coral" : "text-muted-foreground",
                  )}>
                    Day {d.dayNumber}
                  </span>
                  <span className="ml-auto rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {d.activities.length}
                  </span>
                </div>
                <div className="mt-1 truncate font-display text-lg leading-tight tracking-[-0.015em]">
                  {d.title}
                </div>
                {/* Density fill */}
                <div className="mt-2 flex gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, k) => (
                    <span
                      key={k}
                      className={cn(
                        "h-0.5 w-4 rounded-full transition-colors",
                        k < Math.min(5, d.activities.length)
                          ? active ? "bg-brand-coral" : "bg-brand-teal/70"
                          : "bg-muted",
                      )}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ─── ACTIVE DAY — editorial focus column ──────────────────────────────── */
function ActiveDay({
  day,
  isDragOver,
  dragActivityId,
  setDragActivityId,
  setDragOverDay,
}: {
  day: ReturnType<typeof useStudio>["state"]["journey"]["days"][number];
  isDragOver: boolean;
  dragActivityId: string | null;
  setDragActivityId: (id: string | null) => void;
  setDragOverDay: (id: string | null) => void;
}) {
  const { state, actions } = useStudio();

  const addBlank = () => {
    const activity: StudioActivity = {
      id: actions.nextActivityId(),
      kind: "activity",
      title: "New activity",
      description: "Click to edit",
      durationMinutes: 60,
    };
    actions.addActivity(day.id, activity);
    actions.select(activity.id);
  };

  const dayCostCents = day.activities.reduce((n, a) => n + (a.costCents ?? 0), 0);
  const dayCost = dayCostCents ? new Intl.NumberFormat(undefined, { style: "currency", currency: state.journey.currency, maximumFractionDigits: 0 }).format(dayCostCents / 100) : null;

  return (
    <section
      aria-label={day.title}
      onDragOver={(e) => { e.preventDefault(); setDragOverDay(day.id); }}
      onDragLeave={() => setDragOverDay(null)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOverDay(null);
        if (dragActivityId) actions.moveActivity(dragActivityId, day.id, day.activities.length);
      }}
      className={cn(
        "relative rounded-[1.5rem] border bg-card/60 p-6 transition-all sm:p-8",
        isDragOver ? "border-brand-coral/60 ring-2 ring-brand-coral/25 shadow-[var(--shadow-2)]" : "border-border/60",
      )}
    >
      {/* Day header — editorial */}
      <header className="mb-8 hairline pb-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Day {day.dayNumber}{day.date ? ` · ${day.date}` : ""}</p>
            <h2 className="mt-2 font-display text-4xl leading-[1] tracking-[-0.025em] sm:text-5xl">
              {day.title}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {day.activities.length} {day.activities.length === 1 ? "moment" : "moments"}
            </span>
            {dayCost && (
              <span className="inline-flex items-center gap-1 text-sm text-foreground/70">
                <Wallet className="h-3.5 w-3.5 text-brand-coral" /> {dayCost}
              </span>
            )}
          </div>
        </div>
      </header>

      {day.activities.length === 0 ? (
        <button
          type="button"
          onClick={addBlank}
          className="w-full rounded-2xl border border-dashed border-border/70 bg-background/50 py-16 text-center transition hover:border-brand-coral/50 hover:bg-background"
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Plus className="h-5 w-5" />
          </span>
          <p className="mt-4 font-display text-xl tracking-[-0.02em] text-foreground/85">
            A blank day.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop a recommendation from the right, or tap to add your first moment.
          </p>
        </button>
      ) : (
        <ol className="relative space-y-3 sm:pl-10">
          {/* Timeline vertical spine */}
          <span aria-hidden className="absolute left-3 top-2 bottom-2 hidden w-px bg-gradient-to-b from-brand-coral/50 via-border to-transparent sm:block" />
          {day.activities.map((a, idx) => (
            <li key={a.id} className="relative">
              {/* Time dot */}
              <span
                aria-hidden
                className="absolute -left-8 top-5 hidden h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-background ring-2 ring-brand-coral/70 sm:block"
              />
              <span
                aria-hidden
                className="absolute -left-[3.6rem] top-4 hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:block"
              >
                {a.startTime ?? String(idx + 1).padStart(2, "0")}
              </span>
              <ActivityCard
                activity={a}
                selected={state.selectedActivityId === a.id}
                onSelect={() => actions.select(a.id)}
                onRemove={() => actions.removeActivity(a.id)}
                onDragStart={() => setDragActivityId(a.id)}
                onDragEnd={() => setDragActivityId(null)}
              />
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={addBlank}
          className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-4 py-2 text-xs text-foreground/75 transition hover:-translate-y-0.5 hover:border-brand-coral/40 hover:text-brand-coral hover:shadow-[var(--shadow-1)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add a moment
        </button>
      </div>
    </section>
  );
}

/* ─── ROOT CANVAS ──────────────────────────────────────────────────────── */
export function CenterCanvas() {
  const { state, actions } = useStudio();
  const { journey, thinking } = state;
  const [editingTitle, setEditingTitle] = useState(false);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [dragActivityId, setDragActivityId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const totalActivities = useMemo(
    () => journey.days.reduce((n, d) => n + d.activities.length, 0),
    [journey.days],
  );

  const isEmpty = totalActivities === 0 && !journey.destination && journey.title === "Untitled journey";

  // Clamp active day if journey changes shape
  useEffect(() => {
    if (activeDayIdx >= journey.days.length) setActiveDayIdx(Math.max(0, journey.days.length - 1));
  }, [journey.days.length, activeDayIdx]);

  const activeDay = journey.days[activeDayIdx];

  if (isEmpty) {
    return (
      <main className="min-w-0 flex-1 overflow-y-auto">
        <EmptyCanvas />
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 pb-40 pt-8 sm:px-10 sm:pt-10">
        {/* Journey header — editorial magazine masthead */}
        <section className="mb-10">
          <div className="relative overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-2)] ring-1 ring-black/5">
            <div className="relative min-h-[360px] sm:min-h-[420px]">
              <img src={heroOcean} alt="" className="absolute inset-0 h-full w-full object-cover ken-burns" />
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-ink/85 via-brand-ink/45 to-brand-ink/10" />
              <div className="absolute inset-0 grain" aria-hidden />

              <div className="absolute inset-0 flex flex-col justify-end p-6 text-white sm:p-10">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-brand-sunrise">
                  Journey · Draft
                </p>
                {editingTitle ? (
                  <input
                    autoFocus
                    defaultValue={journey.title}
                    onBlur={(e) => { actions.patchJourney({ title: e.target.value || journey.title }); setEditingTitle(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingTitle(false); }}
                    className="mt-2 w-full max-w-3xl bg-transparent font-display text-4xl outline-none placeholder:text-white/40 sm:text-6xl"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="group mt-2 flex min-w-0 max-w-3xl items-start gap-3 text-left"
                    aria-label="Edit journey title"
                  >
                    <h1 className="truncate font-display text-4xl leading-[1] tracking-[-0.025em] sm:text-6xl">
                      {journey.title}
                    </h1>
                    <Pencil className="mt-3 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-80" />
                  </button>
                )}
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
                  {journey.summary}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">
                    <MapPin className="h-3 w-3 text-brand-sunrise" /> {journey.destination ?? "No destination"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">
                    <Calendar className="h-3 w-3 text-brand-sunrise" /> {journey.days.length} days
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">
                    <Clock className="h-3 w-3 text-brand-sunrise" /> {totalActivities} moments
                  </span>
                  {journey.budgetCents != null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">
                      <Wallet className="h-3 w-3 text-brand-sunrise" />
                      {(journey.budgetCents / 100).toLocaleString(undefined, { style: "currency", currency: journey.currency, maximumFractionDigits: 0 })}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">
                    <CloudSun className="h-3 w-3 text-brand-sunrise" /> Weather-aware
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {thinking && (
          <div className="mb-6 rise-in">
            <AIThinkingCard message={thinking} />
          </div>
        )}

        {/* Day spine */}
        <div className="mb-6">
          <DaySpine
            days={journey.days}
            activeIndex={activeDayIdx}
            onSelect={setActiveDayIdx}
          />
        </div>

        {/* Active day + prev/next */}
        {activeDay && (
          <div className="relative rise-in" key={activeDay.id}>
            <ActiveDay
              day={activeDay}
              isDragOver={dragOverDay === activeDay.id}
              dragActivityId={dragActivityId}
              setDragActivityId={setDragActivityId}
              setDragOverDay={setDragOverDay}
            />
            {/* Prev / Next */}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                disabled={activeDayIdx === 0}
                onClick={() => setActiveDayIdx((i) => Math.max(0, i - 1))}
                className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 transition hover:-translate-y-0.5 hover:border-brand-coral/40 hover:text-brand-coral disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous day
              </button>
              <button
                type="button"
                disabled={activeDayIdx >= journey.days.length - 1}
                onClick={() => setActiveDayIdx((i) => Math.min(journey.days.length - 1, i + 1))}
                className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 transition hover:-translate-y-0.5 hover:border-brand-coral/40 hover:text-brand-coral disabled:pointer-events-none disabled:opacity-40"
              >
                Next day <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

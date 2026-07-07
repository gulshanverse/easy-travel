import { useMemo, useState } from "react";
import { useStudio, type StudioActivity } from "./state/StudioContext";
import { ActivityCard, AIThinkingCard, MapCard } from "./cards";
import { Plus, Pencil, MapPin, Calendar, Users, Wallet, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import destTokyo from "@/assets/dest-tokyo.jpg";
import destBali from "@/assets/dest-bali.jpg";
import destIceland from "@/assets/dest-iceland.jpg";
import destMarrakech from "@/assets/dest-marrakech.jpg";
import destDolomites from "@/assets/dest-dolomites.jpg";
import destLisbon from "@/assets/dest-lisbon.jpg";
import heroOcean from "@/assets/hero-ocean.jpg";

const inspirations = [
  { img: destTokyo, name: "Tokyo", tag: "Neon nights", prompt: "5 days in Tokyo in April, focus on food and design" },
  { img: destBali, name: "Bali", tag: "Island calm", prompt: "10-day Bali retreat with yoga and beaches" },
  { img: destIceland, name: "Iceland", tag: "Aurora season", prompt: "A week chasing the northern lights in Iceland" },
  { img: destMarrakech, name: "Marrakech", tag: "Ancient medinas", prompt: "4 days exploring Marrakech riads and souks" },
  { img: destDolomites, name: "Dolomites", tag: "Alpine escape", prompt: "6-day hiking trip through the Dolomites" },
  { img: destLisbon, name: "Lisbon", tag: "Golden hour", prompt: "Long weekend in Lisbon with pastel de nata and viewpoints" },
];

function EmptyHero({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="space-y-10">
      {/* Cinematic greeting */}
      <section className="relative overflow-hidden rounded-[2rem] border border-border/40 shadow-[var(--shadow-3)]">
        <img src={heroOcean} alt="" className="h-[420px] w-full object-cover sm:h-[480px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/60 to-brand-navy/10" />
        <div className="absolute inset-0 grain" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12 text-white">
          <p className="text-[11px] uppercase tracking-[0.28em] text-brand-mint">Your studio · ready when you are</p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95] sm:text-6xl lg:text-7xl max-w-3xl">
            Where would you like to <em className="not-italic italic text-brand-mint">wander</em> next?
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80">
            Describe the trip you're dreaming of below — from a weekend escape to a month across a continent — and I'll draft it, day by day.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Weekend in Kyoto", "Family Bali plan", "Iceland ring road", "Slow Portugal"].map((p) => (
              <button
                key={p}
                onClick={() => onPick(p)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Inspiration grid — asymmetric editorial */}
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Inspiration</p>
            <h2 className="mt-1 font-display text-3xl">Trending journeys</h2>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">Tap a card to prompt the planner</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:grid-rows-2">
          {inspirations.map((d, i) => {
            const layout = [
              "lg:col-span-3 lg:row-span-2 aspect-[4/5] lg:aspect-auto",
              "lg:col-span-3 aspect-[16/9]",
              "lg:col-span-2 aspect-[4/5]",
              "lg:col-span-2 aspect-[4/5]",
              "lg:col-span-2 aspect-[4/5]",
              "hidden",
            ][i];
            return (
              <button
                key={d.name}
                onClick={() => onPick(d.prompt)}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border border-border/40 bg-muted text-left transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-3)]",
                  layout,
                )}
              >
                <img
                  src={d.img}
                  alt={d.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-brand-mint">{d.tag}</p>
                  <h3 className="mt-1 font-display text-3xl leading-none">{d.name}</h3>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs text-white/85 opacity-0 transition group-hover:opacity-100">
                    Draft this journey <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Prompt starters */}
      <section className="rounded-3xl border border-border/60 bg-card/60 p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Companion</p>
            <p className="font-display text-2xl leading-tight">Not sure where to start?</p>
            <p className="mt-1 text-sm text-muted-foreground">Try one of these prompts — I'll turn each into a full itinerary with real activities, budget, and travel-day flow.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                "Plan a slow 7-day trip through Portugal for two — coastal, culinary, calm.",
                "I have 4 days and $800. Pick a place I've never been and design it.",
                "Family of four, spring break, warm weather, under 6-hour flight from NYC.",
                "Cinematic 10-day road trip through northern Italy — lakes and mountains.",
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => onPick(p)}
                  className="rounded-2xl border border-border/60 bg-background p-3 text-left text-sm text-foreground/85 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-1)]"
                >
                  "{p}"
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CenterCanvas() {
  const { state, actions } = useStudio();
  const { journey, thinking } = state;
  const [editingTitle, setEditingTitle] = useState(false);
  const [dragActivityId, setDragActivityId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const totalActivities = useMemo(
    () => journey.days.reduce((n, d) => n + d.activities.length, 0),
    [journey.days],
  );

  const isEmpty = totalActivities === 0 && !journey.destination && journey.title === "Untitled journey";

  const addBlank = (dayId: string) => {
    const activity: StudioActivity = {
      id: actions.nextActivityId(),
      kind: "activity",
      title: "New activity",
      description: "Click to edit",
      durationMinutes: 60,
    };
    actions.addActivity(dayId, activity);
    actions.select(activity.id);
  };

  const setPrompt = (prompt: string) => {
    const el = document.getElementById("studio-composer") as HTMLTextAreaElement | null;
    if (el) {
      el.value = prompt;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    }
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pb-40 pt-6 sm:px-8 sm:pt-10">
        {isEmpty ? (
          <EmptyHero onPick={setPrompt} />
        ) : (
          <>
            {/* Journey hero */}
            <section className="mb-8 overflow-hidden rounded-[2rem] border border-border/40 shadow-[var(--shadow-2)]">
              <div className="relative">
                <img src={heroOcean} alt="" className="h-56 w-full object-cover sm:h-72" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/50 to-brand-navy/10" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-brand-mint">Journey</p>
                  {editingTitle ? (
                    <input
                      autoFocus
                      defaultValue={journey.title}
                      onBlur={(e) => { actions.patchJourney({ title: e.target.value || journey.title }); setEditingTitle(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingTitle(false); }}
                      className="mt-1 w-full bg-transparent font-display text-4xl outline-none placeholder:text-white/50 sm:text-5xl"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTitle(true)}
                      className="group mt-1 flex min-w-0 items-center gap-2 text-left"
                      aria-label="Edit journey title"
                    >
                      <h1 className="truncate font-display text-4xl leading-tight sm:text-5xl">{journey.title}</h1>
                      <Pencil className="h-4 w-4 opacity-0 transition group-hover:opacity-70" />
                    </button>
                  )}
                  <p className="mt-2 max-w-2xl text-sm text-white/80">{journey.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 backdrop-blur"><MapPin className="h-3 w-3" /> {journey.destination ?? "No destination"}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 backdrop-blur"><Calendar className="h-3 w-3" /> {journey.days.length} days</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 backdrop-blur"><Users className="h-3 w-3" /> {totalActivities} activities</span>
                    {journey.budgetCents != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 backdrop-blur"><Wallet className="h-3 w-3" /> {(journey.budgetCents / 100).toLocaleString(undefined, { style: "currency", currency: journey.currency, maximumFractionDigits: 0 })}</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {thinking && (
              <div className="mb-6">
                <AIThinkingCard message={thinking} />
              </div>
            )}

            {/* Overview: map takes the visual anchor */}
            <div className="mb-8">
              <MapCard destination={journey.destination} />
            </div>

            {/* Days — editorial timeline */}
            <div className="relative space-y-8">
              <div aria-hidden className="absolute left-[19px] top-2 bottom-2 hidden w-px bg-gradient-to-b from-primary/30 via-border to-transparent sm:block" />
              {journey.days.map((day) => (
                <section
                  key={day.id}
                  aria-label={day.title}
                  className={cn(
                    "relative rounded-3xl border bg-card/70 p-5 transition-all duration-300 sm:pl-14",
                    dragOverDay === day.id ? "border-primary/60 shadow-[var(--shadow-2)] ring-2 ring-primary/25" : "border-border/60",
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDay(day.id); }}
                  onDragLeave={() => setDragOverDay((d) => (d === day.id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDay(null);
                    if (dragActivityId) actions.moveActivity(dragActivityId, day.id, day.activities.length);
                  }}
                >
                  {/* Day marker on timeline */}
                  <span className="absolute left-2 top-6 hidden h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-display text-sm shadow-[var(--shadow-1)] sm:grid">
                    {day.dayNumber}
                  </span>

                  <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        Day {day.dayNumber}{day.date ? ` · ${day.date}` : ""}
                      </p>
                      <h2 className="mt-1 font-display text-2xl leading-tight">{day.title}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => addBlank(day.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground/80 transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-[var(--shadow-1)]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add activity
                    </button>
                  </header>

                  {day.activities.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addBlank(day.id)}
                      className="w-full rounded-2xl border border-dashed border-border/70 bg-background/50 py-8 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                    >
                      Drop a recommendation, or tap to add your first activity of the day.
                    </button>
                  ) : (
                    <ul className="space-y-2.5">
                      {day.activities.map((a) => (
                        <li key={a.id}>
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
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

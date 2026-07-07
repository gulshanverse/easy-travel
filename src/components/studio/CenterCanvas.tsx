import { useMemo, useState } from "react";
import { useStudio, type StudioActivity } from "./state/StudioContext";
import { ActivityCard, AIThinkingCard, MapCard, JourneyCard } from "./cards";
import { Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Journey header */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Journey</p>
          <div className="mt-1 flex items-start gap-2">
            {editingTitle ? (
              <input
                autoFocus
                defaultValue={journey.title}
                onBlur={(e) => { actions.patchJourney({ title: e.target.value || journey.title }); setEditingTitle(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingTitle(false); }}
                className="w-full bg-transparent font-display text-3xl sm:text-4xl outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="group flex min-w-0 items-center gap-2 text-left"
                aria-label="Edit journey title"
              >
                <h1 className="truncate font-display text-3xl sm:text-4xl">{journey.title}</h1>
                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-60" />
              </button>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{journey.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">{journey.destination ?? "No destination"}</span>
            <span className="rounded-full border border-border px-2 py-0.5">{journey.days.length} days</span>
            <span className="rounded-full border border-border px-2 py-0.5">{totalActivities} activities</span>
          </div>
        </div>

        {thinking && (
          <div className="mb-6">
            <AIThinkingCard message={thinking} />
          </div>
        )}

        {/* Overview */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <MapCard destination={journey.destination} />
          <JourneyCard
            title={journey.destination ?? "Set destination"}
            subtitle={journey.startDate ? `${journey.startDate} → ${journey.endDate ?? ""}` : "Add dates in the composer"}
          />
        </div>

        {/* Days */}
        <div className="space-y-6">
          {journey.days.map((day) => (
            <section
              key={day.id}
              aria-label={day.title}
              className={cn(
                "rounded-2xl border bg-background p-4 transition",
                dragOverDay === day.id ? "border-primary ring-1 ring-primary" : "border-border",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverDay(day.id); }}
              onDragLeave={() => setDragOverDay((d) => (d === day.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDay(null);
                if (dragActivityId) actions.moveActivity(dragActivityId, day.id, day.activities.length);
              }}
            >
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Day {day.dayNumber}{day.date ? ` · ${day.date}` : ""}</p>
                  <h2 className="text-lg font-semibold">{day.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => addBlank(day.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/60"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </header>
              {day.activities.length === 0 ? (
                <button
                  type="button"
                  onClick={() => addBlank(day.id)}
                  className="w-full rounded-xl border border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground"
                >
                  Drop a recommendation, or click to add an activity
                </button>
              ) : (
                <ul className="space-y-2">
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
      </div>
    </main>
  );
}

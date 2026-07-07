import { useStudio } from "./state/StudioContext";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomTimeline() {
  const { state, actions } = useStudio();
  const collapsed = state.bottomCollapsed;
  const days = state.journey.days;
  const snaps = [...state.history].slice(-6).reverse();

  return (
    <footer className="relative z-20 shrink-0 border-t border-border/60 bg-background/70 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Timeline & versions
        </div>
        <button
          type="button"
          aria-label={collapsed ? "Expand timeline" : "Collapse timeline"}
          onClick={() => actions.toggle("bottom")}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {!collapsed && (
        <div className="grid gap-3 px-4 pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          {/* Day chips with mini distribution bars */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const filled = Math.min(6, d.activities.length);
              return (
                <div
                  key={d.id}
                  className={cn(
                    "shrink-0 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 transition hover:-translate-y-0.5 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">{d.dayNumber}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] leading-none text-foreground/85 truncate max-w-[8rem]">{d.title}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{d.activities.length} items</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-0.5" aria-hidden>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1 w-3 rounded-full",
                          i < filled ? "bg-gradient-to-r from-brand-teal to-brand-mint" : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Version snapshots */}
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            {snaps.length === 0 ? (
              <span className="text-[11px] text-muted-foreground/70">No history yet — every edit is saved.</span>
            ) : snaps.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-mint" />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </footer>
  );
}

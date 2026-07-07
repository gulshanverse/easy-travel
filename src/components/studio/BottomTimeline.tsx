import { useStudio } from "./state/StudioContext";
import { TimelineCard } from "./cards";
import { ChevronDown, ChevronUp, History } from "lucide-react";

export function BottomTimeline() {
  const { state, actions } = useStudio();
  const collapsed = state.bottomCollapsed;
  const days = state.journey.days;
  const snaps = [...state.history].slice(-6).reverse();

  return (
    <footer className="shrink-0 border-t border-border bg-background">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Timeline & versions
        </div>
        <button
          type="button"
          aria-label={collapsed ? "Expand timeline" : "Collapse timeline"}
          onClick={() => actions.toggle("bottom")}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {!collapsed && (
        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <TimelineCard key={d.id} label={`Day ${d.dayNumber} · ${d.activities.length} items`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            {snaps.length === 0 ? (
              <span className="text-[11px] text-muted-foreground/60">No history yet</span>
            ) : snaps.map((s) => (
              <span key={s.id} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </footer>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { useStudio, type RightPanelTab } from "./state/StudioContext";
import { cn } from "@/lib/utils";

interface CommandItem { id: string; label: string; hint?: string; run: () => void }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions, state } = useStudio();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);

  const items: CommandItem[] = useMemo(() => {
    const setTab = (tab: RightPanelTab, label: string) =>
      ({ id: `tab-${tab}`, label, hint: "Right panel", run: () => actions.setRight(tab) });
    return [
      { id: "undo", label: "Undo", hint: "⌘Z", run: () => actions.undo() },
      { id: "redo", label: "Redo", hint: "⌘⇧Z", run: () => actions.redo() },
      { id: "toggle-left", label: "Toggle left panel", run: () => actions.toggle("left") },
      { id: "toggle-right", label: "Toggle right panel", run: () => actions.toggle("right") },
      { id: "toggle-bottom", label: "Toggle timeline", run: () => actions.toggle("bottom") },
      { id: "add-day", label: "Add a day", run: () => {
        const n = state.journey.days.length + 1;
        actions.replaceJourney({
          ...state.journey,
          days: [...state.journey.days, { id: `${state.journey.id}_d${n}`, dayNumber: n, title: `Day ${n}`, date: null, activities: [] }],
        }, "Added day");
      }},
      setTab("intel", "Show intelligence"),
      setTab("budget", "Show budget"),
      setTab("weather", "Show weather"),
      setTab("risks", "Show risks"),
      setTab("recs", "Show recommendations"),
      setTab("packing", "Show packing"),
    ];
  }, [actions, state.journey]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(needle));
  }, [items, q]);

  useEffect(() => { setI(0); }, [q, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const it = filtered[i];
        if (it) { it.run(); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, i, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-background/60 backdrop-blur-sm pt-24" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Command palette"
        className="mx-auto w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or run…"
            className="flex-1 bg-transparent py-1 text-sm outline-none"
          />
          <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Command className="h-3 w-3" />K
          </span>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.map((it, idx) => (
            <li key={it.id}>
              <button
                type="button"
                onMouseEnter={() => setI(idx)}
                onClick={() => { it.run(); onClose(); }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                  idx === i ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span>{it.label}</span>
                {it.hint && <span className="text-[11px] text-muted-foreground">{it.hint}</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}

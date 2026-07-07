import { useStudio } from "./state/StudioContext";
import {
  MessageSquare, Bookmark, LayoutTemplate, Clock, FolderHeart, Pin, Brain,
  PanelLeftClose, PanelLeftOpen, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const sections: { icon: ReactNode; label: string; items: string[] }[] = [
  { icon: <MessageSquare className="h-3.5 w-3.5" />, label: "Conversations", items: ["Weekend in Kyoto", "Family Bali plan"] },
  { icon: <Bookmark className="h-3.5 w-3.5" />, label: "Saved journeys", items: ["Iceland ring road"] },
  { icon: <LayoutTemplate className="h-3.5 w-3.5" />, label: "Templates", items: ["Solo city break", "Honeymoon 10d"] },
  { icon: <Clock className="h-3.5 w-3.5" />, label: "Recent", items: ["Paris draft"] },
  { icon: <FolderHeart className="h-3.5 w-3.5" />, label: "Collections", items: ["Bucket list"] },
  { icon: <Pin className="h-3.5 w-3.5" />, label: "Pinned", items: [] },
  { icon: <Brain className="h-3.5 w-3.5" />, label: "AI memories", items: ["Prefers boutique hotels", "Loves food-first travel"] },
];

export function LeftPanel() {
  const { state, actions } = useStudio();
  if (state.leftCollapsed) {
    return (
      <aside className="hidden lg:flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border/60 bg-background/60 py-3 backdrop-blur">
        <button
          type="button"
          aria-label="Expand workspace"
          onClick={() => actions.toggle("left")}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="New journey"
          className="mt-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-1)]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </aside>
    );
  }
  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border/60 bg-background/70 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace</p>
          <p className="mt-0.5 font-display text-lg leading-tight">Your journeys</p>
        </div>
        <button
          type="button"
          aria-label="Collapse workspace"
          onClick={() => actions.toggle("left")}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          className="group inline-flex w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-teal px-4 py-3 text-left text-sm text-white shadow-[var(--shadow-2)] transition-all hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span>Start a new journey</span>
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest">New</span>
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-6">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="text-foreground/60">{s.icon}</span><span>{s.label}</span>
            </div>
            <ul className="space-y-0.5">
              {s.items.length === 0 ? (
                <li className="px-3 py-1.5 text-xs text-muted-foreground/60">Nothing here yet</li>
              ) : s.items.map((it) => (
                <li key={it}>
                  <button
                    type="button"
                    className={cn(
                      "group flex w-full items-center gap-2 truncate rounded-xl px-3 py-2 text-left text-sm text-foreground/85 transition",
                      "hover:bg-muted",
                    )}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
                    <span className="truncate">{it}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

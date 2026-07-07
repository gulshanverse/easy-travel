import { useStudio } from "./state/StudioContext";
import { MessageSquare, Bookmark, LayoutTemplate, Clock, FolderHeart, Pin, Brain, Zap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const sections: { icon: ReactNode; label: string; items: string[] }[] = [
  { icon: <MessageSquare className="h-3.5 w-3.5" />, label: "Conversations", items: ["Weekend in Kyoto", "Family Bali plan"] },
  { icon: <Bookmark className="h-3.5 w-3.5" />, label: "Saved journeys", items: ["Iceland ring road"] },
  { icon: <LayoutTemplate className="h-3.5 w-3.5" />, label: "Templates", items: ["Solo city break", "Honeymoon 10d"] },
  { icon: <Clock className="h-3.5 w-3.5" />, label: "Recent", items: ["Paris draft"] },
  { icon: <FolderHeart className="h-3.5 w-3.5" />, label: "Collections", items: ["Bucket list"] },
  { icon: <Pin className="h-3.5 w-3.5" />, label: "Pinned", items: [] },
  { icon: <Brain className="h-3.5 w-3.5" />, label: "AI memories", items: ["Prefers boutique hotels"] },
];

export function LeftPanel() {
  const { state, actions } = useStudio();
  if (state.leftCollapsed) {
    return (
      <aside className="hidden lg:flex w-12 shrink-0 flex-col items-center border-r border-border bg-background py-3">
        <button
          type="button"
          aria-label="Expand left panel"
          onClick={() => actions.toggle("left")}
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Workspace
        </div>
        <button
          type="button"
          aria-label="Collapse left panel"
          onClick={() => actions.toggle("left")}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((s) => (
          <div key={s.label} className="mt-3">
            <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.icon}<span>{s.label}</span>
            </div>
            <ul>
              {s.items.length === 0 ? (
                <li className="px-2 py-1.5 text-xs text-muted-foreground/60">Empty</li>
              ) : s.items.map((it) => (
                <li key={it}>
                  <button
                    type="button"
                    className={cn("w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-foreground/80 hover:bg-muted")}
                  >
                    {it}
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

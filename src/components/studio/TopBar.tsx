import { Search, Command, Share2, Download, Sun, Undo2, Redo2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStudio } from "./state/StudioContext";
import { UserMenu } from "@/components/site/UserMenu";

function BrandMark() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 pr-1">
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-ink via-brand-navy to-brand-teal shadow-[var(--shadow-1)]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-sunrise" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 14c3-8 11-8 14 0" />
          <circle cx="10" cy="7" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-display text-[17px] tracking-[-0.02em]">Easy Trip</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">Studio</span>
      </span>
    </Link>
  );
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { state, actions } = useStudio();
  const j = state.journey;
  const hasJourney = !(j.title === "Untitled journey" && j.days.length <= 1);
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 glass px-4">
      <BrandMark />

      {hasJourney && (
        <>
          <span className="mx-2 hidden h-4 w-px bg-border/70 md:block" aria-hidden />
          <div className="hidden min-w-0 items-baseline gap-2 md:flex">
            <span className="truncate font-display text-[15px] tracking-[-0.015em]">{j.title}</span>
            <span className="shrink-0 rounded-full bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Draft
            </span>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-auto flex min-w-0 max-w-md items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3.5 py-1.5 text-left text-xs text-muted-foreground transition hover:border-brand-coral/40 hover:bg-background"
        aria-label="Search or run command"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden truncate sm:inline">Search or ask anything…</span>
        <span className="ml-auto hidden shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <Command className="h-3 w-3" />K
        </span>
      </button>

      <div className="hidden sm:flex items-center gap-0.5 rounded-full border border-border/60 bg-background/60 p-0.5">
        <button
          type="button"
          aria-label="Undo"
          onClick={actions.undo}
          disabled={state.history.length === 0}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          onClick={actions.redo}
          disabled={state.future.length === 0}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="hidden md:flex items-center gap-1">
        <button aria-label="Share journey" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Share2 className="h-3.5 w-3.5" /></button>
        <button aria-label="Export journey" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Download className="h-3.5 w-3.5" /></button>
        <button aria-label="Toggle theme" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Sun className="h-3.5 w-3.5" /></button>
      </div>

      <UserMenu />
    </header>
  );
}

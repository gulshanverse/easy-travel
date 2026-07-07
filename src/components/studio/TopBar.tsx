import { Search, Command, Bell, Share2, Download, Sun, Undo2, Redo2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStudio } from "./state/StudioContext";
import { UserMenu } from "@/components/site/UserMenu";
import { Button } from "@/components/ui/button";

function BrandMark() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 pr-2">
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy via-brand-teal to-brand-mint shadow-[var(--shadow-1)]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 14c3-8 11-8 14 0" />
          <circle cx="10" cy="7" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-display text-[17px] tracking-tight">Easy Trip</span>
        <span className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">Studio</span>
      </span>
    </Link>
  );
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { state, actions } = useStudio();
  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 glass px-4">
      <BrandMark />

      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-background"
        aria-label="Search or run command"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search destinations, journeys, or ask anything…</span>
        <span className="ml-auto hidden shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
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
        <button aria-label="Notifications" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="h-4 w-4" /></button>
        <button aria-label="Share journey" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Share2 className="h-4 w-4" /></button>
        <button aria-label="Export journey" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Download className="h-4 w-4" /></button>
        <button aria-label="Toggle theme" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Sun className="h-4 w-4" /></button>
      </div>

      <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex rounded-full text-muted-foreground">
        <Link to="/dashboard">Exit Studio</Link>
      </Button>
      <UserMenu />
    </header>
  );
}

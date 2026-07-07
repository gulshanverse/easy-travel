import { Search, Command, Bell, Share2, Download, Sun, Undo2, Redo2, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStudio } from "./state/StudioContext";
import { UserMenu } from "@/components/site/UserMenu";
import { Button } from "@/components/ui/button";

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { state, actions } = useStudio();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-3">
      <Link to="/" className="flex items-center gap-2 pr-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="hidden sm:inline font-display text-lg leading-none">Studio</span>
      </Link>

      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
        aria-label="Search or run command"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search or run command…</span>
        <span className="ml-auto hidden shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
          <Command className="h-3 w-3" />K
        </span>
      </button>

      <div className="hidden sm:flex items-center gap-1">
        <button
          type="button"
          aria-label="Undo"
          onClick={actions.undo}
          disabled={state.history.length === 0}
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          onClick={actions.redo}
          disabled={state.future.length === 0}
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted disabled:opacity-40"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden md:flex items-center gap-1">
        <button aria-label="Notifications" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Bell className="h-4 w-4" /></button>
        <button aria-label="Share" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Share2 className="h-4 w-4" /></button>
        <button aria-label="Export" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Download className="h-4 w-4" /></button>
        <button aria-label="Theme" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Sun className="h-4 w-4" /></button>
      </div>

      <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
        <Link to="/dashboard">Exit</Link>
      </Button>
      <UserMenu />
    </header>
  );
}

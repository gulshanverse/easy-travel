import { useEffect, useState } from "react";
import { StudioProvider } from "./state/StudioContext";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { CenterCanvas } from "./CenterCanvas";
import { RightPanel } from "./RightPanel";
import { BottomTimeline } from "./BottomTimeline";
import { AIComposer } from "./AIComposer";
import { CommandPalette } from "./CommandPalette";
import { useStudio } from "./state/StudioContext";
import { Compass, Wallet, CloudSun, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Keyboard shortcuts: ⌘K palette, ⌘Z undo, ⌘⇧Z redo, ⌘/ toggle right. */
function Shortcuts({ onPalette }: { onPalette: () => void }) {
  const { actions } = useStudio();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); onPalette(); }
      else if (meta && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); actions.redo(); }
      else if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); actions.undo(); }
      else if (meta && e.key === "/") { e.preventDefault(); actions.toggle("right"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, onPalette]);
  return null;
}

function MobileNav({ onCompose }: { onCompose: () => void }) {
  const { actions } = useStudio();
  return (
    <nav
      aria-label="Studio quick actions"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-border bg-background/95 py-1.5 shadow-lg backdrop-blur xl:hidden"
    >
      <button onClick={() => actions.setRight("recs")} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted" aria-label="Recommendations"><Compass className="h-5 w-5" /></button>
      <button onClick={() => actions.setRight("budget")} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted" aria-label="Budget"><Wallet className="h-5 w-5" /></button>
      <button onClick={onCompose} className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md" aria-label="AI composer"><Sparkles className="h-5 w-5" /></button>
      <button onClick={() => actions.setRight("weather")} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted" aria-label="Weather"><CloudSun className="h-5 w-5" /></button>
      <button onClick={() => actions.toggle("bottom")} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted" aria-label="Timeline"><Compass className="h-5 w-5" /></button>
    </nav>
  );
}

export function StudioShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileCompose, setMobileCompose] = useState(false);
  return (
    <StudioProvider>
      <a href="#studio-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground">Skip to canvas</a>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <LeftPanel />
          <div id="studio-main" className="flex min-w-0 flex-1 flex-col">
            <CenterCanvas />
            {/* Desktop composer docked bottom-center */}
            <div className="hidden lg:block px-4 pb-4">
              <AIComposer />
            </div>
          </div>
          <RightPanel />
        </div>
        <BottomTimeline />
        <MobileNav onCompose={() => setMobileCompose((v) => !v)} />
        {mobileCompose && (
          <div className="fixed inset-x-3 bottom-20 z-40 xl:hidden">
            <AIComposer />
          </div>
        )}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <Shortcuts onPalette={() => setPaletteOpen(true)} />
        <div className={cn("pb-20 xl:pb-0")} />
      </div>
    </StudioProvider>
  );
}

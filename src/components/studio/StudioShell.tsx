import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { StudioProvider, useStudio } from "./state/StudioContext";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { CenterCanvas } from "./CenterCanvas";
import { RightPanel } from "./RightPanel";
import { AIComposer } from "./AIComposer";
import { CommandPalette } from "./CommandPalette";
import { Compass, Wallet, CloudSun, Sparkles, Layers } from "lucide-react";

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

/** Read `?prompt=...` handoff from landing page into the composer once. */
function PromptHandoff() {
  const search = useSearch({ strict: false }) as { prompt?: string };
  useEffect(() => {
    const p = search?.prompt;
    if (!p) return;
    const t = setTimeout(() => {
      const el = document.getElementById("studio-composer") as HTMLTextAreaElement | null;
      if (el) {
        el.value = p;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.focus();
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search?.prompt]);
  return null;
}

function MobileNav({ onCompose }: { onCompose: () => void }) {
  const { actions } = useStudio();
  const items: [string, React.ReactNode, () => void][] = [
    ["Recs", <Compass className="h-5 w-5" />, () => actions.setRight("recs")],
    ["Budget", <Wallet className="h-5 w-5" />, () => actions.setRight("budget")],
    ["Weather", <CloudSun className="h-5 w-5" />, () => actions.setRight("weather")],
    ["Intel", <Layers className="h-5 w-5" />, () => actions.setRight("intel")],
  ];
  return (
    <nav
      aria-label="Studio quick actions"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full glass border border-border/60 py-1.5 shadow-[var(--shadow-3)] xl:hidden"
    >
      {items.slice(0, 2).map(([label, icon, fn]) => (
        <button key={label} onClick={fn} className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={label}>{icon}</button>
      ))}
      <button
        onClick={onCompose}
        className="press grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-gradient-to-br from-brand-coral to-brand-sunrise text-white shadow-[var(--shadow-coral)] ring-4 ring-background"
        aria-label="Ask the AI companion"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {items.slice(2).map(([label, icon, fn]) => (
        <button key={label} onClick={fn} className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={label}>{icon}</button>
      ))}
    </nav>
  );
}

export function StudioShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileCompose, setMobileCompose] = useState(false);
  return (
    <StudioProvider>
      <PromptHandoff />
      <a href="#studio-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground">Skip to canvas</a>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        {/* Ambient studio atmosphere — calmer, sand-warm */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-brand-coral/10 blur-[140px]" />
          <div className="absolute -bottom-40 right-0 h-[560px] w-[560px] rounded-full bg-brand-teal/12 blur-[160px]" />
          <div className="absolute top-1/2 left-0 h-[360px] w-[360px] rounded-full bg-brand-sunrise/8 blur-[120px]" />
        </div>

        <TopBar onOpenPalette={() => setPaletteOpen(true)} />

        <div className="flex min-h-0 flex-1">
          <LeftPanel />
          <div id="studio-main" className="relative flex min-w-0 flex-1 flex-col">
            <CenterCanvas />
            {/* Floating AI composer — anchored to canvas bottom */}
            <div className="pointer-events-none hidden lg:block">
              <div className="pointer-events-auto absolute inset-x-0 bottom-5 mx-auto w-full max-w-3xl px-6">
                <AIComposer />
              </div>
            </div>
          </div>
          <RightPanel />
        </div>

        <MobileNav onCompose={() => setMobileCompose((v) => !v)} />
        {mobileCompose && (
          <div className="fixed inset-x-3 bottom-24 z-40 xl:hidden">
            <AIComposer />
          </div>
        )}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <Shortcuts onPalette={() => setPaletteOpen(true)} />
      </div>
    </StudioProvider>
  );
}

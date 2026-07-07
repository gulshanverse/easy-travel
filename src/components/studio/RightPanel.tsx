import { useStudio, type RightPanelTab, type StudioActivity } from "./state/StudioContext";
import {
  BudgetCard, WeatherCard, RiskCard, RecommendationCard, PackingCard,
} from "./cards";
import { PanelRightClose, PanelRightOpen, Sparkles, Wallet, CloudSun, ShieldAlert, Backpack, BookMarked, Compass, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useMemo } from "react";

const tabs: { id: RightPanelTab; label: string; icon: ReactNode }[] = [
  { id: "intel", label: "Intel", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "budget", label: "Budget", icon: <Wallet className="h-3.5 w-3.5" /> },
  { id: "weather", label: "Weather", icon: <CloudSun className="h-3.5 w-3.5" /> },
  { id: "risks", label: "Risks", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  { id: "recs", label: "Recs", icon: <Compass className="h-3.5 w-3.5" /> },
  { id: "packing", label: "Packing", icon: <Backpack className="h-3.5 w-3.5" /> },
  { id: "visa", label: "Visa", icon: <BookMarked className="h-3.5 w-3.5" /> },
  { id: "safety", label: "Safety", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

export function RightPanel() {
  const { state, actions } = useStudio();

  const spentCents = useMemo(() => {
    let n = 0;
    for (const d of state.journey.days) for (const a of d.activities) if (a.costCents) n += a.costCents;
    return n;
  }, [state.journey]);

  if (state.rightCollapsed) {
    return (
      <aside className="hidden xl:flex w-12 shrink-0 flex-col items-center border-l border-border bg-background py-3">
        <button
          type="button"
          aria-label="Expand right panel"
          onClick={() => actions.toggle("right")}
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  const currentTab = state.rightPanel;

  const addAsActivity = (title: string) => {
    const day = state.journey.days[0];
    if (!day) return;
    const a: StudioActivity = { id: actions.nextActivityId(), kind: "activity", title, durationMinutes: 60 };
    actions.addActivity(day.id, a);
  };

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Travel Intelligence</div>
        <button
          type="button"
          aria-label="Collapse right panel"
          onClick={() => actions.toggle("right")}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => actions.setRight(t.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition",
              currentTab === t.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        {currentTab === "intel" && (
          <>
            <BudgetCard totalCents={state.journey.budgetCents} currency={state.journey.currency} spentCents={spentCents} />
            <WeatherCard location={state.journey.destination ?? undefined} summary="Waiting for destination" />
            <RecommendationCard title="Sunset walk in the old town" reason="Popular for first-time visitors" confidence={0.86} onAdd={() => addAsActivity("Sunset walk in the old town")} />
            <RiskCard severity="low" title="Travel advisory" message="No active advisories detected." />
          </>
        )}
        {currentTab === "budget" && (
          <BudgetCard totalCents={state.journey.budgetCents} currency={state.journey.currency} spentCents={spentCents} />
        )}
        {currentTab === "weather" && (
          <WeatherCard location={state.journey.destination ?? undefined} summary="Add a destination to fetch forecast" />
        )}
        {currentTab === "risks" && (
          <>
            <RiskCard severity="low" title="Health" message="No health warnings for this region." />
            <RiskCard severity="medium" title="Weather" message="Check for seasonal storms near travel dates." />
          </>
        )}
        {currentTab === "recs" && (
          <>
            <RecommendationCard title="Boutique stay with rooftop views" reason="Matches your comfort preference" confidence={0.78} onAdd={() => addAsActivity("Boutique stay with rooftop views")} />
            <RecommendationCard title="Chef-led food tour" reason="Highly rated for couples" confidence={0.82} onAdd={() => addAsActivity("Chef-led food tour")} />
          </>
        )}
        {currentTab === "packing" && (
          <PackingCard items={["BookMarked", "Adapter", "Light jacket", "Sunscreen", "Walking shoes", "Reusable bottle"]} />
        )}
        {currentTab === "visa" && (
          <RiskCard severity="low" title="Visa" message="Set destination and nationality to check requirements." />
        )}
        {currentTab === "safety" && (
          <RiskCard severity="low" title="Safety" message="Overall safety index will appear once a destination is selected." />
        )}
      </div>
    </aside>
  );
}

import { useStudio, type RightPanelTab, type StudioActivity } from "./state/StudioContext";
import {
  BudgetCard, WeatherCard, RiskCard, RecommendationCard, PackingCard, StudioCard, CardHeader,
} from "./cards";
import {
  PanelRightClose, PanelRightOpen, Sparkles, Wallet, CloudSun, ShieldAlert,
  Backpack, BookMarked, Compass, ShieldCheck, Globe2, Clock3,
} from "lucide-react";
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

function InfoTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-foreground/70">{icon}</span> {label}
      </div>
      <div className="mt-2 font-display text-xl leading-tight">{value}</div>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function RightPanel() {
  const { state, actions } = useStudio();

  const spentCents = useMemo(() => {
    let n = 0;
    for (const d of state.journey.days) for (const a of d.activities) if (a.costCents) n += a.costCents;
    return n;
  }, [state.journey]);

  if (state.rightCollapsed) {
    return (
      <aside className="hidden xl:flex w-14 shrink-0 flex-col items-center gap-2 border-l border-border/60 bg-background/60 py-3 backdrop-blur">
        <button
          type="button"
          aria-label="Expand travel intelligence"
          onClick={() => actions.toggle("right")}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {tabs.slice(0, 6).map((t) => (
            <button
              key={t.id}
              onClick={() => { actions.setRight(t.id); actions.toggle("right"); }}
              aria-label={t.label}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t.icon}
            </button>
          ))}
        </div>
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
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-border/60 bg-background/70 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Travel Intelligence</p>
          <p className="mt-0.5 font-display text-lg leading-tight">Companion insights</p>
        </div>
        <button
          type="button"
          aria-label="Collapse right panel"
          onClick={() => actions.toggle("right")}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs — pill chips, horizontal scroll */}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto px-4 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => actions.setRight(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition-all",
              currentTab === t.id
                ? "border-primary/50 bg-primary/[0.08] text-foreground shadow-[var(--shadow-1)]"
                : "border-border/50 bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:text-foreground",
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {currentTab === "intel" && (
          <>
            <WeatherCard location={state.journey.destination ?? undefined} summary="Waiting for destination" />
            <BudgetCard totalCents={state.journey.budgetCents} currency={state.journey.currency} spentCents={spentCents} />
            <div className="grid grid-cols-2 gap-2">
              <InfoTile icon={<Globe2 className="h-3.5 w-3.5" />} label="Currency" value={state.journey.currency} hint="Auto-detected" />
              <InfoTile icon={<Clock3 className="h-3.5 w-3.5" />} label="Timezone" value={state.journey.destination ? "Local" : "—"} hint="Set on destination" />
            </div>
            <RecommendationCard
              title="Sunset walk in the old town"
              reason="Loved by first-time visitors for the golden hour views."
              confidence={0.86}
              onAdd={() => addAsActivity("Sunset walk in the old town")}
            />
            <RiskCard severity="low" title="Travel advisory" message="No active advisories detected for your destination." />
          </>
        )}
        {currentTab === "budget" && (
          <>
            <BudgetCard totalCents={state.journey.budgetCents} currency={state.journey.currency} spentCents={spentCents} />
            <StudioCard>
              <CardHeader icon={<Wallet className="h-4 w-4" />} title="Confidence" meta="Estimate quality" />
              <div className="mt-3 space-y-2 text-xs">
                {[
                  ["Flights", 82],
                  ["Stays", 74],
                  ["Food", 66],
                  ["Activities", 58],
                ].map(([label, pct]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{pct}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-mint" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </StudioCard>
          </>
        )}
        {currentTab === "weather" && (
          <>
            <WeatherCard location={state.journey.destination ?? undefined} summary="Add a destination to fetch a forecast." />
            <StudioCard>
              <CardHeader icon={<CloudSun className="h-4 w-4" />} title="This week" meta="Sample outlook" />
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                {["M","T","W","T","F","S","S"].map((d, i) => (
                  <div key={i} className="rounded-lg bg-muted/60 py-2">
                    <div>{d}</div>
                    <div className="mt-1 font-display text-sm text-foreground">{[22,24,23,25,26,24,22][i]}°</div>
                  </div>
                ))}
              </div>
            </StudioCard>
          </>
        )}
        {currentTab === "risks" && (
          <>
            <RiskCard severity="low" title="Health" message="No health warnings for this region." />
            <RiskCard severity="medium" title="Weather" message="Check for seasonal storms near your travel dates." />
            <RiskCard severity="low" title="Political" message="Stable travel conditions reported." />
          </>
        )}
        {currentTab === "recs" && (
          <>
            <RecommendationCard title="Boutique stay with rooftop views" reason="Matches your comfort preference" confidence={0.78} onAdd={() => addAsActivity("Boutique stay with rooftop views")} />
            <RecommendationCard title="Chef-led food tour" reason="Highly rated by couples on your dates" confidence={0.82} onAdd={() => addAsActivity("Chef-led food tour")} />
            <RecommendationCard title="Sunrise viewpoint hike" reason="Weather window opens on day 3" confidence={0.71} onAdd={() => addAsActivity("Sunrise viewpoint hike")} />
          </>
        )}
        {currentTab === "packing" && (
          <PackingCard items={["Passport", "Adapter", "Light jacket", "Sunscreen", "Walking shoes", "Reusable bottle", "Camera", "Meds kit"]} />
        )}
        {currentTab === "visa" && (
          <>
            <RiskCard severity="low" title="Visa" message="Set destination and nationality to check requirements." />
            <StudioCard>
              <CardHeader icon={<BookMarked className="h-4 w-4" />} title="Documents" meta="Travel checklist" />
              <ul className="mt-3 space-y-1.5 text-sm">
                {["Valid passport (6+ months)", "Return ticket confirmation", "Travel insurance", "Proof of accommodation"].map((it) => (
                  <li key={it} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-foreground/85">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60" /> {it}
                  </li>
                ))}
              </ul>
            </StudioCard>
          </>
        )}
        {currentTab === "safety" && (
          <>
            <RiskCard severity="low" title="Safety index" message="Overall safety looks strong for this destination." />
            <StudioCard>
              <CardHeader icon={<ShieldCheck className="h-4 w-4" />} title="Emergency" meta="Local contacts" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[["Police", "112"], ["Ambulance", "112"], ["Fire", "112"], ["Embassy", "—"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-muted/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
                    <div className="mt-0.5 font-display text-lg text-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </StudioCard>
          </>
        )}
      </div>
    </aside>
  );
}

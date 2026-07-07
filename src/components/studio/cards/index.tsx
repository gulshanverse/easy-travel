/**
 * Journey Studio — reusable card primitives.
 * All cards are presentational; behaviour lives in parent panels.
 * Redesigned for premium travel-workspace feel: cinematic imagery,
 * layered elevation, editorial typography, alive micro-interactions.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Plane, Hotel, Utensils, Bus, StickyNote, MapPin, Wallet, CloudSun,
  AlertTriangle, Sparkles, Backpack, Route as RouteIcon, Compass, Loader2,
  Clock,
} from "lucide-react";
import type { ActivityKind, StudioActivity } from "../state/StudioContext";

// ---------- Shell ----------
export function StudioCard({
  children, className, tone = "default", interactive = false, onClick, ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "accent" | "danger" | "aurora" | "ghost";
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const toneCls =
    tone === "muted" ? "bg-muted/50 border-transparent"
    : tone === "accent" ? "bg-accent/[0.08] border-accent/25"
    : tone === "danger" ? "bg-destructive/[0.06] border-destructive/30"
    : tone === "aurora" ? "aurora-bg border-transparent text-white"
    : tone === "ghost" ? "bg-transparent border-border/60"
    : "bg-card border-border/70";
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      aria-label={ariaLabel}
      className={cn(
        "group relative rounded-3xl border p-5 transition-all duration-300",
        "shadow-[var(--shadow-1)]",
        toneCls,
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ icon, title, meta, right }: { icon?: ReactNode; title: string; meta?: string; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-500 group-hover:scale-105">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium tracking-tight text-foreground">{title}</h3>
          {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ---------- Activity ----------
const activityIcon: Record<ActivityKind, ReactNode> = {
  flight: <Plane className="h-4 w-4" />,
  hotel: <Hotel className="h-4 w-4" />,
  restaurant: <Utensils className="h-4 w-4" />,
  transport: <Bus className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
  activity: <Compass className="h-4 w-4" />,
};

const activityAccent: Record<ActivityKind, string> = {
  flight: "from-sky-500/15 to-transparent text-sky-600 dark:text-sky-300",
  hotel: "from-violet-500/15 to-transparent text-violet-600 dark:text-violet-300",
  restaurant: "from-amber-500/15 to-transparent text-amber-600 dark:text-amber-300",
  transport: "from-emerald-500/15 to-transparent text-emerald-600 dark:text-emerald-300",
  note: "from-slate-500/15 to-transparent text-slate-600 dark:text-slate-300",
  activity: "from-teal-500/15 to-transparent text-teal-600 dark:text-teal-300",
};

function fmtMoney(cents?: number, ccy = "USD") {
  if (typeof cents !== "number") return null;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(0)} ${ccy}`; }
}

export function ActivityCard({
  activity, selected, onSelect, onRemove, draggable = true, onDragStart, onDragEnd,
}: {
  activity: StudioActivity;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const money = fmtMoney(activity.costCents, activity.currency);
  const accent = activityAccent[activity.kind];
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "group relative flex items-start gap-4 rounded-2xl border bg-card p-4 transition-all duration-300",
        "hover:-translate-y-[1px] hover:shadow-[var(--shadow-2)]",
        selected
          ? "border-primary/60 ring-2 ring-primary/25 shadow-[var(--shadow-2)]"
          : "border-border/60",
      )}
    >
      <span
        className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br",
          accent,
        )}
        aria-hidden
      >
        {activityIcon[activity.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="truncate text-[15px] font-medium tracking-tight text-foreground">{activity.title}</p>
          {activity.startTime && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {activity.startTime}
            </span>
          )}
        </div>
        {activity.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{activity.description}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {activity.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{activity.location}</span>
          )}
          {activity.durationMinutes ? <span>{activity.durationMinutes}m</span> : null}
          {money && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
              {money}
            </span>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${activity.title}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 transition group-hover:opacity-100 text-[11px] text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      )}
    </div>
  );
}

// ---------- Timeline / Journey ----------
export function TimelineCard({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group shrink-0 rounded-2xl border px-4 py-2.5 text-left text-xs transition-all duration-300",
        active
          ? "border-primary/50 bg-primary/[0.06] text-foreground shadow-[var(--shadow-1)]"
          : "border-border/60 bg-card/60 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function JourneyCard({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <StudioCard>
      <CardHeader icon={<RouteIcon className="h-4 w-4" />} title={title} meta={subtitle} right={right} />
    </StudioCard>
  );
}

// ---------- Intelligence cards ----------
export function BudgetCard({ totalCents, currency, spentCents = 0 }: { totalCents: number | null; currency: string; spentCents?: number }) {
  const pct = totalCents ? Math.min(100, Math.round((spentCents / totalCents) * 100)) : 0;
  const remaining = totalCents ? totalCents - spentCents : 0;
  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <StudioCard>
      <div className="flex items-center gap-5">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0">
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" className="text-muted" strokeWidth="7" />
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke="url(#budget-grad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - (C * pct) / 100}
              transform="rotate(-90 50 50)"
              className="transition-all duration-700 ease-out"
            />
            <defs>
              <linearGradient id="budget-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand-teal)" />
                <stop offset="100%" stopColor="var(--brand-mint)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative text-center">
            <div className="font-display text-2xl leading-none">{pct}%</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">used</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budget</div>
          <div className="mt-1 font-display text-2xl leading-tight">
            {totalCents ? fmtMoney(totalCents, currency) : "Not set"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {totalCents ? <>{fmtMoney(spentCents, currency)} spent · <span className="text-foreground/80">{fmtMoney(remaining, currency)} left</span></> : "Add a total in the composer"}
          </div>
        </div>
      </div>
    </StudioCard>
  );
}

export function WeatherCard({ location, summary, tempC }: { location?: string; summary?: string; tempC?: number }) {
  return (
    <StudioCard tone="aurora" className="overflow-hidden">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" aria-hidden />
      <div className="absolute -left-4 -bottom-6 h-24 w-24 rounded-full bg-black/20 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-white float-slow">
          <CloudSun className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Forecast</p>
          <p className="mt-1 font-display text-2xl leading-tight text-white">{location ?? "Awaiting destination"}</p>
          <p className="mt-1 text-sm text-white/80">{summary ?? "Add a destination to see your forecast."}</p>
        </div>
        {tempC != null && (
          <div className="text-right text-white">
            <div className="font-display text-4xl leading-none">{Math.round(tempC)}°</div>
            <div className="text-[11px] uppercase tracking-widest text-white/70">Celsius</div>
          </div>
        )}
      </div>
    </StudioCard>
  );
}

export function RiskCard({ severity, title, message }: { severity: "low" | "medium" | "high"; title: string; message: string }) {
  const tone = severity === "high" ? "danger" : severity === "medium" ? "accent" : "muted";
  const dot = severity === "high" ? "bg-destructive" : severity === "medium" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <StudioCard tone={tone}>
      <div className="flex items-start gap-3">
        <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-background/70">
          <AlertTriangle className="h-4 w-4 text-foreground/70" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
            <p className="text-[15px] font-medium tracking-tight">{title}</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </StudioCard>
  );
}

export function RecommendationCard({ title, reason, confidence, onAdd }: { title: string; reason: string; confidence: number; onAdd?: () => void }) {
  const pct = Math.round(confidence * 100);
  return (
    <StudioCard interactive={!!onAdd} onClick={onAdd} ariaLabel={`Add recommendation ${title}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-teal/25 to-brand-mint/20 text-brand-teal dark:text-brand-mint">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-medium tracking-tight">{title}</p>
            <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {pct}% match
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          {onAdd && (
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
              + Add to journey
            </div>
          )}
        </div>
      </div>
    </StudioCard>
  );
}

export function PackingCard({ items }: { items: string[] }) {
  return (
    <StudioCard>
      <CardHeader icon={<Backpack className="h-4 w-4" />} title="Packing" meta={`${items.length} essentials`} />
      <ul className="mt-4 grid grid-cols-2 gap-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
            {it}
          </li>
        ))}
      </ul>
    </StudioCard>
  );
}

export function MapCard({ destination }: { destination: string | null }) {
  return (
    <StudioCard tone="ghost" className="overflow-hidden p-0">
      <div className="relative aspect-[16/10] w-full">
        {/* Stylised topographic map surface */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-deep to-brand-teal" />
        <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 400 250" preserveAspectRatio="none" aria-hidden>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <path d="M0 160 Q80 140 140 170 T280 160 T400 180" stroke="white" strokeWidth="1" fill="none" opacity="0.6" />
          <path d="M0 120 Q100 100 180 130 T400 140" stroke="white" strokeWidth="0.8" fill="none" opacity="0.5" />
          <path d="M0 200 Q120 190 220 210 T400 220" stroke="white" strokeWidth="0.8" fill="none" opacity="0.4" />
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-brand-navy shadow-lg">
            <MapPin className="h-4 w-4" />
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/60" />
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">Destination</p>
            <p className="truncate font-display text-2xl leading-tight">{destination ?? "Choose where you're going"}</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] backdrop-blur">
            Explore map
          </span>
        </div>
      </div>
    </StudioCard>
  );
}

export function FlightCard({ from, to, time }: { from?: string; to?: string; time?: string }) {
  return (
    <StudioCard>
      <CardHeader icon={<Plane className="h-4 w-4" />} title={`${from ?? "Origin"} → ${to ?? "Destination"}`} meta={time ?? "Add flight details"} />
    </StudioCard>
  );
}

export function HotelCard({ name, nights }: { name?: string; nights?: number }) {
  return (
    <StudioCard>
      <CardHeader icon={<Hotel className="h-4 w-4" />} title={name ?? "Accommodation"} meta={nights ? `${nights} nights` : "Add stay"} />
    </StudioCard>
  );
}

export function AIThinkingCard({ message }: { message: string }) {
  return (
    <StudioCard tone="accent" className="overflow-hidden">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-accent/20 blur-2xl breathe" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">AI companion</p>
          <p className="text-sm text-foreground/90">{message}</p>
        </div>
      </div>
    </StudioCard>
  );
}
